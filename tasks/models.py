from django.db import models
from django.conf import settings
from django.utils import timezone

# Import audit models
from .audit_models import AuditLog, PaymentTransaction


class Task(models.Model):
    """
    Represents an annotation task from Label Studio.
    """
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('available', 'Available'),
        ('assigned', 'Assigned'),
        ('in_progress', 'In Progress'),
        ('submitted', 'Submitted'),
        ('completed', 'Completed'),
        ('rejected', 'Rejected'),
    )

    # Relationship to Label Studio project
    project = models.ForeignKey(
        'integration.LabelStudioProject',
        on_delete=models.CASCADE,
        related_name='tasks'
    )

    # Label Studio task details
    labelstudio_task_id = models.IntegerField()
    data = models.JSONField(
        help_text="Task data from Label Studio (e.g., text, image URL, etc.)"
    )

    # Task metadata
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='available'
    )
    difficulty = models.CharField(
        max_length=20,
        choices=[
            ('easy', 'Easy'),
            ('medium', 'Medium'),
            ('hard', 'Hard'),
        ],
        default='medium',
        blank=True
    )

    # Reward/payment info (for future implementation)
    reward_points = models.IntegerField(
        default=10,
        help_text="Points awarded for completing this task"
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        unique_together = ['project', 'labelstudio_task_id']
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['project', 'status']),
            models.Index(fields=['labelstudio_task_id']),
        ]

    def __str__(self):
        return f"Task {self.labelstudio_task_id} from {self.project.title}"

    def is_available(self):
        """Check if task is available for assignment."""
        return self.status == 'available'

    def assign_to(self, annotator):
        """Assign this task to an annotator and automatically start it."""
        from django.utils import timezone
        assignment = TaskAssignment.objects.create(
            task=self,
            annotator=annotator,
            status='in_progress',  # Auto-start for better UX
            started_at=timezone.now()
        )
        self.status = 'assigned'
        self.save(update_fields=['status'])
        return assignment


class TaskAssignment(models.Model):
    """
    Represents the assignment of a task to an annotator.
    """
    STATUS_CHOICES = (
        ('assigned', 'Assigned'),
        ('accepted', 'Accepted'),
        ('in_progress', 'In Progress'),
        ('submitted', 'Submitted'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('cancelled', 'Cancelled'),
    )

    task = models.ForeignKey(
        Task,
        on_delete=models.CASCADE,
        related_name='assignments'
    )
    annotator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='task_assignments',
        limit_choices_to={'user_type': 'annotator'}
    )

    # Assignment details
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='assigned'
    )

    # Annotation result from annotator
    annotation_result = models.JSONField(
        null=True,
        blank=True,
        help_text="Annotation data submitted by annotator"
    )

    # Label Studio annotation ID (after sync)
    labelstudio_annotation_id = models.IntegerField(
        null=True,
        blank=True
    )

    # Quality assessment
    quality_score = models.FloatField(
        null=True,
        blank=True,
        help_text="Quality score from 0-10"
    )
    feedback = models.TextField(
        blank=True,
        help_text="Feedback from researcher"
    )

    # Timestamps
    assigned_at = models.DateTimeField(auto_now_add=True)
    accepted_at = models.DateTimeField(null=True, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['annotator', 'status']),
            models.Index(fields=['task', 'status']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f"{self.task} assigned to {self.annotator.username}"

    def accept(self):
        """Annotator accepts the assignment."""
        self.status = 'accepted'
        self.accepted_at = timezone.now()
        self.save(update_fields=['status', 'accepted_at', 'updated_at'])

    def start(self):
        """Annotator starts working on the task."""
        self.status = 'in_progress'
        self.started_at = timezone.now()
        self.task.status = 'in_progress'
        self.task.save(update_fields=['status'])
        self.save(update_fields=['status', 'started_at', 'updated_at'])

    def submit(self, annotation_result):
        """Annotator submits completed annotation."""
        self.annotation_result = annotation_result
        self.status = 'submitted'
        self.submitted_at = timezone.now()
        self.task.status = 'submitted'
        self.task.save(update_fields=['status'])
        self.save(update_fields=['annotation_result', 'status', 'submitted_at', 'updated_at'])

    def approve(self, quality_score=None, feedback=''):
        """Researcher approves the annotation."""
        self.status = 'approved'
        self.quality_score = quality_score
        self.feedback = feedback
        self.completed_at = timezone.now()
        self.task.status = 'completed'
        self.task.save(update_fields=['status'])

        # Update annotator stats
        self.annotator.tasks_completed += 1
        if quality_score:
            # Simple moving average for rating
            total_score = (self.annotator.rating * (self.annotator.tasks_completed - 1)) + quality_score
            self.annotator.rating = total_score / self.annotator.tasks_completed
        self.annotator.save(update_fields=['tasks_completed', 'rating'])

        self.save(update_fields=['status', 'quality_score', 'feedback', 'completed_at', 'updated_at'])

    def reject(self, feedback=''):
        """Researcher rejects the annotation."""
        self.status = 'rejected'
        self.feedback = feedback
        self.task.status = 'available'  # Make task available again
        self.task.save(update_fields=['status'])
        self.save(update_fields=['status', 'feedback', 'updated_at'])
