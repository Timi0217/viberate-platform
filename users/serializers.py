from rest_framework import serializers
from .models import User


class UserSerializer(serializers.ModelSerializer):
    """Serializer for User model."""

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'user_type', 'bio', 'avatar_url', 'skills', 'rating',
            'tasks_completed', 'base_wallet_address', 'usdc_balance', 'created_at'
        ]
        read_only_fields = ['id', 'rating', 'tasks_completed', 'usdc_balance', 'created_at']


class UserCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating new users."""
    password = serializers.CharField(write_only=True, required=True, style={'input_type': 'password'})

    class Meta:
        model = User
        fields = [
            'username', 'email', 'password', 'first_name', 'last_name',
            'user_type', 'bio', 'avatar_url', 'skills'
        ]

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User.objects.create(**validated_data)
        user.set_password(password)
        user.save()
        return user


class AnnotatorSerializer(serializers.ModelSerializer):
    """Simplified serializer for annotators (public profile)."""

    class Meta:
        model = User
        fields = [
            'id', 'username', 'first_name', 'last_name',
            'bio', 'avatar_url', 'skills', 'rating', 'tasks_completed'
        ]
        read_only_fields = fields
