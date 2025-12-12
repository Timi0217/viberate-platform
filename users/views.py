from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from .models import User, SkillProfile
from .serializers import UserSerializer, UserCreateSerializer, AnnotatorSerializer
from .github_skill_analyzer import GitHubSkillAnalyzer
from django.conf import settings
import logging

logger = logging.getLogger(__name__)


class UserViewSet(viewsets.ModelViewSet):
    """ViewSet for User management."""
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        return UserSerializer

    def get_permissions(self):
        if self.action == 'create':
            return [AllowAny()]
        return super().get_permissions()

    @action(detail=False, methods=['get'])
    def me(self, request):
        """Get current user profile."""
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def annotators(self, request):
        """List all annotators (public profiles)."""
        annotators = User.objects.filter(user_type='annotator', is_active=True)
        serializer = AnnotatorSerializer(annotators, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def analyze_github_skills(self, request):
        """
        Analyze user's GitHub profile and generate skill profile.
        This triggers the GitHub skill analysis for the current user.
        """
        user = request.user

        # Check if user has GitHub username
        if not user.github_username:
            return Response(
                {'error': 'GitHub username not found. Please login with GitHub.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # Get GitHub token from settings (you'll need to add this)
            github_token = getattr(settings, 'GITHUB_API_TOKEN', None)
            if not github_token:
                logger.error("GITHUB_API_TOKEN not configured in settings")
                return Response(
                    {'error': 'GitHub analysis not configured'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

            # Initialize analyzer
            analyzer = GitHubSkillAnalyzer(github_token)

            # Analyze the profile
            analysis_result = analyzer.analyze_profile(user.github_username)

            # Create or update skill profile
            skill_profile, created = SkillProfile.objects.update_or_create(
                user=user,
                defaults={
                    'top_languages': analysis_result['top_languages'],
                    'domain_tags': analysis_result['domain_tags'],
                    'credibility_tier': analysis_result['credibility_tier'],
                    'total_score': analysis_result['total_score'],
                    'collaboration_ratio': analysis_result['collaboration_ratio'],
                    'notable_contributions': analysis_result['notable_contributions'],
                }
            )

            return Response({
                'message': 'Skill profile analyzed successfully',
                'profile': {
                    'top_languages': skill_profile.top_languages,
                    'domain_tags': skill_profile.domain_tags,
                    'credibility_tier': skill_profile.credibility_tier,
                    'total_score': skill_profile.total_score,
                    'collaboration_ratio': skill_profile.collaboration_ratio,
                    'notable_contributions': skill_profile.notable_contributions,
                    'last_analyzed': skill_profile.last_analyzed,
                }
            })

        except Exception as e:
            logger.error(f"Error analyzing GitHub profile for {user.username}: {e}")
            return Response(
                {'error': f'Failed to analyze GitHub profile: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['get'])
    def skill_profile(self, request):
        """Get current user's skill profile."""
        user = request.user

        try:
            skill_profile = SkillProfile.objects.get(user=user)
            return Response({
                'top_languages': skill_profile.top_languages,
                'domain_tags': skill_profile.domain_tags,
                'credibility_tier': skill_profile.credibility_tier,
                'total_score': skill_profile.total_score,
                'collaboration_ratio': skill_profile.collaboration_ratio,
                'notable_contributions': skill_profile.notable_contributions,
                'last_analyzed': skill_profile.last_analyzed,
            })
        except SkillProfile.DoesNotExist:
            return Response(
                {
                    'error': 'Skill profile not found',
                    'message': 'Run skill analysis first'
                },
                status=status.HTTP_404_NOT_FOUND
            )
