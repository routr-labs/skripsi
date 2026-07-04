import base64
import logging

import cv2
import numpy as np
from fastapi.testclient import TestClient

from app.main import app


def encoded_image():
    frame = np.zeros((20, 20, 3), dtype=np.uint8)
    ok, data = cv2.imencode(".jpg", frame)
    assert ok
    return "data:image/jpeg;base64," + base64.b64encode(data.tobytes()).decode("ascii")


def test_encode_roi_image_logs_warning_when_imencode_fails(monkeypatch, caplog):
    import app.routes.recognize as recognize_route

    monkeypatch.setattr(recognize_route.cv2, "imencode", lambda *args, **kwargs: (False, None))

    with caplog.at_level(logging.WARNING, logger="palmgate"):
        roi_image = recognize_route.encode_roi_image(np.zeros((2, 2, 3), dtype=np.uint8))

    assert roi_image is None
    assert "ROI preview encoding failed" in caplog.text


def test_recognize_full_frame_uses_notebook_embedding(monkeypatch):
    import app.main as main

    class FakeProcessor:
        def __init__(self):
            self.used_notebook = False

        def get_embedding_from_notebook_frame(self, frame, tta_enabled=False):
            self.used_notebook = True
            self.tta_enabled = tta_enabled
            return np.ones(4, dtype=np.float32)

        def compute_similarity(self, embedding, stored, threshold):
            return {
                "status": "DENIED",
                "name": "Unknown",
                "similarity": 0.1,
                "closest_match": None,
                "user_id": None,
            }

    class FakeDB:
        def get_all_embeddings(self):
            return []

        def add_access_log(self, user_id, matched_name, status, similarity, duration_ms=None, description=None):
            pass

    processor = FakeProcessor()
    monkeypatch.setattr(main, "palm_processor", processor)
    monkeypatch.setattr(main, "db", FakeDB())
    client = TestClient(app)

    response = client.post("/api/recognize", json={"image": encoded_image(), "is_roi": False})

    assert response.status_code == 200
    assert processor.used_notebook is True


def test_recognize_uses_recognition_tta_flag(monkeypatch):
    import app.main as main
    import app.routes.recognize as recognize_route

    class FakeProcessor:
        def __init__(self):
            self.tta_enabled = None

        def get_embedding_from_notebook_frame(self, frame, tta_enabled=False):
            self.tta_enabled = tta_enabled
            return np.ones(4, dtype=np.float32)

        def compute_similarity(self, embedding, stored, threshold):
            return {"status": "DENIED", "name": "Unknown", "similarity": 0.1, "closest_match": None, "user_id": None}

    class FakeDB:
        def get_all_embeddings(self):
            return []

        def add_access_log(self, *args, **kwargs):
            pass

    fake_processor = FakeProcessor()
    monkeypatch.setattr(main, "palm_processor", fake_processor)
    monkeypatch.setattr(main, "db", FakeDB())
    monkeypatch.setattr(recognize_route, "RECOGNITION_TTA_ENABLED", True)
    monkeypatch.setattr(recognize_route, "decode_base64_image", lambda image: np.zeros((2, 2, 3), dtype=np.uint8))

    client = TestClient(app)
    response = client.post("/api/recognize", json={"image": "img"})

    assert response.status_code == 200
    assert fake_processor.tta_enabled is True


def test_recognize_returns_roi_image_in_dev_debug_mode(monkeypatch):
    import app.main as main
    import app.routes.recognize as recognize_route

    class FakeProcessor:
        def get_embedding_with_processed_roi(self, frame, tta_enabled=False):
            self.used_debug_roi = True
            return np.ones(4, dtype=np.float32), np.full((224, 224, 3), 128, dtype=np.uint8)

        def compute_similarity(self, embedding, stored, threshold):
            return {
                "status": "ALLOWED",
                "name": "Alice",
                "similarity": 0.75,
                "closest_match": "Alice",
                "user_id": 1,
            }

    class FakeDB:
        def get_all_embeddings(self):
            return [{"id": 1, "name": "Alice", "embedding": np.ones(4, dtype=np.float32)}]

        def add_access_log(self, *args, **kwargs):
            pass

    fake_processor = FakeProcessor()
    monkeypatch.setattr(main, "palm_processor", fake_processor)
    monkeypatch.setattr(main, "db", FakeDB())
    monkeypatch.setattr(recognize_route, "DEV_FEATURES_ENABLED", True)
    monkeypatch.setattr(recognize_route, "decode_base64_image", lambda image: np.zeros((20, 20, 3), dtype=np.uint8))

    client = TestClient(app)
    response = client.post("/api/recognize", json={"image": "img", "debug_roi": True})

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ALLOWED"
    assert data["roi_image"].startswith("data:image/jpeg;base64,")
    assert fake_processor.used_debug_roi is True


def test_recognize_does_not_return_roi_image_in_production(monkeypatch):
    import app.main as main
    import app.routes.recognize as recognize_route

    class FakeProcessor:
        def get_embedding_from_notebook_frame(self, frame, tta_enabled=False):
            return np.ones(4, dtype=np.float32)

        def compute_similarity(self, embedding, stored, threshold):
            return {"status": "DENIED", "name": "Unknown", "similarity": 0.1, "closest_match": None, "user_id": None}

    class FakeDB:
        def get_all_embeddings(self):
            return []

        def add_access_log(self, *args, **kwargs):
            pass

    monkeypatch.setattr(main, "palm_processor", FakeProcessor())
    monkeypatch.setattr(main, "db", FakeDB())
    monkeypatch.setattr(recognize_route, "DEV_FEATURES_ENABLED", False)
    monkeypatch.setattr(recognize_route, "decode_base64_image", lambda image: np.zeros((20, 20, 3), dtype=np.uint8))

    client = TestClient(app)
    response = client.post("/api/recognize", json={"image": "img", "debug_roi": True})

    assert response.status_code == 200
    data = response.json()
    assert data["closest_match"] is None
    assert "roi_image" not in data
