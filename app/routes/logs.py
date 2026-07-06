import csv
import io

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
            start_date=start_date,
            end_date=end_date,
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
        start_date=start_date,
        end_date=end_date,
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
        start_date=start_date,
        end_date=end_date,
    )
    output = io.StringIO()
    fieldnames = ["id", "timestamp", "status", "matched_name", "current_nim", "similarity", "duration_ms", "description"]
    writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction="ignore")
    writer.writeheader()
    writer.writerows(rows)
    return Response(
        output.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=access_logs.csv"},
    )
