import { env } from "cloudflare:workers";
import { authConfig } from "../../../../config/auth";
import { createSession, hashPassword, issuePurposeToken, normalizeEmail, publicBaseUrl, sendAccountEmail, sessionCookie } from "../../../appAuth";
import { enforceRateLimit } from "../../../rateLimit";

export async function POST(request: Request) {
  if (!authConfig.registrationEnabled) return Response.json({ error: "Регистрация временно отключена" }, { status: 403 });
  const limited = await enforceRateLimit(request, { scope: "register", limit: 5, windowSeconds: 900 });
  if (limited) return limited;
  const body = await request.json() as { email?: string; password?: string };
  const email = normalizeEmail(body.email || "");
  const password = body.password || "";
  if (!/^\S+@\S+\.\S+$/.test(email)) return Response.json({ error: "Введите корректную почту" }, { status: 400 });
  if (password.length < 10 || password.length > 128) return Response.json({ error: "Пароль должен содержать от 10 до 128 символов" }, { status: 400 });
  const exists = await env.DB.prepare("SELECT id FROM users WHERE email = ? LIMIT 1").bind(email).first();
  if (exists) return Response.json({ error: "Не удалось создать аккаунт с этими данными" }, { status: 409 });
  const id = crypto.randomUUID();
  const passwordData = await hashPassword(password);
  const verifiedAt = authConfig.emailVerificationEnabled ? null : new Date().toISOString();
  await env.DB.prepare("INSERT INTO users (id, email, password_hash, password_salt, auth_provider, email_verified_at) VALUES (?, ?, ?, ?, 'email', ?)").bind(id, email, passwordData.hash, passwordData.salt, verifiedAt).run();
  let emailSent = false;
  if (authConfig.emailVerificationEnabled) {
    const verifyToken = await issuePurposeToken(id, "verify_email", 86400);
    const verifyUrl = `${publicBaseUrl(request)}/api/auth/verify-email?token=${encodeURIComponent(verifyToken)}`;
    emailSent = await sendAccountEmail(email, "Подтверждение почты — Лист Героя 5e", `<p>Подтвердите почту:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`);
  }
  const session = await createSession(id);
  return Response.json({ authenticated: true, email, emailVerified: !authConfig.emailVerificationEnabled, emailSent }, { status: 201, headers: { "set-cookie": sessionCookie(session.token) } });
}
