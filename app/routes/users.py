from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.database import DuplicateNimError, UserValidationError

router = APIRouter()


class UserUpdate(BaseModel):
    nim: str | None = None
    name: str | None = None


@router.get("/api/users", response_model=list)
async def list_users():
    from app.main import db
    return db.get_all_users()


@router.patch("/api/users/{user_id}")
async def update_user(user_id: int, payload: UserUpdate):
    from app.main import db
    try:
        user = db.update_user(user_id, **payload.model_dump(exclude_unset=True))
    except DuplicateNimError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except UserValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.delete("/api/users/{user_id}")
async def delete_user(user_id: int):
    from app.main import db
    if not db.delete_user(user_id):
        raise HTTPException(status_code=404, detail="User not found")
    return {"success": True}
