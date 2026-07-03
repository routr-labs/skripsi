from fastapi import APIRouter

from app.config import (
    APP_ENV,
    CAMERA_SOURCE,
    DB_PATH,
    DEVICE_RUNTIME_ENABLED,
    DEV_FEATURES_ENABLED,
    PALMGATE_VERSION,
)

router = APIRouter()


@router.get("/api/status")
async def status():
    from app.main import db, device_runtime

    row = db.get_device_status() if db is not None else None
    device = row or {
        "worker_state": "disabled",
        "camera_connected": 0,
        "last_error": None,
        "fps": None,
        "last_inference_ms": None,
        "last_recognition_at": None,
    }
    if device_runtime is not None:
        session = device_runtime.registration_session
        device = {
            **device,
            "worker_state": device_runtime.worker_state,
            "registration_active": session is not None,
            "registration_session_id": session.id if session else None,
            "registration_sample_index": session.current_sample_index if session else None,
            "registration_captured_count": len(session.captured_samples) if session else 0,
            "scan_state": getattr(device_runtime, "scan_state", None),
        }
    else:
        device = {
            **device,
            "registration_active": False,
            "registration_session_id": None,
            "registration_sample_index": None,
            "registration_captured_count": 0,
            "scan_state": None,
        }
    return {
        "app": {
            "mode": "hybrid",
            "version": PALMGATE_VERSION,
            "environment": APP_ENV,
            "dev_features": DEV_FEATURES_ENABLED,
            "camera_source": CAMERA_SOURCE,
            "device_runtime_enabled": DEVICE_RUNTIME_ENABLED,
        },
        "database": {"path": str(DB_PATH)},
        "device": device,
    }
