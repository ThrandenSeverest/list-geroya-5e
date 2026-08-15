import httpx
from ..config import settings
async def send_email(to: str, subject: str, html: str) -> bool:
    if not (settings.email_delivery_enabled and settings.resend_api_key and settings.email_from): return False
    async with httpx.AsyncClient() as client:
        r = await client.post("https://api.resend.com/emails", headers={"authorization": f"Bearer {settings.resend_api_key}"}, json={"from": settings.email_from, "to": [to], "subject": subject, "html": html})
    return r.is_success
