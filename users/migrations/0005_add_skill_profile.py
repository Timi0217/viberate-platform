# Generated manually for GitHub skill profile feature

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0004_add_github_oauth_fields"),
    ]

    operations = [
        migrations.CreateModel(
            name="SkillProfile",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "top_languages",
                    models.JSONField(
                        default=list,
                        help_text="Top programming languages with weighted scores",
                    ),
                ),
                (
                    "domain_tags",
                    models.JSONField(
                        default=list,
                        help_text="Inferred domains like 'machine-learning', 'web-backend', etc.",
                    ),
                ),
                (
                    "credibility_tier",
                    models.IntegerField(
                        choices=[
                            (1, "Tier 1 - Expert"),
                            (2, "Tier 2 - Proficient"),
                            (3, "Tier 3 - Developing"),
                        ],
                        default=3,
                        help_text="Overall skill tier based on weighted score",
                    ),
                ),
                (
                    "total_score",
                    models.FloatField(
                        default=0.0, help_text="Composite score from GitHub analysis"
                    ),
                ),
                (
                    "collaboration_ratio",
                    models.FloatField(
                        default=0.0,
                        help_text="Ratio of external contributions to solo work",
                    ),
                ),
                (
                    "notable_contributions",
                    models.JSONField(
                        default=list, help_text="Top contributions for human review"
                    ),
                ),
                (
                    "github_data_cache",
                    models.JSONField(
                        blank=True,
                        default=dict,
                        help_text="Cached GitHub API response data",
                    ),
                ),
                (
                    "last_analyzed",
                    models.DateTimeField(
                        auto_now=True, help_text="Last time profile was analyzed"
                    ),
                ),
                (
                    "analysis_version",
                    models.CharField(
                        default="1.0",
                        help_text="Version of scoring algorithm used",
                        max_length=20,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="skill_profile",
                        to="users.user",
                    ),
                ),
            ],
            options={
                "ordering": ["-total_score"],
            },
        ),
        migrations.AddIndex(
            model_name="skillprofile",
            index=models.Index(
                fields=["credibility_tier"], name="users_skill_credib_idx"
            ),
        ),
        migrations.AddIndex(
            model_name="skillprofile",
            index=models.Index(fields=["total_score"], name="users_skill_total_s_idx"),
        ),
    ]
