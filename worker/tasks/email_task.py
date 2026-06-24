import time
import random

def send_email(payload):
    sleep_time = payload.get("sleep_seconds", random.uniform(1.0, 3.0))
    time.sleep(sleep_time)
    return {
        "sent": True,
        "recipient": payload.get("to", "recipient@example.com"),
        "subject": payload.get("subject", "Orchestrix Task Notification"),
        "duration_seconds": round(sleep_time, 2)
    }
