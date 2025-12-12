"""
GitHub OAuth Code Exchange Endpoint
Handles exchanging OAuth authorization code for access token
"""
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.conf import settings
import requests
import logging

logger = logging.getLogger(__name__)


@api_view(['POST'])
@permission_classes([AllowAny])
def github_oauth_exchange(request):
    """
    Exchange GitHub authorization code for access token.
    This endpoint is called by the frontend after GitHub redirects back.

    Request body:
    - code: Authorization code from GitHub
    - redirect_uri: The redirect URI used in the OAuth flow

    Returns:
    - access_token: GitHub access token to be used for API calls
    """
    code = request.data.get('code')
    redirect_uri = request.data.get('redirect_uri')

    if not code:
        return Response(
            {'error': 'Authorization code is required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        # Exchange code for access token
        token_url = 'https://github.com/login/oauth/access_token'

        data = {
            'client_id': settings.GITHUB_OAUTH_CLIENT_ID,
            'client_secret': settings.GITHUB_OAUTH_CLIENT_SECRET,
            'code': code,
        }

        if redirect_uri:
            data['redirect_uri'] = redirect_uri

        headers = {
            'Accept': 'application/json'
        }

        response = requests.post(token_url, data=data, headers=headers)

        if response.status_code != 200:
            logger.error(f"GitHub token exchange failed: {response.text}")
            return Response(
                {'error': 'Failed to exchange code for token'},
                status=status.HTTP_400_BAD_REQUEST
            )

        token_data = response.json()

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

        return Response({
            'access_token': access_token,
            'token_type': token_data.get('token_type', 'bearer'),
            'scope': token_data.get('scope', '')
        })

    except requests.RequestException as e:
        logger.error(f"GitHub API error during token exchange: {e}")
        return Response(
            {'error': 'Failed to communicate with GitHub API'},
            status=status.HTTP_503_SERVICE_UNAVAILABLE
        )
    except Exception as e:
        logger.error(f"Unexpected error during GitHub OAuth exchange: {e}")
        return Response(
            {'error': 'An unexpected error occurred'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
