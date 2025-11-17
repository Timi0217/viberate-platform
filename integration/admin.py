from django.contrib import admin
from .models import LabelStudioProject, LabelStudioConnection


@admin.register(LabelStudioProject)
class LabelStudioProjectAdmin(admin.ModelAdmin):
    list_display = ['title', 'labelstudio_project_id', 'researcher', 'is_active', 'total_tasks', 'completed_tasks', 'created_at']
    list_filter = ['is_active', 'sync_enabled', 'created_at', 'researcher']
    search_fields = ['title', 'description', 'labelstudio_project_id']
    readonly_fields = ['created_at', 'updated_at', 'last_synced_at']

    fieldsets = (
        ('Project Info', {
            'fields': ('researcher', 'labelstudio_project_id', 'title', 'description')
        }),
        ('Configuration', {
            'fields': ('label_config', 'is_active', 'sync_enabled')
        }),
        ('Stats', {
            'fields': ('total_tasks', 'completed_tasks')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at', 'last_synced_at')
        }),
    )


@admin.register(LabelStudioConnection)
class LabelStudioConnectionAdmin(admin.ModelAdmin):
    list_display = ['researcher', 'labelstudio_url', 'is_verified', 'last_verified_at', 'created_at']
    list_filter = ['is_verified', 'created_at']
    search_fields = ['researcher__username', 'researcher__email', 'labelstudio_url']
    readonly_fields = ['created_at', 'updated_at', 'last_verified_at']

    fieldsets = (
        ('Connection Info', {
            'fields': ('researcher', 'labelstudio_url', 'api_token')
        }),
        ('Verification', {
            'fields': ('is_verified', 'last_verified_at')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at')
        }),
    )
