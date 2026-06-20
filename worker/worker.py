import os
import time
import socket
import traceback
import signal
from datetime import datetime, timezone
from api.database import SessionLocal, Task
from api.redis_client import redis_client
from worker.tasks import TASK_REGISTRY

# Unique worker ID using hostname + process ID
WORKER_ID = f"{socket.gethostname()}:{os.getpid()}"

# Graceful shutdown flag
shutdown_flag = False

def signal_handler(signum, frame):
    global shutdown_flag
    print(f"\n[Worker {WORKER_ID}] Received signal {signum}. Initiating graceful shutdown...")
    shutdown_flag = True

def process_task(task_id: str):
    """Core execution unit — runs synchronously in the main thread."""
    db = SessionLocal()
    try:
        task = db.query(Task).filter(Task.id == task_id).first()
        if not task:
            print(f"[Worker {WORKER_ID}] Task {task_id} not found in database.")
            return

        print(f"[Worker {WORKER_ID}] Picked up task {task_id} (type={task.type}, priority={task.priority})")

        # 1. Mark as PROCESSING in DB and Redis
        task.status = "processing"
        task.started_at = datetime.now(timezone.utc)
        task.worker_id = WORKER_ID
        db.commit()
        redis_client.set(f"task:{task_id}:status", "processing")

        # 2. Get handler from registry
        handler = TASK_REGISTRY.get(task.type)
        if not handler:
            raise ValueError(f"No handler registered for task type: {task.type}")

        # 3. Execute synchronously
        try:
            result = handler(task.payload)
        except Exception as e:
            print(f"[Worker {WORKER_ID}] Handler failed for task {task_id}: {str(e)}")
            task.status = "failed"
            task.error = f"{str(e)}\n{traceback.format_exc()}"
            task.completed_at = datetime.now(timezone.utc)
            db.commit()
            redis_client.set(f"task:{task_id}:status", "failed")
            return

        # 4. Mark COMPLETED
        task.status = "completed"
        task.result = result
        task.completed_at = datetime.now(timezone.utc)
        db.commit()
        redis_client.set(f"task:{task_id}:status", "completed")
        print(f"[Worker {WORKER_ID}] Task {task_id} COMPLETED.")

    except Exception as e:
        print(f"[Worker {WORKER_ID}] Unexpected error for task {task_id}: {str(e)}")
    finally:
        db.close()

def main():
    global shutdown_flag

    # Register signal handlers for graceful shutdown
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    print(f"[Worker {WORKER_ID}] Starting single-threaded worker. Listening for tasks...")

    queues = ["task:queue:high", "task:queue:default", "task:queue:low"]

    while not shutdown_flag:
        try:
            # BLPOP respects key order: high → default → low
            result = redis_client.blpop(queues, timeout=5)
            if result is None:
                continue  # Timeout — loop back and check shutdown flag

            queue_name, task_id = result
            print(f"[Worker {WORKER_ID}] Dequeued {task_id} from {queue_name}")

            # Process task synchronously
            process_task(task_id)

        except Exception as e:
            if not shutdown_flag:
                print(f"[Worker {WORKER_ID}] Error in main loop: {str(e)}")
                time.sleep(1)

    print(f"[Worker {WORKER_ID}] Worker shut down gracefully.")

if __name__ == "__main__":
    main()
