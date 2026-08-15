import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { characterVaults } from "../../../db/schema";
import { ensureChatGPTUser, getAppUser } from "../../appAuth";
import { getChatGPTUser } from "../../chatgpt-auth";
import { validateVaultPayload } from "../../vaultCore";

async function signedInUser(request: Request) {
  const appUser = await getAppUser(request);
  if (appUser) return { id: appUser.id };
  const chatGPTUser = await getChatGPTUser();
  if (!chatGPTUser) return null;
  return { id: await ensureChatGPTUser(chatGPTUser.email) };
}

export async function GET(request: Request) {
  const user = await signedInUser(request);
  if (!user) return Response.json({ error: "Требуется вход" }, { status: 401 });
  const [row] = await getDb().select().from(characterVaults).where(eq(characterVaults.userId, user.id)).limit(1);
  return Response.json({ vault: row ? JSON.parse(row.vaultJson) : null, updatedAt: row?.updatedAt || null });
}

export async function PUT(request: Request) {
  const user = await signedInUser(request);
  if (!user) return Response.json({ error: "Требуется вход" }, { status: 401 });
  const payload = await request.json() as { vault?: unknown };
  const checked = validateVaultPayload(payload.vault);
  if (!checked.valid) return Response.json({ error: checked.error }, { status: checked.status });
  const vaultJson = checked.json;
  const updatedAt = new Date().toISOString();
  await getDb().insert(characterVaults).values({ userId: user.id, vaultJson, updatedAt })
    .onConflictDoUpdate({ target: characterVaults.userId, set: { vaultJson, updatedAt } });
  return Response.json({ saved: true, updatedAt });
}
