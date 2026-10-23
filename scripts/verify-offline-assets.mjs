import fs from "node:fs";
import path from "node:path";

// A static app may compile successfully while its CSS/JS still point to
// the GitHub Pages subdirectory instead of the offline Electron/WebView root.
const root = path.resolve("dist/client");
const pages = ["index.html", "account/index.html", "adventure/index.html"];
let checked = 0;
let styles = 0;
let scripts = 0;
const errors = [];

for (const page of pages) {
  const full = path.join(root, page);
  if (!fs.existsSync(full)) {
    errors.push("Missing static entry point: " + page);
    continue;
  }
  const html = fs.readFileSync(full, "utf8");
  const attrs = [...html.matchAll(/(?:href|src)=["']([^"']+)["']/g)];
  for (const [, raw] of attrs) {
    if (/^(?:https?:|data:|blob:|mailto:|#)/i.test(raw)) continue;
    const clean = raw.split(/[?#]/)[0];
    if (!/\.(?:js|mjs|css|svg|png|jpe?g|webp|ico|woff2?|ttf)$/i.test(clean)) continue;
    if (clean.startsWith("/list-geroya-5e/")) {
      errors.push(page + ": asset still uses GitHub Pages base: " + clean);
      continue;
    }
    let relative;
    try {
      const decoded = decodeURIComponent(clean);
      relative = decoded.startsWith("/")
        ? decoded.substring(1)
        : path.posix.normalize(path.posix.join(path.posix.dirname(page), decoded));
    } catch {
      errors.push(page + ": invalid asset URL: " + clean);
      continue;
    }
    if (relative === ".." || relative.startsWith("../")) {
      errors.push(page + ": asset escapes bundle: " + clean);
      continue;
    }
    const diskPath = path.resolve(root, relative);
    if (!diskPath.startsWith(root + path.sep) || !fs.existsSync(diskPath)) {
      errors.push(page + ": missing packaged resource: " + clean);
      continue;
    }
    checked++;
    if (clean.endsWith(".css")) styles++;
    if (/\.(?:js|mjs)$/i.test(clean)) scripts++;
  }
}
if (styles === 0) errors.push("No CSS stylesheet references were verified");
if (scripts === 0) errors.push("No JS entry references were verified");
if (errors.length) {
  console.error("Offline bundle verification failed:\n" + errors.join("\n"));
  process.exit(1);
}
console.log("Offline bundle verified: " + checked + " assets, " + styles + " CSS, " + scripts + " JS references across " + pages.length + " pages.");
