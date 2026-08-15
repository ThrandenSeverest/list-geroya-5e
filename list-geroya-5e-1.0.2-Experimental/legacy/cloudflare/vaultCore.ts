import { authConfig } from "../config/auth";

export function validateVaultPayload(value: unknown) {
  if (!value || typeof value !== "object") return { valid: false as const, status: 400, error: "Некорректная коллекция персонажей" };
  const vault = value as { version?: unknown; capacity?: unknown; activeId?: unknown; slots?: unknown };
  if (vault.version !== 1 || !Array.isArray(vault.slots) || typeof vault.activeId !== "string" || typeof vault.capacity !== "number") return { valid: false as const, status: 400, error: "Некорректная коллекция персонажей" };
  if (vault.slots.some(slot => !slot || typeof slot !== "object" || typeof (slot as { id?: unknown }).id !== "string" || typeof (slot as { updatedAt?: unknown }).updatedAt !== "string" || !(slot as { character?: unknown }).character)) return { valid: false as const, status: 400, error: "Некорректная запись персонажа" };
  const json = JSON.stringify(vault);
  if (new TextEncoder().encode(json).length > authConfig.vaultMaxBytes) return { valid: false as const, status: 413, error: "Коллекция слишком велика" };
  return { valid: true as const, json, vault };
}

