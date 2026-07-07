from fastapi.testclient import TestClient

from app.main import app



def test_status_endpoint_returns_device_status():
    client = TestClient(app)
    response = client.get("/api/status")

    assert response.status_code == 200
    data = response.json()
    assert "app" in data
    assert "device" in data
    assert "database" in data
    assert "camera_source" in data["app"]
    assert "device_runtime_enabled" in data["app"]


def test_status_includes_usb_scan_state(monkeypatch):
    import app.main as main

    class FakeRuntime:
        worker_state = "running"
        registration_session = None
        scan_state = {"stage": "waiting_for_hand", "metrics": {"hand_detected": False}}

    monkeypatch.setattr(main, "device_runtime", FakeRuntime())
    client = TestClient(app)

    response = client.get("/api/status")

    assert response.status_code == 200
    assert response.json()["device"]["scan_state"]["stage"] == "waiting_for_hand"


def test_status_includes_registration_runtime_state(monkeypatch):
    import app.main as main

    class FakeSession:
        id = "session-1"
        current_sample_index = 3
        captured_samples = [{}, {}, {}]

    class FakeRuntime:
        worker_state = "registration_active"
        registration_session = FakeSession()

    monkeypatch.setattr(main, "device_runtime", FakeRuntime())
    client = TestClient(app)

    response = client.get("/api/status")

    assert response.status_code == 200
    device = response.json()["device"]
    assert device["worker_state"] == "registration_active"
    assert device["registration_active"] is True
    assert device["registration_captured_count"] == 3


def test_status_includes_environment_and_dev_features(monkeypatch):
    import app.routes.status as status_route

    monkeypatch.setattr(status_route, "APP_ENV", "development")
    monkeypatch.setattr(status_route, "DEV_FEATURES_ENABLED", True)

    client = TestClient(app)
    response = client.get("/api/status")

    assert response.status_code == 200
    app_status = response.json()["app"]
    assert app_status["environment"] == "development"
    assert app_status["dev_features"] is True


def test_status_reports_configured_app_version(monkeypatch):
    import app.routes.status as status_route

    monkeypatch.setattr(status_route, "PALMGATE_VERSION", "8f5f5d1")

    client = TestClient(app)
    response = client.get("/api/status")

    assert response.status_code == 200
    assert response.json()["app"]["version"] == "8f5f5d1"
