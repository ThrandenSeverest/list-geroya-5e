import { env } from "cloudflare:workers";

export const AUTH_COOKIE = "list_geroya_session";
const SESSION_DAYS = 30;
const PBKDF2_ITERATIONS = 310_000;

const encoder = new TextEncoder();
const hex = (bytes: Uint8Array) => [...bytes].map(value => value.toString(16).padStart(2, "0")).join("");
const randomToken = (bytes = 32) => {
  const value = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export async function hashToken(token: string) {
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(token))));
}

export async function hashPassword(password: string, salt = randomToken(16)) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: encoder.encode(salt), iterations: PBKDF2_ITERATIONS }, key, 256);
  return { salt, hash: hex(new Uint8Array(bits)) };
}

export async function verifyPassword(password: string, salt: string, expected: string) {
  const actual = (await hashPassword(password, salt)).hash;
  if (actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index++) difference |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  return difference === 0;
}

export function readCookie(request: Request, name = AUTH_COOKIE) {
  const cookie = request.headers.get("cookie") || "";
  return cookie.split(";").map(item => item.trim()).find(item => item.startsWith(`${name}=`))?.slice(name.length + 1) || null;
}

export function sessionCookie(token: string, maxAge = SESSION_DAYS * 86400) {
  return `${AUTH_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export async function createSession(userId: string) {
  const token = randomToken();
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_DAYS * 86400;
  await env.DB.prepare("INSERT INTO auth_sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)")
    .bind(crypto.randomUUID(), userId, await hashToken(token), expiresAt).run();
  return { token, expiresAt };
}

export type AppUser = { id: string; email: string; emailVerified: boolean };

export async function getAppUser(request: Request): Promise<AppUser | null> {
  const token = readCookie(request);
  if (!token) return null;
  const now = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare(`SELECT users.id, users.email, users.email_verified_at
    FROM auth_sessions JOIN users ON users.id = auth_sessions.user_id
    WHERE auth_sessions.token_hash = ? AND auth_sessions.expires_at > ? LIMIT 1`)
    .bind(await hashToken(token), now).first<{ id: string; email: string; email_verified_at: string | null }>();
  return row ? { id: row.id, email: row.email, emailVerified: Boolean(row.email_verified_at) } : null;
}

export async function issuePurposeToken(userId: string, purpose: "verify_email" | "reset_password", ttlSeconds: number) {
  const token = randomToken();
  await env.DB.prepare("INSERT INTO auth_tokens (id, user_id, purpose, token_hash, expires_at) VALUES (?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), userId, purpose, await hashToken(token), Math.floor(Date.now() / 1000) + ttlSeconds).run();
  return token;
}

export async function sendAccountEmail(to: string, subject: string, html: string) {
  const apiKey = env.RESEND_API_KEY as string | undefined;
  const from = env.EMAIL_FROM as string | undefined;
  if (!apiKey || !from) return false;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
  return response.ok;
}

export function publicBaseUrl(request: Request) {
  return (env.APP_BASE_URL as string | undefined)?.replace(/\/$/, "") || new URL(request.url).origin;
}
