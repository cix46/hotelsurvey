from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy import String, Integer, Float, DateTime, Text, Boolean, ForeignKey, Enum
from datetime import datetime
from typing import Optional, List
import enum

DATABASE_URL = "sqlite+aiosqlite:///./hotelsurvey.db"

engine = create_async_engine(DATABASE_URL, echo=True)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)

class Base(DeclarativeBase):
    pass

class SurveyStatus(str, enum.Enum):
    QUEUED  = "queued"
    SENT    = "sent"
    REPLIED = "replied"
    EXPIRED = "expired"

class ComplaintStatus(str, enum.Enum):
    NEW         = "new"
    IN_PROGRESS = "in_progress"
    RESOLVED    = "resolved"

class Guest(Base):
    __tablename__ = "guests"
    id:          Mapped[int]      = mapped_column(primary_key=True)
    name:        Mapped[str]      = mapped_column(String(120))
    phone:       Mapped[str]      = mapped_column(String(20))
    room_number: Mapped[str]      = mapped_column(String(10))
    language:    Mapped[str]      = mapped_column(String(5), default="tr")
    checkout_at: Mapped[datetime] = mapped_column(DateTime)
    created_at:  Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    surveys:     Mapped[List["Survey"]] = relationship(back_populates="guest")

class Survey(Base):
    __tablename__ = "surveys"
    id:               Mapped[int]      = mapped_column(primary_key=True)
    guest_id:         Mapped[int]      = mapped_column(ForeignKey("guests.id"))
    status:           Mapped[SurveyStatus] = mapped_column(default=SurveyStatus.QUEUED)
    score:            Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    feedback:         Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    wa_msg_id:        Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    sent_at:          Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    replied_at:       Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    review_link_sent: Mapped[bool]     = mapped_column(Boolean, default=False)
    created_at:       Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    guest:            Mapped["Guest"]  = relationship(back_populates="surveys")
    complaint:        Mapped[Optional["Complaint"]] = relationship(back_populates="survey", uselist=False)

class Complaint(Base):
    __tablename__ = "complaints"
    id:          Mapped[int]      = mapped_column(primary_key=True)
    survey_id:   Mapped[int]      = mapped_column(ForeignKey("surveys.id"))
    status:      Mapped[ComplaintStatus] = mapped_column(default=ComplaintStatus.NEW)
    notes:       Mapped[Optional[str]]  = mapped_column(Text, nullable=True)
    assigned_to: Mapped[Optional[str]]  = mapped_column(String(80), nullable=True)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at:  Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    survey:      Mapped["Survey"] = relationship(back_populates="complaint")

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
