# Generated manually

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('integration', '0003_add_budget_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='labelstudioproject',
            name='is_published',
            field=models.BooleanField(default=False, help_text='Whether this project is published and available for annotators. Requires budget > 0'),
        ),
    ]
