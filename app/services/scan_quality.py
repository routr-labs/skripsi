def scan_quality_failures(metrics: dict) -> list[str]:
    # ponytail: recognition blocks only detection/clipping; blur stays a ranking signal.
    failures = []
    if not metrics.get("hand_detected", False):
        failures.append("hand")
    if metrics.get("hand_clipped", False):
        failures.append("clipping")
    return failures


def scan_frame_score(metrics: dict) -> float:
    return float(metrics.get("blur_score") or 0.0)
