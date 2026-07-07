def scan_quality_failures(metrics: dict) -> list[str]:
    return [] if metrics.get("hand_detected", False) else ["hand"]


def scan_frame_score(metrics: dict) -> float:
    return float(metrics.get("blur_score") or 0.0)
