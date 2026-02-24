from datetime import datetime, time, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Time, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class ShiftSchedule(Base):
    __tablename__ = "shift_schedules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    site_id: Mapped[int] = mapped_column(Integer, ForeignKey("sites.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    # JSON array of ints: 0=Mon … 6=Sun
    days_of_week: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    site: Mapped["Site"] = relationship("Site")  # type: ignore[name-defined]
    instances: Mapped[list["ShiftInstance"]] = relationship(
        "ShiftInstance", back_populates="schedule", cascade="all, delete-orphan"
    )


class ShiftInstance(Base):
    __tablename__ = "shift_instances"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    schedule_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("shift_schedules.id", ondelete="CASCADE"), nullable=False
    )
    machine_id: Mapped[int] = mapped_column(Integer, ForeignKey("machines.id", ondelete="CASCADE"), nullable=False)
    actual_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    actual_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    operator_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    is_confirmed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    schedule: Mapped["ShiftSchedule"] = relationship("ShiftSchedule", back_populates="instances")
    machine: Mapped["Machine"] = relationship("Machine")  # type: ignore[name-defined]
    operator: Mapped["User"] = relationship("User")  # type: ignore[name-defined]
