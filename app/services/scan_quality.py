from app.config import (
    USB_REGISTRATION_MAX_BRIGHTNESS,
    USB_REGISTRATION_MIN_BLUR,
    USB_REGISTRATION_MIN_BRIGHTNESS,
)


def scan_quality_failures(metrics: dict) -> list[str]:
    # ponytail: reuse registration cutoffs; split scan thresholds if false-denies matter.
    failures = []
    if not metrics.get("hand_detected", False):
        failures.append("hand")
    if metrics.get("hand_clipped", False):
        failures.append("clipping")
    brightness = metrics.get("brightness")
    if brightness is not None and not USB_REGISTRATION_MIN_BRIGHTNESS <= brightness <= USB_REGISTRATION_MAX_BRIGHTNESS:
        failures.append("brightness")
    blur_score = metrics.get("blur_score")
    if blur_score is not None and blur_score < USB_REGISTRATION_MIN_BLUR:
        failures.append("sharpness")
    return failures


def scan_frame_score(metrics: dict) -> float:
    return float(metrics.get("blur_score") or 0.0)
