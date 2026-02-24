from sqlalchemy import Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    sku: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    machine_configs: Mapped[list["MachineProductConfig"]] = relationship(
        "MachineProductConfig", back_populates="product", cascade="all, delete-orphan"
    )


class MachineProductConfig(Base):
    """Ideal cycle time per machine / product combination."""

    __tablename__ = "machine_product_configs"
    __table_args__ = (UniqueConstraint("machine_id", "product_id", name="uq_machine_product"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    machine_id: Mapped[int] = mapped_column(Integer, ForeignKey("machines.id", ondelete="CASCADE"), nullable=False)
    product_id: Mapped[int] = mapped_column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    ideal_cycle_time_seconds: Mapped[float] = mapped_column(Float, nullable=False)

    machine: Mapped["Machine"] = relationship("Machine")  # type: ignore[name-defined]
    product: Mapped["Product"] = relationship("Product", back_populates="machine_configs")
