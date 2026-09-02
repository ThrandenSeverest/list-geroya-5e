import assert from "node:assert/strict";
import test from "node:test";
import { armorClass } from "../app/armor";
import { spells } from "../app/catalog";
import { advancementChoiceComplete, featChoiceGroups } from "../app/featChoices";
import { catalogSources, matchesSources, sourceTokens } from "../app/catalogFilters";
import { featRequirementMet } from "../app/featRequirements";
import { finalAbilityScores } from "../app/characterRules";
import { proficiencyChoicesComplete } from "../app/proficiencies";
import type { AdvancementChoice, ExportCharacter } from "../app/exportFormats";

function hero(partial: Partial<ExportCharacter> = {}): ExportCharacter {
  return {
    name: "Тест", playerName: "", race: "human", raceVariant: "standard", className: "fighter", background: "soldier",
    classSkills: [], backgroundSkills: [], level: 4, spells: [], preparedSpells: [], feats: [], asiChoices: [], advancements: [],
    classChoices: {}, equipmentSelections: {}, languages: [], proficiencyChoices: {}, resourceSpent: {}, spellSlotsUsed: [], pactSlotsUsed: 0,
    useTasha: false, alignment: "", abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    personality: { traits: "", ideals: "", bonds: "", flaws: "" }, ...partial,
  };
}

test("КД учитывает кольчугу и щит", () => {
  assert.equal(armorClass(hero({ className: "paladin", equipmentSelections: { primary: ["shield", "longsword"], secondary: ["javelins"], pack: ["priest"] } })), 18);
});

test("КД ловкого воина учитывает кожаный доспех", () => {
  assert.equal(armorClass(hero({ abilities: { str: 8, dex: 16, con: 10, int: 10, wis: 10, cha: 10 }, equipmentSelections: { armor: ["leather-bow"], primary: ["rapier", "shortsword"], secondary: ["crossbow"], pack: ["explorer"] } })), 14);
});

test("вложенные выборы Посвящённого в магию обязательны", () => {
  const choice: AdvancementChoice = { key: "class-4", level: 4, featId: "magic-initiate", asiChoices: [], featChoices: {} };
  assert.equal(advancementChoiceComplete(choice, spells), false);
  choice.featChoices = { tradition: ["wizard"], cantrips: ["firebolt", "minorillusion"], spell: ["shield"] };
  assert.equal(featChoiceGroups(choice, spells).length, 3);
  assert.equal(advancementChoiceComplete(choice, spells), true);
});

test("боевые и оружейные черты требуют все вложенные решения", () => {
  const martial: AdvancementChoice = { key: "class-4", level: 4, featId: "martial-adept", asiChoices: [], featChoices: {} };
  assert.equal(featChoiceGroups(martial, spells).find(group => group.key === "maneuvers")?.count, 2);
  assert.equal(advancementChoiceComplete(martial, spells), false);
  martial.featChoices = { maneuvers: ["Парирование", "Точная атака"] };
  assert.equal(advancementChoiceComplete(martial, spells), true);

  const weapon: AdvancementChoice = { key: "class-8", level: 8, featId: "weapon-master", asiChoices: [], featChoices: {} };
  assert.equal(featChoiceGroups(weapon, spells).find(group => group.key === "weapons")?.count, 4);
});

test("источники книг комбинируются независимо", () => {
  assert.deepEqual(sourceTokens("VGM / MPMM"), ["VGM", "MPMM"]);
  assert.equal(matchesSources("VGM / MPMM", ["PHB", "MPMM"]), true);
  assert.deepEqual(catalogSources([{ source: "XGE" }, { source: "PHB" }, { source: "VGM / MPMM" }]), ["PHB", "MPMM", "VGM", "XGE"]);
});

test("невыполненные требования черты определяются до выбора", () => {
  const lowCharisma = hero({ className: "fighter", level: 4, abilities: { str: 15, dex: 14, con: 14, int: 8, wis: 10, cha: 8 } });
  assert.equal(featRequirementMet(lowCharisma, "Харизма 13+"), false);
  assert.equal(featRequirementMet(lowCharisma, "Владение воинским оружием"), true);
  assert.equal(featRequirementMet(lowCharisma, "Способность накладывать хотя бы одно заклинание"), false);
});

test("требования различают И и ИЛИ и пересчитываются из текущего персонажа", () => {
  const ritualRequirement = "Интеллект 13+ или Мудрость 13+";
  const locked = hero({ race: "dragonborn", raceVariant: "base", abilities: { str: 10, dex: 10, con: 10, int: 12, wis: 12, cha: 10 } });
  const unlocked = hero({ race: "dragonborn", raceVariant: "base", abilities: { str: 10, dex: 10, con: 10, int: 13, wis: 8, cha: 10 } });
  assert.equal(featRequirementMet(locked, ritualRequirement), false);
  assert.equal(featRequirementMet(unlocked, ritualRequirement), true, "одной альтернативной характеристики достаточно");
  assert.equal(featRequirementMet(unlocked, "Интеллект 13+ и Мудрость 13+"), false, "условия через «и» должны выполняться одновременно");
  assert.equal(featRequirementMet(unlocked, "Интеллект 13+; 4 уровень"), true);
  assert.equal(featRequirementMet({ ...unlocked, level: 3 }, "Интеллект 13+; 4 уровень"), false);
});

test("Ваятель рун требует характеристику и число рун по текущему бонусу мастерства", () => {
  const choice: AdvancementChoice = { key: "class-4", level: 4, featId: "rune-shaper", asiChoices: [], featChoices: {} };
  const groups = featChoiceGroups(choice, spells, 17);
  assert.equal(groups.find(group => group.key === "runeAbility")?.count, 1);
  assert.equal(groups.find(group => group.key === "runes")?.count, 3);
  choice.featChoices = { runeAbility: ["int"], runes: ["disguise-self", "entangle", "chromatic-orb"] };
  assert.equal(advancementChoiceComplete(choice, spells, 17), true);
});

test("выбранный бонус половинной черты меняет характеристику", () => {
  const character = hero({ race: "dwarf", raceVariant: "hill", advancements: [{ key: "class-4", level: 4, featId: "athlete", asiChoices: [], featChoices: { ability: ["dex"] } }] });
  assert.equal(finalAbilityScores(character).dex, 11);
});

test("один инструмент нельзя засчитать в двух источниках", () => {
  const character = hero({
    race: "dwarf", raceVariant: "hill", background: "folkhero",
    proficiencyChoices: { "background-artisan": ["Инструменты кузнеца"], "race-dwarf-artisan": ["Инструменты кузнеца"] },
  });
  assert.equal(proficiencyChoicesComplete(character), false);
});
