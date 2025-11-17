"""
Django management command to set all tasks to available for all published projects.
"""
from django.core.management.base import BaseCommand
from tasks.models import Task
from integration.models import LabelStudioProject


class Command(BaseCommand):
    help = 'Set all tasks to available status for all published projects'

    def handle(self, *args, **options):
        # Get all published projects
        published_projects = LabelStudioProject.objects.filter(is_published=True)

        self.stdout.write(f'\nFound {len(published_projects)} published projects:\n')

        for project in published_projects:
            self.stdout.write(f'\n{project.title} (ID: {project.id})')
            self.stdout.write(f'  - is_published: {project.is_published}')
            self.stdout.write(f'  - budget: ${project.budget_usdc}')

            # Count tasks by status BEFORE
            total_tasks = Task.objects.filter(project=project).count()
            pending_tasks = Task.objects.filter(project=project, status='pending').count()
            available_tasks = Task.objects.filter(project=project, status='available').count()

            self.stdout.write(f'  - BEFORE: Total={total_tasks}, Pending={pending_tasks}, Available={available_tasks}')

            # Update ALL tasks to available (not just pending)
            updated = Task.objects.filter(project=project).update(status='available')

            # Count again AFTER
            available_after = Task.objects.filter(project=project, status='available').count()

            self.stdout.write(self.style.SUCCESS(f'  - AFTER: Set {updated} tasks to available (now {available_after} available)'))

        self.stdout.write(self.style.SUCCESS(f'\n✓ Done! All tasks in published projects are now available.\n'))
