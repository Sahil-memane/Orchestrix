import time
import random

def transform_data(payload):
    # Simulate processing duration
    sleep_time = random.uniform(1.0, 3.0)
    time.sleep(sleep_time)
    
    # Process payload
    input_data = payload.get("data", {})
    return {
        "processed": True,
        "input_data": input_data,
        "duration_seconds": round(sleep_time, 2),
        "timestamp": time.time()
    }
