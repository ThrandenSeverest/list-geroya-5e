import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const input = process.argv[2];
if (!input) throw new Error("Usage: node scripts/import-spell-doc.mjs <catalog.docx>");

const markdown = execFileSync("pandoc", [input, "-t", "gfm", "--wrap=none"], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
const catalogSource = readFileSync(new URL("../app/catalog.ts", import.meta.url), "utf8");
const expandedSource = readFileSync(new URL("../app/spellData.ts", import.meta.url), "utf8");
const exportIdsSource = readFileSync(new URL("../app/exportIds.ts", import.meta.url), "utf8");

const slug = value => value
  .normalize("NFKD")
  .replace(/[’']/g, "_")
  .replace(/[^A-Za-z0-9]+/g, "_")
  .replace(/^_|_$/g, "")
  .toLowerCase();

const normalizeName = value => value.toLocaleLowerCase("ru")
  .replace(/ё/g, "е")
  .replace(/[^a-zа-я0-9]+/g, "")
  .trim();

const existingIdsByRussianName = new Map();
for (const sourceText of [catalogSource, expandedSource]) {
  for (const match of sourceText.matchAll(/\b(?:S|X)\(\s*"([^"]+)"\s*,\s*"([^"]+)"/g)) {
    existingIdsByRussianName.set(normalizeName(match[2]), match[1]);
  }
}
const existingIdsByEnglishSlug = new Map(
  [...exportIdsSource.matchAll(/"([^"]+)"\s*:\s*\["\d+",\s*"([^"]+)"\]/g)]
    .map(match => [match[2], match[1]]),
);

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
  const heading = nameMatch[1].trim().replace(/\\([\[\]])/g, "$1");
  const bilingual = heading.match(/^(.*?)\s*\[([^\]]+)\]\s*$/);
  const name = (bilingual?.[1] || heading).trim();
  const englishName = (bilingual?.[2] || name).trim();
  const block = [];
  for (index += 1; index < lines.length && !/^#{1,3}\s/.test(lines[index]); index += 1) block.push(lines[index]);
  index -= 1;
  const text = block.join("\n");
  const metadata = text.match(/\*\*Источник:\*\*\s*([^*]+)\s*\*\*Школа:\*\*\s*([^*]+)\s*\*\*Классы:\*\*\s*([^\n]+)/);
  const summary = text.match(/\*\*(?:Точная механика|Механическая сводка)\.\*\*\s*([^\n]+)/)?.[1]?.trim() || "Механическая сводка доступна по ссылке на dnd.su.";
  const castingTime = text.match(/\*\*Накладывание:\*\*\s*([^*\n]+)/)?.[1]?.trim();
  const range = text.match(/\*\*Дистанция:\*\*\s*([^*\n]+)/)?.[1]?.trim();
  const components = text.match(/\*\*Компоненты:\*\*\s*([^*\n]+)/)?.[1]?.trim();
  const duration = text.match(/\*\*Длительность:\*\*\s*([^\n]+)/)?.[1]?.trim();
  const url = text.match(/\]\((https:\/\/dnd\.su\/spells\/\?search=[^)]+)\)/)?.[1] || `https://dnd.su/spells/?search=${encodeURIComponent(englishName)}`;
  const rawSource = metadata?.[1]?.trim().split(/[\s/]+/)[0] || source;
  const school = metadata?.[2]?.trim() || "Не указана";
  const classes = (metadata?.[3] || "").split(",").map(value => classIds[value.trim().toLowerCase()]).filter(Boolean);
  const resolvedSource = englishName === "Create Magen" ? "IDRotF" : sourceIds[rawSource] || source;
  const englishSlug = slug(englishName);
  const id = existingIdsByRussianName.get(normalizeName(name)) || existingIdsByEnglishSlug.get(englishSlug) || `spell-doc-${englishSlug}`;
  records.push({ id, name, englishName, source: resolvedSource, level, school: school[0].toUpperCase() + school.slice(1), classes, description: summary, ritual: /ритуал/i.test(`${summary} ${castingTime || ""}`), url, castingTime, range, components, duration });
}

if (records.length !== 514) throw new Error(`Expected 514 spells, parsed ${records.length}`);
const generated = records.map(({ englishName: _englishName, ...record }) => record);
const reusedStableIds = records.filter(record => !record.id.startsWith("spell-doc-")).length;
const output = `import type { CatalogSpell } from "./catalog";\n\n// Generated from the user-provided 514-spell Russian mechanics catalog.\nexport const documentSpells: CatalogSpell[] = ${JSON.stringify(generated, null, 2)};\n`;
writeFileSync(new URL("../app/generatedSpellCatalog.ts", import.meta.url), output);
console.log(JSON.stringify({ parsed: records.length, reusedStableIds, newIds: records.length - reusedStableIds, longestDescription: Math.max(...records.map(record => record.description.length)) }));
