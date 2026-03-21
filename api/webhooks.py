import os
import hmac, hashlib
from fastapi import APIRouter, Request, Response, HTTPException
from sqlalchemy import select
from datetime import datetime
from dotenv import load_dotenv
load_dotenv()

from database import AsyncSessionLocal, Survey, Complaint, Guest, SurveyStatus, ComplaintStatus
from services.whatsapp import send_review_links, send_complaint_followup

router = APIRouter()

VERIFY_TOKEN = os.getenv("WA_WEBHOOK_VERIFY_TOKEN", "hotelsurvey2026")

@router.get("/whatsapp")
async def verify_webhook(request: Request):
    params = request.query_params
    if (params.get("hub.mode") == "subscribe" and
            params.get("hub.verify_token") == VERIFY_TOKEN):
        return Response(content=params.get("hub.challenge"), media_type="text/plain")
    raise HTTPException(status_code=403, detail="Token uyuşmuyor")

@router.post("/whatsapp")
async def receive_message(request: Request):
    body = await request.json()
    try:
        changes = body["entry"][0]["changes"][0]["value"]
        messages = changes.get("messages", [])
    except (KeyError, IndexError):
        return {"status": "no_message"}
    for message in messages:
        await process_message(message)
    return {"status": "ok"}

async def process_message(message: dict):
    phone    = message["from"]
    msg_type = message.get("type")

    if msg_type == "button":
        payload  = message["button"]["payload"]
        btn_text = message["button"].get("text", "")
        if payload.startswith("SCORE_"):
            if "5" in btn_text:
                score = 5
            elif "4" in btn_text:
                score = 4
            elif "3" in btn_text:
                score = 3
            elif "2" in btn_text:
                score = 2
            else:
                score = 1
            await handle_score(phone, score)
    elif msg_type == "text":
        await handle_text(phone, message["text"]["body"])

async def handle_score(phone: str, score: int):
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Survey).join(Guest)
            .where(Guest.phone == "+" + phone, Survey.status == SurveyStatus.SENT)
            .order_by(Survey.sent_at.desc()).limit(1)
        )
        survey = result.scalar_one_or_none()
        if not survey:
            return
        survey.score      = score
        survey.status     = SurveyStatus.REPLIED
        survey.replied_at = datetime.utcnow()
        guest = await db.get(Guest, survey.guest_id)
        lang  = guest.language if guest else "tr"
        if score >= 4:
            await send_review_links("+" + phone, lang)
            survey.review_link_sent = True
        else:
            db.add(Complaint(survey_id=survey.id, status=ComplaintStatus.NEW))
            await send_complaint_followup("+" + phone, lang)
        await db.commit()

async def handle_text(phone: str, text: str):
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Complaint).join(Survey).join(Guest)
            .where(Guest.phone == "+" + phone, Complaint.status == ComplaintStatus.NEW)
            .order_by(Complaint.created_at.desc()).limit(1)
        )
        complaint = result.scalar_one_or_none()
        if complaint:
            complaint.notes = text
            await db.commit()
