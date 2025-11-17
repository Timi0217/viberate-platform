"""
Django management command to update label_config for existing projects.
"""
from django.core.management.base import BaseCommand
from integration.models import LabelStudioProject
from integration.labelstudio_client import create_client_for_user


class Command(BaseCommand):
    help = 'Update label_config for all existing LabelStudioProject records'

    def handle(self, *args, **options):
        projects = LabelStudioProject.objects.filter(label_config__isnull=True)
        
        if not projects.exists():
            self.stdout.write(self.style.SUCCESS('All projects already have label_config'))
            return

        self.stdout.write(f'Found {projects.count()} projects without label_config')

        updated_count = 0
        error_count = 0

        for project in projects:
            try:
                # Get researcher who owns this project
                researcher = project.researcher
                
                # Create Label Studio client for this researcher
                ls_client = create_client_for_user(researcher)
                
                # Fetch project from Label Studio
                ls_project = ls_client.get_project(project.labelstudio_project_id)
                
                # Update label_config
                if ls_project.get('label_config'):
                    project.label_config = ls_project['label_config']
                    project.save()
                    updated_count += 1
                    self.stdout.write(
                        self.style.SUCCESS(
                            f'✓ Updated project #{project.id}: {project.title}'
                        )
                    )
                else:
                    self.stdout.write(
                        self.style.WARNING(
                            f'⚠ Project #{project.id} has no label_config in Label Studio'
                        )
                    )
                    
            except Exception as e:
                error_count += 1
                self.stdout.write(
                    self.style.ERROR(
                        f'✗ Error updating project #{project.id}: {str(e)}'
                    )
                )

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS(f'Updated: {updated_count}'))
        if error_count > 0:
            self.stdout.write(self.style.ERROR(f'Errors: {error_count}'))
