import fs from "node:fs";

const output = process.argv[2];
const inputs = process.argv.slice(3);
if (!output || !inputs.length) throw new Error("Usage: node scripts/build-sheet-rules.mjs <output.ts> <class-markdown...>");

const classIds = {
  "ВАРВАР": "barbarian", "БАРД": "bard", "ЖРЕЦ": "cleric", "ДРУИД": "druid",
  "ВОИН": "fighter", "МОНАХ": "monk", "ПАЛАДИН": "paladin", "СЛЕДОПЫТ": "ranger",
  "ПЛУТ": "rogue", "ЧАРОДЕЙ": "sorcerer", "КОЛДУН": "warlock",
  "ВОЛШЕБНИК": "wizard", "ИЗОБРЕТАТЕЛЬ": "artificer",
};

const base = {};
const optional = {};
const subclasses = {};
const choices = {};

function normalizedName(value) {
  return value.toLocaleLowerCase("ru-RU").replace(/ё/g, "е").replace(/\b(?:tce|tcoe|phb|xge)\b/gi, "").replace(/[^a-zа-я0-9]+/g, " ").trim();
}

function rememberTableChoices(lines) {
  for (const raw of lines) {
    if (!raw.trim().startsWith("|")) continue;
    const cells = raw.split("|").slice(1, -1).map(cell => cell.replace(/[*`]/g, "").trim());
    if (cells.length < 2 || cells.some(cell => /^[-: ]+$/.test(cell))) continue;
    const name = cells[0].replace(/\s*\([^)]*(?:TCE|TCoE|PHB|XGE)[^)]*\)\s*/gi, " ").trim();
    const description = cells.at(-1)?.replace(/\\([*_-])/g, "$1").trim() || "";
    if (!name || description.length < 20 || /^(название|уровень|класс|способность|маневр|стиль|вариант)/i.test(name)) continue;
    const key = normalizedName(name);
    if (!choices[key] || choices[key].length < description.length) choices[key] = description;
  }
}

function cleanText(lines) {
  return lines.join("\n")
    .replace(/\n{2,}/g, "\n\n")
    .split(/\n\n+/)
    .map(block => block.replace(/\s*\n\s*/g, " ").replace(/\s{2,}/g, " ").trim())
    .filter(block => block && !/^\|[- :|]+\|$/.test(block))
    .join("\n\n")
    .replace(/\\([-*])/g, "$1")
    .trim();
}

for (const filename of inputs) {
  const lines = fs.readFileSync(filename, "utf8").split(/\r?\n/);
  rememberTableChoices(lines);
  let classId;
  let section = "base";
  let subclass = "";
  let pending;

  const flush = () => {
    if (!classId || !pending) return;
    const feature = { level: pending.level, name: pending.name, description: cleanText(pending.lines) };
    pending = undefined;
    if (!feature.description) return;
    if (section === "base") (base[classId] ||= []).push(feature);
    else if (section === "optional") (optional[classId] ||= []).push(feature);
    else ((subclasses[classId] ||= {})[subclass] ||= []).push(feature);
  };

  for (const raw of lines) {
    const classHeading = raw.match(/^#\s+(.+?)\s*$/);
    if (classHeading) {
      flush();
      classId = classIds[classHeading[1].trim().toLocaleUpperCase("ru-RU")];
      section = "base";
      subclass = "";
      continue;
    }
    const sectionHeading = raw.match(/^##\s+(.+?)\s*$/);
    if (sectionHeading) {
      flush();
      const name = sectionHeading[1].trim();
      if (/^Опциональн/i.test(name)) {
        section = "optional";
        subclass = "";
      } else {
        section = "subclass";
        subclass = name;
      }
      continue;
    }
    const featureHeading = raw.match(/^\*\*(\d{1,2})-(?:й|го) уровень\s*[—-]\s*(.+?)\*\*\s*$/i);
    if (featureHeading) {
      flush();
      pending = { level: Number(featureHeading[1]), name: featureHeading[2].trim(), lines: [] };
      continue;
    }
    if (pending) pending.lines.push(raw);
  }
  flush();
}

for (const classId of Object.values(classIds)) {
  base[classId] ||= [];
  optional[classId] ||= [];
  subclasses[classId] ||= {};
}

const source = `// Generated from the five user-approved concise class text packages.\n// Rebuild with scripts/build-sheet-rules.mjs; do not edit entries by hand.\n\nimport type { Feature } from "./rules";\n\nexport const sheetClassFeatures: Record<string, Feature[]> = ${JSON.stringify(base, null, 2)};\n\nexport const sheetOptionalFeatures: Record<string, Feature[]> = ${JSON.stringify(optional, null, 2)};\n\nexport const sheetSubclassFeatures: Record<string, Record<string, Feature[]>> = ${JSON.stringify(subclasses, null, 2)};\n\nexport const sheetChoiceDescriptions: Record<string, string> = ${JSON.stringify(choices, null, 2)};\n`;
fs.writeFileSync(output, source);
console.log(JSON.stringify({ classes: Object.fromEntries(Object.entries(base).map(([id, rows]) => [id, rows.length])), subclasses: Object.values(subclasses).reduce((sum, rows) => sum + Object.keys(rows).length, 0) }, null, 2));
