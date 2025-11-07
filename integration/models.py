from django.db import models
from django.conf import settings


class LabelStudioProject(models.Model):
    """
    Represents a Label Studio project imported into Viberate.
    """
    # Foreign key to researcher who imported this project
    researcher = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='labelstudio_projects'
    )

    # Label Studio project details
    labelstudio_project_id = models.IntegerField(unique=True)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)

    # Label configuration (JSON schema defining annotation interface)
    label_config = models.JSONField(
        blank=True,
        null=True,
        help_text="Label Studio labeling configuration"
    )

    # Project metadata
    is_active = models.BooleanField(
        default=True,
        help_text="Whether tasks from this project should be available to annotators"
    )
    total_tasks = models.IntegerField(default=0)
    completed_tasks = models.IntegerField(default=0)

    # Sync tracking
    last_synced_at = models.DateTimeField(null=True, blank=True)
    sync_enabled = models.BooleanField(
        default=True,
        help_text="Auto-sync tasks from Label Studio"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['labelstudio_project_id']),
            models.Index(fields=['researcher', 'is_active']),
        ]

    def __str__(self):
        return f"{self.title} (LS Project #{self.labelstudio_project_id})"

    def update_task_counts(self):
        """Update total and completed task counts from related tasks."""
        from tasks.models import Task
        self.total_tasks = self.tasks.count()
        self.completed_tasks = self.tasks.filter(
            status='completed'
        ).count()
        self.save(update_fields=['total_tasks', 'completed_tasks'])


class LabelStudioConnection(models.Model):
    """
    Stores Label Studio connection credentials for researchers.
    """
    researcher = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='labelstudio_connection'
    )

    labelstudio_url = models.URLField(
        help_text="Label Studio instance URL"
    )
    api_token = models.CharField(
        max_length=255,
        help_text="API token for Label Studio"
    )

    is_verified = models.BooleanField(
        default=False,
        help_text="Whether the connection has been verified"
    )
    last_verified_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['researcher']),
        ]

    def __str__(self):
        return f"LS Connection for {self.researcher.username}"
