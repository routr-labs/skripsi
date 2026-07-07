from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
FORBIDDEN_RUNTIME_HOSTS = (
    "cdn.jsdelivr.net",
    "fonts.googleapis.com",
    "fonts.gstatic.com",
    "storage.googleapis.com",
)
RUNTIME_SOURCE_GLOBS = (
    "app/static/*.html",
    "app/static/*.js",
    "app/static/*.css",
    "frontend/app/**/*.ts",
    "frontend/app/**/*.tsx",
    "frontend/app/**/*.css",
)
VENDORED_MEDIAPIPE_ASSETS = (
    "app/static/vendor/mediapipe/vision_bundle.mjs",
    "app/static/vendor/mediapipe/wasm/vision_wasm_internal.js",
    "app/static/vendor/mediapipe/wasm/vision_wasm_internal.wasm",
    "app/static/vendor/mediapipe/wasm/vision_wasm_nosimd_internal.js",
    "app/static/vendor/mediapipe/wasm/vision_wasm_nosimd_internal.wasm",
    "app/static/vendor/mediapipe/hand_landmarker.task",
)


def iter_runtime_sources():
    for pattern in RUNTIME_SOURCE_GLOBS:
        yield from ROOT.glob(pattern)


def test_browser_runtime_sources_do_not_load_public_cdns():
    offenders = []

    for path in iter_runtime_sources():
        text = path.read_text(encoding="utf-8")
        for host in FORBIDDEN_RUNTIME_HOSTS:
            if host in text:
                offenders.append(f"{path.relative_to(ROOT)} -> {host}")

    assert offenders == []


def test_vendored_browser_mediapipe_assets_exist():
    missing = [
        relative_path
        for relative_path in VENDORED_MEDIAPIPE_ASSETS
        if not (ROOT / relative_path).is_file()
    ]

    assert missing == []
