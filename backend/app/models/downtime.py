from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Double, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class DowntimeCategory(Base):
    __tablename__ = "downtime_categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    counts_against_availability: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    secondary_categories: Mapped[list["DowntimeSecondaryCategory"]] = relationship(
        "DowntimeSecondaryCategory", back_populates="primary_category", cascade="all, delete-orphan"
    )


class DowntimeSecondaryCategory(Base):
    __tablename__ = "downtime_secondary_categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    primary_category_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("downtime_categories.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    primary_category: Mapped["DowntimeCategory"] = relationship(
        "DowntimeCategory", back_populates="secondary_categories"
    )
    codes: Mapped[list["DowntimeCode"]] = relationship(
        "DowntimeCode", back_populates="secondary_category", cascade="all, delete-orphan"
    )


class DowntimeCode(Base):
    __tablename__ = "downtime_codes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    secondary_category_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("downtime_secondary_categories.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    secondary_category: Mapped["DowntimeSecondaryCategory"] = relationship(
        "DowntimeSecondaryCategory", back_populates="codes"
    )


class DowntimeTagConfig(Base):
    __tablename__ = "downtime_tag_configs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    machine_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("machines.id", ondelete="CASCADE"), nullable=False
    )
    measurement_name: Mapped[str] = mapped_column(String(128), nullable=False)
    tag_field: Mapped[str] = mapped_column(String(128), nullable=False)
    tag_type: Mapped[str] = mapped_column(String(16), nullable=False, default="digital")
    digital_downtime_value: Mapped[str | None] = mapped_column(String(64), nullable=True)
    analog_operator: Mapped[str | None] = mapped_column(String(8), nullable=True)
    analog_threshold: Mapped[float | None] = mapped_column(Double(), nullable=True)
    downtime_category_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("downtime_categories.id", ondelete="SET NULL"), nullable=True
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    machine: Mapped["Machine"] = relationship("Machine")  # type: ignore[name-defined]
    downtime_category: Mapped["DowntimeCategory | None"] = relationship("DowntimeCategory")


class DowntimeEvent(Base):
    __tablename__ = "downtime_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    machine_id: Mapped[int] = mapped_column(Integer, ForeignKey("machines.id", ondelete="CASCADE"), nullable=False)
    shift_instance_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("shift_instances.id", ondelete="SET NULL"), nullable=True
    )
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reason_code_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("downtime_codes.id", ondelete="SET NULL"), nullable=True
    )
    comments: Mapped[str | None] = mapped_column(Text, nullable=True)
    operator_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    source_tag_config_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("downtime_tag_configs.id", ondelete="SET NULL"), nullable=True
    )
    parent_event_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("downtime_events.id", ondelete="SET NULL"), nullable=True
    )
    is_split: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    machine: Mapped["Machine"] = relationship("Machine")  # type: ignore[name-defined]
    shift_instance: Mapped["ShiftInstance"] = relationship("ShiftInstance")  # type: ignore[name-defined]
    reason_code: Mapped["DowntimeCode"] = relationship("DowntimeCode")
    operator: Mapped["User"] = relationship("User")  # type: ignore[name-defined]
    source_tag_config: Mapped["DowntimeTagConfig | None"] = relationship("DowntimeTagConfig")
