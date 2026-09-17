import path from "node:path";
import crypto from "node:crypto";
import fs from "node:fs/promises";

const outDir = path.resolve(process.cwd(), "dist");
const draftSecret = crypto.randomUUID();
const serverEntry = path.join(outDir, "server", "index.js");
let serverSource = await fs.readFile(serverEntry, "utf8");
serverSource = serverSource.replace(
  /function getDraftSecret\(\) \{\s*return "[^"]+";\s*\}/,
  `function getDraftSecret() {\n\treturn "${draftSecret}";\n}`,
);
await fs.writeFile(serverEntry, serverSource);

const prerenderSecret = crypto.randomBytes(32).toString("hex");
for (const relativePath of ["server/vinext-server.json", "server/ssr/vinext-server.json"]) {
  const configPath = path.join(outDir, relativePath);
  const config = JSON.parse(await fs.readFile(configPath, "utf8"));
  config.prerenderSecret = prerenderSecret;
  await fs.writeFile(configPath, JSON.stringify(config));
}

const { startProdServer } = await import("vinext/server/prod-server");

const port = Number.parseInt(process.env.PORT || "3000", 10);
const host = process.env.HOST || "127.0.0.1";

await startProdServer({
  port,
  host,
  outDir,
});
