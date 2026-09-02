import { env } from "cloudflare:workers";
import { authConfig } from "../../../../config/auth";
import { issuePurposeToken, normalizeEmail, publicBaseUrl, sendAccountEmail } from "../../../appAuth";
import { enforceRateLimit } from "../../../rateLimit";

export async function POST(request: Request) {
  if (!authConfig.passwordResetEnabled) return Response.json({ error: "Восстановление пароля отключено" }, { status: 403 });
  if (!authConfig.emailDeliveryEnabled || !env.RESEND_API_KEY || !env.EMAIL_FROM) return Response.json({ error: "Восстановление через письмо пока не подключено", emailDeliveryEnabled: false }, { status: 503 });
  const limited = await enforceRateLimit(request, { scope: "forgot", limit: 4, windowSeconds: 3600 });
  if (limited) return limited;
  const body = await request.json() as { email?: string };
  const email = normalizeEmail(body.email || "");
  const row = await env.DB.prepare("SELECT id FROM users WHERE email = ? AND auth_provider = 'email' LIMIT 1").bind(email).first<{ id: string }>();
  if (row) {
    const token = await issuePurposeToken(row.id, "reset_password", 3600);
    const url = `${publicBaseUrl(request)}/account?reset_token=${encodeURIComponent(token)}`;
    await sendAccountEmail(email, "Сброс пароля — Лист Героя 5e", `<p>Ссылка действует 1 час:</p><p><a href="${url}">${url}</a></p>`);
  }
  return Response.json({ sent: true });
}

