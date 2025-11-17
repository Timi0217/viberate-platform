from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """
    Custom user model for Viberate platform.
    Supports both researchers (from Label Studio) and annotators (Viberate network).
    """
    USER_TYPE_CHOICES = (
        ('researcher', 'Researcher'),
        ('annotator', 'Annotator'),
    )

    user_type = models.CharField(
        max_length=20,
        choices=USER_TYPE_CHOICES,
        default='annotator'
    )

    # Label Studio integration fields
    labelstudio_user_id = models.IntegerField(
        null=True,
        blank=True,
        unique=True,
        help_text="User ID from Label Studio"
    )
    labelstudio_api_token = models.CharField(
        max_length=255,
        blank=True,
        help_text="API token for this user's Label Studio account"
    )

    # Annotator fields
    skills = models.JSONField(
        default=list,
        blank=True,
        help_text="Skills/specializations for annotators"
    )
    rating = models.FloatField(
        default=0.0,
        help_text="Average rating based on completed tasks"
    )
    tasks_completed = models.IntegerField(
        default=0,
        help_text="Total number of tasks completed"
    )

    # Crypto wallet fields (Base network)
    base_wallet_address = models.CharField(
        max_length=42,
        blank=True,
        help_text="Base network wallet address (0x...)"
    )
    wallet_data = models.TextField(
        blank=True,
        help_text="Encrypted wallet data from Coinbase CDP"
    )
    wallet_id = models.CharField(
        max_length=255,
        blank=True,
        help_text="Coinbase CDP wallet ID"
    )
    usdc_balance = models.DecimalField(
        max_digits=18,
        decimal_places=6,
        default=0,
        help_text="USDC balance on Base network"
    )

    # Profile fields
    bio = models.TextField(blank=True)
    avatar_url = models.URLField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user_type']),
            models.Index(fields=['labelstudio_user_id']),
        ]

    def __str__(self):
        return f"{self.username} ({self.user_type})"

    def is_researcher(self):
        return self.user_type == 'researcher'

    def is_annotator(self):
        return self.user_type == 'annotator'
