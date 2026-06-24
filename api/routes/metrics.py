import time
import json
import asyncio
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from api.database import get_db, Task
from api.redis_client import redis_client

router = APIRouter()

@router.get("/")
def get_metrics(db: Session = Depends(get_db)):
    # 1. Queue depth from Redis lists
    try:
        high_len = redis_client.llen("task:queue:high")
        default_len = redis_client.llen("task:queue:default")
        low_len = redis_client.llen("task:queue:low")
    except Exception:
        high_len = default_len = low_len = 0

    queue_depth = {
        "high": high_len,
        "default": default_len,
        "low": low_len
    }

    # 2. Active workers from Redis heartbeats
    active_workers_count = 0
    worker_details = []
    
    # Query database for active tasks per worker
    active_tasks_per_worker = {}
    try:
        results = db.query(Task.worker_id, func.count(Task.id)).filter(
            Task.status.in_(['processing', 'retrying'])
        ).group_by(Task.worker_id).all()
        for w_id, count in results:
            if w_id:
                active_tasks_per_worker[w_id] = count
    except Exception as e:
        print(f"Error querying active tasks per worker: {e}")

    try:
        heartbeat_keys = redis_client.keys("worker:*:heartbeat")
        now = int(time.time())
        for key in heartbeat_keys:
            key_str = key if isinstance(key, str) else key.decode('utf-8')
            parts = key_str.split(':')
            if len(parts) >= 2:
                worker_id = parts[1]
                try:
                    last_beat = int(redis_client.get(key_str) or 0)
                    is_active = (now - last_beat) <= 30
                    if is_active:
                        active_workers_count += 1
                    
                    # Compute tasks active on this worker hostname
                    active_tasks = sum(count for w_id, count in active_tasks_per_worker.items() if w_id.startswith(worker_id))
                    
                    worker_details.append({
                        "id": worker_id,
                        "last_heartbeat": last_beat,
                        "active": is_active,
                        "seconds_since_heartbeat": now - last_beat,
                        "active_tasks": active_tasks,
                        "capacity": 4
                    })
                except Exception:
                    pass
    except Exception:
        pass

    # 3. Status counts from PostgreSQL
    status_counts = {
        "pending": 0,
        "processing": 0,
        "completed": 0,
        "failed": 0,
        "retrying": 0,
        "cancelled": 0
    }
    try:
        results = db.query(Task.status, func.count(Task.id)).group_by(Task.status).all()
        for status_val, count in results:
            if status_val in status_counts:
                status_counts[status_val] = count
    except Exception as e:
        print(f"Error querying status counts: {e}")

    # 4. Tasks completed per minute (rolling window) from PostgreSQL
    tasks_per_minute = 0
    try:
        one_minute_ago = datetime.now(timezone.utc) - timedelta(minutes=1)
        tasks_per_minute = db.query(func.count(Task.id)).filter(
            Task.status == 'completed',
            Task.completed_at >= one_minute_ago
        ).scalar() or 0
    except Exception as e:
        print(f"Error querying tasks per minute: {e}")

    return {
        "queue_depth": queue_depth,
        "active_workers": active_workers_count,
        "workers": worker_details,
        "tasks_per_minute": tasks_per_minute,
        "status_counts": status_counts
    }

async def event_generator(request: Request):
    # Create subscription
    pubsub = redis_client.pubsub()
    pubsub.subscribe("orchestrix:task_updates")
    
    # Send initial connection validation ping
    yield ": keep-alive\n\n"
    
    try:
        while True:
            # Check if client connection was closed
            if await request.is_disconnected():
                break
            
            # Non-blocking read from redis pubsub
            message = pubsub.get_message(ignore_subscribe_messages=True, timeout=0)
            if message:
                data = message["data"]
                yield f"event: task_update\ndata: {data}\n\n"
            
            # 100ms pause to prevent CPU spinning
            await asyncio.sleep(0.1)
            
    except asyncio.CancelledError:
        pass
    finally:
        pubsub.unsubscribe("orchestrix:task_updates")
        pubsub.close()

@router.get("/stream/tasks")
async def stream_tasks(request: Request):
    return StreamingResponse(
        event_generator(request),
        media_type="text/event-stream"
    )
