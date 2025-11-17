from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from .models import LabelStudioProject, LabelStudioConnection
from .serializers import (
    LabelStudioProjectSerializer,
    LabelStudioConnectionSerializer,
    ProjectImportSerializer
)
from .labelstudio_client import create_client_for_user
from tasks.models import Task


class LabelStudioConnectionViewSet(viewsets.ModelViewSet):
    """ViewSet for managing Label Studio connections."""
    serializer_class = LabelStudioConnectionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return LabelStudioConnection.objects.filter(researcher=self.request.user)

    def perform_create(self, serializer):
        """
        Create connection and verify it.
        Also stores Label Studio user ID in the User model if available.
        Automatically replaces any existing connection for this user.
        """
        # Delete any existing connections for this user
        LabelStudioConnection.objects.filter(researcher=self.request.user).delete()

        connection = serializer.save(
            researcher=self.request.user,
            last_verified_at=timezone.now()
        )

        # Store Label Studio user ID if available
        labelstudio_user_id = serializer.context.get('labelstudio_user_id')
        if labelstudio_user_id:
            user = self.request.user
            user.labelstudio_user_id = labelstudio_user_id
            user.save(update_fields=['labelstudio_user_id'])

    @action(detail=True, methods=['post'])
    def verify(self, request, pk=None):
        """Verify Label Studio connection."""
        connection = self.get_object()
        try:
            from .labelstudio_client import LabelStudioClient
            client = LabelStudioClient(
                api_url=connection.labelstudio_url,
                api_token=connection.api_token
            )
            user_info = client.verify_connection()
            connection.is_verified = True
            connection.last_verified_at = timezone.now()
            connection.save()
            return Response({
                'status': 'verified',
                'user_info': user_info
            })
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class LabelStudioProjectViewSet(viewsets.ModelViewSet):
    """ViewSet for managing Label Studio projects."""
    serializer_class = LabelStudioProjectSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_researcher():
            return LabelStudioProject.objects.filter(researcher=user)
        # Annotators see all active projects
        return LabelStudioProject.objects.filter(is_active=True)

    def perform_update(self, serializer):
        """Override to recalculate pricing when budget is updated."""
        project = serializer.save()
        # If budget was updated, recalculate price per task
        if 'budget_usdc' in serializer.validated_data:
            project.update_pricing()
        return project

    @action(detail=False, methods=['post'])
    def import_project(self, request):
        """Import a project from Label Studio."""
        serializer = ProjectImportSerializer(
            data=request.data,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)

        # Get project data from context (set during validation)
        ls_project = serializer.context['labelstudio_project']

        # Create project in Viberate
        project = LabelStudioProject.objects.create(
            researcher=request.user,
            labelstudio_project_id=ls_project['id'],
            title=ls_project.get('title', f"Project {ls_project['id']}"),
            description=ls_project.get('description', ''),
            label_config=ls_project.get('label_config'),
            is_active=True
        )

        # Trigger initial sync
        self._sync_project_tasks(project)

        return Response(
            LabelStudioProjectSerializer(project).data,
            status=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=['post'])
    def sync(self, request, pk=None):
        """Sync tasks from Label Studio for this project."""
        project = self.get_object()

        if not project.researcher == request.user:
            return Response(
                {'error': 'Only the project owner can sync.'},
                status=status.HTTP_403_FORBIDDEN
            )

        try:
            result = self._sync_project_tasks(project)
            return Response({
                'status': 'synced',
                'tasks_imported': result['tasks_imported'],
                'tasks_updated': result['tasks_updated']
            })
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    def _sync_project_tasks(self, project):
        """Helper to sync tasks from Label Studio."""
        client = create_client_for_user(project.researcher)
        sync_data = client.sync_project(project.labelstudio_project_id)

        tasks_imported = 0
        tasks_updated = 0

        for ls_task in sync_data['tasks']:
            task, created = Task.objects.update_or_create(
                project=project,
                labelstudio_task_id=ls_task['id'],
                defaults={
                    'data': ls_task.get('data', {}),
                    'status': 'available'
                }
            )
            if created:
                tasks_imported += 1
            else:
                tasks_updated += 1

        project.last_synced_at = timezone.now()
        project.update_task_counts()
        project.update_pricing()  # Recalculate price per task based on new task count

        return {
            'tasks_imported': tasks_imported,
            'tasks_updated': tasks_updated
        }

    @action(detail=True, methods=['post'])
    def publish(self, request, pk=None):
        """Publish the project to make tasks available to annotators."""
        project = self.get_object()

        if not project.researcher == request.user:
            return Response(
                {'error': 'Only the project owner can publish.'},
                status=status.HTTP_403_FORBIDDEN
            )

        try:
            project.publish()
            return Response({
                'status': 'published',
                'message': f'Project "{project.title}" is now live and available to annotators.'
            })
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['post'])
    def unpublish(self, request, pk=None):
        """Unpublish the project to remove tasks from annotator availability."""
        project = self.get_object()

        if not project.researcher == request.user:
            return Response(
                {'error': 'Only the project owner can unpublish.'},
                status=status.HTTP_403_FORBIDDEN
            )

        project.unpublish()
        return Response({
            'status': 'unpublished',
            'message': f'Project "{project.title}" has been removed from the network.'
        })

    @action(detail=False, methods=['get'])
    def available_projects(self, request):
        """List available projects from Label Studio (not yet imported)."""
        if not hasattr(request.user, 'labelstudio_connection'):
            return Response(
                {'error': 'Please configure Label Studio connection first.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            client = create_client_for_user(request.user)
            ls_projects = client.get_projects()

            # Filter out already imported projects
            imported_ids = set(
                LabelStudioProject.objects.filter(
                    researcher=request.user
                ).values_list('labelstudio_project_id', flat=True)
            )

            available = [
                p for p in ls_projects
                if p['id'] not in imported_ids
            ]

            return Response(available)
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=False, methods=['get'])
    def published_projects(self, request):
        """List all published projects with available task counts for annotators."""
        from django.db.models import Count, Q

        # Get all published projects with available task count
        projects = LabelStudioProject.objects.filter(
            is_active=True,
            is_published=True
        ).annotate(
            available_tasks_count=Count(
                'tasks',
                filter=Q(tasks__status='available')
            )
        ).filter(
            available_tasks_count__gt=0  # Only show projects with available tasks
        )

        # Build response
        result = []
        for project in projects:
            result.append({
                'id': project.id,
                'title': project.title,
                'description': project.description,
                'available_tasks_count': project.available_tasks_count,
                'price_per_task': float(project.price_per_task),
                'budget_usdc': float(project.budget_usdc),
            })

        return Response(result)

    @action(detail=False, methods=['post'])
    def fix_all_tasks(self, request):
        """Set all tasks to 'available' status for all published projects."""
        # Get all published projects for this user
        published_projects = LabelStudioProject.objects.filter(
            researcher=request.user,
            is_published=True
        )

        results = []
        total_updated = 0

        for project in published_projects:
            # Update ALL tasks to available
            updated = Task.objects.filter(project=project).update(status='available')
            total_updated += updated

            results.append({
                'project': project.title,
                'tasks_updated': updated
            })

        return Response({
            'status': 'success',
            'total_tasks_updated': total_updated,
            'projects': results
        })

    @action(detail=False, methods=['get'])
    def debug_tasks(self, request):
        """Debug endpoint to show task visibility."""
        from tasks.models import Task
        from collections import defaultdict

        # Get all projects
        projects = LabelStudioProject.objects.all()

        result = {
            'total_projects': projects.count(),
            'projects': []
        }

        for project in projects:
            tasks = Task.objects.filter(project=project)
            total_tasks = tasks.count()

            # Count by status
            status_counts = defaultdict(int)
            for task in tasks:
                status_counts[task.status] += 1

            result['projects'].append({
                'id': project.id,
                'title': project.title,
                'researcher': project.researcher.email,
                'is_active': project.is_active,
                'is_published': project.is_published,
                'budget_usdc': str(project.budget_usdc),
                'total_tasks': total_tasks,
                'status_breakdown': dict(status_counts)
            })

        # Simulate annotator query
        annotator_tasks = Task.objects.filter(
            project__is_active=True,
            project__is_published=True
        ).select_related('project')

        annotator_view = defaultdict(lambda: defaultdict(int))
        for task in annotator_tasks:
            annotator_view[task.project.title][task.status] += 1

        result['annotator_view'] = {
            'total_visible_tasks': annotator_tasks.count(),
            'by_project': dict(annotator_view)
        }

        return Response(result)
