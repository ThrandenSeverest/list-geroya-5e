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

bundle_text = "\n".join(
    p.read_text(encoding="utf-8")
    for p in (ROOT / "assets").glob("*.js")
    if p.is_file()
)
if "/list-geroya-5e/experimental/site-mark.png" not in bundle_text:
    raise SystemExit("Built JS does not contain the prefixed site-mark path")

print("GitHub Pages paths, anonymous mode and local character saving verified.")
