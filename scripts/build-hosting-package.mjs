import { cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version || "")) throw new Error("Usage: node scripts/build-hosting-package.mjs <version>");

const root = process.cwd();
const release = path.join(root, "release");
const stage = path.join(release, `HeroList-hosting-${version}`);
await rm(stage, { recursive: true, force: true });
await mkdir(stage, { recursive: true });

for (const entry of ["dist", "backend", "deployment", "package.json", "package-lock.json", "next.config.ts", "postcss.config.mjs"]) {
  await cp(path.join(root, entry), path.join(stage, entry), { recursive: true });
}

for (const forbidden of ["backend/data", ".env", "uploads", "saves", "node_modules", "tests", ".git"]) {
  await rm(path.join(stage, forbidden), { recursive: true, force: true });
}

await writeFile(path.join(stage, "DEPLOY_README.md"), `# HeroList ${version}\n\nЗамените runtime-файлы содержимым архива и перезапустите приложение. Не удаляйте .env, backend/data, SQLite, uploads или saves. Перед запуском выполните Alembic-миграции.\n`, "utf8");

const forbiddenPattern = /(^|\/)(\.env(?:\.|$)|[^/]*\.sqlite3?$|data\/|uploads\/|saves\/|node_modules\/|\.git\/)/;
const listed = spawnSync("find", [stage, "-type", "f"], { encoding: "utf8" });
if (listed.status !== 0) throw new Error(listed.stderr);
const files = listed.stdout.trim().split("\n").filter(Boolean);
for (const file of files) {
  const relative = path.relative(stage, file).replaceAll(path.sep, "/");
  if (forbiddenPattern.test(relative)) throw new Error(`Forbidden release path: ${relative}`);
  const info = await stat(file);
  if (info.size <= 1024 * 1024) {
    const content = await readFile(file).catch(() => Buffer.alloc(0));
    if (/SMTP_PASSWORD=|RESEND_API_KEY=|DATABASE_URL=.*@/.test(content.toString("utf8"))) throw new Error(`Possible secret in ${relative}`);
  }
}

const archive = path.join(release, `HeroList-hosting-${version}.zip`);
await rm(archive, { force: true });
const zipped = spawnSync("zip", ["-qr", archive, path.basename(stage)], { cwd: release, encoding: "utf8" });
if (zipped.status !== 0) throw new Error(zipped.stderr);
console.log(archive);
