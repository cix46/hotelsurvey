# HotelSurvey — WhatsApp Memnuniyet Anketi Sistemi

**Stack:** Python (FastAPI) · React · Meta Business API · PostgreSQL · Celery/Redis

---

## Proje Yapısı

```
hotelsurvey/
├── backend/
│   ├── main.py                  # FastAPI uygulama girişi
│   ├── database.py              # SQLAlchemy modelleri
│   ├── requirements.txt
│   ├── .env.example
│   ├── api/
│   │   ├── surveys.py           # Check-out tetikleyici + Celery görevi
│   │   ├── complaints.py        # Şikayet CRUD
│   │   ├── dashboard.py         # İstatistik endpoint'leri
│   │   └── webhooks.py          # Meta → gelen WhatsApp mesajları
│   ├── services/
│   │   └── whatsapp.py          # Meta Business API wrapper
│   └── tasks/
│       └── celery_app.py        # Zamanlanmış görev yapılandırması
└── frontend/                    # React dashboard (sonraki adım)
```

---

## Kurulum

### 1. Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# .env dosyasını düzenle (Meta token, DB bilgileri vb.)

# Veritabanını oluştur
python -c "import asyncio; from database import init_db; asyncio.run(init_db())"

# Sunucuyu başlat
uvicorn main:app --reload --port 8000
```

### 2. Celery (zamanlanmış görevler)

```bash
# Redis gerekli
docker run -d -p 6379:6379 redis

# Celery worker
celery -A tasks.celery_app worker --loglevel=info

# Celery Beat (zamanlayıcı)
celery -A tasks.celery_app beat --loglevel=info
```

### 3. Meta Business API Kurulumu

1. [business.facebook.com](https://business.facebook.com) → WhatsApp → API Setup
2. Test phone number al
3. `WA_PHONE_NUMBER_ID` ve `WA_ACCESS_TOKEN` değerlerini `.env`'e ekle
4. Webhook URL'ni kaydet: `https://yourdomain.com/webhook/whatsapp`
5. Meta panelinde `messages` subscription'ını etkinleştir
6. **Şablon onayı:** Meta Business Manager'da aşağıdaki şablonu oluştur:
   - Ad: `hotel_checkout_survey`
   - Dil: Türkçe + İngilizce
   - 5 adet hızlı yanıt butonu: 1★, 2★, 3★, 4★, 5★

### 4. PMS Entegrasyonu

Check-out olduğunda PMS'in şu endpoint'e POST atması yeterli:

```bash
curl -X POST http://localhost:8000/api/surveys/trigger \
  -H "Content-Type: application/json" \
  -d '{
    "guest_name": "Ahmet Yılmaz",
    "phone": "+905321234567",
    "room_number": "301",
    "checkout_at": "2026-03-13T12:00:00",
    "language": "tr",
    "delay_minutes": 60
  }'
```

Cloudbeds, Opera PMS ve Mews'ün hepsi webhook desteği sunar.

---

## Akış Özeti

```
Check-out → POST /api/surveys/trigger
         → Celery: 60 dk sonra WhatsApp mesajı gönder

Misafir 4-5★ → send_review_links() → Google/Tripadvisor linki
Misafir 1-3★ → Complaint kaydı aç + send_complaint_followup()
             → Dashboard'da kırmızı uyarı
```

---

## API Dokümantasyonu

Sunucu çalışırken: [http://localhost:8000/docs](http://localhost:8000/docs)
