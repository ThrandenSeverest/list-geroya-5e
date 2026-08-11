import { env } from "cloudflare:workers";
import { hashToken, readCookie, sessionCookie } from "../../../appAuth";

export async function POST(request: Request) {
  const token = readCookie(request);
  if (token) await env.DB.prepare("DELETE FROM auth_sessions WHERE token_hash = ?").bind(await hashToken(token)).run();
  return Response.json({ authenticated: false }, { headers: { "set-cookie": sessionCookie("", 0) } });
}

