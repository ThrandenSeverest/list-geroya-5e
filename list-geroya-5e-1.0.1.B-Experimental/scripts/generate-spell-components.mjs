import fs from "node:fs";
import { spells } from "../app/catalog.ts";

const sourcePath = process.argv[2];
if (!sourcePath) throw new Error("Pass the source spells JSON path.");

const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
const normalize = value => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]/g, "");

const aliases = {
  vicious: "viciousmockery",
  eldritch: "eldritchblast",
  booming: "boomingblade",
  greenflame: "greenflameblade",
  absorb: "absorbelements",
  armoragathys: "armorofagathys",
  silvery: "silverybarbs",
  pass: "passwithouttrace",
  mindwhip: "tashasmindwhip",
  shadowmoil: "shadowofmoil",
  steelwind: "steelwindstrike",
  wallforce: "wallofforce",
  draconic: "draconictransformation",
  powerstun: "powerwordstun",
  meteor: "meteorswarm",
  "word-radiance": "wordofradiance",
  "protection-evil-good": "protectionfromevilandgood",
  "globe-invulnerability": "globeofinvulnerability",
};

const official = source.filter(entry => entry.publisher === "Wizards of the Coast" && !/2024/.test(entry.book || ""));
const byName = new Map();
for (const entry of official) {
  const key = normalize(entry.name || "");
  if (!byName.has(key)) byName.set(key, entry);
}

function componentData(entry) {
  const raw = String(entry.properties?.Components || "").toUpperCase();
  const components = ["V", "S", "M"].filter(component => new RegExp(`(?:^|[^A-Z])${component}(?:$|[^A-Z])`).test(raw));
  const material = String(entry.description || "").match(/Components?\s*:\s*[^\n]*?M\s*\((.*?)\)\s*Duration\s*:/i)?.[1] || "";
  const materialSpecial = components.includes("M") && /\b(?:\d[\d,.]*\s*)?(?:cp|sp|ep|gp|pp)\b|worth\s+(?:at\s+least\s+)?\d|cost(?:s|ing)?\b|consum(?:e|es|ed|able)\b|which\s+the\s+spell\s+consumes/i.test(material);
  return { components, materialSpecial };
}

const generated = {};
const missing = [];
for (const spell of spells) {
  const candidateKeys = [normalize(spell.name), normalize(aliases[spell.id] || spell.id)];
  const entry = candidateKeys.map(key => byName.get(key)).find(Boolean);
  if (!entry) {
    missing.push(`${spell.id} (${spell.name})`);
    continue;
  }
  generated[spell.id] = componentData(entry);
}

if (missing.length) throw new Error(`Missing component data for ${missing.length} spells:\n${missing.join("\n")}`);

const body = `// Generated from the 2014 Wizards of the Coast spell records.\n` +
  `// Regenerate with: node --import tsx scripts/generate-spell-components.mjs <spells.json>\n` +
  `export const spellComponentsById = ${JSON.stringify(generated, null, 2)} as const;\n`;

fs.writeFileSync(new URL("../app/spellComponents.generated.ts", import.meta.url), body);
console.log(`Generated component metadata for ${Object.keys(generated).length} spells.`);
