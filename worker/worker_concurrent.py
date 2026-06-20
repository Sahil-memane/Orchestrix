import os
import time
import socket
import traceback
import signal
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from api.database import SessionLocal, Task
from api.redis_client import redis_client
from worker.tasks import TASK_REGISTRY

# Configuration from environment variables
MAX_WORKERS = int(os.getenv("WORKER_THREADS", "4"))
MAX_RETRIES = int(os.getenv("MAX_RETRIES", "3"))
TASK_TIMEOUT = int(os.getenv("TASK_TIMEOUT", "30"))

# Unique worker ID using hostname + process ID
WORKER_ID = f"{socket.gethostname()}:{os.getpid()}"

# Graceful shutdown flag
shutdown_flag = False

def signal_handler(signum, frame):
    global shutdown_flag
    print(f"\n[Worker {WORKER_ID}] Received signal {signum}. Initiating graceful shutdown...")
    shutdown_flag = True

def process_task(task_id: str):
    """Core execution unit — runs inside a ThreadPoolExecutor thread."""
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

        # 3. Execute with timeout using a nested ThreadPoolExecutor
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as tex:
            future = tex.submit(handler, task.payload)
            try:
                result = future.result(timeout=TASK_TIMEOUT)
            except concurrent.futures.TimeoutError:
                _handle_failure(db, task, f"Task timed out after {TASK_TIMEOUT}s")
                return
            except Exception as e:
                _handle_failure(db, task, f"{str(e)}\n{traceback.format_exc()}")
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

def _handle_failure(db, task, error_msg: str):
    """Handle failure with exponential backoff retry."""
    task_id = str(task.id)
    if task.retry_count < MAX_RETRIES:
        delay = 2 ** task.retry_count  # 1s, 2s, 4s
        print(f"[Worker {WORKER_ID}] Task {task_id} failed. Retrying in {delay}s (attempt {task.retry_count + 1}/{MAX_RETRIES})...")
        time.sleep(delay)
        task.status = "retrying"
        task.retry_count += 1
        db.commit()
        redis_client.set(f"task:{task_id}:status", "retrying")
        redis_client.rpush(f"task:queue:{task.priority}", task_id)
    else:
        print(f"[Worker {WORKER_ID}] Task {task_id} FAILED after {MAX_RETRIES} retries. Error: {error_msg[:100]}")
        task.status = "failed"
        task.error = error_msg
        task.completed_at = datetime.now(timezone.utc)
        db.commit()
        redis_client.set(f"task:{task_id}:status", "failed")

def main():
    global shutdown_flag

    # Register signal handlers for graceful shutdown
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    print(f"[Worker {WORKER_ID}] Starting with {MAX_WORKERS} threads. Listening for tasks...")

    queues = ["task:queue:high", "task:queue:default", "task:queue:low"]

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        while not shutdown_flag:
            try:
                # BLPOP respects key order: high → default → low
                result = redis_client.blpop(queues, timeout=5)
                if result is None:
                    continue  # Timeout — loop back and check shutdown flag

                queue_name, task_id = result
                print(f"[Worker {WORKER_ID}] Dequeued {task_id} from {queue_name}")

                # Submit to thread pool — non-blocking
                executor.submit(process_task, task_id)

            except Exception as e:
                if not shutdown_flag:
                    print(f"[Worker {WORKER_ID}] Error in main loop: {str(e)}")
                    time.sleep(1)

    print(f"[Worker {WORKER_ID}] Worker shut down gracefully.")

if __name__ == "__main__":
    main()
