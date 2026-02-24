"""Initial schema

Revision ID: 001
Revises:
Create Date: 2024-01-01 00:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── users ─────────────────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("username", sa.String(64), nullable=False, unique=True),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("role", sa.String(16), nullable=False, server_default="operator"),
        sa.Column("line_id", sa.Integer(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_users_username", "users", ["username"])
    op.create_index("ix_users_email", "users", ["email"])

    # ── sites ─────────────────────────────────────────────────────────────────
    op.create_table(
        "sites",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(128), nullable=False, unique=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("timezone", sa.String(64), nullable=False, server_default="UTC"),
    )

    # ── areas ─────────────────────────────────────────────────────────────────
    op.create_table(
        "areas",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("site_id", sa.Integer(), sa.ForeignKey("sites.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
    )

    # ── lines ─────────────────────────────────────────────────────────────────
    op.create_table(
        "lines",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("area_id", sa.Integer(), sa.ForeignKey("areas.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
    )

    # Add FK from users to lines
    op.create_foreign_key("fk_users_line_id", "users", "lines", ["line_id"], ["id"], ondelete="SET NULL")

    # ── machines ──────────────────────────────────────────────────────────────
    op.create_table(
        "machines",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("line_id", sa.Integer(), sa.ForeignKey("lines.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("opcua_node_id", sa.String(256), nullable=True),
    )

    # ── shift_schedules ───────────────────────────────────────────────────────
    op.create_table(
        "shift_schedules",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("site_id", sa.Integer(), sa.ForeignKey("sites.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("end_time", sa.Time(), nullable=False),
        sa.Column("days_of_week", sa.JSON(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
    )

    # ── shift_instances ───────────────────────────────────────────────────────
    op.create_table(
        "shift_instances",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("schedule_id", sa.Integer(), sa.ForeignKey("shift_schedules.id", ondelete="CASCADE"), nullable=False),
        sa.Column("machine_id", sa.Integer(), sa.ForeignKey("machines.id", ondelete="CASCADE"), nullable=False),
        sa.Column("actual_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("actual_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("operator_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("is_confirmed", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # ── products ──────────────────────────────────────────────────────────────
    op.create_table(
        "products",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("sku", sa.String(64), nullable=False, unique=True),
        sa.Column("description", sa.Text(), nullable=True),
    )
    op.create_index("ix_products_sku", "products", ["sku"])

    # ── machine_product_configs ───────────────────────────────────────────────
    op.create_table(
        "machine_product_configs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("machine_id", sa.Integer(), sa.ForeignKey("machines.id", ondelete="CASCADE"), nullable=False),
        sa.Column("product_id", sa.Integer(), sa.ForeignKey("products.id", ondelete="CASCADE"), nullable=False),
        sa.Column("ideal_cycle_time_seconds", sa.Float(), nullable=False),
        sa.UniqueConstraint("machine_id", "product_id", name="uq_machine_product"),
    )

    # ── downtime_categories ───────────────────────────────────────────────────
    op.create_table(
        "downtime_categories",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(128), nullable=False, unique=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("counts_against_availability", sa.Boolean(), nullable=False, server_default="true"),
    )

    # ── downtime_codes ────────────────────────────────────────────────────────
    op.create_table(
        "downtime_codes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("category_id", sa.Integer(), sa.ForeignKey("downtime_categories.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
    )

    # ── downtime_events ───────────────────────────────────────────────────────
    op.create_table(
        "downtime_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("machine_id", sa.Integer(), sa.ForeignKey("machines.id", ondelete="CASCADE"), nullable=False),
        sa.Column("shift_instance_id", sa.Integer(), sa.ForeignKey("shift_instances.id", ondelete="SET NULL"), nullable=True),
        sa.Column("start_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_time", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reason_code_id", sa.Integer(), sa.ForeignKey("downtime_codes.id", ondelete="SET NULL"), nullable=True),
        sa.Column("comments", sa.Text(), nullable=True),
        sa.Column("operator_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # ── oee_targets ───────────────────────────────────────────────────────────
    op.create_table(
        "oee_targets",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("machine_id", sa.Integer(), sa.ForeignKey("machines.id", ondelete="CASCADE"), nullable=True),
        sa.Column("line_id", sa.Integer(), sa.ForeignKey("lines.id", ondelete="CASCADE"), nullable=True),
        sa.Column("availability_target", sa.Float(), nullable=False, server_default="0.90"),
        sa.Column("performance_target", sa.Float(), nullable=False, server_default="0.95"),
        sa.Column("quality_target", sa.Float(), nullable=False, server_default="0.99"),
        sa.Column("oee_target", sa.Float(), nullable=False, server_default="0.85"),
    )

    # ── machine_availability_configs ──────────────────────────────────────────
    op.create_table(
        "machine_availability_configs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("machine_id", sa.Integer(), sa.ForeignKey("machines.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("state_tag", sa.String(256), nullable=True),
        sa.Column("running_value", sa.String(64), nullable=True),
        sa.Column("stopped_value", sa.String(64), nullable=True),
        sa.Column("faulted_value", sa.String(64), nullable=True),
        sa.Column("idle_value", sa.String(64), nullable=True),
        sa.Column("changeover_value", sa.String(64), nullable=True),
        sa.Column("planned_downtime_value", sa.String(64), nullable=True),
        sa.Column("excluded_category_ids", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("planned_production_time_seconds", sa.Integer(), nullable=True),
    )

    # ── machine_performance_configs ───────────────────────────────────────────
    op.create_table(
        "machine_performance_configs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("machine_id", sa.Integer(), sa.ForeignKey("machines.id", ondelete="CASCADE"), nullable=False),
        sa.Column("product_id", sa.Integer(), sa.ForeignKey("products.id", ondelete="SET NULL"), nullable=True),
        sa.Column("ideal_cycle_time_seconds", sa.Float(), nullable=False),
        sa.Column("rated_speed", sa.Float(), nullable=True),
        sa.Column("cycle_count_tag", sa.String(256), nullable=True),
        sa.Column("minor_stoppage_threshold_seconds", sa.Integer(), nullable=False, server_default="120"),
        sa.UniqueConstraint("machine_id", "product_id", name="uq_perf_machine_product"),
    )

    # ── machine_quality_configs ───────────────────────────────────────────────
    op.create_table(
        "machine_quality_configs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("machine_id", sa.Integer(), sa.ForeignKey("machines.id", ondelete="CASCADE"), nullable=False),
        sa.Column("product_id", sa.Integer(), sa.ForeignKey("products.id", ondelete="SET NULL"), nullable=True),
        sa.Column("good_parts_tag", sa.String(256), nullable=True),
        sa.Column("reject_parts_tag", sa.String(256), nullable=True),
        sa.Column("manual_reject_entry", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("cost_per_unit", sa.Float(), nullable=True),
        sa.Column("quality_target", sa.Float(), nullable=False, server_default="0.99"),
        sa.UniqueConstraint("machine_id", "product_id", name="uq_qual_machine_product"),
    )

    # ── reject_events ─────────────────────────────────────────────────────────
    op.create_table(
        "reject_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("machine_id", sa.Integer(), sa.ForeignKey("machines.id", ondelete="CASCADE"), nullable=False),
        sa.Column("shift_instance_id", sa.Integer(), sa.ForeignKey("shift_instances.id", ondelete="SET NULL"), nullable=True),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("reject_count", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("reason_code_id", sa.Integer(), sa.ForeignKey("downtime_codes.id", ondelete="SET NULL"), nullable=True),
        sa.Column("operator_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("is_manual", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("comments", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("reject_events")
    op.drop_table("machine_quality_configs")
    op.drop_table("machine_performance_configs")
    op.drop_table("machine_availability_configs")
    op.drop_table("oee_targets")
    op.drop_table("downtime_events")
    op.drop_table("downtime_codes")
    op.drop_table("downtime_categories")
    op.drop_table("machine_product_configs")
    op.drop_table("products")
    op.drop_table("shift_instances")
    op.drop_table("shift_schedules")
    op.drop_table("machines")
    op.drop_foreign_key("fk_users_line_id", "users")
    op.drop_table("lines")
    op.drop_table("areas")
    op.drop_table("sites")
    op.drop_table("users")
