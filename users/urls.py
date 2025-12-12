from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import UserViewSet
from .github_views import get_github_profile, analyze_github_profile, get_leaderboard

router = DefaultRouter()
router.register(r'users', UserViewSet)

urlpatterns = [
    path('', include(router.urls)),
    # Public GitHub profile endpoints
    path('github/profile/<str:username>/', get_github_profile, name='github-profile'),
    path('github/analyze/<str:username>/', analyze_github_profile, name='github-analyze'),
    path('github/leaderboard/', get_leaderboard, name='github-leaderboard'),
]
