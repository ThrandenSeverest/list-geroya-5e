import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const input = process.argv[2];
if (!input) throw new Error("Usage: node scripts/import-spell-doc.mjs <catalog.docx>");

const markdown = execFileSync("pandoc", [input, "-t", "gfm", "--wrap=none"], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
const exportIds = readFileSync(new URL("../app/exportIds.ts", import.meta.url), "utf8");
const knownSlugs = new Set([...exportIds.matchAll(/\["\d+",\s*"([^"]+)"\]/g)].map(match => match[1]));

const slug = value => value
  .normalize("NFKD")
  .replace(/[’']/g, "_")
  .replace(/[^A-Za-z0-9]+/g, "_")
  .replace(/^_|_$/g, "")
  .toLowerCase();

const classIds = {
  "бард": "bard", "жрец": "cleric", "друид": "druid", "паладин": "paladin",
  "следопыт": "ranger", "чародей": "sorcerer", "колдун": "warlock", "волшебник": "wizard",
  "изобретатель": "artificer",
};
const sourceIds = { PH14: "PHB", XGE: "XGE", TCE: "TCE", FTD: "FTD", EGW: "EGW", AI: "AI", SAS: "SAS", PAM: "PAM", BMT: "BMT", IDRotF: "IDRotF" };

let source = "PHB";
let level = 0;
const records = [];
const lines = markdown.split(/\r?\n/);
for (let index = 0; index < lines.length; index += 1) {
  const line = lines[index];
  const sourceMatch = line.match(/^#\s+([A-Z0-9]+)\s/);
  if (sourceMatch) source = sourceIds[sourceMatch[1]] || sourceMatch[1];
  const levelMatch = line.match(/^##\s+(Заговоры|(\d+) уровень)/);
  if (levelMatch) level = levelMatch[1] === "Заговоры" ? 0 : Number(levelMatch[2]);
  const nameMatch = line.match(/^###\s+(.+)$/);
  if (!nameMatch) continue;
  const name = nameMatch[1].trim().replace(/\\([\[\]])/g, "$1");
  const block = [];
  for (index += 1; index < lines.length && !/^#{1,3}\s/.test(lines[index]); index += 1) block.push(lines[index]);
  index -= 1;
  const text = block.join("\n");
  const metadata = text.match(/\*\*Источник:\*\*\s*([^*]+)\s*\*\*Школа:\*\*\s*([^*]+)\s*\*\*Классы:\*\*\s*([^\n]+)/);
  const summary = text.match(/\*\*Механическая сводка\.\*\*\s*([^\n]+)/)?.[1]?.trim() || "Механическая сводка доступна по ссылке на dnd.su.";
  const url = text.match(/\]\((https:\/\/dnd\.su\/spells\/\?search=[^)]+)\)/)?.[1] || `https://dnd.su/spells/?search=${encodeURIComponent(name)}`;
  const rawSource = metadata?.[1]?.trim().split(/[\s/]+/)[0] || source;
  const school = metadata?.[2]?.trim() || "Не указана";
  const classes = (metadata?.[3] || "").split(",").map(value => classIds[value.trim().toLowerCase()]).filter(Boolean);
  const resolvedSource = name === "Create Magen" ? "IDRotF" : sourceIds[rawSource] || source;
  records.push({ id: `spell-doc-${slug(name)}`, name, source: resolvedSource, level, school: school[0].toUpperCase() + school.slice(1), classes, description: summary, ritual: /ритуал/i.test(summary), url });
}

if (records.length !== 514) throw new Error(`Expected 514 spells, parsed ${records.length}`);
const generated = records.filter(record => !knownSlugs.has(slug(record.name)));
const duplicates = records.length - generated.length;
const output = `import type { CatalogSpell } from "./catalog";\n\n// Generated from dnd_spells_514_filtered.docx. Existing hand-curated cards keep their stable IDs.\nexport const documentSpells: CatalogSpell[] = ${JSON.stringify(generated, null, 2)};\n`;
writeFileSync(new URL("../app/generatedSpellCatalog.ts", import.meta.url), output);
const recordSlugs = new Set(records.map(record => slug(record.name)));
console.log(JSON.stringify({ parsed: records.length, matchedExisting: duplicates, generated: generated.length, knownNotMatched: [...knownSlugs].filter(value => !recordSlugs.has(value)) }));
