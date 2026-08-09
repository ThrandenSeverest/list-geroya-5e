import assert from "node:assert/strict";
import { createNativeCharacterFile, parseCharacterFile } from "../app/characterFiles";
import { helpmateClassIds, type ExportCharacter } from "../app/exportFormats";
import { finalAbilityScores, pointBuySpent } from "../app/characterRules";

const empty: ExportCharacter = {
  name: "", playerName: "", race: "", raceVariant: "", className: "", subclass: "", background: "",
  classSkills: [], backgroundSkills: [], level: 1, spells: [], preparedSpells: [], alignment: "",
  abilities: { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 },
  personality: { traits: "", ideals: "", bonds: "", flaws: "" },
};

assert.equal(helpmateClassIds.bard, "12");
assert.equal(helpmateClassIds.artificer, "23");

const native = parseCharacterFile(createNativeCharacterFile({ ...empty, name: "Лира", className: "bard" }), empty);
assert.equal(native.source, "native");
assert.equal(native.character.name, "Лира");
assert.equal(native.character.className, "bard");

const lssInne: "Бард" }, level: { value: 8 }, race: { value: "Эль�background: { value: "Артист" }, playerName: { value: "Игрок" }, alignment: { value: "Хаотично-доброе" },
  },
  stats: { str: { score: 8 }, dex: { score: 16 }, con:score: 10 }, wontent: [d");
assert.equal(lss.character.level, 8);
assert.deepEqual(lss.character.spellSlotsUsed?.slice(0, 2), [1, 0]);
assert.ok(lss.character.spells.includes("vicious"));

const cardPrepared = ["65d3c16ef3d820fa1add4695", "6723be82cbc20b6b98471104"];
const cardBook = ["65d3c173f3d820fa1add4919"];
const lssCards = parseCharacterFile({
  jsonType: "character",
  edition: "2014",
  spells: { mode: "cards", prepared: cardPrepared, book: cardBook },
  data: JSON.stringify(lssInneD не содержат ссылки/);
assert.doesNotMatch(lssCards.warnings.join(" "), /сопоставить вручную|ручного выбора/i);

const namedCard = parseCharacterFile({
  jsonType: "character",
  edition: "2014",
  spells: {
    mode: "cards",
    prepared: [{ _id: cardPrepared[0], name: "Лечащее слово" }],
    book: [{ id: cardBook[0], spell: { name: "Щит" } }],
  },
  data: JSON.stringify(lssInner),
}, empty);
assert.ok(namedCard.character.spells.includes("healingword"));
assert.ok(namedCard.character.spells.includes("shield"));
assert.equal(namedCard.character.lssSpellCards?.resolved?.[cardPrepared[0]], "healingword");
assert.equal(namedCard.character.lssSpellCards?.resolved?.[cardBook[0]], "shield");
assert.ok(namedCard.character.preparedSpells?.includes("healingword"));

const linkedCard = parseCharacterFile({
  jsonType: "character",
  edition: "2014",
  spells: {
    mode: "cards",
    prepared: [{ _id: "65d3c16ef3d820fa1add4695", source: "https://dnd.su/spells/144-healing_word/" }],
    book: [],
  },
  data: JSON.stringify(lssInner),
}, empty);
assert.ok(linkedCard.character.spells.includes("healingword"), "A dnd.su URL must resolve an LSS spell without a manual choice");
assert.equal(linkedCard.character.lssSpellCards?.resolved?.["65d3c16ef3d820fa1add4695"], "healingword");

const ravenCardIds = [
  "65d3c169f3d820fa1add429e", "65d3c168f3d820fa1add425f", "65d3c170f3d820fa1add4759",
  "65d3c16af3d820fa1add434d", "65d3c16df3d820fa1add45f4", "65d3c16af3d820fa1add437e",
  "65d3c172f3d820fa1add48b7", "65d3c16ef3d820fa1add465d", "65d3c16df3d820fa1add4561",
  "65d3c171f3d820fa1add47ec",
];
const ravenCards = parseCharacterFile({
  jsonType: "character", edition: "2014", spells: { mode: "cards", prepared: ravenCardIds, book: [] },
  data: JSON.stringify(lssInner),
}, empty);
assert.deepEqual(ravenCards.character.spells.filter(id => id !== "vicious"), [
  "chill-touch", "firebolt", "mending", "mage-armor", "charm-person", "sleep",
  "invisibility", "enhanceability", "hypnotic-pattern", "fear",
]);
assert.equal(Object.keys(ravenCards.character.lssSpellCards?.resolved || {}).length, 10);

const frodiInner = {
  ...lssInner,
  name: { value: "Сказитель Фроди" },
  info: { ...lssInner.info, race: { value: "Человек" }, level: { value: 10 } },
  stats: { str: { score: 8 }, dex: { score: 14 }, con: { score: 10 }, int: { score: 12 }, wis: { score: 14 }, cha: { score: 18 } },
  skills: {
    athletics: { isProf: 2 }, persuasion: { isProf: 2 }, performance: { isProf: 1 }, stealth: { isProf: 1 },
  },
  text: { "notes-1": { value: { data: { content: [{ content: [{ text: "Лекарь (черта). Одарённый (черта)." }] }] } } } },
};
const frodi = parseCharacterFile({ jsonType: "character", data: JSON.stringify(frodiInner), spells: { mode: "cards", prepared: [], book: [] } }, empty);
assert.equal(frodi.character.level, 10);
assert.equal(frodi.character.raceVariant, "variant", "Level and feats must identify the variant human build");
assert.deepEqual(finalAbilityScores(frodi.character), { str: 8, dex: 14, con: 10, int: 12, wis: 14, cha: 18 });
assert.equal(pointBuySpent(frodi.character.abilities), 27);
assert.deepEqual(frodi.character.classChoices?.expertise, ["skill-Атлетика", "skill-Убеждение"]);
assert.ok(frodi.character.advancements?.some(choice => choice.featId === "asi" && choice.asiChoices.join(",") === "cha,cha"));

const skillExpertInner = {
  ...lssInner,
  info: { ...lssInner.info, charClass: { value: "Воин" }, level: { value: 4 }, race: { value: "Человек · Стандартный человек" } },
  stats: { str: { score: 16 }, dex: { score: 14 }, con: { score: 14 }, int: { score: 10 }, wis: { score: 12 }, cha: { score: 9 } },
  skills: { athletics: { isProf: 2 } },
  text: {},
};
const skillExpert = parseCharacterFile({ jsonType: "character", data: JSON.stringify(skillExpertInner) }, empty);
const skillExpertFeat = skillExpert.character.advancements?.find(choice => choice.featId === "skill-expert");
assert.ok(skillExpertFeat, "Expertise outside bard/rogue must infer the Skill Expert feat when a level slot is available");
assert.deepEqual(skillExpertFeat?.featChoices?.expertise, ["Атлетика"]);

const parameters = ["STR", "DEX", "CON", "INT", "WIS", "CHA"].map(Name => ({ Name, Value: Name === "INT" ? 18 : 10, Abilities: [] }));
const helpmate = parseCharacterFile({
  Classes: [{ Id: "23", Level: 5, SpellCells: [{ Level: 1, Max: 4, Left: 2 }] }],
  Parameters: parameters, UserRace: "Гном — Скальный гном", Spells: ["204"],
}, empty);
assert.equal(helpmate.source, "helpmate");
assert.equal(helpmate.character.className, "artificer");
assert.equal(helpmate.character.abilities.int, 18);
assert.equal(helpmate.character.spellSlotsUsed?.[0], 2);
assert.ok(helpmate.character.spells.includes("firebolt"));

console.log("character file contracts passed");
