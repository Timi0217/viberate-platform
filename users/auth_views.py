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
import requests

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
def github_login_view(request):
    """Login or register using GitHub OAuth token or authorization code."""
    access_token = request.data.get('access_token')
    code = request.data.get('code')

    # If code is provided, exchange it for access token
    if code and not access_token:
        try:
            token_url = 'https://github.com/login/oauth/access_token'
            data = {
                'client_id': settings.GITHUB_OAUTH_CLIENT_ID,
                'client_secret': settings.GITHUB_OAUTH_CLIENT_SECRET,
                'code': code,
            }
            headers = {'Accept': 'application/json'}

            token_response = requests.post(token_url, data=data, headers=headers)

            if token_response.status_code != 200:
                logger.error(f"GitHub token exchange failed: {token_response.text}")
                return Response(
                    {'error': 'Failed to exchange code for token'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            token_data = token_response.json()

            if 'error' in token_data:
                logger.error(f"GitHub OAuth error: {token_data.get('error_description', token_data['error'])}")
                return Response(
                    {'error': token_data.get('error_description', 'OAuth exchange failed')},
                    status=status.HTTP_400_BAD_REQUEST
                )

            access_token = token_data.get('access_token')

            if not access_token:
                return Response(
                    {'error': 'No access token received from GitHub'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        except requests.RequestException as e:
            logger.error(f"GitHub API error during token exchange: {e}")
            return Response(
                {'error': 'Failed to communicate with GitHub API'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )

    if not access_token:
        return Response(
            {'error': 'GitHub access token or authorization code is required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        # Verify token and get user info from GitHub
        headers = {
            'Authorization': f'token {access_token}',
            'Accept': 'application/vnd.github.v3+json'
        }

        # Get user info
        github_response = requests.get('https://api.github.com/user', headers=headers)

        if github_response.status_code != 200:
            log_audit(
                action_type='auth.github_login',
                user=None,
                details={'success': False, 'error': 'Invalid GitHub token'},
                request=request,
                success=False,
                error_message='Invalid GitHub token'
            )
            return Response(
                {'error': 'Invalid GitHub access token'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        github_user = github_response.json()
        github_id = github_user.get('id')
        github_login = github_user.get('login')
        github_email = github_user.get('email')
        github_name = github_user.get('name', '')

        # Get primary email if not public
        if not github_email:
            emails_response = requests.get('https://api.github.com/user/emails', headers=headers)
            if emails_response.status_code == 200:
                emails = emails_response.json()
                for email_data in emails:
                    if email_data.get('primary'):
                        github_email = email_data.get('email')
                        break

        if not github_email:
            github_email = f"{github_login}@users.noreply.github.com"

        # Try to find existing user by GitHub ID or email
        user = None
        try:
            user = User.objects.get(github_id=github_id)
            # Ensure user is set as annotator for extension
            if user.user_type != 'annotator':
                user.user_type = 'annotator'
                user.save()
        except User.DoesNotExist:
            try:
                user = User.objects.get(email=github_email)
                # Link GitHub account and ensure user is an annotator
                user.github_id = github_id
                user.github_username = github_login
                user.user_type = 'annotator'  # Ensure user is set as annotator for extension
                user.save()
            except User.DoesNotExist:
                # Create new user
                username = github_login
                # Ensure unique username
                base_username = username
                counter = 1
                while User.objects.filter(username=username).exists():
                    username = f"{base_username}{counter}"
                    counter += 1

                # Parse name
                first_name = ''
                last_name = ''
                if github_name:
                    name_parts = github_name.split(' ', 1)
                    first_name = name_parts[0]
                    if len(name_parts) > 1:
                        last_name = name_parts[1]

                user = User.objects.create_user(
                    username=username,
                    email=github_email,
                    first_name=first_name,
                    last_name=last_name,
                    user_type='annotator',
                    github_id=github_id,
                    github_username=github_login,
                    password=None  # No password for OAuth users
                )
                user.set_unusable_password()  # Mark that password login is not available
                user.save()

                log_audit(
                    action_type='auth.github_register',
                    user=user,
                    details={
                        'username': username,
                        'github_id': github_id,
                        'github_username': github_login
                    },
                    request=request,
                    success=True
                )

        # Create token for extension
        token, _ = Token.objects.get_or_create(user=user)

        # Create response with user data
        response_data = {
            'user': UserSerializer(user).data,
            'token': token.key,
            'message': 'GitHub login successful'
        }
        response = Response(response_data)

        # Set httpOnly authentication cookie
        set_auth_cookie(response, user)

        # Log successful login
        log_audit(
            action_type='auth.github_login',
            user=user,
            details={
                'username': user.username,
                'github_id': github_id,
                'github_username': github_login
            },
            request=request,
            success=True
        )

        return response

    except requests.RequestException as e:
        logger.error(f"GitHub API error: {e}")
        return Response(
            {'error': 'Failed to communicate with GitHub API'},
            status=status.HTTP_503_SERVICE_UNAVAILABLE
        )
    except Exception as e:
        logger.error(f"GitHub login error: {e}")
        return Response(
            {'error': 'An error occurred during GitHub login'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


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
