# Generated manually for Coinbase CDP wallet integration

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0002_add_wallet_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="wallet_data",
            field=models.TextField(
                blank=True,
                help_text="Encrypted wallet data from Coinbase CDP",
            ),
        ),
        migrations.AddField(
            model_name="user",
            name="wallet_id",
            field=models.CharField(
                blank=True,
                help_text="Coinbase CDP wallet ID",
                max_length=255,
            ),
        ),
    ]
