from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import LabelStudioConnectionViewSet, LabelStudioProjectViewSet

router = DefaultRouter()
router.register(r'connections', LabelStudioConnectionViewSet, basename='labelstudio-connection')
router.register(r'projects', LabelStudioProjectViewSet, basename='labelstudio-project')

urlpatterns = [
    path('', include(router.urls)),
]
