import time
import random

def transform_data(payload):
    if payload.get("should_fail"):
        raise ValueError("Deliberate task failure for retry verification")

    # Simulate processing duration
    sleep_time = payload.get("sleep_seconds", random.uniform(1.0, 3.0))
    time.sleep(sleep_time)
    
    # Process payload
    input_data = payload.get("data", {})
    return {
        "processed": True,
        "input_data": input_data,
        "duration_seconds": round(sleep_time, 2),
        "timestamp": time.time()
    }
