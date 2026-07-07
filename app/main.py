import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.config import CAMERA_SOURCE, DEVICE_RUNTIME_ENABLED, MODEL_PATH, DB_PATH
from app.database import Database
from app.device_runtime import build_device_runtime
from app.palm_processor import PalmProcessor
from app.routes import recognize, register, users, logs, debug, status, device_registration

log = logging.getLogger("palmgate")

db: Database = None
palm_processor: PalmProcessor = None
device_runtime = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global db, palm_processor, device_runtime
    try:
        db = Database(DB_PATH)
        palm_processor = PalmProcessor(MODEL_PATH)
        if DEVICE_RUNTIME_ENABLED and CAMERA_SOURCE == "usb":
            device_runtime = build_device_runtime(palm_processor, db)
            device_runtime.start()
        yield
    finally:
        if device_runtime is not None:
            device_runtime.stop()
            device_runtime = None
        if palm_processor is not None:
            palm_processor.close()
            palm_processor = None
        if db is not None:
            db.close()
            db = None


app = FastAPI(title="Palmprint Recognition Preview", lifespan=lifespan)

app.include_router(recognize.router)
app.include_router(register.router)
app.include_router(users.router)
app.include_router(logs.router)
app.include_router(debug.router)
app.include_router(status.router)
app.include_router(device_registration.router)
