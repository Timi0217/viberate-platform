from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q
from .models import Task, TaskAssignment
from .serializers import (
    TaskSerializer,
    TaskAssignmentSerializer,
    TaskClaimSerializer,
    AnnotationSubmitSerializer,
    AssignmentReviewSerializer
)
from integration.labelstudio_client import create_client_for_user


class TaskViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for viewing and claiming tasks."""
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        queryset = Task.objects.all()

        # Researchers see tasks from their projects
        if user.is_researcher():
            queryset = queryset.filter(project__researcher=user)
        # Annotators see available tasks from active projects
        else:
            queryset = queryset.filter(
                project__is_active=True,
                status='available'
            )

        # Filter by project
        project_id = self.request.query_params.get('project')
        if project_id:
            queryset = queryset.filter(project_id=project_id)

        # Filter by status
        task_status = self.request.query_params.get('status')
        if task_status:
            queryset = queryset.filter(status=task_status)

        return queryset.select_related('project')

    @action(detail=False, methods=['post'])
    def claim(self, request):
        """Claim a task for annotation."""
        if not request.user.is_annotator():
            return Response(
                {'error': 'Only annotators can claim tasks.'},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = TaskClaimSerializer(
            data=request.data,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)

        task = serializer.context['task']
        assignment = task.assign_to(request.user)

        return Response(
            TaskAssignmentSerializer(assignment).data,
            status=status.HTTP_201_CREATED
        )


class TaskAssignmentViewSet(viewsets.ModelViewSet):
    """ViewSet for managing task assignments."""
    serializer_class = TaskAssignmentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        queryset = TaskAssignment.objects.all()

        # Annotators only see their own assignments
        if user.is_annotator():
            queryset = queryset.filter(annotator=user)
        # Researchers see assignments for their projects
        elif user.is_researcher():
            queryset = queryset.filter(task__project__researcher=user)

        # Filter by status
        assignment_status = self.request.query_params.get('status')
        if assignment_status:
            queryset = queryset.filter(status=assignment_status)

        return queryset.select_related('task', 'task__project', 'annotator')

    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        """Annotator accepts the assignment."""
        assignment = self.get_object()

        if assignment.annotator != request.user:
            return Response(
                {'error': 'You can only accept your own assignments.'},
                status=status.HTTP_403_FORBIDDEN
            )

        if assignment.status != 'assigned':
            return Response(
                {'error': f'Cannot accept assignment in status: {assignment.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        assignment.accept()
        return Response(TaskAssignmentSerializer(assignment).data)

    @action(detail=True, methods=['post'])
    def start(self, request, pk=None):
        """Annotator starts working on the assignment."""
        assignment = self.get_object()

        if assignment.annotator != request.user:
            return Response(
                {'error': 'You can only start your own assignments.'},
                status=status.HTTP_403_FORBIDDEN
            )

        if assignment.status not in ['assigned', 'accepted']:
            return Response(
                {'error': f'Cannot start assignment in status: {assignment.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        assignment.start()
        return Response(TaskAssignmentSerializer(assignment).data)

    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        """Annotator submits completed annotation."""
        assignment = self.get_object()

        if assignment.annotator != request.user:
            return Response(
                {'error': 'You can only submit your own assignments.'},
                status=status.HTTP_403_FORBIDDEN
            )

        if assignment.status != 'in_progress':
            return Response(
                {'error': f'Cannot submit assignment in status: {assignment.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = AnnotationSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        annotation_result = serializer.validated_data['annotation_result']
        assignment.submit(annotation_result)

        # Optionally sync to Label Studio immediately
        if request.data.get('sync_to_labelstudio', False):
            try:
                self._sync_to_labelstudio(assignment)
            except Exception as e:
                # Log error but don't fail the submission
                pass

        return Response(TaskAssignmentSerializer(assignment).data)

    @action(detail=True, methods=['post'])
    def review(self, request, pk=None):
        """Researcher reviews and approves/rejects the annotation."""
        assignment = self.get_object()

        if assignment.task.project.researcher != request.user:
            return Response(
                {'error': 'Only the project researcher can review assignments.'},
                status=status.HTTP_403_FORBIDDEN
            )

        if assignment.status != 'submitted':
            return Response(
                {'error': f'Cannot review assignment in status: {assignment.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = AssignmentReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        action = serializer.validated_data['action']
        quality_score = serializer.validated_data.get('quality_score')
        feedback = serializer.validated_data.get('feedback', '')

        if action == 'approve':
            assignment.approve(quality_score=quality_score, feedback=feedback)
            # Sync to Label Studio
            try:
                self._sync_to_labelstudio(assignment)
            except Exception as e:
                # Log error but don't fail the approval
                pass
        else:
            assignment.reject(feedback=feedback)

        return Response(TaskAssignmentSerializer(assignment).data)

    def _sync_to_labelstudio(self, assignment):
        """Sync approved annotation back to Label Studio."""
        project = assignment.task.project
        client = create_client_for_user(project.researcher)

        # Create annotation in Label Studio
        response = client.create_annotation(
            task_id=assignment.task.labelstudio_task_id,
            annotation_data=assignment.annotation_result,
            completed_by=project.researcher.labelstudio_user_id
        )

        # Store Label Studio annotation ID
        if response.get('id'):
            assignment.labelstudio_annotation_id = response['id']
            assignment.save(update_fields=['labelstudio_annotation_id'])

    @action(detail=False, methods=['get'])
    def my_assignments(self, request):
        """Get current user's assignments."""
        if not request.user.is_annotator():
            return Response(
                {'error': 'Only annotators have assignments.'},
                status=status.HTTP_403_FORBIDDEN
            )

        assignments = self.get_queryset().filter(
            annotator=request.user
        ).order_by('-created_at')

        serializer = self.get_serializer(assignments, many=True)
        return Response(serializer.data)
