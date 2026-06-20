import urllib.request
import urllib.error
import json
import time

def run_test():
    base_url = "http://127.0.0.1:8000/tasks/"
    task_ids = []
    
    print("--- Submitting 5 Tasks ---")
    for i in range(1, 6):
        payload = {
            "type": "data_transform",
            "payload": {"data": f"task_{i}"},
            "priority": "default"
        }
        
        req = urllib.request.Request(
            base_url,
            data=json.dumps(payload).encode('utf-8'),
            headers={'Content-Type': 'application/json'},
            method='POST'
        )
        
        try:
            with urllib.request.urlopen(req) as response:
                res_data = json.loads(response.read().decode('utf-8'))
                task_id = res_data["task_id"]
                task_ids.append(task_id)
                print(f"Task {i} submitted successfully. ID: {task_id}")
        except urllib.error.HTTPError as e:
            print(f"Failed to submit task {i}: {e.code} - {e.read().decode('utf-8')}")
            return
            
    print("\n--- Polling Task Statuses ---")
    completed_tasks = set()
    start_time = time.time()
    
    while len(completed_tasks) < 5 and time.time() - start_time < 30:
        for task_id in task_ids:
            if task_id in completed_tasks:
                continue
                
            req = urllib.request.Request(f"{base_url}{task_id}", method='GET')
            try:
                with urllib.request.urlopen(req) as response:
                    task = json.loads(response.read().decode('utf-8'))
                    if task["status"] == "completed":
                        duration = task.get("result", {}).get("duration_seconds", "unknown")
                        print(f"Task {task_id} is completed. Duration: {duration}s")
                        completed_tasks.add(task_id)
                    elif task["status"] == "failed":
                        print(f"Task {task_id} failed: {task.get('error')}")
                        completed_tasks.add(task_id)
            except urllib.error.HTTPError as e:
                print(f"Failed to get task {task_id}: {e.code}")
        
        if len(completed_tasks) < 5:
            time.sleep(1)
            
    print(f"\n--- Verification Summary ---")
    print(f"Total tasks processed: {len(completed_tasks)}/5")
    if len(completed_tasks) == 5:
        print("Success! Block 2 Verification PASSED.")
    else:
        print("Failure. Some tasks did not complete.")

if __name__ == "__main__":
    run_test()
