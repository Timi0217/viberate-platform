from django.core.management.base import BaseCommand
from integration.models import LabelStudioProject
from tasks.models import Task


class Command(BaseCommand):
    help = 'Set all tasks to available for published projects'

    def handle(self, *args, **options):
        self.stdout.write('Fixing tasks for published projects...\n')
        
        published_projects = LabelStudioProject.objects.filter(is_published=True)
        
        total = 0
        for project in published_projects:
            count = Task.objects.filter(project=project).update(status='available')
            total += count
            self.stdout.write(f'  {project.title}: {count} tasks set to available')
        
        self.stdout.write(self.style.SUCCESS(f'\nDone! Updated {total} tasks'))
