import { env } from "cloudflare:workers";
import { authConfig } from "../../../../config/auth";
import { getAppUser, issuePurposeToken, publicBaseUrl, sendAccountEmail } from "../../../appAuth";
import { enforceRateLimit } from "../../../rateLimit";

export async function POST(request: Request) {
  if (!authConfig.emailVerificationEnabled || !authConfig.emailDeliveryEnabled) return Response.json({ error: "Подтверждение почты пока отключено" }, { status: 503 });
  const limited = await enforceRateLimit(request, { scope: "verify", limit: 3, windowSeconds: 3600 });
  if (limited) return limited;
  const user = await getAppUser(request);
  if (!user) return Response.json({ error: "Требуется вход" }, { status: 401 });
  if (user.emailVerified) return Response.json({ sent: true });
  const recent = await env.DB.prepare("SELECT id FROM auth_tokens WHERE user_id = ? AND purpose = 'verify_email' AND used_at IS NULL AND created_at > datetime('now', '-10 minutes') LIMIT 1").bind(user.id).first();
  if (recent) return Response.json({ error: "Новое письмо можно запросить через 10 минут" }, { status: 429 });
  const token = await issuePurposeToken(user.id, "verify_email", 86400);
  const url = `${publicBaseUrl(request)}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
  const sent = await sendAccountEmail(user.email, "Подтверждение почты — Лист Героя 5e", `<p>Подтвердите почту:</p><p><a href="${url}">${url}</a></p>`);
  return Response.json({ sent });
}

