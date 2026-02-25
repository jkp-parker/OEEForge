"""Downtime features: secondary categories, tag configs, event splitting

Revision ID: 002
Revises: 001
Create Date: 2025-01-01 00:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── downtime_secondary_categories ─────────────────────────────────────────
    op.create_table(
        "downtime_secondary_categories",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "primary_category_id",
            sa.Integer(),
            sa.ForeignKey("downtime_categories.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
    )
    op.create_index(
        "ix_downtime_secondary_categories_id",
        "downtime_secondary_categories",
        ["id"],
    )

    # ── downtime_tag_configs ───────────────────────────────────────────────────
    op.create_table(
        "downtime_tag_configs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "machine_id",
            sa.Integer(),
            sa.ForeignKey("machines.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("measurement_name", sa.String(128), nullable=False),
        sa.Column("tag_field", sa.String(128), nullable=False),
        sa.Column("tag_type", sa.String(16), nullable=False, server_default="digital"),
        sa.Column("digital_downtime_value", sa.String(64), nullable=True),
        sa.Column("analog_operator", sa.String(8), nullable=True),
        sa.Column("analog_threshold", sa.Double(), nullable=True),
        sa.Column(
            "downtime_category_id",
            sa.Integer(),
            sa.ForeignKey("downtime_categories.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default="true"),
    )
    op.create_index("ix_downtime_tag_configs_id", "downtime_tag_configs", ["id"])

    # ── Migrate downtime_codes: category_id → secondary_category_id ───────────
    # Step 1: add nullable secondary_category_id column
    op.add_column(
        "downtime_codes",
        sa.Column("secondary_category_id", sa.Integer(), nullable=True),
    )

    # Step 2: for each existing primary category, create a "General" secondary category
    op.execute(
        """
        INSERT INTO downtime_secondary_categories (primary_category_id, name)
        SELECT id, 'General' FROM downtime_categories
        """
    )

    # Step 3: update downtime_codes to point to the new secondary categories
    op.execute(
        """
        UPDATE downtime_codes
        SET secondary_category_id = (
            SELECT dsc.id
            FROM downtime_secondary_categories dsc
            WHERE dsc.primary_category_id = downtime_codes.category_id
            LIMIT 1
        )
        """
    )

    # Step 4: make NOT NULL and add FK constraint
    op.alter_column("downtime_codes", "secondary_category_id", nullable=False)
    op.create_foreign_key(
        "fk_downtime_codes_secondary_category_id",
        "downtime_codes",
        "downtime_secondary_categories",
        ["secondary_category_id"],
        ["id"],
        ondelete="CASCADE",
    )

    # Step 5: drop old category_id FK and column
    op.drop_constraint("downtime_codes_category_id_fkey", "downtime_codes", type_="foreignkey")
    op.drop_column("downtime_codes", "category_id")

    # ── Modify downtime_events: add split/tag-monitoring columns ──────────────
    op.add_column(
        "downtime_events",
        sa.Column(
            "source_tag_config_id",
            sa.Integer(),
            sa.ForeignKey("downtime_tag_configs.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column(
        "downtime_events",
        sa.Column(
            "parent_event_id",
            sa.Integer(),
            sa.ForeignKey("downtime_events.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column(
        "downtime_events",
        sa.Column("is_split", sa.Boolean(), nullable=False, server_default="false"),
    )


def downgrade() -> None:
    # Remove columns from downtime_events
    op.drop_column("downtime_events", "is_split")
    op.drop_column("downtime_events", "parent_event_id")
    op.drop_column("downtime_events", "source_tag_config_id")

    # Restore downtime_codes.category_id from secondary_category_id
    op.add_column(
        "downtime_codes",
        sa.Column("category_id", sa.Integer(), nullable=True),
    )
    op.execute(
        """
        UPDATE downtime_codes
        SET category_id = (
            SELECT dsc.primary_category_id
            FROM downtime_secondary_categories dsc
            WHERE dsc.id = downtime_codes.secondary_category_id
            LIMIT 1
        )
        """
    )
    op.alter_column("downtime_codes", "category_id", nullable=False)
    op.create_foreign_key(
        "downtime_codes_category_id_fkey",
        "downtime_codes",
        "downtime_categories",
        ["category_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.drop_constraint("fk_downtime_codes_secondary_category_id", "downtime_codes", type_="foreignkey")
    op.drop_column("downtime_codes", "secondary_category_id")

    # Drop new tables
    op.drop_table("downtime_tag_configs")
    op.drop_table("downtime_secondary_categories")
