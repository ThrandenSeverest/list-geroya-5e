import { env } from "cloudflare:workers";
import { createSession, hashPassword, issuePurposeToken, normalizeEmail, publicBaseUrl, sendAccountEmail, sessionCookie } from "../../../appAuth";

export async function POST(request: Request) {
  const body = await request.json() as { email?: string; password?: string };
  const email = normalizeEmail(body.email || "");
  const password = body.password || "";
  if (!/^\S+@\S+\.\S+$/.test(email)) return Response.json({ error: "Введите корректную почту" }, { status: 400 });
  if (password.length < 10 || password.length > 128) return Response.json({ error: "Пароль должен содержать от 10 до 128 символов" }, { status: 400 });
  const exists = await env.DB.prepare("SELECT id FROM users WHERE email = ? LIMIT 1").bind(email).first();
  if (exists) return Response.json({ error: "Эта почта уже занята" }, { status: 409 });
  const id = crypto.randomUUID();
  const passwordData = await hashPassword(password);
  await env.DB.prepare("INSERT INTO users (id, email, password_hash, password_salt) VALUES (?, ?, ?, ?)")
    .bind(id, email, passwordData.hash, passwordData.salt).run();
  const verifyToken = await issuePurposeToken(id, "verify_email", 86400);
  const verifyUrl = `${publicBaseUrl(request)}/api/auth/verify-email?token=${encodeURIComponent(verifyToken)}`;
  const emailSent = await sendAccountEmail(email, "Подтверждение почты — Лист Героя 5e", `<p>Подтвердите почту:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`);
  const session = await createSession(id);
  return Response.json({ authenticated: true, email, emailVerified: false, emailSent }, { status: 201, headers: { "set-cookie": sessionCookie(session.token) } });
}
