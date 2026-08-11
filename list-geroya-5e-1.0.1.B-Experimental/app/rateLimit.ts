import { env } from "cloudflare:workers";

type RateLimitOptions = { scope: string; limit: number; windowSeconds: number };

export async function enforceRateLimit(request: Request, options: RateLimitOptions) {
  const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const bucket = Math.floor(Date.now() / 1000 / options.windowSeconds);
  const key = `${options.scope}:${ip}:${bucket}`;
  await env.DB.prepare(`INSERT INTO auth_rate_limits (key, attempts, expires_at) VALUES (?, 1, ?)
    ON CONFLICT(key) DO UPDATE SET attempts = attempts + 1`).bind(key, (bucket + 1) * options.windowSeconds).run();
  const row = await env.DB.prepare("SELECT attempts FROM auth_rate_limits WHERE key = ?").bind(key).first<{ attempts: number }>();
  if ((row?.attempts || 0) > options.limit) return Response.json({ error: "Слишком много попыток. Попробуйте позже." }, { status: 429, headers: { "retry-after": String(options.windowSeconds) } });
  return null;
}

