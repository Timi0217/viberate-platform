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

        return {
            'tasks_imported': tasks_imported,
            'tasks_updated': tasks_updated
        }

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
