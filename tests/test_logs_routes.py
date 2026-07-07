from fastapi.testclient import TestClient

from app.main import app


class FakeLogsDB:
    def __init__(self):
        self.list_calls = []
        self.count_calls = []
        self.rows = [
            {
                "id": 1,
                "timestamp": "2026-07-05 10:00:00",
                "status": "ALLOWED",
                "matched_name": "Alice",
                "current_nim": "A001",
                "similarity": 0.95,
                "duration_ms": 12,
                "description": "front door",
                "user_id": 7,
            }
        ]

    def get_access_logs(self, limit=20, offset=0, *, q=None, status=None, start_date=None, end_date=None):
        self.list_calls.append(
            {"limit": limit, "offset": offset, "q": q, "status": status, "start_date": start_date, "end_date": end_date}
        )
        return self.rows

    def count_access_logs(self, *, q=None, status=None, start_date=None, end_date=None):
        self.count_calls.append({"q": q, "status": status, "start_date": start_date, "end_date": end_date})
        return 1


def test_logs_route_forwards_filters(monkeypatch):
    import app.main as main

    fake_db = FakeLogsDB()
    monkeypatch.setattr(main, "db", fake_db)
    client = TestClient(app)

    response = client.get("/api/logs?limit=5&offset=10&q=alice&status=ALLOWED&start_date=2026-07-01&end_date=2026-07-05")

    assert response.status_code == 200
    assert response.json()[0]["current_nim"] == "A001"
    assert fake_db.list_calls == [
        {"limit": 5, "offset": 10, "q": "alice", "status": "ALLOWED", "start_date": "2026-07-01", "end_date": "2026-07-05"}
    ]


def test_logs_count_route_forwards_filters(monkeypatch):
    import app.main as main

    fake_db = FakeLogsDB()
    monkeypatch.setattr(main, "db", fake_db)
    client = TestClient(app)

    response = client.get("/api/logs/count?q=alice&status=DENIED&start_date=2026-07-01&end_date=2026-07-05")

    assert response.status_code == 200
    assert response.json() == {"count": 1}
    assert fake_db.count_calls == [
        {"q": "alice", "status": "DENIED", "start_date": "2026-07-01", "end_date": "2026-07-05"}
    ]


def test_logs_reject_invalid_status(monkeypatch):
    import app.main as main

    monkeypatch.setattr(main, "db", FakeLogsDB())
    client = TestClient(app)

    response = client.get("/api/logs?status=MAYBE")

    assert response.status_code == 400
    assert "status must be ALLOWED or DENIED" in response.json()["detail"]


def test_logs_reject_invalid_date_filters(monkeypatch):
    import app.main as main

    monkeypatch.setattr(main, "db", FakeLogsDB())
    client = TestClient(app)

    response = client.get("/api/logs?start_date=not-a-date")

    assert response.status_code == 400
    assert "start_date must use YYYY-MM-DD" in response.json()["detail"]


def test_logs_export_csv(monkeypatch):
    import app.main as main

    fake_db = FakeLogsDB()
    monkeypatch.setattr(main, "db", fake_db)
    client = TestClient(app)

    response = client.get("/api/logs/export.csv?q=alice&status=ALLOWED")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert "attachment; filename=access_logs.csv" in response.headers["content-disposition"]
    assert "id,timestamp,status,matched_name,current_nim,similarity,duration_ms,description" in response.text
    assert "1,2026-07-05 10:00:00,ALLOWED,Alice,A001,0.95,12,front door" in response.text
    assert fake_db.list_calls[0]["limit"] is None


def test_logs_export_csv_neutralizes_spreadsheet_formulas(monkeypatch):
    import app.main as main

    fake_db = FakeLogsDB()
    fake_db.rows = [{**fake_db.rows[0], "matched_name": "=cmd", "description": "+SUM(1,1)"}]
    monkeypatch.setattr(main, "db", fake_db)
    client = TestClient(app)

    response = client.get("/api/logs/export.csv")

    assert response.status_code == 200
    assert "'=cmd" in response.text
    assert "'+SUM(1,1)" in response.text
