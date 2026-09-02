import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const rulesPath = path.resolve(here, "../app/characterRules.ts");
const source = fs.readFileSync(rulesPath, "utf8");

const expectedCounts = Object.freeze({
  barbarian: 9,
  bard: 8,
  cleric: 14,
  druid: 7,
  fighter: 10,
  monk: 10,
  paladin: 9,
  ranger: 8,
  rogue: 9,
  sorcerer: 8,
  warlock: 9,
  wizard: 13,
  artificer: 4,
});

const requiredAddedIds = Object.freeze({
  barbarian: ["battlerager", "stormherald", "wildmagic", "beast", "giant"],
  bard: ["creation", "spirits"],
  cleric: ["tempest", "knowledge", "trickery", "nature", "death", "arcana", "peace", "order"],
  druid: ["spores"],
  fighter: ["banneret", "echo-knight", "psi-warrior"],
  monk: ["four-elements", "long-death", "astral-self", "ascendant-dragon"],
  paladin: ["oathbreaker", "crown", "glory"],
  ranger: ["swarmkeeper", "drakewarden"],
  rogue: ["phantom"],
  sorcerer: ["clockwork"],
  warlock: ["undying", "fathomless", "undead"],
  wizard: ["chronurgy", "graviturgy"],
});

const requiredSources = ["PHB", "DMG", "SCAG", "XGE", "GGR", "MOT", "EGW", "TCE", "VRGR", "FTD", "BPGG"];

function fail(message) {
  console.error(`Subclass catalogue check failed: ${message}`);
  process.exitCode = 1;
}

const catalogStart = source.indexOf("export const subclasses:");
const catalogEnd = source.indexOf("const missingOfficialSubclassOptions", catalogStart);
if (catalogStart < 0 || catalogEnd < 0) {
  fail("could not locate subclass catalogue sections in characterRules.ts");
  process.exit();
}

const baseCatalog = source.slice(catalogStart, catalogEnd);
const baseIdsByClass = new Map();
for (const classId of Object.keys(expectedCounts)) {
  const startNeedle = `${classId}: { level:`;
  const start = baseCatalog.indexOf(startNeedle);
  if (start < 0) {
    fail(`missing base class block: ${classId}`);
    continue;
  }
  const nextCandidates = Object.keys(expectedCounts)
    .filter(candidate => candidate !== classId)
    .map(candidate => baseCatalog.indexOf(`\n  ${candidate}: { level:`, start + startNeedle.length))
    .filter(index => index >= 0);
  const end = nextCandidates.length ? Math.min(...nextCandidates) : baseCatalog.length;
  const block = baseCatalog.slice(start, end);
  const ids = [...block.matchAll(/\bSC(?:E)?\("([^"]+)"/g)].map(match => match[1]);
  baseIdsByClass.set(classId, ids);
}

const missingArrayStart = source.indexOf("const missingOfficialSubclassOptions");
const missingArrayEnd = source.indexOf("];", missingArrayStart);
if (missingArrayStart < 0 || missingArrayEnd < 0) {
  fail("could not locate missingOfficialSubclassOptions array");
  process.exit();
}
const missingArray = source.slice(missingArrayStart, missingArrayEnd + 2);
const appendedByClass = new Map();
for (const match of missingArray.matchAll(/classId:\s*"([^"]+)"[\s\S]*?id:\s*"([^"]+)"/g)) {
  const [, classId, id] = match;
  const list = appendedByClass.get(classId) || [];
  list.push(id);
  appendedByClass.set(classId, list);
}

const allIdsByClass = new Map();
for (const [classId, expected] of Object.entries(expectedCounts)) {
  const combined = [...(baseIdsByClass.get(classId) || []), ...(appendedByClass.get(classId) || [])];
  const unique = [...new Set(combined)];
  allIdsByClass.set(classId, unique);
  if (combined.length !== unique.length) fail(`${classId} contains duplicate subclass IDs`);
  if (unique.length !== expected) fail(`${classId}: expected ${expected}, found ${unique.length} (${unique.join(", ")})`);
}

const total = [...allIdsByClass.values()].reduce((sum, ids) => sum + ids.length, 0);
if (total !== 118) fail(`expected 118 official subclasses, found ${total}`);

for (const [classId, ids] of Object.entries(requiredAddedIds)) {
  const actual = new Set(allIdsByClass.get(classId) || []);
  for (const id of ids) {
    if (!actual.has(id)) fail(`required subclass missing: ${classId}/${id}`);
  }
}

const filterPath = path.resolve(here, "../app/catalogFilters.ts");
const filterSource = fs.readFileSync(filterPath, "utf8");
for (const book of requiredSources) {
  if (!new RegExp(`\\b${book}\\b`).test(filterSource)) fail(`source filter does not recognise ${book}`);
}

if (!process.exitCode) {
  console.log(`Subclass catalogue OK: ${total} official 5e14 subclasses.`);
  for (const [classId, ids] of allIdsByClass) console.log(`  ${classId}: ${ids.length}`);
}
