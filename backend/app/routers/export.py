from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, Query, Response
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.auth import get_current_user
from app.services.export_service import generate_candidates_csv, generate_candidates_json

router = APIRouter(prefix="/api/v1/export", tags=["Export"])

@router.get("/candidates.csv")
def export_candidates_csv(
    status: Optional[str] = Query(None, description="Filter exported candidates by status"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    csv_content = generate_candidates_csv(db=db, current_user=current_user, status_filter=status)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    filename = f"candidates_export_{timestamp}.csv"

    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache"
        }
    )

@router.get("/candidates.json", response_model=List[Dict[str, Any]])
def export_candidates_json(
    status: Optional[str] = Query(None, description="Filter exported candidates by status"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    data = generate_candidates_json(db=db, current_user=current_user, status_filter=status)
    return JSONResponse(
        content=data,
        headers={
            "Content-Disposition": 'inline; filename="candidates_export.json"',
            "Cache-Control": "no-cache"
        }
    )
