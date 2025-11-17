from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ['username', 'email', 'user_type', 'rating', 'tasks_completed', 'is_staff']
    list_filter = ['user_type', 'is_staff', 'is_active', 'created_at']
    search_fields = ['username', 'email', 'first_name', 'last_name']

    fieldsets = BaseUserAdmin.fieldsets + (
        ('Viberate Info', {
            'fields': ('user_type', 'bio', 'avatar_url')
        }),
        ('Label Studio', {
            'fields': ('labelstudio_user_id', 'labelstudio_api_token')
        }),
        ('Annotator Stats', {
            'fields': ('skills', 'rating', 'tasks_completed')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at')
        }),
    )

    readonly_fields = ['created_at', 'updated_at']

    def get_fieldsets(self, request, obj=None):
        fieldsets = super().get_fieldsets(request, obj)
        if not obj:
            return fieldsets
        return fieldsets
