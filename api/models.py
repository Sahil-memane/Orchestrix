from pydantic import BaseModel, Field
from typing import Optional, Any
from datetime import datetime
from uuid import UUID

class TaskCreate(BaseModel):
    type: str
    payload: dict
    priority: Optional[str] = "default"

class TaskResponse(BaseModel):
    id: UUID
    type: str
    priority: str
    status: str
    payload: Optional[Any] = None
    result: Optional[Any] = None
    error: Optional[str] = None
    worker_id: Optional[str] = None
    retry_count: int
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "id": "e3b0c442-98fc-1c14-9afb-f4c59f9b6e82",
                "type": "image_processing",
                "priority": "default",
                "status": "pending",
                "payload": {"url": "http://example.com/image.jpg"},
                "retry_count": 0,
                "created_at": "2026-06-20T12:00:00Z"
            }
        }
