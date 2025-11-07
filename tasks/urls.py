from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TaskViewSet, TaskAssignmentViewSet

router = DefaultRouter()
router.register(r'tasks', TaskViewSet, basename='task')
router.register(r'assignments', TaskAssignmentViewSet, basename='assignment')

urlpatterns = [
    path('', include(router.urls)),
]
