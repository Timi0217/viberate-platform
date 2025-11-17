from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate
from .models import User
from .serializers import UserSerializer, UserCreateSerializer
from .cookie_auth import set_auth_cookie, clear_auth_cookie
from wallet.wallet_service import WalletService
from tasks.audit_utils import log_audit
import logging

logger = logging.getLogger(__name__)


@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    """Login endpoint that sets httpOnly cookie and returns user data."""
    username = request.data.get('username')
    password = request.data.get('password')

    if not username or not password:
        return Response(
            {'error': 'Please provide both username and password'},
            status=status.HTTP_400_BAD_REQUEST
        )

    user = authenticate(username=username, password=password)

    if not user:
        # Log failed login attempt
        log_audit(
            action_type='auth.login',
            user=None,
            details={'username': username, 'success': False},
            request=request,
            success=False,
            error_message='Invalid credentials'
        )
        return Response(
            {'error': 'Invalid credentials'},
            status=status.HTTP_401_UNAUTHORIZED
        )

    # Create response with user data
    response_data = {
        'user': UserSerializer(user).data,
        'message': 'Login successful'
    }
    response = Response(response_data)

    # Set httpOnly authentication cookie
    set_auth_cookie(response, user)

    # Also keep token for backward compatibility with extension
    token, _ = Token.objects.get_or_create(user=user)
    response_data['token'] = token.key  # Add token to response for backward compatibility

    # Log successful login
    log_audit(
        action_type='auth.login',
        user=user,
        details={'username': username},
        request=request,
        success=True
    )

    return response


@api_view(['POST'])
@permission_classes([AllowAny])
def register_view(request):
    """Register a new user and set httpOnly cookie."""
    serializer = UserCreateSerializer(data=request.data)

    if serializer.is_valid():
        user = serializer.save()

        # Create wallet automatically for researchers
        if user.user_type == 'researcher':
            try:
                wallet_info = WalletService.create_wallet(network='base-mainnet')
                user.base_wallet_address = wallet_info['address']
                user.wallet_data = wallet_info['wallet_data']
                user.wallet_id = wallet_info['wallet_id']
                user.save()
                logger.info(f"Created wallet for researcher {user.username}: {wallet_info['address']}")
            except Exception as e:
                logger.error(f"Failed to create wallet for {user.username}: {e}")
                # Continue registration even if wallet creation fails

        # Create response with user data
        response_data = {
            'user': UserSerializer(user).data,
            'message': 'Registration successful'
        }
        response = Response(response_data, status=status.HTTP_201_CREATED)

        # Set httpOnly authentication cookie
        set_auth_cookie(response, user)

        # Also create token for backward compatibility with extension
        token, _ = Token.objects.get_or_create(user=user)
        response_data['token'] = token.key  # Add token to response for backward compatibility

        # Log registration
        log_audit(
            action_type='auth.register',
            user=user,
            details={
                'username': user.username,
                'user_type': user.user_type
            },
            request=request,
            success=True
        )

        return response

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_view(request):
    """Logout endpoint that clears the httpOnly cookie and deletes the token."""
    try:
        # Log logout
        log_audit(
            action_type='auth.logout',
            user=request.user,
            details={'username': request.user.username},
            request=request,
            success=True
        )

        # Delete the user's token (for backward compatibility)
        try:
            request.user.auth_token.delete()
        except:
            pass  # Token might not exist

        # Create response
        response = Response({'message': 'Successfully logged out'})

        # Clear authentication cookie
        clear_auth_cookie(response)

        return response
    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def profile_view(request):
    """Get current user's profile."""
    return Response(UserSerializer(request.user).data)


@api_view(['POST'])
@permission_classes([AllowAny])
def delete_all_users_view(request):
    """Delete all users (for testing only)."""
    # Simple secret key check
    secret = request.data.get('secret')
    if secret != 'delete_all_users_2024':
        return Response(
            {'error': 'Invalid secret'},
            status=status.HTTP_403_FORBIDDEN
        )

    count = User.objects.all().count()
    User.objects.all().delete()

    return Response({
        'message': f'Successfully deleted {count} users'
    })
