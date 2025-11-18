#!/usr/bin/env python
"""
Manually sync project statistics.
Run this to update project stats immediately.
"""
import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'viberate_platform.settings')
django.setup()

from integration.models import LabelStudioProject

def sync_stats():
    """Update task counts for all projects."""
    projects = LabelStudioProject.objects.all()

    print(f"Syncing stats for {projects.count()} project(s)...\n")

    for project in projects:
        old_total = project.total_tasks
        old_completed = project.completed_tasks

        # Update counts
        project.update_task_counts()

        print(f"Project: {project.title}")
        print(f"  Total: {old_total} → {project.total_tasks}")
        print(f"  Completed: {old_completed} → {project.completed_tasks}")
        print(f"  Progress: {project.completion_percentage}%\n")

    print("✅ All project stats synced!")

if __name__ == '__main__':
    sync_stats()
