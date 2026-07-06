from fastapi.testclient import TestClient

from app.main import app


class FakeUsersDB:
    def __init__(self):
        self.updated = None
        self.error = None
        self.result = {"id": 7, "nim": "002", "name": "Alice Updated", "created_at": "2026-07-05 10:00:00"}

    def update_user(self, user_id, *, nim, name):
        self.updated = (user_id, nim, name)
        if self.error:
            raise ValueError(self.error)
        return self.result

    def delete_user(self, user_id):
        return True

    def get_all_users(self):
        return []


def test_patch_user_returns_updated_user(monkeypatch):
    import app.main as main

    fake_db = FakeUsersDB()
    monkeypatch.setattr(main, "db", fake_db)
    client = TestClient(app)

    response = client.patch("/api/users/7", json={"nim": " 002 ", "name": " Alice Updated "})

    assert response.status_code == 200
    assert response.json()["nim"] == "002"
    assert fake_db.updated == (7, " 002 ", " Alice Updated ")


def test_patch_user_rejects_empty_values(monkeypatch):
    import app.main as main

    fake_db = FakeUsersDB()
    fake_db.error = "NIM is required"
    monkeypatch.setattr(main, "db", fake_db)
    client = TestClient(app)

    response = client.patch("/api/users/7", json={"nim": " ", "name": "Alice"})

    assert response.status_code == 400
    assert "NIM is required" in response.json()["detail"]


def test_patch_user_rejects_duplicate_nim(monkeypatch):
    import app.main as main

    fake_db = FakeUsersDB()
    fake_db.error = "NIM already exists"
    monkeypatch.setattr(main, "db", fake_db)
    client = TestClient(app)

    response = client.patch("/api/users/7", json={"nim": "001", "name": "Alice"})

    assert response.status_code == 409
    assert "NIM already exists" in response.json()["detail"]


def test_patch_user_returns_404_for_missing_user(monkeypatch):
    import app.main as main

    fake_db = FakeUsersDB()
    fake_db.result = None
    monkeypatch.setattr(main, "db", fake_db)
    client = TestClient(app)

    response = client.patch("/api/users/999", json={"nim": "001", "name": "Ghost"})

    assert response.status_code == 404
    assert "User not found" in response.json()["detail"]
