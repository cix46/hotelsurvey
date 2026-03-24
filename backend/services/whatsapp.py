import os
import httpx
from dotenv import load_dotenv
load_dotenv()

WA_API_VERSION  = "v22.0"
TRIPADVISOR_URL = os.getenv("TRIPADVISOR_URL", "https://www.tripadvisor.com/your-hotel")
GOOGLE_URL      = os.getenv("GOOGLE_MAPS_URL", "https://g.page/r/your-hotel/review")

def get_headers():
    return {
        "Authorization": f"Bearer {os.getenv('WA_ACCESS_TOKEN')}",
        "Content-Type": "application/json",
    }

def build_survey_message(guest_name: str, language: str = "tr") -> dict:
    if language == "tr":
        lang_code = "tr"
        template_name = "hotel_checkout_surveys"
    elif language == "en":
        lang_code = "en"
        template_name = "hotel_checkout_surveys_en"
    else:
        lang_code = "de"
        template_name = "hotel_checkout_surveys_de"
        
    return {
        "messaging_product": "whatsapp",
        "to": None,
        "type": "template",
        "template": {
            "name": template_name,
            "language": {"code": lang_code},
            "components":[
                {
                    "type": "body",
                    "parameters": [{"type": "text", "parameter_name": "customer_name", "text": guest_name}]
                },
                {"type": "button", "sub_type": "quick_reply", "index": "0", "parameters": [{"type": "payload", "payload": "SCORE_1"}]},
                {"type": "button", "sub_type": "quick_reply", "index": "1", "parameters":[{"type": "payload", "payload": "SCORE_2"}]},
                {"type": "button", "sub_type": "quick_reply", "index": "2", "parameters":[{"type": "payload", "payload": "SCORE_3"}]},
                {"type": "button", "sub_type": "quick_reply", "index": "3", "parameters":[{"type": "payload", "payload": "SCORE_4"}]},
                {"type": "button", "sub_type": "quick_reply", "index": "4", "parameters": [{"type": "payload", "payload": "SCORE_5"}]},
            ]
        }
    }

def build_review_link_message(language: str = "tr") -> dict:
    if language == "tr":
        body = f"Harika! Değerlendirmeniz için teşekkürler 🙏\n\nDeneyiminizi paylaşmak ister misiniz?\n\n⭐ Google Maps: {GOOGLE_URL}\n🌍 Tripadvisor: {TRIPADVISOR_URL}"
    elif language == "de":
        body = f"Vielen Dank für Ihre Bewertung! 🙏\n\nMöchten Sie Ihre Erfahrung teilen?\n\n⭐ Google Maps: {GOOGLE_URL}\n🌍 Tripadvisor: {TRIPADVISOR_URL}"
    else:
        body = f"Thank you for your feedback! 🙏\n\nWould you like to share your experience?\n\n⭐ Google Maps: {GOOGLE_URL}\n🌍 Tripadvisor: {TRIPADVISOR_URL}"
    return {"messaging_product": "whatsapp", "type": "text", "to": None, "text": {"body": body}}

def build_complaint_followup_message(language: str = "tr") -> dict:
    if language == "tr":
        body = "Anlayışınız için teşekkür ederiz.\n\nSizi memnun etmeyen deneyimi bizimle paylaşırsanız, ekibimiz en kısa sürede sizinle iletişime geçecektir."
    elif language == "de":
        body = "Vielen Dank für Ihr Verständnis.\n\nSollten Sie uns mitteilen, dass Sie mit unserer Leistung nicht zufrieden waren, wird sich unser Team so schnell wie möglich mit Ihnen in Verbindung setzen."
    else:
        body = "Thank you for your understanding.\n\nIf you share any experience that did not meet your expectations with us, our team will contact you as soon as possible."
    return {"messaging_product": "whatsapp", "type": "text", "to": None, "text": {"body": body}}

async def send_whatsapp_message(phone: str, payload: dict) -> dict:
    url = f"https://graph.facebook.com/{WA_API_VERSION}/{os.getenv('WA_PHONE_NUMBER_ID')}/messages"
    payload["to"] = phone.replace("+", "").replace(" ", "")
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(url, json=payload, headers=get_headers())
        
        # EĞER META'DAN HATA DÖNERSE BURASI ÇALIŞACAK VE EKRANA YAZACAK
        if resp.status_code >= 400:
            print("\n" + "="*50)
            print(f"WHATSAPP API HATASI - STATUS CODE: {resp.status_code}")
            print(f"URL: {url}")
            print(f"META'NIN GERÇEK CEVABI: {resp.text}")
            print(f"GÖNDERİLEN PAYLOAD: {payload}")
            print("="*50 + "\n")
            
        resp.raise_for_status()
        return resp.json()

async def send_survey(phone: str, guest_name: str, language: str = "tr") -> str:
    payload = build_survey_message(guest_name, language)
    result = await send_whatsapp_message(phone, payload)
    return result["messages"][0]["id"]

async def send_review_links(phone: str, language: str = "tr") -> str:
    payload = build_review_link_message(language)
    result = await send_whatsapp_message(phone, payload)
    return result["messages"][0]["id"]

async def send_complaint_followup(phone: str, language: str = "tr") -> str:
    payload = build_complaint_followup_message(language)
    result = await send_whatsapp_message(phone, payload)
    return result["messages"][0]["id"]
