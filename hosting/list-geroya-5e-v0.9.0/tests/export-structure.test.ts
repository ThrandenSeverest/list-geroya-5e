import assert from "node:assert/strict";
import { backgrounds, classes, races, spells } from "../app/catalog";
import { dndSpellUrl, helpmateSpellId, helpmateSpellIds, spellIdFromDndUrl } from "../app/exportIds";
import { createHelpmateExport, createLongStoryShortExport, helpmateClassIds, helpmateSkippedSpells, helpmateSubclassClassIds, type ExportCharacter } from "../app/exportFormats";
import { classRules, raceFeatures } from "../app/rules";
import { resolvedClassChoiceFeatures } from "../app/classChoices";

const character: ExportCharacter = {
  name: "Проверочный герой",
  playerName: "Игрок",
  race: "elf",
  raceVariant: "",
  className: "wizard",
  background: "sage",
  classSkills: ["Магия", "Расследование"],
  backgroundSkills: ["История", "Магия"],
  level: 5,
  spells: ["firebolt", "mage-armor", "mistystep"],
  preparedSpells: ["mage-armor", "mistystep"],
  equipmentSelections: { weapon: ["quarterstaff"], focus: ["components"], pack: ["scholar"] },
  languages: ["Драконий", "Небесный"],
  resourceSpent: {},
  alignment: "Нейтрально-доброе",
  abilities: { str: 8, dex: 14, con: 14, int: 16, wis: 12, cha: 10 },
  personality: {
    traits: "Я записываю необычные факты.",
    ideals: "Истина важнее удобства.",
    bonds: "Я закончу труд наставника.",
    flaws: "Любопытство ведёт м  },
const racption.id === character.race);
const characterClass = classes.find(ion  === chcter.className);
const background = backgrounds.find(option => option.id === character.background);
const context = {
  character,
  race,
  characterClass,
  background,
  spells,
  raceFeatureList: raceFeatures(character.race, character.raceVariant, race?.description, race?.tags),
  classFeatureList: classRules[character.className].features.filter(feature re.leve 1) <= c"204", "6], "Helpmate must receive dnd.su numeric spell ids");
assert(hels must be numeric");
assert.deepEqual(helpmate.Classes.map(item => item.Id), ["21"], "Wizard must use Helpmate class id 21");
asassert.des(helpmate.Parameters[0]), ["Name", "Value", "UserSpasValue", "Proficiency", "Abilities"]);
assert.deepEqual(Object.keys(helpmate.Parameters[0].Abilities[0]), ["UserValue", "MinValue", "Proficiency"]);
assert.deepEqual(helpmate.CustomStatuses, [], "Do not inject local Helpmate status definitions");
assert.deepEqual(helpmate.Classes[0].SpellCells, [
  { Level: 0, Left: 4, Max: 4 },
  { Level: 1, Left: 4, Max: 4 },
  { Level: 2, Left: 3, Max: 3 },
  { Level: 3, Left: 2, Max: 2 },
], "Wizard level 5 cells must match the supplied Helpmate reference");
assert.equal(helpmate.FirstSpellText, "Сл спасброска заклинаний: 14");
assert.equal(helpmate.SecondSpellText, "Бонус атаки заклинанием: +6");
assert.equal(helpmate.SelectedSaveThrowKey, 4, "Helpmate must select Intelligence for wizard spellcasting");
assert.match(helpmate.Note, /Подготовлено: Доспехи мага, Туманный шаг/);
assert.equal(helpmate.Parameters[3].Abilities[0].Proficiency, true, "Arcana proficiency must transfer");
assert.equal(helpmate.Parameters[3].Abilities[1].Proficiency, true, "History proficiency must transfer");
assert.equal(helpmate.Parameters[3].Abilities[2].Proficiency, true, "Investigation proficiency must transfer");

for (const casterClass of classes.map(item => item.id)) {
  const exported = createHelpmateExport({ ...context, character: { ...character, className: casterClass } });
  assert(exported.Classes.every(item => /^\d+$/.test(item.Id)), `${casterClass}: unresolved class id must never be exported`);
}
assert.deepEqual(helpmateClassIds, {
  barbarian: "11", bard: "12", cleric: "13", fighter: "14", monk: "15", paladin: "16", ranger: "17",
  rogue: "18", sorcerer: "19", warlock: "20", wizard: "21", druid: "22", artificer: "23",
}, "Helpmate class ids must match the supplied class examples");
assert.equal(createHelpmateExport({ ...context, character: { ...character, className: "bard", level: 1 } }).Classes[0].Id, "12");
assert.equal(createHelpmateExport({ ...context, character: { ...character, className: "artificer", level: 1 } }).Classes[0].Id, "23");
assert.deepEqual(helpmateSubclassClassIds, {
  fighter: { eldritchknight: ",preparedSpells: [], p [{ Level: 0, Left: 2, Max: 2 }, { Level: 1, Left: 1, Max: 1 }],
}], "Warlock pact cells must match the supplied Helpmate class example");

const humanDruidCharacter: ExportCharacter = {
  ...character,
  race: "human",
  raceVariant: "standard",
  className: "druid",
  subclass: "moon",
  level: 4,
  abilities: { str: 8, dex: 16, con: 16, int: 8, wis: 16, cha: 8 },
};
const humanDruidFeatures = raceFeatures("human", "standard");
const humanDruidHelpmate = createHelpmateExport({
  ...context,
  character: humanDruidCharacter,
  race: races.find(option => option.id === "human"),
  characт �he catalog");
assert(Oter: { ...character, spe"spell-doc-create_magen", "spdoc-air_bubble"] } };
assert.deepEqual(createHelpmateExport(partialContext).Spells, ["204"], "Unsupported spells must be skipped without breaking compatible exports");
assert.deepEqual(helpmateSkippedSpells(partialContext).map(spell => spell.name), ["Create Magen", "Воздушный пузырь [Air Bubble]"]);

const lss = createLongStoryShortExport(context);
const lssInner = JSON.parse(lss.data);
assert.deepEqual(Object.keys(lss), lssKeys, "Long Story Short top-level contract changed");
assert.equal(typeof lss.data, "string", "Long Story Short.data must remain JSON encoded");
assert.deepEqual(Object.keys(lssInner), lssInnerKeys, "Long Story Short.data contract changed");
assert.deepEqual(lss.spells.prepared, [], "Never send local slugs as Long Story Short card ids");
assert.deepEqual(lss.spells.book, [], "Never send local slugs as Long Story Short card ids");
assert.equal(lss.spells.mode, "text");
assert.equal(lss.linkAccess, "none");
assert.deepEqual(lss.rooms, []);
assert.deepEqual(lss.wizard, {});
assert.equal(lssInner.spellsInfo.base.code, "int", "LSS needs the spellcasting ability code");
assert.equal(lssInner.spellsInfo.base.value, "", "LSS base.value is not a localized label");
assert.equal(lssInner.spellsInfo.save.customModifier, null, "LSS calculates the save DC from the selected base ability");
assert.equal(lssInner.spellsInfo.mod.customModifier, 3);
assert.equal(lssInner.skills.arcana.isProf, 1);
const expertiseLssInner = JSON.parse(createLongStoryShortExport({
  ...context,
  character: { ...character, expertiseSkills: ["Магия"] },
}).data);
assert.equal(expertiseLssInner.skills.arcana.isProf, 2, "LSS expertise must use isProf = 2");
assert.equal(lssInner.text.traits.value.data.type, "doc", "LSS rich text must use ProseMirror JSON");
assert.equal(lssInner.text.prof.value.data.type, "doc", "LSS proficiencies must use ProseMirror JSON" 1, MalassName: "sorcerer",
  subcl LSS formull(rapierAttack.ability, "dex");lAdeptCharacter: ExportCharacter = {
  ...character,
  level: 5,
  advancements: [{
    key: "class-    level: 4,
    featId: "elemental-adept",
    asiChoices: [],
    featChoices: { element: ["Огонь"] },
  }],
  feats: ["elemental-adept"],
};
const elementalAdeptFeature = {
  name: "Стихийный адепт",
  description: "Огонь: заклинания игнорируют сопротивление урону огнём, а каждая 1 на кости такого урона считаетс�chSts(elementalAdeptLss.features), /кажда кости такого урона считается 2/, "A selected feat must never disappear from the LSS feat field");
assert.doesNotMatch(richStrings(elementalAdeptLss.text.traits), /Полный текст перенесён/, "The main LSS sheet must contain a useful summary, not a redirect to notes");
assert.match(richStrings(elementalAdeptLss.text.attacks), /Стихийный адепт \(огонь\)/, "Elemental Adept must annotate matching cantrip attacks");
assert.match(richStrings(elementalAdeptLss.text.attacks), /сопротивление этому урону игнорируется/, "Elemental Adept resistance handling belongs with the attack");
assert.match(richStrings(elementalAdeptLss.text.prof), /Раса · Тёмное зрение/, "Racial features belong in Other proficiencies and languages");

const crowdedFeatLss = JSON.parse(createLongStoryShortExport({
  ...context,
  character,
  featFeatureList: [
    { name: "Первая черта", description: "Первая механика." },
    { name: "Вторая черта", description: "Вторая механика." },
    { name: "Страж", description: "Реакцией совершите атаку по существу, которое атакует союзника рядом с вами." },
  ],
}).data);
assert.match(richStrings(crowdedFeatLss.text.features), /Первая черта/);
assert.match(richStrings(crowdedFeatLss.text.features), /Вторая черта/);
assert.doesNotMatch(richStrings(crowdedFeatLss.text.features), /Страж/);
assert.match([1, 2, 3, 4, 5].map(index => richStrings(crowdedFeatLss.text[`notes-${index}`])).join(" "), /Страж/, "Feats after the first two must continue in notes instead of being discarded");

const paladinLss = JSON.parse(createLongStoryShortExport({
  ...context,
  character: { ...character, className: "paladin", level: 1, spells: [] },
  characterClass: classes.find(option => option.id === "paladin"),
  classFeatureList: classRules.paladin.features.filter(feature => (feature.level || 1) <= 1),
}).data);
const paladinNotes = richStrings(paladinLss.text["notes-1"]);
assert.match(paladinNotes, /1 \+ модификатор Харизмы/, "Divine Sense usage count belongs in notes");
assert.match(paladinNotes, /пятикратному уровню паладина/, "Lay on Hands pool belongs in notes");
assert.match(paladinNotes, /продолжительного отдыха/, "Feature recharge mechanics belong in notes");

const spentLssInner = JSON.parse(createLongStoryShortExport(spentContext).data);
assert.equal(spentLssInner.spells["level-1-slot-0"].isChecked, true, "LSS must mark spent slots");
assert.equal(spentLssInner.spells["level-1-slot-1"].isChecked, false, "LSS must preserve unspent slots");
assert.equal(spentLssInner.spells["level-3-slot-1"].isChecked, true, "LSS must mark every spent slot of a circle");

console.log("Export contracts and spell ids match the supplied Helpmate and Long Story Short examples.");
