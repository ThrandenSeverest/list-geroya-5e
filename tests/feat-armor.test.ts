import assert from "node:assert/strict";
import test from "node:test";
import { armorClass } from "../app/armor";
import { spells } from "../app/catalog";
import { advancementChoiceComplete, featChoiceGroups } from "../app/featChoices";
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
