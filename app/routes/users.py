from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


class UserUpdate(BaseModel):
    nim: str
    name: str


@router.get("/api/users", response_model=list)
async def list_users():
    from app.main import db
    return db.get_all_users()


@router.patch("/api/users/{user_id}")
async def update_user(user_id: int, payload: UserUpdate):
    from app.main import db
    try:
        user = db.update_user(user_id, nim=payload.nim, name=payload.name)
    except ValueError as exc:
        detail = str(exc)
        if "already exists" in detail:
            raise HTTPException(status_code=409, detail=detail) from exc
        raise HTTPException(status_code=400, detail=detail) from exc
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.delete("/api/users/{user_id}")
async def delete_user(user_id: int):
    from app.main import db
    if not db.delete_user(user_id):
        raise HTTPException(status_code=404, detail="User not found")
    return {"success": True}
