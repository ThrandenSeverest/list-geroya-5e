import fs from "node:fs";
import path from "node:path";

const inputDir = process.argv[2];
const outputFile = process.argv[3];
if (!inputDir || !outputFile) {
  throw new Error("Usage: node scripts/build-rules-corpus.mjs <text-directory> <output-file>");
}

const classFiles = {
  barbarian: "varvar_dnd5e_oficialnye_sposobnosti.txt",
  bard: "bard_dnd5e_oficialnye_sposobnosti.txt",
  cleric: "zhrets_dnd5e_oficialnye_sposobnosti.txt",
  druid: "druid_dnd5e_oficialnye_sposobnosti.txt",
  fighter: "voin_dnd5e_oficialnye_sposobnosti.txt",
  monk: "monah_dnd5e_oficialnye_sposobnosti.txt",
  paladin: "paladin_dnd5e_oficialnye_sposobnosti.txt",
  ranger: "sledopyt_dnd5e_oficialnye_sposobnosti.txt",
  rogue: "plut_dnd5e_oficialnye_sposobnosti.txt",
  sorcerer: "charodey_dnd5e_oficialnye_sposobnosti.txt",
  warlock: "koldun_dnd5e_oficialnye_sposobnosti.txt",
  wizard: "volshebnik_dnd5e_oficialnye_sposobnosti.txt",
  artificer: "izobretatel_dnd5e_oficialnye_sposobnosti.txt",
};

const boundaries = {
  barbarian: [/2\. Базовые классовые способности/i, /3\. Официальные пути/i],
  bard: [/^Классовые способности$/im, /2\. Коллегия Доблести/i],
  cleric: [/^Классовые способности$/im, /2\. Домен бури \(/i],
  druid: [/^ДРУИДИЧЕСКИЙ ЯЗЫК/im, /^Официальные круги друидов$/im],
  fighter: [/2\. Базовые классовые способности/i, /4\. Официальные воинские архетипы/i],
  monk: [/3\. Классовые способности монаха/i, /4\. Официальные монастырские традиции/i],
  paladin: [/3\. Базовые классовые способности/i, /4\. Священные клятвы/i],
  ranger: [/3\. Классовые способности следопыта/i, /4\. Официальные архетипы следопыта/i],
  rogue: [/3\. Классовые способности плута/i, /4\. Официальные архетипы плута/i],
  sorcerer: [/3\. Классовые способности чародея/i, /4\. Официальные происхождения/i],
  warlock: [/2\. Классовые способности/i, /4\. Таинственные воззвания/i],
  wizard: [/2\. Использование заклинаний/i, /4\. Официальные магические традиции/i],
  artificer: [/2\. Классовые способности/i, /3\. Инфузии изобретателя/i],
};

function compact(value) {
  return value
    .replace(/^\s*[•*-]\s*/gm, "• ")
    .replace(/\s*\n\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function blocks(value) {
  return value.split(/\n\s*\n+/).map(compact).filter(Boolean);
}

function smartName(value) {
  const cleaned = value
    .replace(/^\d+(?:\.\d+)*\.?\s+/, "")
    .replace(/\s*[·,]\s*(?:опциональное|умение|Tasha).*$/i, "")
    .replace(/[.:]+$/, "")
    .trim();
  if (!cleaned) return "";
  const letters = cleaned.replace(/[^A-Za-zА-ЯЁа-яё]/g, "");
  if (letters && letters === letters.toUpperCase()) {
    const lower = cleaned.toLocaleLowerCase("ru-RU");
    return lower[0].toLocaleUpperCase("ru-RU") + lower.slice(1);
  }
  return cleaned;
}

const levelPattern = /(\d{1,2})-(?:й|го)[^\n]{0,70}?уров(?:ень|ня|ни)/i;

function featureCandidates(text) {
  const list = blocks(text);
  const candidates = [];
  for (let index = 0; index < list.length; index += 1) {
    const block = list[index];
    const levelMatch = block.match(levelPattern);
    if (!levelMatch) continue;
    const prefix = block.slice(0, levelMatch.index).trim();
    if (prefix.length > 120) continue;
    const prefixLetters = prefix.replace(/[^A-Za-zА-ЯЁа-яё]/g, "");
    if (prefix && prefixLetters !== prefixLetters.toUpperCase()) continue;
    const previous = list[index - 1] || "";
    const separateHeading = !prefix && previous.length <= 110 && !/[.!?]$/.test(previous) && !previous.startsWith("•");
    const rawName = prefix || (separateHeading ? previous : "");
    const name = smartName(rawName);
    if (!name || /^(ур\.?|уровень|бонус мастерства|классовые параметры|источник|требование)/i.test(name)) continue;
    if (/увеличение характеристик/i.test(name)) continue;
    candidates.push({
      name,
      level: Number(levelMatch[1]),
      optional: /опциональн|Tasha/i.test(block),
      headingIndex: separateHeading ? index - 1 : index,
      descriptionIndex: index + 1,
    });
  }
  return { list, candidates };
}

function parseFeatures(text) {
  const { list, candidates } = featureCandidates(text);
  return candidates.map((candidate, index) => {
    const end = candidates[index + 1]?.headingIndex ?? list.length;
    const description = list.slice(candidate.descriptionIndex, end)
      .filter(block => !/^[-+| ]+$/.test(block))
      .join("\n\n")
      .trim();
    return { level: candidate.level, name: candidate.name, description, optional: candidate.optional };
  }).filter(feature => feature.description.length >= 18);
}

function findIndex(text, expression, from = 0) {
  const match = expression.exec(text.slice(from));
  expression.lastIndex = 0;
  return match ? from + match.index : -1;
}

function findLastIndex(text, expression) {
  const matcher = new RegExp(expression.source, expression.flags.replace("g", "") + "g");
  let result = -1;
  for (const match of text.matchAll(matcher)) result = match.index;
  return result;
}

function baseRange(classId, text) {
  const [startPattern, endPattern] = boundaries[classId];
  const start = findLastIndex(text, startPattern);
  const end = findIndex(text, endPattern, Math.max(0, start + 1));
  if (start < 0 || end < 0) throw new Error(`Could not find base class boundaries for ${classId}`);
  return { start, end };
}

function subsectionHeadings(text, from) {
  const found = [];
  const lines = text.split("\n");
  let offset = 0;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    const position = offset + rawLine.indexOf(line);
    offset += rawLine.length + 1;
    if (position < from || !line) continue;
    let name = "";
    const numbered = line.match(/^\d+(?:\.\d+)+\.?\s+(.+)$/) || line.match(/^\d+\.\s+(.+)$/);
    if (numbered) name = numbered[1];
    const druid = line.match(/^(Круг .+?)\s+\[[^\]]+\]$/i);
    if (druid) name = druid[1];
    if (!name || /официальн|источник|границ|приложение|нарушение клятвы/i.test(name)) continue;
    found.push({ position, name: smartName(name.replace(/\s*\([^)]*\)\s*$/, "")) });
  }
  return found;
}

const classFeatureCorpus = {};
const optionalClassFeatureCorpus = {};
const subclassFeatureCorpus = {};

for (const [classId, filename] of Object.entries(classFiles)) {
  const text = fs.readFileSync(path.join(inputDir, filename), "utf8");
  const range = baseRange(classId, text);
  const parsed = parseFeatures(text.slice(range.start, range.end));
  classFeatureCorpus[classId] = parsed.filter(feature => !feature.optional).map(({ level, name, description }) => ({ level, name, description }));
  optionalClassFeatureCorpus[classId] = parsed.filter(feature => feature.optional).map(({ level, name, description }) => ({ level, name, description }));

  const headings = subsectionHeadings(text, range.end);
  subclassFeatureCorpus[classId] = {};
  for (let index = 0; index < headings.length; index += 1) {
    const heading = headings[index];
    const end = headings[index + 1]?.position ?? text.length;
    const features = parseFeatures(text.slice(heading.position, end)).map(({ level, name, description }) => ({ level, name, description }));
    if (features.length) subclassFeatureCorpus[classId][heading.name] = features;
  }
}

const abilityNames = {
  str: "Сила",
  dex: "Ловкость",
  con: "Телосложение",
  int: "Интеллект",
  wis: "Мудрость",
  cha: "Харизма",
};

function featAbilityOptions(description) {
  const bonusSentences = description.split(/(?<=[.!?])\s+/).filter(value => /\+1|на 1\b/i.test(value));
  if (!bonusSentences.length) return [];
  const segment = bonusSentences[0];
  if (/люб(?:ая|ую|ой)|одн(?:у|ой) характеристик/i.test(segment)) return Object.keys(abilityNames);
  return Object.entries(abilityNames).filter(([, label]) => segment.includes(label)).map(([key]) => key);
}

function slug(value) {
  return value.normalize("NFKD").replace(/[’']/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
}

function parseFeats(text) {
  const list = blocks(text);
  const starts = [];
  for (let index = 0; index < list.length; index += 1) {
    const match = list[index].match(/^(.+?)\s+\[([^\]]+)\]$/);
    if (match && /^Источник:/i.test(list[index + 1] || "")) starts.push({ index, name: match[1].trim(), english: match[2].trim() });
  }
  return starts.map((entry, entryIndex) => {
    const end = starts[entryIndex + 1]?.index ?? list.length;
    const chunk = list.slice(entry.index + 1, end);
    const sourceLine = chunk.find(value => /^Источник:/i.test(value)) || "";
    const requirementLine = chunk.find(value => /^Требования:/i.test(value)) || "";
    const mechanicsIndex = chunk.findIndex(value => /^Механика:/i.test(value));
    const description = chunk.slice(mechanicsIndex + 1).filter(value => value.startsWith("•")).join(" ").replace(/•\s*/g, "• ").trim();
    const source = sourceLine.match(/\(([A-Z0-9]+)\)\s*$/)?.[1] || "PHB";
    const requirement = requirementLine.replace(/^Требования:\s*/i, "").trim();
    return {
      id: slug(entry.english),
      name: entry.name,
      source,
      description,
      ...(requirement && requirement !== "—" ? { requirement } : {}),
      abilityOptions: featAbilityOptions(description),
      repeatable: /можно (?:брать|выбирать|получать) повторно|несколько раз/i.test(description),
    };
  }).filter(feat => feat.description);
}

const featFilename = fs.readdirSync(inputDir).find(value => value.startsWith("Черты_DnD_5e_2014"));
if (!featFilename) throw new Error("Feat reference text was not found");
const generatedFeats = parseFeats(fs.readFileSync(path.join(inputDir, featFilename), "utf8"));

const banner = `// Generated from the user-provided 5e 2014 class and feat references.\n// Run scripts/build-rules-corpus.mjs to rebuild; do not edit entries by hand.\n\n`;
const source = banner
  + `import type { Feature } from "./rules";\n\n`
  + `export type GeneratedFeat = { id: string; name: string; source: string; description: string; requirement?: string; abilityOptions: string[]; repeatable: boolean };\n\n`
  + `export const classFeatureCorpus: Record<string, Feature[]> = ${JSON.stringify(classFeatureCorpus, null, 2)};\n\n`
  + `export const optionalClassFeatureCorpus: Record<string, Feature[]> = ${JSON.stringify(optionalClassFeatureCorpus, null, 2)};\n\n`
  + `export const subclassFeatureCorpus: Record<string, Record<string, Feature[]>> = ${JSON.stringify(subclassFeatureCorpus, null, 2)};\n\n`
  + `export const generatedFeats: GeneratedFeat[] = ${JSON.stringify(generatedFeats, null, 2)};\n`;

fs.writeFileSync(outputFile, source);
console.log(JSON.stringify({
  classes: Object.fromEntries(Object.entries(classFeatureCorpus).map(([key, value]) => [key, value.length])),
  subclasses: Object.values(subclassFeatureCorpus).reduce((count, value) => count + Object.keys(value).length, 0),
  feats: generatedFeats.length,
  outputFile,
}, null, 2));
