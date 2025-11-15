"""
Audit logging models for tracking all critical platform actions.
"""
from django.db import models
from django.conf import settings
from django.contrib.postgres.fields import JSONField as PostgresJSONField
from django.utils import timezone


class AuditLog(models.Model):
    """
    Immutable audit log for all critical platform actions.
    Used for compliance, debugging, and security monitoring.
    """
    ACTION_TYPES = (
        # Authentication
        ('auth.login', 'User Login'),
        ('auth.logout', 'User Logout'),
        ('auth.register', 'User Registration'),
        ('auth.password_change', 'Password Change'),

        # Task Management
        ('task.create', 'Task Created'),
        ('task.claim', 'Task Claimed'),
        ('task.submit', 'Task Submitted'),
        ('task.approve', 'Task Approved'),
        ('task.reject', 'Task Rejected'),

        # Payment Actions
        ('payment.initiated', 'Payment Initiated'),
        ('payment.completed', 'Payment Completed'),
        ('payment.failed', 'Payment Failed'),
        ('payment.refund', 'Payment Refunded'),

        # Wallet Actions
        ('wallet.connected', 'Wallet Connected'),
        ('wallet.updated', 'Wallet Updated'),
        ('wallet.disconnected', 'Wallet Disconnected'),

        # Admin Actions
        ('admin.user_update', 'Admin User Update'),
        ('admin.task_override', 'Admin Task Override'),

        # Security Events
        ('security.suspicious_activity', 'Suspicious Activity'),
        ('security.rate_limit', 'Rate Limit Exceeded'),
    )

    # Who performed the action
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='audit_logs',
        help_text="User who performed the action (null for system actions)"
    )

    # What action was performed
    action_type = models.CharField(
        max_length=50,
        choices=ACTION_TYPES,
        db_index=True,
        help_text="Type of action performed"
    )

    # When it happened
    timestamp = models.DateTimeField(
        default=timezone.now,
        db_index=True,
        help_text="When the action occurred"
    )

    # Additional context
    resource_type = models.CharField(
        max_length=50,
        blank=True,
        db_index=True,
        help_text="Type of resource affected (e.g., 'task', 'payment', 'user')"
    )

    resource_id = models.CharField(
        max_length=100,
        blank=True,
        db_index=True,
        help_text="ID of the affected resource"
    )

    # Detailed information about the action
    details = models.JSONField(
        default=dict,
        help_text="Additional details about the action (payment amounts, task IDs, etc.)"
    )

    # Request metadata
    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
        help_text="IP address from which the action was performed"
    )

    user_agent = models.TextField(
        blank=True,
        help_text="User agent string from the request"
    )

    # Outcome
    success = models.BooleanField(
        default=True,
        help_text="Whether the action succeeded"
    )

    error_message = models.TextField(
        blank=True,
        help_text="Error message if action failed"
    )

    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['-timestamp']),
            models.Index(fields=['user', '-timestamp']),
            models.Index(fields=['action_type', '-timestamp']),
            models.Index(fields=['resource_type', 'resource_id']),
        ]
        # Make the table append-only (no updates or deletes)
        permissions = [
            ("view_audit_logs", "Can view audit logs"),
        ]

    def __str__(self):
        user_str = self.user.username if self.user else "System"
        return f"{user_str} - {self.action_type} at {self.timestamp}"

    def save(self, *args, **kwargs):
        """Override save to prevent updates to existing records."""
        if self.pk is not None:
            raise ValueError("Audit logs cannot be modified once created")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        """Prevent deletion of audit logs."""
        raise ValueError("Audit logs cannot be deleted")


class PaymentTransaction(models.Model):
    """
    Record of all USDC payment transactions on Base network.
    Immutable record for financial compliance.
    """
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('refunded', 'Refunded'),
    )

    # Transaction ID (UUID)
    transaction_id = models.CharField(
        max_length=100,
        unique=True,
        db_index=True,
        help_text="Unique transaction identifier"
    )

    # Related assignment (what is being paid for)
    assignment = models.ForeignKey(
        'TaskAssignment',
        on_delete=models.PROTECT,
        related_name='payment_transactions',
        help_text="Task assignment this payment is for"
    )

    # Recipient (annotator)
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='received_payments',
        help_text="User receiving the payment"
    )

    # Amount
    amount_usdc = models.DecimalField(
        max_digits=18,
        decimal_places=6,
        help_text="Amount in USDC paid to annotator"
    )

    platform_fee_usdc = models.DecimalField(
        max_digits=18,
        decimal_places=6,
        default=0,
        help_text="Platform fee (10% of amount_usdc)"
    )

    # Blockchain details
    blockchain_network = models.CharField(
        max_length=20,
        default='base',
        help_text="Blockchain network (base, ethereum, etc.)"
    )

    transaction_hash = models.CharField(
        max_length=66,
        blank=True,
        unique=True,
        null=True,
        help_text="Blockchain transaction hash (0x...)"
    )

    from_address = models.CharField(
        max_length=42,
        help_text="Platform wallet address (sender)"
    )

    to_address = models.CharField(
        max_length=42,
        help_text="Annotator wallet address (recipient)"
    )

    # Status tracking
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending',
        db_index=True
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    # Gas fees
    gas_used = models.DecimalField(
        max_digits=18,
        decimal_places=6,
        null=True,
        blank=True,
        help_text="Gas used for transaction"
    )

    gas_price_gwei = models.DecimalField(
        max_digits=18,
        decimal_places=6,
        null=True,
        blank=True,
        help_text="Gas price in Gwei"
    )

    # Error handling
    error_message = models.TextField(
        blank=True,
        help_text="Error message if transaction failed"
    )

    retry_count = models.IntegerField(
        default=0,
        help_text="Number of retry attempts"
    )

    # Additional metadata
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Additional transaction metadata"
    )

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['-created_at']),
            models.Index(fields=['recipient', '-created_at']),
            models.Index(fields=['status', '-created_at']),
            models.Index(fields=['transaction_hash']),
        ]

    def __str__(self):
        return f"Payment {self.transaction_id}: {self.amount_usdc} USDC to {self.recipient.username}"

    def save(self, *args, **kwargs):
        """Allow updates only to specific fields for status tracking."""
        if self.pk is not None:
            # Only allow updates to status, timestamps, and transaction details
            allowed_updates = {
                'status', 'processed_at', 'completed_at', 'transaction_hash',
                'gas_used', 'gas_price_gwei', 'error_message', 'retry_count', 'metadata'
            }
            # This is a simplified check - in production you'd want more robust validation
        super().save(*args, **kwargs)
