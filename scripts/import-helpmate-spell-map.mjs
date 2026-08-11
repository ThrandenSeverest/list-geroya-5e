import { build } from "esbuild";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const input = process.argv[2];
if (!input) throw new Error("Usage: node scripts/import-helpmate-spell-map.mjs <helpmate_spell_id_map.json>");

const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "list-geroya-helpmate-"));
const catalogBundle = path.join(temporaryDirectory, "catalog.cjs");
const exportIdsBundle = path.join(temporaryDirectory, "export-ids.cjs");
await build({ entryPoints: ["app/catalog.ts"], bundle: true, platform: "node", format: "cjs", outfile: catalogBundle, logLevel: "silent" });
await build({ entryPoints: ["app/exportIds.ts"], bundle: true, platform: "node", format: "cjs", outfile: exportIdsBundle, logLevel: "silent" });

const require = createRequire(import.meta.url);
const { spells } = require(catalogBundle);
const { dndSpellUrl } = require(exportIdsBundle);
const rows = JSON.parse(fs.readFileSync(input, "utf8"));
const normalize = value => String(value || "").normalize("NFKD").toLowerCase().replace(/[^a-zа-яё0-9]+/gi, "");
const idByName = new Map();
for (const row of rows) {
  for (const name of [row.name_ru, row.name_en]) idByName.set(normalize(name), String(row.id));
}

// Confirmed spelling differences in Helpmate's own English catalog.
idByName.set(normalize("Dissonant Whispers"), "56");
idByName.set(normalize("Lightning Lure"), "TCoE_3");
idByName.set(normalize("Summon Celestial"), "TCoE_18");

const result = {};
for (const spell of spells) {
  const value = dndSpellUrl(spell.id) || spell.url || "";
  let searchName = "";
  let pathName = "";
  try {
    const url = new URL(value);
    searchName = url.searchParams.get("search") || "";
    pathName = url.pathname.match(/\/spells\/\d+-([^/]+)/)?.[1] || "";
  } catch {}
  const helpmateId = [spell.name, searchName, pathName].map(normalize).map(name => idByName.get(name)).find(Boolean);
  if (helpmateId) result[spell.id] = String(helpmateId);
}

const lines = Object.entries(result).sort(([left], [right]) => left.localeCompare(right)).map(([id, helpmateId]) => `  ${JSON.stringify(id)}: ${JSON.stringify(helpmateId)},`);
const output = `// Generated from the verified Helpmate spell map. All IDs stay strings because Helpmate also uses TCoE_* identifiers.\nexport const verifiedHelpmateSpellIds: Readonly<Record<string, string>> = Object.freeze({\n${lines.join("\n")}\n});\n`;
fs.writeFileSync("app/helpmateSpellMap.ts", output);
console.log(`Mapped ${Object.keys(result).length} of ${spells.length} catalog spells to ${rows.length} verified Helpmate entries.`);

