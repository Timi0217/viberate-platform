"""
HttpOnly Cookie Authentication for secure session management.

This module provides cookie-based authentication as a secure alternative
to storing tokens in localStorage.
"""
import jwt
from datetime import datetime, timedelta
from django.conf import settings
from rest_framework import authentication, exceptions
from .models import User


class CookieJWTAuthentication(authentication.BaseAuthentication):
    """
    Custom authentication class that reads JWT from httpOnly cookie.

    This is more secure than localStorage because:
    - HttpOnly cookies can't be accessed by JavaScript (prevents XSS attacks)
    - Cookies are automatically sent with requests (no manual token management)
    - Can be marked as Secure (HTTPS only) and SameSite (CSRF protection)
    """

    def authenticate(self, request):
        """
        Authenticate the request by extracting JWT from cookie.

        Returns:
            tuple: (user, token) if authentication successful
            None: if no authentication cookie found

        Raises:
            AuthenticationFailed: if token is invalid or expired
        """
        # Get JWT from cookie
        token = request.COOKIES.get('auth_token')

        if not token:
            # No cookie found - try fallback to Authorization header for backward compatibility
            return None

        try:
            # Decode JWT
            payload = jwt.decode(
                token,
                settings.SECRET_KEY,
                algorithms=['HS256']
            )

            # Get user ID from payload
            user_id = payload.get('user_id')
            if not user_id:
                raise exceptions.AuthenticationFailed('Invalid token payload')

            # Get user from database
            try:
                user = User.objects.get(id=user_id, is_active=True)
            except User.DoesNotExist:
                raise exceptions.AuthenticationFailed('User not found')

            return (user, token)

        except jwt.ExpiredSignatureError:
            raise exceptions.AuthenticationFailed('Token has expired')
        except jwt.InvalidTokenError:
            raise exceptions.AuthenticationFailed('Invalid token')

    def authenticate_header(self, request):
        """
        Return WWW-Authenticate header for 401 responses.
        """
        return 'Cookie'


def create_jwt_token(user):
    """
    Create a JWT token for the given user.

    Args:
        user: User instance

    Returns:
        str: JWT token
    """
    expiration = datetime.utcnow() + timedelta(days=7)  # Token expires in 7 days

    payload = {
        'user_id': user.id,
        'username': user.username,
        'user_type': user.user_type,
        'exp': expiration,
        'iat': datetime.utcnow(),
    }

    token = jwt.encode(
        payload,
        settings.SECRET_KEY,
        algorithm='HS256'
    )

    return token


def set_auth_cookie(response, user):
    """
    Set authentication cookie on response.

    Args:
        response: Django Response object
        user: User instance

    Returns:
        Response: Modified response with auth cookie set
    """
    token = create_jwt_token(user)

    # Cookie settings
    max_age = 7 * 24 * 60 * 60  # 7 days in seconds

    response.set_cookie(
        key='auth_token',
        value=token,
        max_age=max_age,
        httponly=True,  # Can't be accessed by JavaScript (XSS protection)
        secure=not settings.DEBUG,  # Only send over HTTPS in production
        samesite='Lax',  # CSRF protection (can be 'Strict', 'Lax', or 'None')
        domain=None,  # Use default domain
    )

    return response


def clear_auth_cookie(response):
    """
    Clear authentication cookie from response.

    Args:
        response: Django Response object

    Returns:
        Response: Modified response with auth cookie cleared
    """
    response.delete_cookie(
        key='auth_token',
        samesite='Lax'
    )

    return response
