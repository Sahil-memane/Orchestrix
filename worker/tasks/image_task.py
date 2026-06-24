import time
import random

def compress_image(payload):
    sleep_time = payload.get("sleep_seconds", random.uniform(1.0, 3.0))
    time.sleep(sleep_time)
    return {
        "compressed": True,
        "width": payload.get("width", 1920),
        "height": payload.get("height", 1080),
        "duration_seconds": round(sleep_time, 2)
    }
