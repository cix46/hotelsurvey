from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
from database import get_db, Complaint, Survey, Guest, ComplaintStatus

router = APIRouter()

@router.get("/")
async def list_complaints(db: AsyncSession = Depends(get_db)):
    rows = await db.execute(
        select(Complaint, Survey, Guest)
        .join(Survey, Complaint.survey_id == Survey.id)
        .join(Guest, Survey.guest_id == Guest.id)
        .order_by(Complaint.created_at.desc())
    )
    return [
        {
            "id": c.id,
            "status": c.status,
            "score": s.score,
            "notes": c.notes,
            "created_at": c.created_at.isoformat(),
            "guest": {"name": g.name, "room": g.room_number, "phone": g.phone[:7] + "****"}
        }
        for c, s, g in rows
    ]

@router.patch("/{complaint_id}")
async def update_complaint(complaint_id: int, body: dict, db: AsyncSession = Depends(get_db)):
    complaint = await db.get(Complaint, complaint_id)
    if not complaint:
        raise HTTPException(status_code=404)
    if "status" in body:
        complaint.status = body["status"]
        if body["status"] == "resolved":
            complaint.resolved_at = datetime.utcnow()
    if "notes" in body:
        complaint.notes = body["notes"]
    await db.commit()
    return {"ok": True}
