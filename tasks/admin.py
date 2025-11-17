from django.contrib import admin
from .models import Task, TaskAssignment


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ['labelstudio_task_id', 'project', 'status', 'difficulty', 'reward_points', 'created_at']
    list_filter = ['status', 'difficulty', 'project', 'created_at']
    search_fields = ['labelstudio_task_id', 'project__title']
    readonly_fields = ['created_at', 'updated_at']

    fieldsets = (
        ('Task Info', {
            'fields': ('project', 'labelstudio_task_id', 'data')
        }),
        ('Task Details', {
            'fields': ('status', 'difficulty', 'reward_points')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at')
        }),
    )


@admin.register(TaskAssignment)
class TaskAssignmentAdmin(admin.ModelAdmin):
    list_display = ['task', 'annotator', 'status', 'quality_score', 'assigned_at', 'completed_at']
    list_filter = ['status', 'assigned_at', 'completed_at']
    search_fields = ['task__labelstudio_task_id', 'annotator__username']
    readonly_fields = ['created_at', 'updated_at', 'assigned_at', 'accepted_at', 'started_at', 'submitted_at', 'completed_at']

    fieldsets = (
        ('Assignment Info', {
            'fields': ('task', 'annotator', 'status')
        }),
        ('Annotation Data', {
            'fields': ('annotation_result', 'labelstudio_annotation_id')
        }),
        ('Quality Assessment', {
            'fields': ('quality_score', 'feedback')
        }),
        ('Timestamps', {
            'fields': ('assigned_at', 'accepted_at', 'started_at', 'submitted_at', 'completed_at', 'created_at', 'updated_at')
        }),
    )
