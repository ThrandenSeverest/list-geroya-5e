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
    flaws: "Любопытство ведёт меня к опасности.",
  },
};

const race = races.find(option => option.id === character.race);
const characterClass = classes.find(option => option.id === character.className);
const background = backgrounds.find(option => option.id === character.background);
const context = {
  character,
  race,
  characterClass,
  background,
  spells,
  raceFeatureList: raceFeatures(character.race, character.raceVariant, race?.description, race?.tags),
  classFeatureList: classRules[character.className].features.filter(feature => (feature.level || 1) <= character.level),
};

const helpmateKeys = [
  "Id", "MyRaceId", "UserRace", "TokenColor", "SecondName", "Speed", "IHaveLight", "TorchValue",
  "TorchValueSecond", "CellEyeValue", "EyeEnabled", "SoundFolder", "ImDoubleHeal", "SeeInTheDark",
  "Gold", "Silver", "Copper", "HitPoints", "CurrentHitPoints", "TempHitPoints", "TempCurrentHitPoints",
  "HasInspiration", "Alignment", "HitDice", "HitDiceCount", "IsArmorTakeOf", "TwoHanded", "FlyValue",
  "IsFly", "FamiliarId", "SelectedSaveThrowKey", "SizeIndex", "TagString", "Skills", "Languages",
  "Multiplier", "TrueMultiplier", "Inspiration", "Armor", "Bditelnost", "IniBonus", "IsPlaying", "Note",
  "FirstSpellText", "SecondSpellText", "Spells", "HandsCapacity", "HandsItems", "MainHandsItems", "ArrowItems",
  "InventoryItems", "Parameters", "Classes", "DamageResist", "DamageImmun", "DamageVulner", "HasAura",
  "AuraSize", "AuraAngle", "AuraAngleSize", "AuraOpacity", "AuraType", "AuraColorEnable", "ShowAuraCells",
  "IsRotationEnable", "IsWallBlock", "ShowAuraToPlayers", "CustomAuraImage", "CustomStatuses",
];

const lssKeys = ["tags", "disabledBlocks", "edition", "spells", "data", "lastWriterSessionId", "linkAccess", "rooms", "sheetEdition", "jsonType", "version", "wizard"];
const lssInnerKeys = [
  "jsonType", "template", "name", "info", "subInfo", "spellsInfo", "spells", "spellsPact", "bonuses",
  "proficiency", "stats", "saves", "skills", "vitality", "attunementsList", "weaponsList", "text", "coins",
  "resources", "bonusesSkills", "bonusesStats", "conditions", "wizardStep", "isDefault", "weapons", "hiddenName",
  "casterClass", "avatar", "inspiration", "exhaustion", "createdAt", "proficiencyCustom",
];

const helpmate = createHelpmateExport(context);
assert.deepEqual(Object.keys(helpmate), helpmateKeys, "Helpmate top-level contract changed");
assert.match(helpmate.Id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
assert.deepEqual(helpmate.Spells, ["204", "60", "352"], "Helpmate must receive dnd.su numeric spell ids");
assert(helpmate.Spells.every(id => /^\d+$/.test(id)), "Helpmate spell ids must be numeric");
assert.deepEqual(helpmate.Classes.map(item => item.Id), ["21"], "Wizard must use Helpmate class id 21");
assert(helpmate.Classes.every(item => /^\d+$/.test(item.Id)), "Helpmate class ids must be numeric");
assert.deepEqual(Object.keys(helpmate.Parameters[0]), ["Name", "Value", "UserSpasValue", "Proficiency", "Abilities"]);
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
  fighter: { eldritchknight: "25" }, rogue: { arcanetrickster: "26" },
}, "Helpmate subclass class ids must match the supplied Mystic Knight and Arcane Trickster examples");
assert.equal(createHelpmateExport({
  ...context,
  character: { ...character, className: "fighter", subclass: "eldritchknight" },
}).Classes[0].Id, "25");
const warlockHelpmate = createHelpmateExport({
  ...context,
  character: { ...character, className: "warlock", subclass: "fiend", level: 1, spells: [], preparedSpells: [], pactSlotsUsed: 0 },
});
assert.deepEqual(warlockHelpmate.Classes, [{
  Id: "20",
  Level: 1,
  SpellCells: [{ Level: 0, Left: 2, Max: 2 }, { Level: 1, Left: 1, Max: 1 }],
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
  characterClass: classes.find(option => option.id === "druid"),
  raceFeatureList: humanDruidFeatures,
});
assert.equal(humanDruidHelpmate.SelectedSaveThrowKey, 5, "Helpmate must select Wisdom for druid spellcasting");
assert.equal(humanDruidHelpmate.CellEyeValue, 0, "a human must not receive a hidden 120-foot darkvision value");
assert.equal(humanDruidHelpmate.EyeEnabled, false);
assert.equal(humanDruidHelpmate.SeeInTheDark, false);

const drowHelpmate = createHelpmateExport({
  ...context,
  raceFeatureList: [
    ...raceFeatures("elf", "drow"),
    { name: "Превосходное тёмное зрение", description: "Видит в темноте на 120 футов." },
  ],
});
assert.equal(drowHelpmate.CellEyeValue, 120, "the superior darkvision of a drow must override base elf darkvision");

assert.equal(spells.length, 515, "The attached 514-spell corpus plus the existing official Silvery Barbs card must be available");
assert.equal(new Set(spells.map(spell => spell.id)).size, spells.length, "Expanded spell IDs must remain unique");
assert.equal(Object.keys(helpmateSpellIds).length, 477, "Every supplied and verified Helpmate spell mapping must be available");
assert(spells.every(spell => dndSpellUrl(spell.id)), "Every spell needs a dnd.su page or search URL for LSS and PDF");
assert.equal(helpmateSpellId("spell-doc-blade_ward"), "101");
assert.equal(helpmateSpellId("dissonant-whispers"), "56", "Dissonant Whispers must accept Helpmate's singular alias");
assert.equal(helpmateSpellId("spell-doc-lightning_lure"), "TCoE_3", "Lightning Lure must accept Helpmate's Lighting Lure typo");
assert.equal(helpmateSpellId("spell-doc-summon_celestial"), "TCoE_18", "Summon Celestial must accept Helpmate's truncated alias");
assert.equal(helpmateSpellId("spell-doc-create_magen"), null, "Create Magen is absent from Helpmate");
assert.equal(spells.find(spell => spell.id === "spell-doc-create_magen")?.source, "IDRotF");
assert.equal(spellIdFromDndUrl("https://dnd.su/spells/?search=Blade%20Ward"), "spell-doc-blade_ward", "Search links from the attached document must round-trip into the catalog");
assert(Object.values(helpmateSpellIds).every(id => typeof id === "string"), "Helpmate IDs must always stay strings");
assert(Object.values(helpmateSpellIds).some(id => /^TCoE_\d+$/.test(id)), "Tasha mappings must preserve TCoE_* IDs");
assert.equal(new Set(Object.values(helpmateSpellIds)).size, Object.keys(helpmateSpellIds).length, "Verified Helpmate spell ids must not collide");

const partialContext = { ...context, character: { ...character, spells: ["firebolt", "spell-doc-create_magen", "spell-doc-air_bubble"] } };
assert.deepEqual(createHelpmateExport(partialContext).Spells, ["204"], "Unsupported spells must be skipped without breaking compatible exports");
assert.deepEqual(helpmateSkippedSpells(partialContext).map(spell => spell.name), ["Сотворение магена", "Воздушный пузырь"]);

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
assert.equal(lssInner.text.prof.value.data.type, "doc", "LSS proficiencies must use ProseMirror JSON");
assert.equal(lssInner.text["notes-1"].value.data.type, "doc", "Long class descriptions belong in notes");
const richStrings = (block: { value: { data: { content?: Array<{ content?: Array<{ text?: string }> }> | null } } }) =>
  (block.value.data.content || []).flatMap(paragraph => paragraph.content || []).map(node => node.text || "").join("");
assert.match(richStrings(lssInner.text.quests), /Подготовленные заклинания: Доспехи мага, Туманный шаг/);
assert.deepEqual(lssInner.weaponsList.map((item: { name: { value: string } }) => item.name.value), ["Боевой посох", "Огненный снаряд"]);
assert.deepEqual(lssInner.weaponsList[0], {
  id: lssInner.weaponsList[0].id,
  name: { value: "Боевой посох" },
  dmg: { value: "1d6+[STR]" },
  ability: "str",
  isProf: true,
  modBonus: { value: 0 },
}, "LSS weapon entries must match the supplied weaponsList contract");
assert.deepEqual(lssInner.weaponsList[1], {
  id: lssInner.weaponsList[1].id,
  name: { value: "Огненный снаряд" },
  dmg: { value: "2d10" },
  ability: "int",
  isProf: true,
  modBonus: { value: 0 },
}, "Attack cantrips must use the spellcasting ability and proficiency");
assert.match(richStrings(lssInner.text.attacks), /Боевой посох: атака \+2; урон 1d6-1/);
assert.match(richStrings(lssInner.text.attacks), /Огненный снаряд: атака \+6; урон 2d10/);
assert.match(richStrings(lssInner.text.prof), /Инструменты:/, "Background tools must live in the consolidated proficiencies block");
assert.equal(lssInner.resources["arcane-recovery"].current, 1);
assert.equal(lssInner.resources["arcane-recovery"].max, 1);
assert(Object.values(lssInner.stats).every((stat: unknown) => (stat as { modifier: number }).modifier === 0), "LSS stat modifiers are overrides, not calculated values");
assert(Object.values(lssInner.saves).every((save: unknown) => (save as { bonus: number }).bonus === 0));

const battlemasterCharacter: ExportCharacter = {
  ...character,
  race: "dwarf",
  raceVariant: "hill",
  className: "fighter",
  subclass: "battlemaster",
  background: "folkhero",
  level: 3,
  proficiencyChoices: {
    "background-artisan": ["Инструменты кожевника"],
    "race-dwarf-artisan": ["Инструменты кузнеца"],
    "subclass-battlemaster-artisan": ["Инструменты ювелира"],
  },
};
const battlemasterContext = {
  ...context,
  character: battlemasterCharacter,
  race: races.find(option => option.id === "dwarf"),
  characterClass: classes.find(option => option.id === "fighter"),
  background: backgrounds.find(option => option.id === "folkhero"),
  classFeatureList: classRules.fighter.features.filter(feature => (feature.level || 1) <= 3),
};
const battlemasterLss = JSON.parse(createLongStoryShortExport(battlemasterContext).data);
const battlemasterProf = richStrings(battlemasterLss.text.prof);
assert.match(battlemasterProf, /Инструменты кожевника/);
assert.match(battlemasterProf, /Инструменты кузнеца/);
assert.match(battlemasterProf, /Инструменты ювелира/);
assert.doesNotMatch(battlemasterProf, /Один вид ремесленных инструментов/);
const battlemasterHelpmate = createHelpmateExport(battlemasterContext);
assert.match(battlemasterHelpmate.Note, /Инструменты:.*Инструменты кожевника/);

const textAt = (level: number) =>
  (lssInner.text[`spells-level-${level}`].value.data.content || [])
    .flatMap((paragraph: { content?: Array<{ text?: string }> }) => paragraph.content || [])
    .map((node: { text?: string }) => node.text)
    .filter(Boolean);
assert.deepEqual(textAt(0), ["Огненный снаряд"]);
assert.deepEqual(textAt(1), ["Доспехи мага"]);
assert.deepEqual(textAt(2), ["Туманный шаг"]);
assert.equal(dndSpellUrl("firebolt"), "https://dnd.su/spells/204-fire_bolt/");

const retainedPreparedCards = ["65d3c16ef3d820fa1add4695", "6723be82cbc20b6b98471104"];
const retainedBookCards = ["65d3c173f3d820fa1add4919"];
const roundTripLss = createLongStoryShortExport({
  ...context,
  character: {
    ...character,
    lssSpellCards: { mode: "cards", prepared: retainedPreparedCards, book: retainedBookCards, edition: "2014" },
  },
});
assert.equal(roundTripLss.spells.mode, "cards");
assert.deepEqual(roundTripLss.spells.prepared, retainedPreparedCards, "Imported LSS prepared-card ids must survive export unchanged");
assert.deepEqual(roundTripLss.spells.book, retainedBookCards, "Imported LSS spellbook-card ids must survive export unchanged");
const roundTripInner = JSON.parse(roundTripLss.data);
const roundTripCantrips = (roundTripInner.text["spells-level-0"].value.data.content || [])
  .flatMap((paragraph: { content?: Array<{ text?: string }> }) => paragraph.content || [])
  .map((node: { text?: string }) => node.text)
  .filter(Boolean);
assert.deepEqual(roundTripCantrips, ["Огненный снаряд"], "Portable text spell lists must remain available alongside retained LSS cards");

const spentCharacter = { ...character, spellSlotsUsed: [1, 2, 2] };
const spentContext = { ...context, character: spentCharacter };
const spentHelpmate = createHelpmateExport(spentContext);
const cells = spentHelpmate.Classes[0].SpellCells.filter(cell => cell.Level > 0);
assert.deepEqual(cells.map(cell => cell.Left), [3, 1, 0], "Helpmate must export remaining slots as Max minus spent");
assert(cells.every(cell => Number.isInteger(cell.Level) && Number.isInteger(cell.Left) && Number.isInteger(cell.Max)));
assert(cells.every(cell => cell.Left >= 0 && cell.Left <= cell.Max));

const fullLevelNine = createHelpmateExport({ ...context, character: { ...character, level: 9, spellSlotsUsed: [] } });
assert.deepEqual(fullLevelNine.Classes[0].SpellCells, [
  { Level: 0, Left: 4, Max: 4 },
  { Level: 1, Left: 4, Max: 4 },
  { Level: 2, Left: 3, Max: 3 },
  { Level: 3, Left: 3, Max: 3 },
  { Level: 4, Left: 3, Max: 3 },
  { Level: 5, Left: 1, Max: 1 },
], "Wizard level 9 cells must match the supplied full Helpmate reference");

const sorcererCharacter: ExportCharacter = {
  ...character,
  className: "sorcerer",
  subclass: "draconic",
  level: 5,
  abilities: { ...character.abilities, cha: 18 },
  resourceSpent: { "sorcery-points": 2 },
};
const sorcererLss = JSON.parse(createLongStoryShortExport({
  ...context,
  character: sorcererCharacter,
  characterClass: classes.find(option => option.id === "sorcerer"),
  classFeatureList: classRules.sorcerer.features.filter(feature => (feature.level || 1) <= 5),
}).data);
assert.equal(sorcererLss.spellsInfo.base.code, "cha");
assert.equal(sorcererLss.spellsInfo.save.customModifier, null);
assert.deepEqual(sorcererLss.resources["sorcery-points"], {
  name: "Очки чародейства", current: 3, max: 5, isShortRest: false, isLongRest: true,
});

const fighterCharacter: ExportCharacter = {
  ...character,
  className: "fighter",
  level: 1,
  spells: [],
  classChoices: { "fighting-style": ["dueling"] },
  equipmentSelections: { armor: ["chain"], primary: ["shield", "rapier"], secondary: ["crossbow"], pack: ["dungeoneer"] },
};
const fighterFeatures = resolvedClassChoiceFeatures(
  fighterCharacter,
  classRules.fighter.features.filter(feature => (feature.level || 1) <= fighterCharacter.level),
  spells,
);
assert(fighterFeatures.some(feature => feature.name === "Боевой стиль: Дуэлянт"));
assert(!fighterFeatures.some(feature => feature.name === "Боевой стиль"), "The generic fighting-style placeholder must be removed after selection");
const fighterLss = JSON.parse(createLongStoryShortExport({
  ...context,
  character: fighterCharacter,
  characterClass: classes.find(option => option.id === "fighter"),
  classFeatureList: fighterFeatures,
}).data);
assert.match(richStrings(fighterLss.text.traits), /Боевой стиль: Дуэлянт/, "Selected fighting style must be visible in the main feature summary");
assert.doesNotMatch(richStrings(fighterLss.text.traits), /Выберите один доступный/, "The export must not ask to choose an already selected option");
assert.match(richStrings(fighterLss.text["notes-1"]), /\+2 к урону/, "Selected option mechanics must be present in full notes");
const rapierAttack = fighterLss.weaponsList.find((item: { name: { value: string } }) => item.name.value === "Рапира");
assert.equal(rapierAttack.dmg.value, "1d8+[DEX]+2", "Dueling damage must be included in the LSS formula");
assert.equal(rapierAttack.ability, "dex");

const elementalAdeptCharacter: ExportCharacter = {
  ...character,
  level: 5,
  advancements: [{
    key: "class-4",
    level: 4,
    featId: "elemental-adept",
    asiChoices: [],
    featChoices: { element: ["Огонь"] },
  }],
  feats: ["elemental-adept"],
};
const elementalAdeptFeature = {
  name: "Стихийный адепт",
  description: "Огонь: заклинания игнорируют сопротивление урону огнём, а каждая 1 на кости такого урона считается 2.",
};
const elementalAdeptLss = JSON.parse(createLongStoryShortExport({
  ...context,
  character: elementalAdeptCharacter,
  featNames: ["Стихийный адепт"],
  featFeatureList: [elementalAdeptFeature],
}).data);
assert.match(richStrings(elementalAdeptLss.text.features), /каждая 1 на кости такого урона считается 2/, "A selected feat must never disappear from the LSS feat field");
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
