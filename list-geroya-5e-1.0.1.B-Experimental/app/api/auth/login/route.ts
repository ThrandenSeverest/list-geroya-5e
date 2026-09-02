import { env } from "cloudflare:workers";
import { authConfig } from "../../../../config/auth";
import { createSession, normalizeEmail, sessionCookie, verifyPassword } from "../../../appAuth";
import { enforceRateLimit } from "../../../rateLimit";

export async function POST(request: Request) {
  if (!authConfig.loginEnabled) return Response.json({ error: "Вход временно отключён" }, { status: 403 });
  const limited = await enforceRateLimit(request, { scope: "login", limit: 10, windowSeconds: 900 });
  if (limited) return limited;
  const body = await request.json() as { email?: string; password?: string };
  const email = normalizeEmail(body.email || "");
  const row = await env.DB.prepare("SELECT id, email, password_hash, password_salt, email_verified_at FROM users WHERE email = ? AND auth_provider = 'email' LIMIT 1")
    .bind(email).first<{ id: string; email: string; password_hash: string | null; password_salt: string | null; email_verified_at: string | null }>();
  if (!row?.password_hash || !row.password_salt || !await verifyPassword(body.password || "", row.password_salt, row.password_hash)) return Response.json({ error: "Неверная почта или пароль" }, { status: 401 });
  if (authConfig.requireVerifiedEmail && !row.email_verified_at) return Response.json({ error: "Сначала подтвердите почту" }, { status: 403 });
  const session = await createSession(row.id);
  return Response.json({ authenticated: true, email: row.email, emailVerified: Boolean(row.email_verified_at) }, { headers: { "set-cookie": sessionCookie(session.token) } });
}

