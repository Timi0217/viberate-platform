"""
Utility functions for audit logging.
"""
from .audit_models import AuditLog


def log_audit(
    action_type,
    user=None,
    resource_type='',
    resource_id='',
    details=None,
    request=None,
    success=True,
    error_message=''
):
    """
    Create an audit log entry.

    Args:
        action_type: Type of action (must be one of AuditLog.ACTION_TYPES)
        user: User who performed the action (None for system actions)
        resource_type: Type of resource affected ('task', 'payment', 'user', etc.)
        resource_id: ID of the affected resource
        details: Dictionary of additional details
        request: Django request object (for IP and user agent)
        success: Whether the action succeeded
        error_message: Error message if action failed

    Returns:
        AuditLog instance

    Example:
        log_audit(
            action_type='payment.completed',
            user=annotator,
            resource_type='payment',
            resource_id=transaction.transaction_id,
            details={
                'amount_usdc': str(transaction.amount_usdc),
                'transaction_hash': transaction.transaction_hash,
                'recipient_wallet': transaction.to_address,
            },
            request=request,
            success=True
        )
    """
    ip_address = None
    user_agent = ''

    if request:
        # Get IP address from request
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip_address = x_forwarded_for.split(',')[0].strip()
        else:
            ip_address = request.META.get('REMOTE_ADDR')

        # Get user agent
        user_agent = request.META.get('HTTP_USER_AGENT', '')[:500]  # Limit length

    return AuditLog.objects.create(
        user=user,
        action_type=action_type,
        resource_type=resource_type,
        resource_id=str(resource_id) if resource_id else '',
        details=details or {},
        ip_address=ip_address,
        user_agent=user_agent,
        success=success,
        error_message=error_message
    )


def log_payment_initiated(transaction, user, request=None):
    """Log when a payment is initiated."""
    return log_audit(
        action_type='payment.initiated',
        user=user,
        resource_type='payment',
        resource_id=transaction.transaction_id,
        details={
            'amount_usdc': str(transaction.amount_usdc),
            'recipient': transaction.recipient.username,
            'recipient_wallet': transaction.to_address,
            'assignment_id': transaction.assignment.id,
        },
        request=request,
        success=True
    )


def log_payment_completed(transaction, request=None):
    """Log when a payment completes successfully."""
    return log_audit(
        action_type='payment.completed',
        user=transaction.recipient,
        resource_type='payment',
        resource_id=transaction.transaction_id,
        details={
            'amount_usdc': str(transaction.amount_usdc),
            'transaction_hash': transaction.transaction_hash,
            'recipient_wallet': transaction.to_address,
            'gas_used': str(transaction.gas_used) if transaction.gas_used else None,
        },
        request=request,
        success=True
    )


def log_payment_failed(transaction, error_message, request=None):
    """Log when a payment fails."""
    return log_audit(
        action_type='payment.failed',
        user=transaction.recipient,
        resource_type='payment',
        resource_id=transaction.transaction_id,
        details={
            'amount_usdc': str(transaction.amount_usdc),
            'recipient_wallet': transaction.to_address,
            'retry_count': transaction.retry_count,
        },
        request=request,
        success=False,
        error_message=error_message
    )


def log_task_approved(assignment, approved_by, payment_amount, request=None):
    """Log when a task assignment is approved."""
    return log_audit(
        action_type='task.approve',
        user=approved_by,
        resource_type='assignment',
        resource_id=assignment.id,
        details={
            'task_id': assignment.task.id,
            'annotator': assignment.annotator.username,
            'payment_amount': str(payment_amount) if payment_amount else None,
            'quality_score': str(assignment.quality_score) if assignment.quality_score else None,
        },
        request=request,
        success=True
    )


def log_task_rejected(assignment, rejected_by, reason, request=None):
    """Log when a task assignment is rejected."""
    return log_audit(
        action_type='task.reject',
        user=rejected_by,
        resource_type='assignment',
        resource_id=assignment.id,
        details={
            'task_id': assignment.task.id,
            'annotator': assignment.annotator.username,
            'reason': reason,
        },
        request=request,
        success=True
    )


def log_wallet_connected(user, wallet_address, request=None):
    """Log when a user connects their wallet."""
    return log_audit(
        action_type='wallet.connected',
        user=user,
        resource_type='wallet',
        resource_id=wallet_address,
        details={
            'wallet_address': wallet_address,
            'network': 'base',
        },
        request=request,
        success=True
    )


def log_suspicious_activity(user, activity_type, details, request=None):
    """Log suspicious activity for security monitoring."""
    return log_audit(
        action_type='security.suspicious_activity',
        user=user,
        resource_type='security',
        resource_id=activity_type,
        details=details,
        request=request,
        success=True
    )
