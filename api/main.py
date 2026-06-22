import os
from fastapi import FastAPI, Depends, Request
from fastapi.responses import JSONResponse
import sqlalchemy as sa
from sqlalchemy.orm import Session
from api.database import get_db, Base, engine
from api.redis_client import redis_client
from api.routes import tasks, metrics

app = FastAPI(
    title="Orchestrix API",
    description="Distributed Task Execution System API",
    version="1.0"
)

API_INSTANCE_NAME = os.getenv("API_INSTANCE_NAME", "unknown")

@app.middleware("http")
async def add_instance_header(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Instance-Name"] = API_INSTANCE_NAME
    return response

# Include routers
app.include_router(tasks.router, prefix="/tasks", tags=["tasks"])
app.include_router(metrics.router, prefix="/metrics", tags=["metrics"])

@app.get("/")
def read_root():
    return {
        "message": "Welcome to Orchestrix: Distributed Task Execution System API",
        "docs_url": "/docs",
        "health_check_url": "/health"
    }

@app.get("/health")
def health_check(db: Session = Depends(get_db)):
    status = "healthy"
    redis_status = "healthy"
    db_status = "healthy"

    # Check redis connectivity
    try:
        redis_client.ping()
    except Exception as e:
        redis_status = f"unhealthy: {str(e)}"
        status = "unhealthy"

    # Check database connectivity
    try:
        db.execute(sa.text("SELECT 1"))
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"
        status = "unhealthy"

    response_data = {
        "status": status,
        "services": {
            "postgres": db_status,
            "redis": redis_status
        }
    }

    if status == "unhealthy":
        return JSONResponse(status_code=500, content=response_data)
    
    return response_data
