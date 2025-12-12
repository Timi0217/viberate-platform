"""
URL configuration for viberate_platform project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""

from django.contrib import admin
from django.urls import path, include
from users.auth_views import (
    login_view,
    register_view,
    logout_view,
    profile_view,
    delete_all_users_view,
    github_login_view
)
from users.github_oauth_views import github_oauth_exchange

urlpatterns = [
    path("admin/", admin.site.urls),

    # Authentication
    path("api/auth/login/", login_view, name='login'),
    path("api/auth/github/", github_login_view, name='github_login'),
    path("api/auth/github/exchange/", github_oauth_exchange, name='github_oauth_exchange'),
    path("api/auth/register/", register_view, name='register'),
    path("api/auth/logout/", logout_view, name='logout'),
    path("api/auth/profile/", profile_view, name='profile'),
    path("api/auth/delete-all-users/", delete_all_users_view, name='delete-all-users'),

    # API endpoints
    path("api/", include('users.urls')),
    path("api/labelstudio/", include('integration.urls')),
    path("api/", include('tasks.urls')),
    path("api/wallet/", include('wallet.urls')),
]
