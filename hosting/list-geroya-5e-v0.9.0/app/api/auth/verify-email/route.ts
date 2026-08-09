import { env } from "cloudflare:workers";
import { hashToken } from "../../../appAuth";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return Response.redirect(new URL("/account?verified=invalid", request.url));
  const row = await env.DB.prepare("SELECT id, user_id FROM auth_tokens WHERE token_hash = ? AND purpose = 'verify_email' AND used_at IS NULL AND expires_at > ? LIMIT 1")
    .bind(await hashToken(token), Math.floor(Date.now() / 1000)).first<{ id: string; user_id: string }>();
  if (!row) return Response.redirect(new URL("/account?verified=invalid", request.url));
  await env.DB.batch([
    env.DB.prepare("UPDATE users SET email_verified_at = CURRENT_TIMESTAMP WHERE id = ?").bind(row.user_id),
    env.DB.prepare("UPDATE auth_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = ?").bind(row.id),
  ]);
  return Response.redirect(new URL("/account?verified=success", request.url));
}
