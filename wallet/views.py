"""
API views for wallet operations
"""
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.authentication import TokenAuthentication
from django.views.decorators.csrf import csrf_exempt
from .wallet_service import WalletService
from .authentication import CsrfExemptSessionAuthentication
from decimal import Decimal
import logging
import os
import requests
import time
import jwt as pyjwt
import secrets

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


@csrf_exempt
@api_view(['POST'])
@authentication_classes([TokenAuthentication, CsrfExemptSessionAuthentication])
@permission_classes([IsAuthenticated])
def generate_onramp_session_token(request):
    """
    Generate a Coinbase Onramp session token for secure initialization
    This endpoint creates a JWT and calls Coinbase API to get a session token
    """
    user = request.user

    if not user.base_wallet_address:
        return Response(
            {'error': 'No wallet address found for this user'},
            status=status.HTTP_404_NOT_FOUND
        )

    try:
        # Get CDP API credentials
        api_key_name = os.getenv('COINBASE_CDP_API_KEY_NAME')
        api_key_private_key = os.getenv('COINBASE_CDP_API_KEY_PRIVATE')

        if not api_key_name or not api_key_private_key:
            logger.error("Coinbase CDP API credentials not configured")
            return Response(
                {'error': 'Onramp service not configured'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        # Generate JWT for Coinbase API authentication
        request_method = "POST"
        request_host = "api.developer.coinbase.com"
        request_path = "/onramp/v1/token"

        # Create JWT payload
        payload = {
            'sub': api_key_name,
            'iss': 'cdp',
            'nbf': int(time.time()),
            'exp': int(time.time()) + 120,  # 2 minutes
            'uri': f"{request_method} {request_host}{request_path}",
        }

        # Load private key
        from cryptography.hazmat.primitives import serialization
        from cryptography.hazmat.primitives.asymmetric import ec
        from cryptography.hazmat.backends import default_backend
        import base64

        # Check if key is already in PEM format
        if api_key_private_key.startswith('-----BEGIN'):
            # Already in PEM format - replace literal \n with actual newlines
            api_key_private_key = api_key_private_key.replace('\\n', '\n')
            private_key_bytes = api_key_private_key.encode('utf-8')
            pem_key = serialization.load_pem_private_key(
                private_key_bytes,
                password=None,
                backend=default_backend()
            )
        else:
            # Base64 encoded - try multiple formats
            raw_key_bytes = base64.b64decode(api_key_private_key)

            try:
                # Try loading as DER-encoded EC private key (SEC1 format)
                pem_key = serialization.load_der_private_key(
                    raw_key_bytes,
                    password=None,
                    backend=default_backend()
                )
                logger.info("Loaded private key as DER format")
            except Exception as der_error:
                logger.warning(f"Failed to load as DER: {der_error}, trying raw key bytes")
                # Fall back to deriving from raw bytes (first 32 bytes as private key value)
                if len(raw_key_bytes) >= 32:
                    private_value = int.from_bytes(raw_key_bytes[:32], 'big')
                    pem_key = ec.derive_private_key(
                        private_value,
                        ec.SECP256R1(),
                        default_backend()
                    )
                    logger.info("Derived EC key from raw bytes")
                else:
                    raise ValueError(f"Invalid private key length: {len(raw_key_bytes)} bytes")

        # Create JWT using ES256 algorithm
        token = pyjwt.encode(
            payload,
            pem_key,
            algorithm='ES256',
            headers={'kid': api_key_name, 'nonce': secrets.token_hex(16)}
        )

        # Call Coinbase API to generate session token
        url = f"https://{request_host}{request_path}"
        headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }

        # Prepare request body
        body = {
            'addresses': [{
                'address': user.base_wallet_address,
                'blockchains': ['base']
            }],
            'assets': ['USDC']
        }

        # Make API request
        response = requests.post(url, json=body, headers=headers, timeout=10)

        if response.status_code != 200:
            logger.error(f"Coinbase API error: {response.status_code} - {response.text}")
            return Response(
                {'error': 'Failed to generate session token', 'details': response.text},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        # Parse response
        data = response.json()
        # Response format is {"token": "...", "channel_id": ""}
        session_token = data.get('token')

        if not session_token:
            logger.error(f"No token in response: {data}")
            return Response(
                {'error': 'Invalid response from Coinbase'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        logger.info(f"Generated session token for user {user.username}")

        return Response({
            'sessionToken': session_token
        })

    except Exception as e:
        logger.error(f"Failed to generate session token for {user.username}: {e}", exc_info=True)
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
