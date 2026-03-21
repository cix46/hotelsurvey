from database import get_db, Guest, Survey, SurveyStatus, AsyncSessionLocal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from datetime import datetime
import asyncio

from database import get_db, Guest, Survey, SurveyStatus
from services.whatsapp import send_survey

router = APIRouter()

class CheckoutPayload(BaseModel):
    guest_name:    str
    phone:         str
    room_number:   str
    checkout_at:   datetime
    language:      str = "tr"
    delay_minutes: int = 60

@router.post("/trigger")
async def trigger_survey(payload: CheckoutPayload, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Guest).where(
            Guest.phone == payload.phone,
            Guest.checkout_at == payload.checkout_at
        )
    )
    guest = result.scalar_one_or_none()

    if not guest:
        guest = Guest(
            name=payload.guest_name,
            phone=payload.phone,
            room_number=payload.room_number,
            checkout_at=payload.checkout_at,
            language=payload.language,
        )
        db.add(guest)
        await db.flush()

    survey = Survey(guest_id=guest.id, status=SurveyStatus.QUEUED)
    db.add(survey)
    await db.commit()

    async def delayed_send():
        if payload.delay_minutes > 0:
            await asyncio.sleep(payload.delay_minutes * 60)
        try:
            msg_id = await send_survey(payload.phone, payload.guest_name, payload.language)
            async with AsyncSessionLocal() as db2:
                s = await db2.get(Survey, survey.id)
                s.wa_msg_id = msg_id
                s.status    = SurveyStatus.SENT
                s.sent_at   = datetime.utcnow()
                await db2.commit()
        except Exception as e:
            print(f"WhatsApp gönderim hatası: {e}")

    asyncio.create_task(delayed_send())
    return {"survey_id": survey.id, "status": "queued"}

@router.get("/{survey_id}")
async def get_survey(survey_id: int, db: AsyncSession = Depends(get_db)):
    survey = await db.get(Survey, survey_id)
    if not survey:
        raise HTTPException(status_code=404)
    return survey
