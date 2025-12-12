"""
GitHub Profile Public API Views
Endpoints for analyzing and retrieving GitHub developer profiles
"""
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.conf import settings
from .models import SkillProfile, User
from .github_skill_analyzer import GitHubSkillAnalyzer
import logging

logger = logging.getLogger(__name__)


@api_view(['GET'])
@permission_classes([AllowAny])  # Public endpoint
def get_github_profile(request, username):
    """
    Get a GitHub user's skill profile (public endpoint)
    If profile doesn't exist, returns 404
    """
    try:
        # Look up by github_username in User model
        user = User.objects.filter(github_username=username).first()

        if not user or not hasattr(user, 'skill_profile'):
            return Response(
                {'error': 'Profile not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        profile = user.skill_profile

        # Serialize profile data
        data = {
            'github_username': user.github_username,
            'total_score': profile.total_score,
            'credibility_tier': profile.credibility_tier,
            'top_languages': profile.top_languages,
            'domain_tags': profile.domain_tags,
            'collaboration_ratio': profile.collaboration_ratio,
            'notable_contributions': profile.notable_contributions,
            'last_analyzed': profile.last_analyzed.isoformat() if profile.last_analyzed else None,
            'is_claimed': user.is_active and user.email,  # Has claimed if they have an account
        }

        return Response(data)

    except Exception as e:
        logger.error(f"Error fetching profile for {username}: {e}")
        return Response(
            {'error': 'Internal server error'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([AllowAny])  # Public endpoint - anyone can trigger analysis
def analyze_github_profile(request, username):
    """
    Analyze a GitHub user's profile and create/update their SkillProfile
    This is rate-limited in production to prevent abuse
    """
    try:
        # Check if GitHub API token is configured
        github_token = settings.GITHUB_API_TOKEN
        if not github_token:
            return Response(
                {'error': 'GitHub API not configured'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )

        # Initialize analyzer
        analyzer = GitHubSkillAnalyzer(github_token)

        # Analyze the profile
        try:
            skill_data = analyzer.analyze_profile(username)
        except Exception as e:
            logger.error(f"GitHub analysis failed for {username}: {e}")
            return Response(
                {'error': 'Failed to analyze GitHub profile. User may not exist or be private.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get or create user
        user, created = User.objects.get_or_create(
            github_username=username,
            defaults={
                'username': username,  # Use GitHub username as Django username
                'is_active': False,  # Not claimed yet
            }
        )

        # Create or update SkillProfile
        profile, profile_created = SkillProfile.objects.update_or_create(
            user=user,
            defaults={
                'top_languages': skill_data['top_languages'],
                'domain_tags': skill_data['domain_tags'],
                'credibility_tier': skill_data['credibility_tier'],
                'total_score': skill_data['total_score'],
                'collaboration_ratio': skill_data['collaboration_ratio'],
                'notable_contributions': skill_data['notable_contributions'],
                'analysis_version': '1.0',
            }
        )

        # Return the profile data
        data = {
            'github_username': user.github_username,
            'total_score': profile.total_score,
            'credibility_tier': profile.credibility_tier,
            'top_languages': profile.top_languages,
            'domain_tags': profile.domain_tags,
            'collaboration_ratio': profile.collaboration_ratio,
            'notable_contributions': profile.notable_contributions,
            'last_analyzed': profile.last_analyzed.isoformat() if profile.last_analyzed else None,
            'is_claimed': False,  # Just analyzed, so not claimed
        }

        return Response(data, status=status.HTTP_201_CREATED if profile_created else status.HTTP_200_OK)

    except Exception as e:
        logger.error(f"Error analyzing profile for {username}: {e}")
        return Response(
            {'error': 'Internal server error'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([AllowAny])  # Public endpoint
def get_leaderboard(request):
    """
    Get top-ranked GitHub developers
    Query params:
    - limit: Number of results (default 100, max 1000)
    - language: Filter by language
    - tier: Filter by tier (1, 2, or 3)
    """
    try:
        limit = min(int(request.query_params.get('limit', 100)), 1000)
        language_filter = request.query_params.get('language')
        tier_filter = request.query_params.get('tier')

        # Base query
        queryset = SkillProfile.objects.select_related('user').all()

        # Apply filters
        if tier_filter:
            try:
                tier = int(tier_filter)
                queryset = queryset.filter(credibility_tier=tier)
            except ValueError:
                pass

        # Order by total score descending
        queryset = queryset.order_by('-total_score')[:limit]

        # Serialize
        leaderboard = []
        for rank, profile in enumerate(queryset, start=1):
            data = {
                'rank': rank,
                'github_username': profile.user.github_username,
                'total_score': profile.total_score,
                'credibility_tier': profile.credibility_tier,
                'top_languages': profile.top_languages[:5],  # Top 5 only
                'is_claimed': profile.user.is_active and profile.user.email,
            }

            # Language filter (post-query since it's in JSON field)
            if language_filter:
                languages = [lang['language'].lower() for lang in profile.top_languages]
                if language_filter.lower() not in languages:
                    continue

            leaderboard.append(data)

        return Response({
            'count': len(leaderboard),
            'results': leaderboard
        })

    except Exception as e:
        logger.error(f"Error fetching leaderboard: {e}")
        return Response(
            {'error': 'Internal server error'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
