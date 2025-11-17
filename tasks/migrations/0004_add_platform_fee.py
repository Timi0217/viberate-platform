# Generated manually to add platform_fee_usdc field
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tasks', '0003_audit_logging'),
    ]

    operations = [
        migrations.AddField(
            model_name='paymenttransaction',
            name='platform_fee_usdc',
            field=models.DecimalField(
                decimal_places=6,
                default=0,
                help_text='Platform fee (10% of amount_usdc)',
                max_digits=18
            ),
        ),
    ]
