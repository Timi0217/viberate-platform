# Generated manually for GitHub OAuth integration

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0003_add_wallet_data_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="github_id",
            field=models.BigIntegerField(
                blank=True,
                null=True,
                unique=True,
                help_text="GitHub user ID",
            ),
        ),
        migrations.AddField(
            model_name="user",
            name="github_username",
            field=models.CharField(
                blank=True,
                max_length=255,
                help_text="GitHub username",
            ),
        ),
        migrations.AddIndex(
            model_name="user",
            index=models.Index(fields=["github_id"], name="users_user_github__idx"),
        ),
    ]
