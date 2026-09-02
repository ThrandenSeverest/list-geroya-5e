import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = relative => fs.readFileSync(path.resolve(here, relative), "utf8");
const source = read("../app/characterRules.ts");

const expectedCounts = Object.freeze({
  barbarian: 9, bard: 8, cleric: 14, druid: 7, fighter: 10, monk: 10,
  paladin: 9, ranger: 8, rogue: 9, sorcerer: 8, warlock: 9, wizard: 13, artificer: 4,
});
const expectedTotal = Object.values(expectedCounts).reduce((sum, count) => sum + count, 0);
if (expectedTotal !== 118) throw new Error(`Broken acceptance fixture: ${expectedTotal} != 118`);

const requiredAdded = [
  ["barbarian", "battlerager"], ["barbarian", "stormherald"], ["barbarian", "wildmagic"], ["barbarian", "beast"], ["barbarian", "giant"],
  ["bard", "creation"], ["bard", "spirits"],
  ["cleric", "tempest"], ["cleric", "knowledge"], ["cleric", "trickery"], ["cleric", "nature"], ["cleric", "death"], ["cleric", "arcana"], ["cleric", "peace"], ["cleric", "order"],
  ["druid", "spores"],
  ["fighter", "banneret"], ["fighter", "echo-knight"], ["fighter", "psi-warrior"],
  ["monk", "four-elements"], ["monk", "long-death"], ["monk", "astral-self"], ["monk", "ascendant-dragon"],
  ["paladin", "oathbreaker"], ["paladin", "crown"], ["paladin", "glory"],
  ["ranger", "swarmkeeper"], ["ranger", "drakewarden"], ["rogue", "phantom"], ["sorcerer", "clockwork"],
  ["warlock", "undying"], ["warlock", "fathomless"], ["warlock", "undead"],
  ["wizard", "chronurgy"], ["wizard", "graviturgy"],
];

function fail(message) {
  console.error(`Subclass integration check failed: ${message}`);
  process.exitCode = 1;
}
function requireText(file, needles) {
  const text = read(file);
  for (const needle of needles) if (!text.includes(needle)) fail(`${file}: missing ${needle}`);
}

for (const [classId, id] of requiredAdded) {
  const direct = new RegExp(`classId:\\s*"${classId}"[^\\n]*id:\\s*"${id}"`).test(source);
  const baseClassStart = source.indexOf(`${classId}: { level:`);
  const baseId = baseClassStart >= 0 && source.indexOf(`SC("${id}"`, baseClassStart) >= 0;
  if (!direct && !baseId) fail(`required subclass missing: ${classId}/${id}`);
}
requireText("../app/characterRules.ts", [
  "officialSubclassCount", "subclassFeatureCorpus", "SUBCLASS_SPELL_GRANTS_5E14",
  "always-prepared", "known", "expanded", "subclassSpellGrantTable", "subclassFlagTable",
  "cleric:tempest", "druid:spores", "paladin:oathbreaker", "ranger:swarmkeeper",
  "sorcerer:clockwork", "warlock:undying", "warlock:fathomless", "warlock:undead",
  "selectedSubclassSpellChoiceIds", "dmApproval", "settingRestriction",
]);

const filterSource = read("../app/catalogFilters.ts");
for (const book of ["PHB", "DMG", "SCAG", "XGE", "GGR", "MOT", "EGW", "TCE", "VRGR", "FTD", "BPGG"])
  if (!filterSource.includes(book)) fail(`catalog filter does not recognise ${book}`);

requireText("../app/multiclass.ts", ["selectedSubclassForClass", "migratedChoiceValues", "choiceValues"]);
requireText("../app/proficiencies.ts", ["subclass-cleric-knowledge-skills", "cleric:tempest", "cleric:nature", "cleric:death", "cleric:order", "banneret"]);
requireText("../app/classChoices.ts", ["storm-herald-environment", "giant-cantrip", "nature-druid-cantrip", "death-necromancy-cantrip", "arcana-wizard-cantrips", "four-elements-disciplines", "entry.choiceValues"]);
requireText("../app/characterResources.ts", ["wild-magic-awareness", "psi-warrior-dice", "emboldening-bond", "form-of-dread", "chronal-shift"]);
requireText("../app/combat.ts", ["subclass-battlerager-spikes", "subclass-beast-bite", "subclass-astral-arms", "subclass-creation-dancing-item", "subclass-drakewarden-bite"]);
requireText("../app/languages.ts", ["subclass === \"knowledge\"", "subclass === \"giant\"", "subclass === \"ascendant-dragon\"", "subclass === \"drakewarden\""]);

if (!process.exitCode) console.log(`Subclass integration guard OK: acceptance target ${expectedTotal}; all 35 formerly missing subclass IDs plus choices, spell modes, proficiencies, resources, attacks, languages and multiclass persistence are present.`);
