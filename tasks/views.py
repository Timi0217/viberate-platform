from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q
from decimal import Decimal
from .models import Task, TaskAssignment
from .serializers import (
    TaskSerializer,
    TaskAssignmentSerializer,
    TaskClaimSerializer,
    AnnotationSubmitSerializer,
    AssignmentReviewSerializer
)
from .payment_service import payment_service
from .audit_utils import log_task_approved, log_task_rejected
from integration.labelstudio_client import create_client_for_user
import logging

logger = logging.getLogger(__name__)


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
        # Annotators see tasks from active, published projects
        # Don't filter by task status - if project is published, tasks are available
        else:
            queryset = queryset.filter(
                project__is_active=True,
                project__is_published=True
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
    def approve(self, request, pk=None):
        """
        Approve an assignment and process USDC payment.

        Request body:
        {
            "payment_amount": 5.00,  # USDC amount (optional, uses default if not provided)
            "quality_score": 8.5,    # Quality score 0-10 (optional)
            "feedback": "Great work!" # Feedback message (optional)
        }
        """
        assignment = self.get_object()

        # Permission check
        if assignment.task.project.researcher != request.user:
            return Response(
                {'error': 'Only the project researcher can approve assignments.'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Status check
        if assignment.status != 'submitted':
            return Response(
                {'error': f'Cannot approve assignment in status: {assignment.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get payment amount (default to $5 USDC)
        payment_amount = request.data.get('payment_amount', 5.00)
        try:
            payment_amount = Decimal(str(payment_amount))
        except:
            return Response(
                {'error': 'Invalid payment amount'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate payment amount
        if payment_amount <= 0:
            return Response(
                {'error': 'Payment amount must be greater than zero'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if payment_amount > 10000:
            return Response(
                {'error': 'Payment amount cannot exceed $10,000 USDC'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get quality score and feedback
        quality_score = request.data.get('quality_score')
        feedback = request.data.get('feedback', '')

        # Approve the assignment
        assignment.approve(quality_score=quality_score, feedback=feedback)

        # Create payment transaction
        try:
            transaction = payment_service.create_payment(
                assignment=assignment,
                amount_usdc=payment_amount,
                approved_by=request.user
            )

            # Process payment using researcher's wallet
            # If the researcher has wallet_data, use it; otherwise use PLATFORM_WALLET_DATA from settings
            payer_wallet_data = request.user.wallet_data if request.user.wallet_data else None

            payment_success = payment_service.process_payment(
                transaction,
                request=request,
                payer_wallet_data=payer_wallet_data
            )

            if not payment_success:
                # Payment failed - log warning but don't fail the approval
                logger.warning(
                    f"Payment failed for assignment {assignment.id}: {transaction.error_message}"
                )

        except Exception as e:
            # Log payment error but don't fail the approval
            logger.error(f"Failed to process payment for assignment {assignment.id}: {str(e)}")
            transaction = None

        # Log approval
        log_task_approved(assignment, request.user, payment_amount, request=request)

        # Sync to Label Studio
        try:
            self._sync_to_labelstudio(assignment)
        except Exception as e:
            logger.error(f"Failed to sync to Label Studio: {str(e)}")

        # Prepare response
        response_data = TaskAssignmentSerializer(assignment).data

        # Add payment info to response
        if transaction:
            response_data['payment'] = {
                'transaction_id': transaction.transaction_id,
                'amount_usdc': str(transaction.amount_usdc),
                'status': transaction.status,
                'transaction_hash': transaction.transaction_hash,
            }

        return Response(response_data)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Annotator cancels/unclaims their assignment."""
        assignment = self.get_object()

        # Permission check - only the annotator can cancel their own assignment
        if assignment.annotator != request.user:
            return Response(
                {'error': 'You can only cancel your own assignments.'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Status check - can only cancel if not yet submitted
        if assignment.status in ['submitted', 'approved', 'rejected']:
            return Response(
                {'error': f'Cannot cancel assignment in status: {assignment.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Cancel the assignment and make task available again
        assignment.status = 'cancelled'
        assignment.task.status = 'available'
        assignment.task.save(update_fields=['status'])
        assignment.save(update_fields=['status'])

        return Response({'status': 'cancelled'})

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """
        Reject an assignment.

        Request body:
        {
            "reason": "Does not meet quality standards"  # Required
        }
        """
        assignment = self.get_object()

        # Permission check
        if assignment.task.project.researcher != request.user:
            return Response(
                {'error': 'Only the project researcher can reject assignments.'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Status check
        if assignment.status != 'submitted':
            return Response(
                {'error': f'Cannot reject assignment in status: {assignment.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get rejection reason
        reason = request.data.get('reason', '')

        # Reject the assignment
        assignment.reject(feedback=reason)

        # Log rejection
        log_task_rejected(assignment, request.user, reason, request=request)

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
        """Get current user's assignments (excludes cancelled)."""
        if not request.user.is_annotator():
            return Response(
                {'error': 'Only annotators have assignments.'},
                status=status.HTTP_403_FORBIDDEN
            )

        assignments = self.get_queryset().filter(
            annotator=request.user
        ).exclude(status='cancelled').order_by('-created_at')

        serializer = self.get_serializer(assignments, many=True)
        return Response(serializer.data)
