from rest_framework import serializers
from .models import LabelStudioProject, LabelStudioConnection
from .labelstudio_client import LabelStudioClient, login_and_get_token


class LabelStudioProjectSerializer(serializers.ModelSerializer):
    """Serializer for LabelStudioProject model."""
    researcher_username = serializers.CharField(source='researcher.username', read_only=True)
    completion_percentage = serializers.SerializerMethodField()
    remaining_budget = serializers.SerializerMethodField()
    can_publish = serializers.SerializerMethodField()

    class Meta:
        model = LabelStudioProject
        fields = [
            'id', 'labelstudio_project_id', 'title', 'description',
            'researcher', 'researcher_username', 'label_config',
            'is_active', 'is_published', 'total_tasks', 'completed_tasks',
            'completion_percentage', 'sync_enabled', 'last_synced_at',
            'budget_usdc', 'price_per_task', 'remaining_budget', 'can_publish',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'researcher', 'total_tasks', 'completed_tasks',
            'price_per_task', 'remaining_budget', 'can_publish',
            'last_synced_at', 'created_at', 'updated_at'
        ]

    def get_completion_percentage(self, obj):
        if obj.total_tasks == 0:
            return 0
        return round((obj.completed_tasks / obj.total_tasks) * 100, 2)

    def get_remaining_budget(self, obj):
        return float(obj.remaining_budget)

    def get_can_publish(self, obj):
        return obj.can_publish


class LabelStudioConnectionSerializer(serializers.ModelSerializer):
    """
    Serializer for LabelStudioConnection model.

    Supports two authentication methods:
    1. Credential-based: Provide username + password, we fetch the token
    2. Token-based: Provide api_token directly (for advanced users)
    """
    # Optional fields for credential-based authentication
    email = serializers.EmailField(
        write_only=True,
        required=False,
        help_text="Label Studio email (for credential-based auth)"
    )
    password = serializers.CharField(
        write_only=True,
        required=False,
        style={'input_type': 'password'},
        help_text="Label Studio password (for credential-based auth)"
    )

    class Meta:
        model = LabelStudioConnection
        fields = [
            'id', 'labelstudio_url', 'api_token', 'email', 'password',
            'is_verified', 'last_verified_at', 'created_at'
        ]
        read_only_fields = ['id', 'is_verified', 'last_verified_at', 'created_at']
        extra_kwargs = {
            'api_token': {
                'write_only': True,
                'required': False,
                'help_text': 'API token (optional if using username/password)'
            }
        }

    def validate(self, attrs):
        """
        Verify the connection works.

        If email/password provided: Authenticate and fetch token
        If api_token provided: Verify token works
        """
        url = attrs.get('labelstudio_url')
        email = attrs.pop('email', None)
        password = attrs.pop('password', None)
        token = attrs.get('api_token')

        # Check that we have either credentials OR token
        if not token and not (email and password):
            raise serializers.ValidationError(
                "Please provide either 'api_token' OR both 'email' and 'password'"
            )

        # Method 1: Credential-based authentication (email + password)
        if email and password:
            try:
                # Login and get the token
                api_token = login_and_get_token(url, email, password)

                # Store the fetched token
                attrs['api_token'] = api_token
                attrs['is_verified'] = True

            except Exception as e:
                raise serializers.ValidationError({
                    'email': f'Label Studio authentication failed: {str(e)}'
                })

        # Method 2: Token-based authentication
        else:
            try:
                client = LabelStudioClient(api_url=url, api_token=token)
                user_info = client.verify_connection()
                attrs['is_verified'] = True

                # Store Label Studio user ID
                if 'id' in user_info:
                    self.context['labelstudio_user_id'] = user_info.get('id')

            except Exception as e:
                raise serializers.ValidationError({
                    'api_token': f'Connection verification failed: {str(e)}'
                })

        return attrs


class ProjectImportSerializer(serializers.Serializer):
    """Serializer for importing a project from Label Studio."""
    labelstudio_project_id = serializers.IntegerField(required=True)

    def validate_labelstudio_project_id(self, value):
        """Verify the project exists in Label Studio."""
        user = self.context['request'].user

        if not hasattr(user, 'labelstudio_connection'):
            raise serializers.ValidationError(
                "You must configure Label Studio connection first."
            )

        try:
            from .labelstudio_client import create_client_for_user
            client = create_client_for_user(user)
            project = client.get_project(value)

            # Store project data in context for later use
            self.context['labelstudio_project'] = project

        except Exception as e:
            raise serializers.ValidationError(f"Could not fetch project: {str(e)}")

        # Check if already imported
        if LabelStudioProject.objects.filter(
            labelstudio_project_id=value,
            researcher=user
        ).exists():
            raise serializers.ValidationError("This project is already imported.")

        return value
