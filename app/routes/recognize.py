import base64
import logging
import time
import cv2
import numpy as np
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config import DEV_FEATURES_ENABLED, RECOGNITION_TTA_ENABLED, SIMILARITY_THRESHOLD
from app.services.recognition_service import match_embedding_and_log
from app.services.scan_quality import scan_frame_score, scan_quality_failures

log = logging.getLogger("palmgate")
router = APIRouter()


class RecognizeRequest(BaseModel):
    image: str
    images: list[str] | None = None
    is_roi: bool = False          # True when the browser has pre-cropped the palm ROI
    rotation_angle: float = 0.0   # Knuckle-line tilt (deg) from index-MCP→pinky-MCP vector
    debug_roi: bool = False


class RecognizeResponse(BaseModel):
    status: str
    name: str
    similarity: float
    closest_match: "str | None" = None
    roi_image: "str | None" = None


def decode_base64_image(b64_string: str) -> np.ndarray:
    if "," in b64_string:
        b64_string = b64_string.split(",", 1)[1]
    img_bytes = base64.b64decode(b64_string)
    img_array = np.frombuffer(img_bytes, dtype=np.uint8)
    img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Failed to decode image")
    return cv2.cvtColor(img, cv2.COLOR_BGR2RGB)


def encode_roi_image(processed_roi: np.ndarray) -> str | None:
    try:
        roi_uint8 = np.clip(processed_roi, 0, 255).astype(np.uint8)
        ok, data = cv2.imencode(".jpg", cv2.cvtColor(roi_uint8, cv2.COLOR_RGB2BGR))
        if not ok:
            log.warning("RECOGNIZE | ROI preview encoding failed: cv2.imencode returned false")
            return None
        return "data:image/jpeg;base64," + base64.b64encode(data.tobytes()).decode("ascii")
    except Exception as exc:
        log.warning("RECOGNIZE | ROI preview encoding failed: %s", exc)
        return None


def select_best_scan_frame(palm_processor, frames: list[np.ndarray]):
    best = None
    best_score = -1.0
    for frame in frames:
        metrics = palm_processor.get_registration_guidance_metrics(frame)
        if scan_quality_failures(metrics):
            continue
        score = scan_frame_score(metrics)
        if score > best_score:
            best = frame
            best_score = score
    return best


@router.post("/api/recognize", response_model=RecognizeResponse, response_model_exclude_unset=True)
async def recognize(req: RecognizeRequest):
    from app.main import palm_processor, db

    started_at = time.perf_counter()
    try:
        frame = decode_base64_image(req.image)
        if req.images and not req.is_roi:
            burst_frames = [decode_base64_image(image) for image in req.images]
            best_frame = select_best_scan_frame(palm_processor, burst_frames)
            if best_frame is None:
                log.warning("RECOGNIZE | returning 422 — no acceptable burst frame")
                raise HTTPException(status_code=422, detail="No acceptable hand frame")
            frame = best_frame
        log.debug("RECOGNIZE | decoded image  shape=%s  dtype=%s  payload_len=%d",
                  frame.shape, frame.dtype, len(req.image))
    except HTTPException:
        raise
    except Exception as e:
        log.error("RECOGNIZE | image decode failed: %s", e)
        raise HTTPException(status_code=400, detail="Invalid image data")

    processed_roi = None
    should_return_roi = DEV_FEATURES_ENABLED and req.debug_roi

    if req.is_roi:
        log.debug("RECOGNIZE | using pre-cropped client ROI — skipping server detection")
        if should_return_roi:
            embedding, processed_roi = palm_processor.get_embedding_from_roi_with_processed_roi(
                frame,
                req.rotation_angle,
                tta_enabled=RECOGNITION_TTA_ENABLED,
            )
        else:
            embedding = palm_processor.get_embedding_from_roi(
                frame,
                req.rotation_angle,
                tta_enabled=RECOGNITION_TTA_ENABLED,
            )
    else:
        if should_return_roi:
            embedding, processed_roi = palm_processor.get_embedding_with_processed_roi(
                frame,
                tta_enabled=RECOGNITION_TTA_ENABLED,
            )
        else:
            embedding = palm_processor.get_embedding_from_notebook_frame(
                frame,
                tta_enabled=RECOGNITION_TTA_ENABLED,
            )

    if embedding is None:
        log.warning("RECOGNIZE | returning 422 — no hand detected in frame")
        raise HTTPException(status_code=422, detail="No hand detected")

    duration_ms = int((time.perf_counter() - started_at) * 1000)
    result = match_embedding_and_log(palm_processor, db, embedding, SIMILARITY_THRESHOLD, duration_ms=duration_ms)
    payload = dict(result)
    if should_return_roi and processed_roi is not None:
        roi_image = encode_roi_image(processed_roi)
        if roi_image:
            payload["roi_image"] = roi_image
    return RecognizeResponse(**payload)
