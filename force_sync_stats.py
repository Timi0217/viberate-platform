#!/usr/bin/env python
"""Force sync project stats by directly querying the database"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'viberate_platform.settings')
django.setup()

from integration.models import LabelStudioProject
from tasks.models import Task

# Get the demo project
project = LabelStudioProject.objects.get(id=1)

print(f"\n{'='*60}")
print(f"Project: {project.title}")
print(f"{'='*60}")

# Count tasks by status
total_tasks = project.tasks.count()
completed_tasks = project.tasks.filter(status='completed').count()
available_tasks = project.tasks.filter(status='available').count()
in_progress_tasks = project.tasks.filter(status='in_progress').count()
submitted_tasks = project.tasks.filter(status='submitted').count()

print(f"\nCurrent Database Counts:")
print(f"  Total tasks:      {total_tasks}")
print(f"  Completed:        {completed_tasks}")
print(f"  Available:        {available_tasks}")
print(f"  In Progress:      {in_progress_tasks}")
print(f"  Submitted:        {submitted_tasks}")

print(f"\nCurrent Model Values:")
print(f"  project.total_tasks:      {project.total_tasks}")
print(f"  project.completed_tasks:  {project.completed_tasks}")

# Force update
print(f"\nUpdating project counts...")
project.update_task_counts()

print(f"\nUpdated Model Values:")
print(f"  project.total_tasks:      {project.total_tasks}")
print(f"  project.completed_tasks:  {project.completed_tasks}")
print(f"  Progress:                 {project.completion_percentage}%")

print(f"\n{'='*60}")
print("✅ Stats synced successfully!")
print(f"{'='*60}\n")
