"""
Django management command to delete all users
"""
from django.core.management.base import BaseCommand
from users.models import User


class Command(BaseCommand):
    help = 'Delete all users from the database'

    def handle(self, *args, **options):
        count = User.objects.all().count()
        User.objects.all().delete()
        self.stdout.write(
            self.style.SUCCESS(f'Successfully deleted {count} users')
        )
