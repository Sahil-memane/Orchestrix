import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from api.database import get_db, Task
from api.redis_client import redis_client
from api.models import TaskCreate, TaskResponse

router = APIRouter()

VALID_TASK_TYPES = {"image_processing", "email_send", "data_transform"}
VALID_PRIORITIES = {"high", "default", "low"}

@router.post("/", status_code=status.HTTP_201_CREATED)
def create_task(task_in: TaskCreate, db: Session = Depends(get_db)):
    # 1. Validate task type
    if task_in.type not in VALID_TASK_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown task type: {task_in.type}"
        )
    
    # 2. Validate priority
    priority = task_in.priority
    if priority not in VALID_PRIORITIES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid priority: {priority}. Must be one of high, default, low."
        )

    # 3. Create task record in Postgres
    task = Task(
        type=task_in.type,
        priority=priority,
        status="pending",
        payload=task_in.payload,
        retry_count=0
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    # 4. Cache status in Redis and push ID to the priority queue
    task_id_str = str(task.id)
    try:
        # Cache status
        redis_client.set(f"task:{task_id_str}:status", "pending")
        # Push to queue
        redis_client.rpush(f"task:queue:{priority}", task_id_str)
    except Exception as e:
        # If Redis queuing fails, clean up the DB task to maintain consistency
        db.delete(task)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to queue task in Redis: {str(e)}"
        )

    return {
        "task_id": task.id,
        "status": task.status,
        "queued_at": task.created_at
    }

@router.get("/{task_id}", response_model=TaskResponse)
def get_task(task_id: uuid.UUID, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )
    return task
