import assert from "node:assert/strict";
import { spells } from "../app/catalog";
import {
  classChoiceGroups,
  clearTashaOptionalState,
  resolvedClassChoiceFeatures,
  selectedClassChoiceIds,
} from "../app/classChoices";
import { characterResources } from "../app/characterResources";
import { alwaysPreparedSpellEntries } from "../app/characterRules";
import type { ExportCharacter } from "../app/exportFormats";
import type { Feature } from "../app/rules";

const hero = (className: string, level: number, extra: Partial<ExportCharacter> = {}) => ({
  name: "Test", playerName: "", race: "human", raceVariant: "base", className, subclass: "",
  background: "acolyte", classSkills: [], backgroundSkills: [], level, spells: [], currency: { gp: 0, sp: 0, cp: 0, pp: 0 },
  alignment: "Нейтральный", abilities: { str: 13, dex: 14, con: 14, int: 12, wis: 16, cha: 14 },
  personality: { traits: "", ideals: "", bonds: "", flaws: "" }, useTasha: true, classChoices: {},
  ...extra,
} as ExportCharacter);

const rangerBase: Feature[] = [
  { level: 1, name: "Избранный враг", description: "PHB favored" },
  { level: 1, name: "Исследователь природы", description: "PHB explorer" },
  { level: 3, name: "Первобытная осведомлённость", description: "PHB awareness" },
  { level: 10, name: "Маскировка на виду", description: "PHB veil" },
];

const ranger = hero("ranger", 10);
const replacements = classChoiceGroups(ranger).filter(group => group.key.startsWith("tce-"));
assert.deepEqual(replacements.map(group => selectedClassChoiceIds(ranger, group)), [
  ["favored-enemy"], ["natural-explorer"], ["primeval-awareness"], ["hide-in-plain-sight"],
]);
assert.deepEqual(resolvedClassChoiceFeatures(ranger, rangerBase).map(feature => feature.name), rangerBase.map(feature => feature.name));

const rangerTce = hero("ranger", 10, { classChoices: {
  "tce-favored-foe": ["favored-foe"],
  "tce-deft-explorer": ["deft-explorer"],
  "tce-deft-explorer-skill": ["Внимательность"],
  "tce-primal-awareness": ["primal-awareness"],
  "tce-natures-veil": ["natures-veil"],
}});
const resolved = resolvedClassChoiceFeatures(rangerTce, rangerBase);
for (const oldName of rangerBase.map(feature => feature.name)) assert(!resolved.some(feature => feature.name === oldName), oldName);
for (const newName of ["Предпочтительный противник", "Искусный исследователь", "Изначальная осведомлённость", "Покров природы"]) {
  assert.equal(resolved.filter(feature => feature.name.startsWith(newName)).length, 1, newName);
}

const cleared = clearTashaOptionalState(hero("ranger", 13, {
  classChoices: { ...rangerTce.classChoices, "ranger:tce-primal-awareness": ["primal-awareness"], "fighting-style": ["druidic-warrior"] },
  classes: [{ classId: "ranger", level: 13, acquiredAtCharacterLevel: 1, choiceValues: { "tce-primal-awareness": ["primal-awareness"], "fighting-style": ["druidic-warrior"] } }],
  resourceSpent: { "favored-foe": 1, "primal-awareness:speak-with-animals": 1, other: 2 },
}));
assert.equal(cleared.useTasha, false);
assert(!Object.keys(cleared.classChoices || {}).some(key => key.split(":").at(-1)?.startsWith("tce-")));
assert(!Object.keys(cleared.classes?.[0].choiceValues || {}).some(key => key.startsWith("tce-")));
assert.deepEqual(cleared.classes?.[0].choiceValues?.["fighting-style"], ["druidic-warrior"]);
assert.deepEqual(cleared.resourceSpent, { other: 2 });

const primalIds = ["speak-with-animals", "spell-doc-beast_sense", "spell-doc-speak_with_plants", "spell-doc-locate_creature", "spell-doc-commune_with_nature"];
for (const [level, count] of [[3, 1], [5, 2], [9, 3], [13, 4], [17, 5]] as const) {
  const selected = hero("ranger", level, { classChoices: { "tce-primal-awareness": ["primal-awareness"] } });
  const grants = alwaysPreparedSpellEntries(selected, spells).filter(entry => entry.source.includes("Изначальная"));
  assert.deepEqual(grants.map(entry => entry.id), primalIds.slice(0, count));
  const resources = characterResources(selected).filter(resource => resource.key.startsWith("primal-awareness:"));
  assert.equal(resources.length, count);
  assert(resources.every(resource => resource.max === 1 && resource.isLongRest && !resource.isShortRest));
}
assert(!alwaysPreparedSpellEntries(hero("ranger", 17), spells).some(entry => entry.source.includes("Изначальная")));

const cleric = hero("cleric", 8, { subclass: "life" });
const clericGroup = classChoiceGroups(cleric).find(group => group.key === "tce-blessed-strikes")!;
assert.deepEqual(selectedClassChoiceIds(cleric, clericGroup), ["domain-feature"]);
const clericBase: Feature[] = [{ level: 8, name: "Божественный удар", description: "PHB domain" }];
assert.deepEqual(resolvedClassChoiceFeatures(cleric, clericBase), clericBase);
const blessed = resolvedClassChoiceFeatures({ ...cleric, classChoices: { "tce-blessed-strikes": ["blessed-strikes"] } }, clericBase);
assert(!blessed.some(feature => feature.name === "Божественный удар"));
assert.equal(blessed.filter(feature => feature.name.startsWith("Благословлённые удары")).length, 1);

const tceManeuvers = new Set(["ambush", "bait-switch", "brace", "commanding-presence", "grappling-strike", "quick-toss", "tactical-assessment"]);
const maneuverIds = new Set(classChoiceGroups(hero("fighter", 3, { subclass: "battlemaster" })).find(group => group.key === "maneuvers")!.options.map(option => option.id));
for (const id of tceManeuvers) assert(maneuverIds.has(id), id);
const bannedManeuverIds = new Set(classChoiceGroups(hero("fighter", 3, { subclass: "battlemaster", tceFullBanned: true })).find(group => group.key === "maneuvers")!.options.map(option => option.id));
for (const id of tceManeuvers) assert(!bannedManeuverIds.has(id), id);

for (const [className, style, choiceKey, spellClass] of [
  ["ranger", "druidic-warrior", "druidic-warrior-cantrips", "druid"],
  ["paladin", "blessed-warrior", "blessed-warrior-cantrips", "cleric"],
] as const) {
  const cantrips = spells.filter(spell => spell.level === 0 && spell.classes.includes(spellClass)).slice(0, 2).map(spell => spell.id);
  assert.equal(cantrips.length, 2);
  const character = hero(className, 2, { classChoices: { "fighting-style": [style], [choiceKey]: cantrips } });
  const grants = alwaysPreparedSpellEntries(character, spells).filter(entry => entry.id === cantrips[0] || entry.id === cantrips[1]);
  assert.deepEqual(grants.map(entry => entry.id), cantrips);
}

console.log("TCE regression checks passed: PHB defaults, exact replacements, cleanup, level-scoped spells/resources, styles and catalog bans.");
