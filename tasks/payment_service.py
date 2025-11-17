"""
USDC Payment Service for Base Network.

This service handles all USDC payments to annotators on the Base network.
Uses the existing Coinbase CDP wallet service.
"""
import uuid
import logging
from decimal import Decimal
from django.conf import settings
from django.utils import timezone
from .audit_models import PaymentTransaction
from .audit_utils import log_payment_initiated, log_payment_completed, log_payment_failed
from wallet.wallet_service import WalletService

logger = logging.getLogger(__name__)


class PaymentService:
    """
    Service for processing USDC payments on Base network using existing WalletService.
    """

    def __init__(self):
        """Initialize payment service with configuration."""
        self.network = getattr(settings, 'BASE_NETWORK', 'base-sepolia')  # or 'base-mainnet'

        # Initialize WalletService
        WalletService.initialize()

    def get_platform_wallet_data(self):
        """Get platform wallet data from settings or database."""
        # Check if we should use researcher's wallet (for MVP) or platform wallet
        # For now, we'll use an environment variable
        platform_wallet_data = getattr(settings, 'PLATFORM_WALLET_DATA', None)

        if not platform_wallet_data:
            raise ValueError("PLATFORM_WALLET_DATA not configured. Set it in environment variables.")

        return platform_wallet_data

    def create_payment(self, assignment, amount_usdc, approved_by):
        """
        Create a payment transaction record.

        Args:
            assignment: TaskAssignment instance
            amount_usdc: Decimal amount in USDC
            approved_by: User who approved the payment

        Returns:
            PaymentTransaction instance

        Raises:
            ValueError: If annotator doesn't have a wallet address
        """
        # Validate annotator has wallet
        if not assignment.annotator.base_wallet_address:
            raise ValueError(f"Annotator {assignment.annotator.username} has no wallet address connected")

        # Validate amount
        amount_usdc = Decimal(str(amount_usdc))
        if amount_usdc <= 0:
            raise ValueError("Payment amount must be greater than zero")

        # Calculate 10% platform fee
        platform_fee_usdc = (amount_usdc * Decimal('0.10')).quantize(Decimal('0.000001'))

        # Generate unique transaction ID
        transaction_id = str(uuid.uuid4())

        # Get platform wallet address from wallet data or use the researcher's wallet
        # For MVP, use the project researcher's wallet
        from_address = approved_by.base_wallet_address or 'PENDING'

        # Create payment transaction record
        transaction = PaymentTransaction.objects.create(
            transaction_id=transaction_id,
            assignment=assignment,
            recipient=assignment.annotator,
            amount_usdc=amount_usdc,
            platform_fee_usdc=platform_fee_usdc,
            blockchain_network=self.network,
            from_address=from_address,
            to_address=assignment.annotator.base_wallet_address,
            status='pending'
        )

        logger.info(f"Created payment transaction {transaction_id} for {amount_usdc} USDC")
        return transaction

    def process_payment(self, transaction, request=None, payer_wallet_data=None):
        """
        Process a payment transaction on Base network using WalletService.

        Args:
            transaction: PaymentTransaction instance
            request: Django request object for audit logging
            payer_wallet_data: Wallet data of the payer (optional, defaults to PLATFORM_WALLET_DATA)

        Returns:
            bool: True if payment succeeded, False otherwise

        Updates transaction status and blockchain details.
        """
        try:
            # Log payment initiation
            log_payment_initiated(transaction, transaction.recipient, request)

            # Update status to processing
            transaction.status = 'processing'
            transaction.processed_at = timezone.now()
            transaction.save(update_fields=['status', 'processed_at'])

            # Get wallet data (use provided or get from settings)
            if not payer_wallet_data:
                payer_wallet_data = self.get_platform_wallet_data()

            # Use existing WalletService to transfer USDC
            result = WalletService.transfer_usdc(
                from_wallet_data=payer_wallet_data,
                to_address=transaction.to_address,
                amount=transaction.amount_usdc,
                gasless=True  # Coinbase CDP handles gas automatically
            )

            tx_hash = result['transaction_hash']

            # Update transaction with success
            transaction.status = 'completed'
            transaction.transaction_hash = tx_hash
            transaction.completed_at = timezone.now()
            transaction.from_address = result['from_address']
            transaction.save(update_fields=['status', 'transaction_hash', 'completed_at', 'from_address'])

            # Log successful payment
            log_payment_completed(transaction, request)

            logger.info(f"Payment {transaction.transaction_id} completed: {tx_hash}")
            return True

        except Exception as e:
            error_message = str(e)
            logger.error(f"Payment {transaction.transaction_id} failed: {error_message}")

            # Update transaction with failure
            transaction.status = 'failed'
            transaction.error_message = error_message
            transaction.retry_count += 1
            transaction.save(update_fields=['status', 'error_message', 'retry_count'])

            # Log failed payment
            log_payment_failed(transaction, error_message, request)

            return False

    def retry_failed_payment(self, transaction, request=None, payer_wallet_data=None):
        """
        Retry a failed payment.

        Args:
            transaction: PaymentTransaction instance
            request: Django request object
            payer_wallet_data: Wallet data of the payer (optional)

        Returns:
            bool: True if retry succeeded
        """
        if transaction.status != 'failed':
            raise ValueError(f"Cannot retry payment in status: {transaction.status}")

        if transaction.retry_count >= 3:
            raise ValueError("Maximum retry attempts (3) exceeded")

        logger.info(f"Retrying payment {transaction.transaction_id} (attempt {transaction.retry_count + 1})")

        # Reset status to pending
        transaction.status = 'pending'
        transaction.error_message = ''
        transaction.save(update_fields=['status', 'error_message'])

        # Process payment
        return self.process_payment(transaction, request, payer_wallet_data)

    def get_balance(self, wallet_data):
        """
        Get USDC balance using WalletService.

        Args:
            wallet_data: Encrypted wallet data

        Returns:
            Decimal: USDC balance
        """
        return WalletService.get_balance(wallet_data, asset="usdc")


# Global payment service instance
payment_service = PaymentService()
