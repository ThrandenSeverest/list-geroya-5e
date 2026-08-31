const encoder = new TextEncoder();

export const hex = (bytes: Uint8Array) => [...bytes].map(value => value.toString(16).padStart(2, "0")).join("");

export function randomToken(bytes = 32) {
  const value = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export async function hashToken(token: string) {
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(token))));
}

export async function hashPassword(password: string, iterations: number, salt = randomToken(16)) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: encoder.encode(salt), iterations }, key, 256);
  return { salt, hash: hex(new Uint8Array(bits)) };
}

export async function verifyPassword(password: string, salt: string, expected: string, iterations: number) {
  const actual = (await hashPassword(password, iterations, salt)).hash;
  if (actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index++) difference |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  return difference === 0;
}

export type VaultSlotLike = { id: string; updatedAt: string; [key: string]: unknown };
export type VaultLike = { version: number; capacity: number; activeId: string; slots: VaultSlotLike[] };

export function mergeVaultCollections(local: VaultLike, remote?: VaultLike | null): VaultLike {
  if (!remote?.slots?.length) return local;
  const merged = new Map<string, VaultSlotLike>();
  for (const slot of [...remote.slots, ...local.slots]) {
    const existing = merged.get(slot.id);
    if (!existing || Date.parse(slot.updatedAt || "") >= Date.parse(existing.updatedAt || "")) merged.set(slot.id, slot);
  }
  const slots = [...merged.values()].sort((a, b) => Date.parse(b.updatedAt || "") - Date.parse(a.updatedAt || ""));
  const activeId = slots.some(slot => slot.id === local.activeId) ? local.activeId : remote.activeId || slots[0]?.id || "";
  return { version: 1, capacity: Math.max(5, local.capacity || 0, remote.capacity || 0, slots.length), activeId, slots };
}

