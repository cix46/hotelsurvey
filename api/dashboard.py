"""
Dashboard API — yönetici paneli için istatistikler
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case
from datetime import datetime, timedelta

from database import get_db, Survey, Complaint, Guest, SurveyStatus, ComplaintStatus

router = APIRouter()


@router.get("/stats")
async def get_stats(db: AsyncSession = Depends(get_db)):
    """Ana dashboard istatistikleri"""
    today = datetime.utcnow().date()
    month_start = today.replace(day=1)

    # Bu ay gönderilen
    sent_this_month = await db.scalar(
        select(func.count(Survey.id))
        .where(Survey.sent_at >= month_start)
    )

    # Yanıt sayısı
    replied = await db.scalar(
        select(func.count(Survey.id))
        .where(Survey.status == SurveyStatus.REPLIED)
        .where(Survey.sent_at >= month_start)
    )

    # Ortalama puan
    avg_score = await db.scalar(
        select(func.avg(Survey.score))
        .where(Survey.score.isnot(None))
    )

    # Açık şikayetler
    open_complaints = await db.scalar(
        select(func.count(Complaint.id))
        .where(Complaint.status.in_([ComplaintStatus.NEW, ComplaintStatus.IN_PROGRESS]))
    )

    return {
        "sent_this_month":  sent_this_month or 0,
        "reply_count":      replied or 0,
        "reply_rate":       round((replied / sent_this_month * 100) if sent_this_month else 0, 1),
        "avg_score":        round(float(avg_score), 1) if avg_score else 0,
        "open_complaints":  open_complaints or 0,
    }


@router.get("/rating-distribution")
async def rating_distribution(db: AsyncSession = Depends(get_db)):
    """1-5 yıldız dağılımı"""
    rows = await db.execute(
        select(Survey.score, func.count(Survey.id).label("count"))
        .where(Survey.score.isnot(None))
        .group_by(Survey.score)
        .order_by(Survey.score)
    )
    data = {row.score: row.count for row in rows}
    return {str(i): data.get(i, 0) for i in range(1, 6)}


@router.get("/weekly")
async def weekly_chart(db: AsyncSession = Depends(get_db)):
    """Son 7 günün günlük gönderim sayısı"""
    result = []
    for i in range(6, -1, -1):
        day = datetime.utcnow().date() - timedelta(days=i)
        count = await db.scalar(
            select(func.count(Survey.id))
            .where(func.date(Survey.sent_at) == day)
        )
        result.append({"day": day.strftime("%a"), "count": count or 0})
    return result


@router.get("/complaints")
async def get_complaints(
    status: str = None,
    limit: int = 20,
    db: AsyncSession = Depends(get_db)
):
    """Şikayet listesi"""
    query = (
        select(Complaint, Survey, Guest)
        .join(Survey, Complaint.survey_id == Survey.id)
        .join(Guest, Survey.guest_id == Guest.id)
        .order_by(Complaint.created_at.desc())
        .limit(limit)
    )
    if status:
        query = query.where(Complaint.status == status)

    rows = await db.execute(query)
    return [
        {
            "id":          c.id,
            "status":      c.status,
            "score":       s.score,
            "feedback":    s.feedback,
            "notes":       c.notes,
            "created_at":  c.created_at.isoformat(),
            "resolved_at": c.resolved_at.isoformat() if c.resolved_at else None,
            "guest": {
                "name":        g.name,
                "room_number": g.room_number,
                "phone":       g.phone[:7] + "****",  # Kısmi maskeleme
            }
        }
        for c, s, g in rows
    ]


@router.patch("/complaints/{complaint_id}")
async def update_complaint(
    complaint_id: int,
    body: dict,
    db: AsyncSession = Depends(get_db)
):
    """Şikayet durumunu güncelle"""
    complaint = await db.get(Complaint, complaint_id)
    if not complaint:
        from fastapi import HTTPException
        raise HTTPException(status_code=404)

    if "status" in body:
        complaint.status = body["status"]
        if body["status"] == "resolved":
            complaint.resolved_at = datetime.utcnow()
    if "notes" in body:
        complaint.notes = body["notes"]
    if "assigned_to" in body:
        complaint.assigned_to = body["assigned_to"]

    await db.commit()
    return {"ok": True}


@router.get("/queue")
async def message_queue(db: AsyncSession = Depends(get_db)):
    """Bugünkü check-out kuyruğu"""
    today = datetime.utcnow().date()
    rows = await db.execute(
        select(Survey, Guest)
        .join(Guest)
        .where(func.date(Guest.checkout_at) == today)
        .order_by(Survey.created_at.desc())
    )
    return [
        {
            "survey_id":   s.id,
            "status":      s.status,
            "score":       s.score,
            "sent_at":     s.sent_at.isoformat() if s.sent_at else None,
            "guest": {
                "name":        g.name,
                "room_number": g.room_number,
                "phone":       g.phone[:7] + "****",
                "checkout_at": g.checkout_at.isoformat(),
            }
        }
        for s, g in rows
    ]
