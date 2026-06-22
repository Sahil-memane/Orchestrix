import os
import time
import signal
from datetime import datetime, timezone
from api.database import SessionLocal, Task
from api.redis_client import redis_client

shutdown_flag = False

def signal_handler(signum, frame):
    global shutdown_flag
    print(f"\n[Watchdog] Received signal {signum}. Initiating graceful shutdown...")
    shutdown_flag = True

def recover_worker_tasks(db, worker_id):
    """Resets stuck tasks for a dead worker and re-queues them in Redis."""
    stuck_tasks = db.query(Task).filter(
        Task.worker_id == worker_id,
        Task.status == 'processing'
    ).all()

    if not stuck_tasks:
        return

    print(f"[Watchdog] Recovering {len(stuck_tasks)} tasks from dead worker {worker_id}...")

    for task in stuck_tasks:
        task_id = str(task.id)
        task.status = 'pending'
        task.worker_id = None
        task.started_at = None
        
        # Update Redis status cache
        redis_client.set(f"task:{task_id}:status", "pending")

        # Push task ID back into its priority queue
        queue_key = f"task:queue:{task.priority or 'default'}"
        redis_client.rpush(queue_key, task_id)
        print(f"[Watchdog] Task {task_id} (priority={task.priority}) re-queued to {queue_key}")
        
    db.commit()

def check_stale_workers():
    """Scans for workers without active heartbeats and recovers their tasks."""
    now = int(time.time())
    stale_threshold = now - 30  # 30 seconds without heartbeat is dead

    db = SessionLocal()
    try:
        # Get all tasks currently in processing state from PostgreSQL
        processing_tasks = db.query(Task).filter(Task.status == 'processing').all()
        active_db_workers = {t.worker_id for t in processing_tasks if t.worker_id}

        # Get all worker heartbeat keys from Redis
        heartbeat_keys = redis_client.keys('worker:*:heartbeat')
        active_redis_workers = {}
        
        for key in heartbeat_keys:
            key_str = key if isinstance(key, str) else key.decode('utf-8')
            parts = key_str.split(':')
            if len(parts) >= 2:
                worker_id = parts[1]
                try:
                    last_beat = int(redis_client.get(key_str) or 0)
                    active_redis_workers[worker_id] = last_beat
                except Exception as e:
                    print(f"[Watchdog] Error reading heartbeat for {key_str}: {e}")

        dead_workers = set()

        # 1. Identify workers whose heartbeats are stale in Redis
        for worker_id, last_beat in active_redis_workers.items():
            if last_beat < stale_threshold:
                print(f"[Watchdog] Worker {worker_id} has stale heartbeat ({now - last_beat}s old). Flagging as dead.")
                dead_workers.add(worker_id)

        # 2. Identify workers processing tasks but having NO heartbeat key at all in Redis (e.g. key expired)
        for worker_id in active_db_workers:
            if worker_id not in active_redis_workers:
                print(f"[Watchdog] Worker {worker_id} has active tasks but no heartbeat key in Redis. Flagging as dead.")
                dead_workers.add(worker_id)

        # 3. Recover tasks for all dead workers
        for worker_id in dead_workers:
            recover_worker_tasks(db, worker_id)

    except Exception as e:
        print(f"[Watchdog] Error during stale worker check: {e}")
    finally:
        db.close()

def main():
    global shutdown_flag
    
    # Register signal handlers for graceful shutdown
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    print("[Watchdog] Starting heartbeat monitor loop (runs every 30s)...")
    
    while not shutdown_flag:
        check_stale_workers()
        
        # Sleep in short increments to remain responsive to shutdown signals
        for _ in range(300):
            if shutdown_flag:
                break
            time.sleep(0.1)

    print("[Watchdog] Watchdog process shut down gracefully.")

if __name__ == "__main__":
    main()
