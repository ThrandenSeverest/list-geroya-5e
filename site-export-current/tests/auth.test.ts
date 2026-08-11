import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { join } from "node:path";
import { authConfig } from "../config/auth";
import { hashPassword, hashToken, mergeVaultCollections, normalizeEmail, verifyPassword } from "../app/authCore";
import { validateVaultPayload } from "../app/vaultCore";

test("passwords use unique salts and verify without plaintext storage", async () => {
  const first = await hashPassword("correct horse battery staple", 2_000);
  const second = await hashPassword("correct horse battery staple", 2_000);
  assert.notEqual(first.salt, second.salt);
  assert.notEqual(first.hash, second.hash);
  assert.equal(await verifyPassword("correct horse battery staple", first.salt, first.hash, 2_000), true);
  assert.equal(await verifyPassword("wrong password", first.salt, first.hash, 2_000), false);
  assert.equal(first.hash.includes("correct horse"), false);
});

test("session tokens are stored only as hashes", async () => {
  const token = "opaque-session-token";
  const digest = await hashToken(token);
  assert.notEqual(digest, token);
  assert.equal(digest.length, 64);
  const source = readFileSync(join(process.cwd(), "app/appAuth.ts"), "utf8");
  assert.match(source, /token_hash/);
  assert.doesNotMatch(source, /INSERT INTO auth_sessions[^\n]*\btoken\b(?!_hash)/);
});

test("email normalization is stable", () => assert.equal(normalizeEmail("  Hero@Example.COM "), "hero@example.com"));

test("local and cloud vaults merge by id and newest updatedAt", () => {
  const local = { version: 1, capacity: 5, activeId: "same", slots: [{ id: "same", updatedAt: "2026-08-11T12:00:00Z", character: { name: "new" } }, { id: "local", updatedAt: "2026-08-11T10:00:00Z", character: {} }] };
  const remote = { version: 1, capacity: 10, activeId: "remote", slots: [{ id: "same", updatedAt: "2026-08-10T12:00:00Z", character: { name: "old" } }, { id: "remote", updatedAt: "2026-08-11T11:00:00Z", character: {} }] };
  const merged = mergeVaultCollections(local, remote);
  assert.equal(merged.slots.length, 3);
  assert.equal((merged.slots.find(slot => slot.id === "same")?.character as { name: string }).name, "new");
  assert.equal(merged.capacity, 10);
  assert.equal(merged.activeId, "same");
});

test("vault validation accepts opaque current characters and rejects oversized vaults", () => {
  const valid = { version: 1, capacity: 5, activeId: "a", slots: [{ id: "a", updatedAt: new Date().toISOString(), character: { newFutureField: { anything: true } } }] };
  assert.equal(validateVaultPayload(valid).valid, true);
  const oversized = { ...valid, slots: [{ ...valid.slots[0], character: { payload: "x".repeat(authConfig.vaultMaxBytes + 1) } }] };
  const result = validateVaultPayload(oversized);
  assert.equal(result.valid, false);
  if (!result.valid) assert.equal(result.status, 413);
});

test("release auth flags keep registration and sync on while email verification stays off", () => {
  assert.equal(authConfig.registrationEnabled, true);
  assert.equal(authConfig.loginEnabled, true);
  assert.equal(authConfig.cloudSyncEnabled, true);
  assert.equal(authConfig.emailVerificationEnabled, false);
  assert.equal(authConfig.requireVerifiedEmail, false);
  assert.equal(authConfig.emailDeliveryEnabled, false);
});

test("schema isolates vaults by user id and tokens are one-time", () => {
  const schema = readFileSync(join(process.cwd(), "db/schema.ts"), "utf8");
  const vaultRoute = readFileSync(join(process.cwd(), "app/api/vault/route.ts"), "utf8");
  const resetRoute = readFileSync(join(process.cwd(), "app/api/auth/reset-password/route.ts"), "utf8");
  const verifyRoute = readFileSync(join(process.cwd(), "app/api/auth/verify-email/route.ts"), "utf8");
  assert.match(schema, /userId: text\("user_id"\)\.primaryKey\(\)\.references/);
  assert.doesNotMatch(schema, /userEmail/);
  assert.match(vaultRoute, /eq\(characterVaults\.userId, user\.id\)/);
  assert.match(resetRoute, /used_at IS NULL/);
  assert.match(resetRoute, /DELETE FROM auth_sessions WHERE user_id/);
  assert.match(verifyRoute, /used_at IS NULL/);
});

test("rate limiting protects expensive and email endpoints", () => {
  for (const path of ["register", "login", "forgot-password", "resend-verification"]) {
    const source = readFileSync(join(process.cwd(), `app/api/auth/${path}/route.ts`), "utf8");
    assert.match(source, /enforceRateLimit/);
  }
});
