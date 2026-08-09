import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { characterVaults } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getAppUser } from "../../appAuth";

const MAX_VAULT_BYTES = 2_000_000;

async function signedInUser(request: Request) {
  const appUser = await getAppUser(request);
  if (appUser) return { email: appUser.email };
  return getChatGPTUser();
}

export async function GET(request: Request) {
  const user = await signedInUser(request);
  if (!user) return Response.json({ error: "Требуется вход" }, { status: 401 });
  const [row] = await getDb().select().from(characterVaults).where(eq(characterVaults.userEmail, user.email)).limit(1);
  return Response.json({ vault: row ? JSON.parse(row.vaultJson) : null, updatedAt: row?.updatedAt || null });
}

export async function PUT(request: Request) {
  const user = await signedInUser(request);
  if (!user) return Response.json({ error: "Требуется вход" }, { status: 401 });
  const payload = await request.json() as { vault?: unknown };
  const vault = payload.vault as { version?: number; slots?: unknown[] } | undefined;
  if (!vault || vault.version !== 1 || !Array.isArray(vault.slots)) {
    return Response.json({ error: "Некорректная коллекция персонажей" }, { status: 400 });
  }
  const vaultJson = JSON.stringify(vault);
  if (new TextEncoder().encode(vaultJson).length > MAX_VAULT_BYTES) {
    return Response.json({ error: "Коллекция слишком велика" }, { status: 413 });
  }
  const updatedAt = new Date().toISOString();
  await getDb().insert(characterVaults).values({ userEmail: user.email, vaultJson, updatedAt })
    .onConflictDoUpdate({ target: characterVaults.userEmail, set: { vaultJson, updatedAt } });
  return Response.json({ saved: true, updatedAt });
}
