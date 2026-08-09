import { env } from "cloudflare:workers";
import { issuePurposeToken, normalizeEmail, publicBaseUrl, sendAccountEmail } from "../../../appAuth";

export async function POST(request: Request) {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) return Response.json({ error: "Отправка писем пока не подключена", emailDeliveryEnabled: false }, { status: 503 });
  const body = await request.json() as { email?: string };
  const email = normalizeEmail(body.email || "");
  const row = await env.DB.prepare("SELECT id FROM users WHERE email = ? LIMIT 1").bind(email).first<{ id: string }>();
  if (row) {
    const token = await issuePurposeToken(row.id, "reset_password", 3600);
    const url = `${publicBaseUrl(request)}/account?reset_token=${encodeURIComponent(token)}`;
    await sendAccountEmail(email, "Сброс пароля — Лист Героя 5e", `<p>Ссылка действует 1 час:</p><p><a href="${url}">${url}</a></p>`);
  }
  return Response.json({ sent: true });
}
