from pathlib import Path
import re

ROOT = Path(".pages-test")
PREFIX = "/list-geroya-5e"

TEST_LAYER = r'''
<style id="herolist-gh-pages-test-style">
  .account-state,
  a[href="/account"],
  .mobile-top-menu a[href="/account"] { display: none !important; }
  .account-warning { display: inline-flex !important; }
  .app-shell.modern-design { background: linear-gradient(rgba(246,235,203,.84), rgba(238,218,173,.88)), url('/list-geroya-5e/parchment-background.jpg') center top / cover fixed !important; }
</style>
<script id="herolist-gh-pages-test-api">
(() => {
  const nativeFetch = window.fetch.bind(window);
  const nativeSetItem = Storage.prototype.setItem;
  const VAULT_KEY = "list-geroya-character-vault-v1";
  const VAULT_BACKUP_KEY = "list-geroya-character-vault-v1-gh-pages-backup";
  const LEGACY_CHARACTER_KEY = "dark-codex-character";
  const startupProtectionUntil = Date.now() + 5000;

  function parseJson(raw) {
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

  function isVault(value) {
    return !!value && typeof value === "object" && Array.isArray(value.slots);
  }

  function isMeaningfulCharacter(character) {
    if (!character || typeof character !== "object") return false;
    if (String(character.name || "").trim()) return true;
    if (String(character.race || "").trim()) return true;
    if (String(character.className || "").trim()) return true;
    if (String(character.background || "").trim()) return true;
    if (String(character.subclass || "").trim()) return true;
    if (Array.isArray(character.classes) && character.classes.some(item => item && item.classId)) return true;
    if (Array.isArray(character.spells) && character.spells.length) return true;
    if (Array.isArray(character.feats) && character.feats.length) return true;
    return false;
  }

  function meaningfulSlotCount(vault) {
    if (!isVault(vault)) return 0;
    return vault.slots.filter(slot => slot && isMeaningfulCharacter(slot.character)).length;
  }

  function makeLegacyVault(character) {
    const now = new Date().toISOString();
    const id = `recovered-${Date.now()}`;
    return { version: 1, capacity: 5, activeId: id, slots: [{ id, character, updatedAt: now }], folders: [] };
  }

  function saveBackup(raw) {
    const parsed = parseJson(raw);
    if (!isVault(parsed) || !parsed.slots.length) return;
    const existing = parseJson(localStorage.getItem(VAULT_BACKUP_KEY));
    if (!isVault(existing) || parsed.slots.length >= existing.slots.length || meaningfulSlotCount(parsed) >= meaningfulSlotCount(existing)) {
      nativeSetItem.call(localStorage, VAULT_BACKUP_KEY, raw);
    }
  }

  function recoverLocalVault() {
    const primaryRaw = localStorage.getItem(VAULT_KEY);
    const backupRaw = localStorage.getItem(VAULT_BACKUP_KEY);
    const primary = parseJson(primaryRaw);
    const backup = parseJson(backupRaw);
    const primaryUseful = isVault(primary) && meaningfulSlotCount(primary) > 0;
    const backupUseful = isVault(backup) && meaningfulSlotCount(backup) > 0;

    if (backupUseful && !primaryUseful) {
      nativeSetItem.call(localStorage, VAULT_KEY, backupRaw);
      return;
    }

    if (primaryUseful) {
      saveBackup(primaryRaw);
      return;
    }

    const legacyRaw = localStorage.getItem(LEGACY_CHARACTER_KEY);
    const legacy = parseJson(legacyRaw);
    if (isMeaningfulCharacter(legacy)) {
      const recovered = JSON.stringify(makeLegacyVault(legacy));
      nativeSetItem.call(localStorage, VAULT_KEY, recovered);
      nativeSetItem.call(localStorage, VAULT_BACKUP_KEY, recovered);
    }
  }

  recoverLocalVault();

  Storage.prototype.setItem = function(key, value) {
    if (this === localStorage && key === VAULT_KEY) {
      const previousRaw = localStorage.getItem(VAULT_KEY);
      const previous = parseJson(previousRaw);
      const next = parseJson(String(value));
      const previousMeaningful = meaningfulSlotCount(previous);
      const nextMeaningful = meaningfulSlotCount(next);

      if (Date.now() < startupProtectionUntil && previousMeaningful > 0 && nextMeaningful < previousMeaningful) {
        saveBackup(previousRaw);
        return;
      }

      nativeSetItem.call(this, key, value);
      if (isVault(next) && next.slots.length) saveBackup(String(value));
      return;
    }
    nativeSetItem.call(this, key, value);
  };

  function markLocalSaving() {
    document.querySelectorAll('.account-warning').forEach(node => {
      if (node.textContent !== 'Персонажи сохраняются локально в этом браузере.') {
        node.textContent = 'Персонажи сохраняются локально в этом браузере.';
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', markLocalSaving, { once: true });
  } else {
    markLocalSaving();
  }
  new MutationObserver(markLocalSaving).observe(document.documentElement, { childList: true, subtree: true });

  window.fetch = (input, init) => {
    const raw = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
    const method = String(init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
    let path = raw;
    try { path = new URL(raw, window.location.href).pathname; } catch {}
    if (path === "/api/account" || path.endsWith("/api/account")) {
      return Promise.resolve(new Response(JSON.stringify({ authenticated: false, cloudSyncEnabled: false }), { status: 200, headers: { "content-type": "application/json" } }));
    }
    if (path === "/api/vault" || path.endsWith("/api/vault")) {
      return Promise.resolve(new Response(JSON.stringify(method === "GET" ? { vault: null, updatedAt: null } : { error: "Cloud sync is disabled in the GitHub Pages test" }), { status: method === "GET" ? 200 : 404, headers: { "content-type": "application/json" } }));
    }
    if (path === "/api/homebrew" || path.endsWith("/api/homebrew")) {
      return Promise.resolve(new Response(JSON.stringify(method === "GET" ? { library: { version: 1, elements: [] }, updatedAt: null } : { error: "Cloud homebrew is disabled in the GitHub Pages test" }), { status: method === "GET" ? 200 : 404, headers: { "content-type": "application/json" } }));
    }
    if (path.includes("/api/auth/")) {
      return Promise.resolve(new Response(JSON.stringify({ error: "Authentication is disabled in the GitHub Pages test" }), { status: 404, headers: { "content-type": "application/json" } }));
    }
    return nativeFetch(input, init);
  };
})();
</script>
'''

DIR_PATH_RE = re.compile(r'(?<![A-Za-z0-9._~-])/(assets|experimental|acknowledgements)/')
FILE_PATH_RE = re.compile(r'(?<![A-Za-z0-9._~-])/(favicon\.svg|parchment-background\.jpg)')


def normalize_paths(text: str) -> str:
    text = DIR_PATH_RE.sub(lambda m: f"{PREFIX}/{m.group(1)}/", text)
    text = FILE_PATH_RE.sub(lambda m: f"{PREFIX}/{m.group(1)}", text)
    return text


for filename in ("index.html", "404.html"):
    path = ROOT / filename
    html = path.read_text(encoding="utf-8")
    if "</head>" not in html:
        raise SystemExit(f"{filename}: missing </head>")
    html = html.replace("</head>", TEST_LAYER + "</head>", 1)
    html = re.sub(r"<title>.*?</title>", "<title>Лист Героя 5e 1.4 — тест GitHub Pages</title>", html, count=1, flags=re.S)
    path.write_text(html, encoding="utf-8")

for path in ROOT.rglob("*"):
    if not path.is_file() or path.suffix.lower() not in {".html", ".css", ".js"}:
        continue
    text = path.read_text(encoding="utf-8")
    normalized = normalize_paths(text)
    if normalized != text:
        path.write_text(normalized, encoding="utf-8")

problems = []
for path in ROOT.rglob("*"):
    if not path.is_file() or path.suffix.lower() not in {".html", ".css", ".js"}:
        continue
    text = path.read_text(encoding="utf-8")
    if DIR_PATH_RE.search(text) or FILE_PATH_RE.search(text):
        problems.append(str(path))
if problems:
    raise SystemExit("Unprefixed static paths remain in: " + ", ".join(problems[:20]))

for path in (
    ROOT / "favicon.svg",
    ROOT / "parchment-background.jpg",
    ROOT / "experimental" / "site-mark.png",
):
    if not path.is_file():
        raise SystemExit(f"Missing required GitHub Pages asset: {path}")

index = (ROOT / "index.html").read_text(encoding="utf-8")
for expected in ("/list-geroya-5e/favicon.svg", "/list-geroya-5e/assets/"):
    if expected not in index:
        raise SystemExit(f"index.html does not contain expected path: {expected}")
if 'Персонажи сохраняются локально в этом браузере.' not in index:
    raise SystemExit("Anonymous local-save test layer is missing")
if 'Authentication is disabled in the GitHub Pages test' not in index:
    raise SystemExit("Authentication blocker is missing")
if 'list-geroya-character-vault-v1-gh-pages-backup' not in index:
    raise SystemExit("Local vault recovery layer is missing")

bundle_text = "\n".join(
    p.read_text(encoding="utf-8")
    for p in (ROOT / "assets").glob("*.js")
    if p.is_file()
)
if "/list-geroya-5e/experimental/site-mark.png" not in bundle_text:
    raise SystemExit("Built JS does not contain the prefixed site-mark path")

print("GitHub Pages paths, anonymous mode and protected local character saving verified.")
