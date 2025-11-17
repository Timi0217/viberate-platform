from rest_framework import serializers
from .models import Task, TaskAssignment
from users.serializers import AnnotatorSerializer


class TaskSerializer(serializers.ModelSerializer):
    """Serializer for Task model."""
    project_title = serializers.CharField(source='project.title', read_only=True)
    label_config = serializers.JSONField(source='project.label_config', read_only=True)
    has_active_assignment = serializers.SerializerMethodField()
    price_per_task = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = [
            'id', 'labelstudio_task_id', 'project', 'project_title', 'label_config',
            'data', 'status', 'difficulty', 'reward_points',
            'has_active_assignment', 'price_per_task', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'labelstudio_task_id', 'project', 'status',
            'created_at', 'updated_at'
        ]

    def get_has_active_assignment(self, obj):
        """Check if task has an active assignment."""
        return obj.assignments.filter(
            status__in=['assigned', 'accepted', 'in_progress']
        ).exists()

    def get_price_per_task(self, obj):
        """Calculate price per task from project budget."""
        from decimal import Decimal
        if obj.project.total_tasks > 0:
            return float(Decimal(str(obj.project.budget_usdc)) / Decimal(str(obj.project.total_tasks)))
        return 0.0


class TaskAssignmentSerializer(serializers.ModelSerializer):
    """Serializer for TaskAssignment model."""
    task_data = TaskSerializer(source='task', read_only=True)
    annotator_info = AnnotatorSerializer(source='annotator', read_only=True)

    class Meta:
        model = TaskAssignment
        fields = [
            'id', 'task', 'task_data', 'annotator', 'annotator_info',
            'status', 'annotation_result', 'quality_score', 'feedback',
            'assigned_at', 'accepted_at', 'started_at', 'submitted_at',
            'completed_at', 'created_at'
        ]
        read_only_fields = [
            'id', 'task', 'annotator', 'status', 'assigned_at',
            'accepted_at', 'started_at', 'submitted_at', 'completed_at',
            'created_at'
        ]


class TaskClaimSerializer(serializers.Serializer):
    """Serializer for claiming a task."""
    task_id = serializers.IntegerField(required=True)

    def validate_task_id(self, value):
        """Validate that task exists and is available."""
        try:
            task = Task.objects.get(id=value)
        except Task.DoesNotExist:
            raise serializers.ValidationError("Task not found.")

        if not task.is_available():
            raise serializers.ValidationError("Task is not available for assignment.")

        # Store task in context
        self.context['task'] = task
        return value


class AnnotationSubmitSerializer(serializers.Serializer):
    """Serializer for submitting an annotation."""
    annotation_result = serializers.JSONField(required=True)

    def validate_annotation_result(self, value):
        """Validate annotation result structure."""
        if not isinstance(value, (dict, list)):
            raise serializers.ValidationError(
                "Annotation result must be a JSON object or array."
            )
        return value


class AssignmentReviewSerializer(serializers.Serializer):
    """Serializer for reviewing an assignment."""
    action = serializers.ChoiceField(
        choices=['approve', 'reject'],
        required=True
    )
    quality_score = serializers.FloatField(
        required=False,
        min_value=0,
        max_value=10
    )
    feedback = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=1000
    )

    def validate(self, attrs):
        """Validate that quality_score is provided when approving."""
        if attrs.get('action') == 'approve' and 'quality_score' not in attrs:
            raise serializers.ValidationError({
                'quality_score': 'Quality score is required when approving.'
            })
        return attrs
