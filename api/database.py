import os
import sqlalchemy as sa
from sqlalchemy import create_engine, Column, String, Integer, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://orchestrix:password@localhost:5435/orchestrix")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class Task(Base):
    __tablename__ = 'tasks'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()"))
    type = Column(String(50), nullable=False)
    priority = Column(String(10), server_default="default")
    status = Column(String(20), server_default="pending")
    payload = Column(JSONB)
    result = Column(JSONB)
    error = Column(sa.Text)
    worker_id = Column(String(50))
    retry_count = Column(Integer, server_default="0")
    created_at = Column(DateTime(timezone=True), server_default=sa.func.now())
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
