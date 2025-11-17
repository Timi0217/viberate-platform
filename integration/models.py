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
    is_published = models.BooleanField(
        default=False,
        help_text="Whether this project is published and available for annotators. Requires budget > 0"
    )
    total_tasks = models.IntegerField(default=0)
    completed_tasks = models.IntegerField(default=0)

    # Budget and pricing
    budget_usdc = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0.00,
        help_text="Total budget allocated for this project in USDC"
    )
    price_per_task = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=5.00,
        help_text="Automatically calculated price per task based on budget"
    )

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

    def update_pricing(self):
        """Calculate price per task based on budget and total tasks."""
        if self.budget_usdc > 0 and self.total_tasks > 0:
            # Divide budget by total tasks to get price per task
            self.price_per_task = self.budget_usdc / self.total_tasks
        else:
            # No budget set, price per task is 0
            self.price_per_task = 0.00
        self.save(update_fields=['price_per_task'])

    def publish(self):
        """
        Publish the project to make it available for annotators.
        Validates that budget > 0 before publishing.
        Also makes all pending tasks available.
        """
        if self.budget_usdc <= 0:
            raise ValueError("Cannot publish project with budget of $0. Please set a budget first.")

        # Make all pending tasks available when publishing
        self.tasks.filter(status='pending').update(status='available')

        self.is_published = True
        self.save(update_fields=['is_published'])
        return True

    def unpublish(self):
        """Unpublish the project to remove it from annotator availability."""
        self.is_published = False
        self.save(update_fields=['is_published'])
        return True

    @property
    def can_publish(self):
        """Check if project can be published (has budget > 0)."""
        return self.budget_usdc > 0

    @property
    def completion_percentage(self):
        """Calculate completion percentage."""
        if self.total_tasks == 0:
            return 0
        return int((self.completed_tasks / self.total_tasks) * 100)

    @property
    def remaining_budget(self):
        """Calculate remaining budget (total - spent on completed tasks)."""
        from decimal import Decimal
        spent = Decimal(str(self.completed_tasks)) * Decimal(str(self.price_per_task))
        return Decimal(str(self.budget_usdc)) - spent


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
