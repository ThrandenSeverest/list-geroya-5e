import { env } from "cloudflare:workers";
import { createSession, normalizeEmail, sessionCookie, verifyPassword } from "../../../appAuth";

export async function POST(request: Request) {
  const body = await request.json() as { email?: string; password?: string };
  const email = normalizeEmail(body.email || "");
  const row = await env.DB.prepare("SELECT id, email, password_hash, password_salt, email_verified_at FROM users WHERE email = ? LIMIT 1")
    .bind(email).first<{ id: string; email: string; password_hash: string; password_salt: string; email_verified_at: string | null }>();
  if (!row || !await verifyPassword(body.password || "", row.password_salt, row.password_hash)) {
    return Response.json({ error: "Неверная почта или пароль" }, { status: 401 });
  }
  const session = await createSession(row.id);
  return Response.json({ authenticated: true, email: row.email, emailVerified: Boolean(row.email_verified_at) }, { headers: { "set-cookie": sessionCookie(session.token) } });
}
