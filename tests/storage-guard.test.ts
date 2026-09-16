import assert from "node:assert/strict";
import test from "node:test";
import { storageGuardScript } from "../app/storageGuard";

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.has(key) ? this.values.get(key)! : null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, String(value));
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

function runGuard(localStorage: MemoryStorage, sessionStorage = new MemoryStorage()) {
  let loadHandler: (() => void) | null = null;
  let timerHandler: (() => void) | null = null;
  let reloads = 0;
  const window = {
    location: { reload: () => { reloads += 1; } },
    addEventListener: (name: string, handler: () => void) => {
      if (name === "load") loadHandler = handler;
    },
    setTimeout: (handler: () => void) => {
      timerHandler = handler;
      return 1;
    },
  };
  const document = { readyState: "loading" };
  const execute = new Function("localStorage", "sessionStorage", "window", "document", storageGuardScript);
  execute(localStorage, sessionStorage, window, document);
  return {
    fireLoad() { loadHandler?.(); },
    fireTimer() { timerHandler?.(); },
    reloads() { return reloads; },
  };
}

const vaultKey = "list-geroya-character-vault-v1";
const backupKey = "list-geroya-character-vault-v1-safe-backup";

function vault(ids: string[]) {
  return JSON.stringify({
    version: 1,
    capacity: Math.max(5, ids.length),
    activeId: ids[0] || "",
    folders: [],
    slots: ids.map(id => ({ id, updatedAt: "2026-09-16T00:00:00.000Z", character: { name: id } })),
  });
}

test("keeps a pre-upgrade snapshot and restores it if boot replaces old slots", () => {
  const localStorage = new MemoryStorage();
  const oldVault = vault(["hero-old-1", "hero-old-2", "hero-old-3"]);
  localStorage.setItem(vaultKey, oldVault);

  const runtime = runGuard(localStorage);
  assert.equal(localStorage.getItem(backupKey), oldVault);

  // Simulate a failed migration/fallback that creates a fresh empty character.
  localStorage.setItem(vaultKey, vault(["hero-new-empty"]));
  runtime.fireLoad();
  runtime.fireTimer();

  assert.equal(localStorage.getItem(vaultKey), oldVault);
  assert.equal(localStorage.getItem(backupKey), oldVault);
  assert.equal(runtime.reloads(), 1);
});

test("restores a missing or corrupted primary Vault from the safe backup", () => {
  const localStorage = new MemoryStorage();
  const oldVault = vault(["hero-safe"]);
  localStorage.setItem(vaultKey, "{broken-json");
  localStorage.setItem(backupKey, oldVault);

  runGuard(localStorage);
  assert.equal(localStorage.getItem(vaultKey), oldVault);
});

test("does not resurrect characters from backup when the current Vault is deliberately empty", () => {
  const localStorage = new MemoryStorage();
  const emptyVault = vault([]);
  localStorage.setItem(vaultKey, emptyVault);
  localStorage.setItem(backupKey, vault(["hero-deleted-on-purpose"]));

  const runtime = runGuard(localStorage);
  runtime.fireLoad();
  runtime.fireTimer();

  assert.equal(localStorage.getItem(vaultKey), emptyVault);
  assert.equal(runtime.reloads(), 0);
});
