import csv
import io
from datetime import date

from fastapi import APIRouter, HTTPException, Response

router = APIRouter()


ALLOWED_LOG_STATUSES = {"ALLOWED", "DENIED"}


def _clean_status(status: str | None) -> str | None:
    if status in (None, ""):
        return None
    clean = status.upper()
    if clean not in ALLOWED_LOG_STATUSES:
        raise HTTPException(status_code=400, detail="status must be ALLOWED or DENIED")
    return clean


def _clean_date(value: str | None, name: str) -> str | None:
    if value in (None, ""):
        return None
    if len(value) != 10 or value[4] != "-" or value[7] != "-":
        raise HTTPException(status_code=400, detail=f"{name} must use YYYY-MM-DD")
    try:
        return date.fromisoformat(value).isoformat()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"{name} must use YYYY-MM-DD") from exc


def _csv_safe(value):
    if isinstance(value, str) and value.startswith(("=", "+", "-", "@")):
        return f"'{value}"
    return value


def _csv_safe_row(row: dict) -> dict:
    return {key: _csv_safe(value) for key, value in row.items()}


@router.get("/api/logs/count")
async def get_logs_count(
    q: str | None = None,
    status: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
):
    from app.main import db
    return {
        "count": db.count_access_logs(
            q=q,
            status=_clean_status(status),
            start_date=_clean_date(start_date, "start_date"),
            end_date=_clean_date(end_date, "end_date"),
        )
    }


@router.get("/api/logs")
async def get_logs(
    limit: int = 20,
    offset: int = 0,
    q: str | None = None,
    status: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
):
    from app.main import db
    return db.get_access_logs(
        limit=limit,
        offset=offset,
        q=q,
        status=_clean_status(status),
        start_date=_clean_date(start_date, "start_date"),
        end_date=_clean_date(end_date, "end_date"),
    )


@router.get("/api/logs/export.csv")
async def export_logs_csv(
    q: str | None = None,
    status: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
):
    from app.main import db
    rows = db.get_access_logs(
        limit=None,
        offset=0,
        q=q,
        status=_clean_status(status),
        start_date=_clean_date(start_date, "start_date"),
        end_date=_clean_date(end_date, "end_date"),
    )
    output = io.StringIO()
    fieldnames = ["id", "timestamp", "status", "matched_name", "current_nim", "similarity", "duration_ms", "description"]
    writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction="ignore")
    writer.writeheader()
    writer.writerows(_csv_safe_row(row) for row in rows)
    return Response(
        output.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=access_logs.csv"},
    )
