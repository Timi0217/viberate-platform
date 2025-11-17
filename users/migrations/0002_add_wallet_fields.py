# Generated manually for wallet integration

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="base_wallet_address",
            field=models.CharField(
                blank=True,
                help_text="Base network wallet address (0x...)",
                max_length=42,
            ),
        ),
        migrations.AddField(
            model_name="user",
            name="usdc_balance",
            field=models.DecimalField(
                decimal_places=6,
                default=0,
                help_text="USDC balance on Base network",
                max_digits=18,
            ),
        ),
    ]
