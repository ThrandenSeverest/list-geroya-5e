import { env } from "cloudflare:workers";
import { hashPassword, hashToken } from "../../../appAuth";

export async function POST(request: Request) {
  const body = await request.json() as { token?: string; password?: string };
  if (!body.token || !body.password || body.password.length < 10 || body.password.length > 128) return Response.json({ error: "Некорректная ссылка или пароль" }, { status: 400 });
  const row = await env.DB.prepare("SELECT id, user_id FROM auth_tokens WHERE token_hash = ? AND purpose = 'reset_password' AND used_at IS NULL AND expires_at > ? LIMIT 1")
    .bind(await hashToken(body.token), Math.floor(Date.now() / 1000)).first<{ id: string; user_id: string }>();
  if (!row) return Response.json({ error: "Ссылка недействительна или устарела" }, { status: 400 });
  const password = await hashPassword(body.password);
  await env.DB.batch([
    env.DB.prepare("UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?").bind(password.hash, password.salt, row.user_id),
    env.DB.prepare("UPDATE auth_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = ?").bind(row.id),
    env.DB.prepare("DELETE FROM auth_sessions WHERE user_id = ?").bind(row.user_id),
  ]);
  return Response.json({ reset: true });
}
