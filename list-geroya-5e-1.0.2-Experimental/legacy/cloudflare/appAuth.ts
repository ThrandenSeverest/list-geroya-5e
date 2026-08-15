import { env } from "cloudflare:workers";
import { authConfig } from "../config/auth";
import { hashPassword as derivePassword, hashToken, normalizeEmail, randomToken, verifyPassword as comparePassword } from "./authCore";

export { hashToken, normalizeEmail } from "./authCore";
export const AUTH_COOKIE = "list_geroya_session";

export const hashPassword = (password: string, salt?: string) => derivePassword(password, authConfig.passwordIterations, salt);
export const verifyPassword = (password: string, salt: string, expected: string) => comparePassword(password, salt, expected, authConfig.passwordIterations);

export function readCookie(request: Request, name = AUTH_COOKIE) {
  const cookie = request.headers.get("cookie") || "";
  return cookie.split(";").map(item => item.trim()).find(item => item.startsWith(`${name}=`))?.slice(name.length + 1) || null;
}

export function sessionCookie(token: string, maxAge = authConfig.sessionDays * 86400) {
  return `${AUTH_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export async function createSession(userId: string) {
  const token = randomToken();
  const expiresAt = Math.floor(Date.now() / 1000) + authConfig.sessionDays * 86400;
  await env.DB.prepare("INSERT INTO auth_sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)")
    .bind(crypto.randomUUID(), userId, await hashToken(token), expiresAt).run();
  return { token, expiresAt };
}

export type AppUser = { id: string; email: string; emailVerified: boolean; provider: "email" | "chatgpt" };

export async function getAppUser(request: Request): Promise<AppUser | null> {
  const token = readCookie(request);
  if (!token) return null;
  const now = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare(`SELECT users.id, users.email, users.email_verified_at, users.auth_provider
    FROM auth_sessions JOIN users ON users.id = auth_sessions.user_id
    WHERE auth_sessions.token_hash = ? AND auth_sessions.expires_at > ? LIMIT 1`)
    .bind(await hashToken(token), now).first<{ id: string; email: string; email_verified_at: string | null; auth_provider: "email" | "chatgpt" }>();
  return row ? { id: row.id, email: row.email, emailVerified: Boolean(row.email_verified_at), provider: row.auth_provider || "email" } : null;
}

export async function ensureChatGPTUser(emailValue: string) {
  const email = normalizeEmail(emailValue);
  const found = await env.DB.prepare("SELECT id FROM users WHERE email = ? LIMIT 1").bind(email).first<{ id: string }>();
  if (found) return found.id;
  const id = crypto.randomUUID();
  await env.DB.prepare("INSERT INTO users (id, email, auth_provider, email_verified_at) VALUES (?, ?, 'chatgpt', CURRENT_TIMESTAMP)").bind(id, email).run();
  return id;
}

export async function issuePurposeToken(userId: string, purpose: "verify_email" | "reset_password", ttlSeconds: number) {
  const token = randomToken();
  await env.DB.prepare("INSERT INTO auth_tokens (id, user_id, purpose, token_hash, expires_at) VALUES (?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), userId, purpose, await hashToken(token), Math.floor(Date.now() / 1000) + ttlSeconds).run();
  return token;
}

export async function sendAccountEmail(to: string, subject: string, html: string) {
  if (!authConfig.emailDeliveryEnabled) return false;
  const apiKey = env.RESEND_API_KEY as string | undefined;
  const from = env.EMAIL_FROM as string | undefined;
  if (!apiKey || !from) return false;
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" }, body: JSON.stringify({ from, to: [to], subject, html }) });
  return response.ok;
}

export function publicBaseUrl(request: Request) {
  return (env.APP_BASE_URL as string | undefined)?.replace(/\/$/, "") || new URL(request.url).origin;
}

