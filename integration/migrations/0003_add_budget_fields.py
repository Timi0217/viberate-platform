# Generated manually

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('integration', '0002_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='labelstudioproject',
            name='budget_usdc',
            field=models.DecimalField(decimal_places=2, default=0.0, help_text='Total budget allocated for this project in USDC', max_digits=10),
        ),
        migrations.AddField(
            model_name='labelstudioproject',
            name='price_per_task',
            field=models.DecimalField(decimal_places=2, default=5.0, help_text='Automatically calculated price per task based on budget', max_digits=10),
        ),
    ]
