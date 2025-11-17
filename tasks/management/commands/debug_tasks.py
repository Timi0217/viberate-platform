"""
Django management command to debug task visibility.
"""
from django.core.management.base import BaseCommand
from tasks.models import Task
from integration.models import LabelStudioProject
from django.contrib.auth import get_user_model

User = get_user_model()


class Command(BaseCommand):
    help = 'Debug task visibility - show all projects and their task statuses'

    def handle(self, *args, **options):
        self.stdout.write('\n' + '='*80)
        self.stdout.write('TASK VISIBILITY DEBUG REPORT')
        self.stdout.write('='*80 + '\n')

        # Get all projects
        projects = LabelStudioProject.objects.all()

        self.stdout.write(f'Total Projects: {projects.count()}\n')

        for project in projects:
            self.stdout.write(f'\n{"-"*80}')
            self.stdout.write(f'PROJECT: {project.title} (ID: {project.id})')
            self.stdout.write(f'{"-"*80}')
            self.stdout.write(f'  - Researcher: {project.researcher.email}')
            self.stdout.write(f'  - is_active: {project.is_active}')
            self.stdout.write(f'  - is_published: {project.is_published}')
            self.stdout.write(f'  - Label Studio ID: {project.labelstudio_project_id}')
            self.stdout.write(f'  - Budget: ${project.budget_usdc}')
            self.stdout.write(f'  - Price per task: ${project.price_per_task}')

            # Get tasks for this project
            tasks = Task.objects.filter(project=project)
            total_tasks = tasks.count()

            self.stdout.write(f'\n  TASKS (Total: {total_tasks}):')

            if total_tasks == 0:
                self.stdout.write('    No tasks found!')
                continue

            # Group by status
            status_counts = {}
            for task in tasks:
                status = task.status
                if status not in status_counts:
                    status_counts[status] = 0
                status_counts[status] += 1

            for status, count in sorted(status_counts.items()):
                self.stdout.write(f'    - {status}: {count} tasks')

            # Show first 3 tasks as examples
            self.stdout.write('\n  Example Tasks:')
            for task in tasks[:3]:
                self.stdout.write(f'    - Task {task.id}: status={task.status}, LS_ID={task.labelstudio_task_id}')

        self.stdout.write('\n' + '='*80)
        self.stdout.write('API QUERY SIMULATION (for annotators)')
        self.stdout.write('='*80 + '\n')

        # Simulate the query that annotators would see
        queryset = Task.objects.filter(
            project__is_active=True,
            project__is_published=True
        ).select_related('project')

        self.stdout.write(f'Total tasks visible to annotators: {queryset.count()}\n')

        # Group by project
        projects_dict = {}
        for task in queryset:
            proj_title = task.project.title
            if proj_title not in projects_dict:
                projects_dict[proj_title] = []
            projects_dict[proj_title].append(task)

        for proj_title, tasks_list in projects_dict.items():
            self.stdout.write(f'\n  {proj_title}: {len(tasks_list)} tasks')
            # Show status breakdown
            status_counts = {}
            for task in tasks_list:
                status = task.status
                if status not in status_counts:
                    status_counts[status] = 0
                status_counts[status] += 1
            for status, count in sorted(status_counts.items()):
                self.stdout.write(f'    - {status}: {count}')

        self.stdout.write('\n' + '='*80 + '\n')
