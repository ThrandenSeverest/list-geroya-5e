import asyncio
import smtplib
from email.message import EmailMessage

import httpx

from ..config import settings


def _send_smtp(to: str, subject: str, html: str) -> bool:
    message = EmailMessage()
    message["From"] = settings.email_from
    message["To"] = to
    message["Subject"] = subject
    message.set_content("Откройте письмо в HTML-совместимой почтовой программе.")
    message.add_alternative(html, subtype="html")
    try:
        with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=15) as server:
            server.login(settings.smtp_username, settings.smtp_password)
            server.send_message(message)
        return True
    except (OSError, smtplib.SMTPException):
        return False


async def send_email(to: str, subject: str, html: str) -> bool:
    if not settings.email_delivery_configured:
        return False
    if settings.smtp_host and settings.smtp_username and settings.smtp_password:
        return await asyncio.to_thread(_send_smtp, to, subject, html)
    async with httpx.AsyncClient() as client:
        r = await client.post("https://api.resend.com/emails", headers={"authorization": f"Bearer {settings.resend_api_key}"}, json={"from": settings.email_from, "to": [to], "subject": subject, "html": html})
    return r.is_success
