from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from .models import User
from .serializers import UserSerializer, UserCreateSerializer, AnnotatorSerializer


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
