from dotenv import load_dotenv
load_dotenv()
from fastapi.staticfiles import StaticFiles
"""
HotelSurvey - WhatsApp Memnuniyet Anketi Sistemi
Backend: FastAPI + Meta Business API
"""

from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
import uvicorn

from api.surveys import router as survey_router
from api.complaints import router as complaint_router
from api.dashboard import router as dashboard_router
from api.webhooks import router as webhook_router
from database import init_db

app = FastAPI(
    title="HotelSurvey API",
    description="WhatsApp tabanlı otel memnuniyet anketi sistemi",
    version="1.0.0"
)
app.mount("/static", StaticFiles(directory="static"), name="static")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(survey_router,    prefix="/api/surveys",    tags=["Anketler"])
app.include_router(complaint_router, prefix="/api/complaints", tags=["Şikayetler"])
app.include_router(dashboard_router, prefix="/api/dashboard",  tags=["Dashboard"])
app.include_router(webhook_router,   prefix="/webhook",        tags=["WhatsApp Webhook"])

@app.on_event("startup")
async def startup():
    await init_db()

@app.get("/health")
async def health():
    return {"status": "ok", "service": "HotelSurvey"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
