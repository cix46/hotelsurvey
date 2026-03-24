import asyncio
import os
from dotenv import load_dotenv
import httpx

load_dotenv()

async def test():
    phone_id = os.getenv('WA_PHONE_NUMBER_ID')
    token = os.getenv('WA_ACCESS_TOKEN')
    url = f"https://graph.facebook.com/v22.0/{phone_id}/messages"
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    payload = {
        "messaging_product": "whatsapp",
        "to": "905324318297",
        "type": "template",
        "template": {
            "name": "hotel_checkout_surveys_en",
            "language": {"code": "en_US"},
            "components": [
                {"type": "body", "parameters":[{"type": "text", "parameter_name": "customer_name", "text": "Halil Test Misafir"}]},
                {"type": "button", "sub_type": "quick_reply", "index": "0", "parameters":[{"type": "payload", "payload": "SCORE_1"}]},
                {"type": "button", "sub_type": "quick_reply", "index": "1", "parameters":[{"type": "payload", "payload": "SCORE_2"}]},
                {"type": "button", "sub_type": "quick_reply", "index": "2", "parameters": [{"type": "payload", "payload": "SCORE_3"}]},
                {"type": "button", "sub_type": "quick_reply", "index": "3", "parameters":[{"type": "payload", "payload": "SCORE_4"}]},
                {"type": "button", "sub_type": "quick_reply", "index": "4", "parameters":[{"type": "payload", "payload": "SCORE_5"}]}
            ]
        }
    }
    async with httpx.AsyncClient() as client:
        print("\n=== WHATSAPP TEST BASLIYOR ===")
        print(f"URL: {url}")
        try:
            resp = await client.post(url, json=payload, headers=headers)
            print(f"STATUS CODE: {resp.status_code}")
            print(f"META CEVABI: {resp.text}")
        except Exception as e:
            print(f"SISTEM HATASI: {str(e)}")
        print("==============================\n")

asyncio.run(test())
