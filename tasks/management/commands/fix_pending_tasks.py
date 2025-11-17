"""
Django management command to fix pending tasks.
Updates all pending tasks to available status for published projects.
"""
from django.core.management.base import BaseCommand
from tasks.models import Task
from integration.models import LabelStudioProject


class Command(BaseCommand):
    help = 'Fix pending tasks by setting them to available for published projects'

    def handle(self, *args, **options):
        # Get all published projects
        published_projects = LabelStudioProject.objects.filter(is_published=True)

        total_updated = 0

        for project in published_projects:
            # Update pending tasks to available
            updated = Task.objects.filter(
                project=project,
                status='pending'
            ).update(status='available')

            if updated > 0:
                self.stdout.write(
                    self.style.SUCCESS(
                        f'✓ Updated {updated} pending tasks to available for project: {project.title}'
                    )
                )
                total_updated += updated

        if total_updated == 0:
            self.stdout.write(self.style.WARNING('No pending tasks found in published projects.'))
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    f'\n✓ Total: Updated {total_updated} tasks across {len(published_projects)} published projects'
                )
            )
