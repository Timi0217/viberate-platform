"""
Custom authentication classes for wallet API
"""
from rest_framework.authentication import SessionAuthentication


class CsrfExemptSessionAuthentication(SessionAuthentication):
    """
    SessionAuthentication without CSRF checks.
    Use this for API endpoints that are protected by Token authentication.
    """
    def enforce_csrf(self, request):
        return  # Do not enforce CSRF
