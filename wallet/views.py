"""
API views for wallet operations
"""
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .wallet_service import WalletService
from decimal import Decimal
import logging

logger = logging.getLogger(__name__)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_balance(request):
    """Get the USDC balance for the authenticated user's wallet"""
    user = request.user

    if not user.wallet_data:
        return Response(
            {'error': 'No wallet found for this user'},
            status=status.HTTP_404_NOT_FOUND
        )

    try:
        balance = WalletService.get_balance(user.wallet_data, asset='usdc')

        # Update balance in database
        user.usdc_balance = balance
        user.save(update_fields=['usdc_balance'])

        return Response({
            'balance': str(balance),
            'address': user.base_wallet_address,
            'currency': 'USDC'
        })

    except Exception as e:
        logger.error(f"Failed to get balance for {user.username}: {e}")
        return Response(
            {'error': 'Failed to retrieve balance'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def transfer_usdc(request):
    """
    Transfer USDC to another address
    Expected payload: {
        "to_address": "0x...",
        "amount": "10.50"
    }
    """
    user = request.user

    if not user.wallet_data:
        return Response(
            {'error': 'No wallet found for this user'},
            status=status.HTTP_404_NOT_FOUND
        )

    to_address = request.data.get('to_address')
    amount = request.data.get('amount')

    if not to_address or not amount:
        return Response(
            {'error': 'Please provide to_address and amount'},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        amount_decimal = Decimal(str(amount))

        # Check if user has sufficient balance
        current_balance = WalletService.get_balance(user.wallet_data, asset='usdc')
        if current_balance < amount_decimal:
            return Response(
                {'error': f'Insufficient balance. Current balance: {current_balance} USDC'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Perform transfer
        result = WalletService.transfer_usdc(
            from_wallet_data=user.wallet_data,
            to_address=to_address,
            amount=amount_decimal,
            gasless=True
        )

        # Update sender's balance
        new_balance = WalletService.get_balance(user.wallet_data, asset='usdc')
        user.usdc_balance = new_balance
        user.save(update_fields=['usdc_balance'])

        return Response({
            'success': True,
            'transaction_hash': result['transaction_hash'],
            'from_address': result['from_address'],
            'to_address': result['to_address'],
            'amount': result['amount'],
            'new_balance': str(new_balance)
        })

    except ValueError as e:
        return Response(
            {'error': 'Invalid amount format'},
            status=status.HTTP_400_BAD_REQUEST
        )
    except Exception as e:
        logger.error(f"Failed to transfer USDC for {user.username}: {e}")
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def transaction_history(request):
    """Get transaction history for the authenticated user's wallet"""
    user = request.user

    if not user.wallet_data:
        return Response(
            {'error': 'No wallet found for this user'},
            status=status.HTTP_404_NOT_FOUND
        )

    try:
        transactions = WalletService.get_transaction_history(user.wallet_data)

        return Response({
            'transactions': transactions,
            'count': len(transactions)
        })

    except Exception as e:
        logger.error(f"Failed to get transaction history for {user.username}: {e}")
        return Response(
            {'error': 'Failed to retrieve transaction history'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
