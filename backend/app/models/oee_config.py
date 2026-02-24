"""OEE configuration models — targets, component configs, reject events."""
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class OEETarget(Base):
    __tablename__ = "oee_targets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    machine_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("machines.id", ondelete="CASCADE"), nullable=True
    )
    line_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("lines.id", ondelete="CASCADE"), nullable=True
    )
    availability_target: Mapped[float] = mapped_column(Float, default=0.90, nullable=False)
    performance_target: Mapped[float] = mapped_column(Float, default=0.95, nullable=False)
    quality_target: Mapped[float] = mapped_column(Float, default=0.99, nullable=False)
    oee_target: Mapped[float] = mapped_column(Float, default=0.85, nullable=False)

    machine: Mapped["Machine"] = relationship("Machine")  # type: ignore[name-defined]
    line: Mapped["Line"] = relationship("Line")  # type: ignore[name-defined]


class MachineAvailabilityConfig(Base):
    """Maps OPC-UA state tag values to machine states; controls availability calculation."""

    __tablename__ = "machine_availability_configs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    machine_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("machines.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    # OPC-UA tag path that carries the machine state value
    state_tag: Mapped[str | None] = mapped_column(String(256), nullable=True)
    # Value strings/ints that map to each state
    running_value: Mapped[str | None] = mapped_column(String(64), nullable=True)
    stopped_value: Mapped[str | None] = mapped_column(String(64), nullable=True)
    faulted_value: Mapped[str | None] = mapped_column(String(64), nullable=True)
    idle_value: Mapped[str | None] = mapped_column(String(64), nullable=True)
    changeover_value: Mapped[str | None] = mapped_column(String(64), nullable=True)
    planned_downtime_value: Mapped[str | None] = mapped_column(String(64), nullable=True)
    # JSON array of downtime_category ids that do NOT count against availability
    excluded_category_ids: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    # Planned production time in seconds per shift (overrides schedule-based calculation if set)
    planned_production_time_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)

    machine: Mapped["Machine"] = relationship("Machine")  # type: ignore[name-defined]


class MachinePerformanceConfig(Base):
    """Per-machine (optionally per-product) performance settings."""

    __tablename__ = "machine_performance_configs"
    __table_args__ = (UniqueConstraint("machine_id", "product_id", name="uq_perf_machine_product"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    machine_id: Mapped[int] = mapped_column(Integer, ForeignKey("machines.id", ondelete="CASCADE"), nullable=False)
    product_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("products.id", ondelete="SET NULL"), nullable=True
    )
    ideal_cycle_time_seconds: Mapped[float] = mapped_column(Float, nullable=False)
    rated_speed: Mapped[float | None] = mapped_column(Float, nullable=True)  # parts/hour
    cycle_count_tag: Mapped[str | None] = mapped_column(String(256), nullable=True)
    # Seconds threshold below which a stoppage is classified as a "minor stoppage"
    minor_stoppage_threshold_seconds: Mapped[int] = mapped_column(Integer, default=120, nullable=False)

    machine: Mapped["Machine"] = relationship("Machine")  # type: ignore[name-defined]
    product: Mapped["Product"] = relationship("Product")  # type: ignore[name-defined]


class MachineQualityConfig(Base):
    """Per-machine (optionally per-product) quality settings."""

    __tablename__ = "machine_quality_configs"
    __table_args__ = (UniqueConstraint("machine_id", "product_id", name="uq_qual_machine_product"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    machine_id: Mapped[int] = mapped_column(Integer, ForeignKey("machines.id", ondelete="CASCADE"), nullable=False)
    product_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("products.id", ondelete="SET NULL"), nullable=True
    )
    good_parts_tag: Mapped[str | None] = mapped_column(String(256), nullable=True)
    reject_parts_tag: Mapped[str | None] = mapped_column(String(256), nullable=True)
    # True = operator manually enters reject count; False = read from OPC-UA tag
    manual_reject_entry: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    cost_per_unit: Mapped[float | None] = mapped_column(Float, nullable=True)
    quality_target: Mapped[float] = mapped_column(Float, default=0.99, nullable=False)

    machine: Mapped["Machine"] = relationship("Machine")  # type: ignore[name-defined]
    product: Mapped["Product"] = relationship("Product")  # type: ignore[name-defined]


class RejectEvent(Base):
    """Operator-entered or automatically captured reject records."""

    __tablename__ = "reject_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    machine_id: Mapped[int] = mapped_column(Integer, ForeignKey("machines.id", ondelete="CASCADE"), nullable=False)
    shift_instance_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("shift_instances.id", ondelete="SET NULL"), nullable=True
    )
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    reject_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    reason_code_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("downtime_codes.id", ondelete="SET NULL"), nullable=True
    )
    operator_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    is_manual: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    comments: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    machine: Mapped["Machine"] = relationship("Machine")  # type: ignore[name-defined]
    shift_instance: Mapped["ShiftInstance"] = relationship("ShiftInstance")  # type: ignore[name-defined]
    reason_code: Mapped["DowntimeCode"] = relationship("DowntimeCode")  # type: ignore[name-defined]
    operator: Mapped["User"] = relationship("User")  # type: ignore[name-defined]
