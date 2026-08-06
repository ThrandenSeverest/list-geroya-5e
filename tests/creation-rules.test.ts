import assert from "node:assert/strict";
import test from "node:test";
import { backgroundRules } from "../app/backgroundRules";
import { equipmentComplete, equipmentRule, optimalEquipmentSelections, selectedEquipment } from "../app/equipment";
import { characterLanguages, languageRule } from "../app/languages";
import type { ExportCharacter } from "../app/exportFormats";
import {
  alwaysPreparedSpellEntries,
  alwaysPreparedSpellIds,
  optimalPreparedSpellIds,
  optimalSpellIds,
  spellAvailableToCharacter,
  spellSelectionRule,
} from "../app/characterRules";
import { spells } from "../app/catalog";
import { characterProficiencies, proficiencyChoiceRequirements, proficiencyChoicesComplete } from "../app/proficiencies";

const base: ExportCharacter = {
  name: "", playerName: "", race: "human", raceVariant: "standard", className: "fighter", background: "sage",
  classSkills: [], backgroundSkills: ["История", "Магия"], level: 1, spells: [], languages: ["Драконий", "Небесный", "Орочий"],
  alignment: "", abilities: { str: 15, dex: 12, con: 14, int: 10, wis: 10, cha: 8 },
  personality: { traits: "", ideals: "", bonds: "", flaws: "" },
};

test("every core background has complete mechanical benefits", () => {
  assert.equal(Object.keys(backgroundRules).length, 13);
  for (const [id, rule] of Object.entries(backgroundRules)) {
    assert.equal(rule.skills.length, 2, `${id}: exactly two background skills`);
    assert.ok(rule.equipment.length, `${id}: equipment is present`);
    assert.ok(rule.feature.name && rule.feature.description, `${id}: feature is present`);
  }
});

test("language choices combine race and background and export only the allowed count", () => {
  assert.deepEqual(languageRule(base), { fixed: ["Общий"], choices: 3 });
  assert.deepEqual(characterLanguages(base), ["Общий", "Драконий", "Небесный", "Орочий"]);
});

test("optimal starting equipment completes every required class choice", () => {
  for (const classId of ["barbarian", "bard", "cleric", "druid", "fighter", "monk", "paladin", "ranger", "rogue", "sorcerer", "warlock", "wizard", "artificer"]) {
    const equipmentSelections = optimalEquipmentSelections(classId, base.abilities);
    assert.equal(equipmentComplete({ className: classId, equipmentSelections }), true, `${classId}: optimal selection must be complete`);
  }
});

test("fighter selects two concrete primary items and exports class plus background equipment", () => {
  const equipmentSelections = optimalEquipmentSelections("fighter", base.abilities);
  assert.equal(equipmentSelections.primary.length, 2);
  assert.equal(equipmentRule("fighter").groups.find(group => group.key === "primary")?.count, 2);
  const items = selectedEquipment({ ...base, equipmentSelections });
  assert(items.includes("Щит"));
  assert(items.includes("Длинный меч"));
  assert(items.includes("Бутылочка чёрных чернил"));
});

test("equipment recommendations respect Strength, Dexterity and armor requirements", () => {
  const agile = { str: 8, dex: 16, con: 14, int: 10, wis: 10, cha: 10 };
  const agileFighter = optimalEquipmentSelections("fighter", agile);
  assert.deepEqual(agileFighter.armor, ["leather-bow"], "a low-Strength fighter must not be recommended chain mail");
  assert(agileFighter.primary.includes("rapier"), "the recommendation should use the higher Dexterity through finesse");
  assert(!agileFighter.primary.some(id => ["greatsword", "greataxe", "glaive", "halberd", "maul", "pike"].includes(id)), "heavy Strength weapons must be excluded");

  const strongFighter = optimalEquipmentSelections("fighter", base.abilities);
  assert.deepEqual(strongFighter.armor, ["chain"]);
  assert(strongFighter.primary.includes("longsword"));
});

test("selected fighting style changes the equipment recommendation", () => {
  const strong = { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 };
  const greatWeapon = optimalEquipmentSelections("fighter", strong, { classChoices: { "fighting-style": ["great-weapon"] } });
  assert(!greatWeapon.primary.includes("shield"));
  assert(greatWeapon.primary.some(id => ["greatsword", "greataxe", "glaive", "halberd", "maul", "pike"].includes(id)));

  const agile = { str: 8, dex: 16, con: 14, int: 10, wis: 10, cha: 10 };
  const duelist = optimalEquipmentSelections("paladin", agile, { classChoices: { "fighting-style": ["dueling"] } });
  assert.deepEqual(duelist.primary, ["shield", "rapier"]);
});

test("level 8 paladin cannot receive oath spells above the second circle", () => {
  const paladin = { ...base, className: "paladin", subclass: "devotion", level: 8 };
  assert.equal(spellSelectionRule(paladin).maxLevel, 2);
  const prepared = alwaysPreparedSpellIds(paladin, spells);
  assert(prepared.length > 0);
  assert(prepared.every(id => (spells.find(spell => spell.id === id)?.level || 0) <= 2));
  assert(!prepared.includes("commune"), "fifth-circle oath spells must stay locked until paladin level 17");
});

test("level 8 wizard recommendation follows spellbook acquisition instead of filling level one", () => {
  const wizard: ExportCharacter = { ...base, className: "wizard", level: 8, abilities: { ...base.abilities, int: 18 } };
  const selected = optimalSpellIds(wizard, spells);
  const counts = [0, 1, 2, 3, 4].map(level => selected.filter(id => spells.find(spell => spell.id === id)?.level === level).length);
  assert.deepEqual(counts, [4, 8, 4, 4, 4]);
  assert.equal(selected.length, 24, "four cantrips plus twenty spellbook spells");
  const prepared = optimalPreparedSpellIds(wizard, spells, selected);
  assert.equal(prepared.length, 12, "level plus Intelligence modifier are prepared from the book");
  assert(prepared.every(id => selected.includes(id)));
});

test("life domain spells are automatic, outside the limit and cannot consume an optimal pick", () => {
  const cleric: ExportCharacter = { ...base, className: "cleric", subclass: "life", level: 8, abilities: { ...base.abilities, wis: 18 } };
  const automatic = alwaysPreparedSpellIds(cleric, spells);
  const selected = optimalSpellIds(cleric, spells);
  assert(automatic.includes("curewounds"));
  assert(!selected.includes("curewounds"), "Cure Wounds must not be selected twice for a Life cleric");
  assert.equal(selected.filter(id => (spells.find(spell => spell.id === id)?.level || 0) > 0).length, spellSelectionRule(cleric).leveled);
  assert.equal(new Set([...selected, ...automatic]).size, selected.length + automatic.length);
});

test("expanded lists and always-prepared lists remain distinct", () => {
  const fiend: ExportCharacter = { ...base, className: "warlock", subclass: "fiend", level: 3 };
  const burningHands = spells.find(spell => spell.id === "burning-hands")!;
  assert.equal(spellAvailableToCharacter(fiend, burningHands), true, "patron spell is a selectable option");
  assert(!alwaysPreparedSpellIds(fiend, spells).includes("burning-hands"), "warlock patron spells are not automatically known");

  const ranger: ExportCharacter = { ...base, className: "ranger", level: 3, useTasha: true };
  const aid = spells.find(spell => spell.id === "aid")!;
  assert.equal(spellAvailableToCharacter({ ...ranger, useTasha: false }, aid), false);
  assert.equal(spellAvailableToCharacter(ranger, aid), true, "TCE expands the ranger list");
  assert.deepEqual(alwaysPreparedSpellEntries(ranger, spells), [
    { id: "speak-with-animals", source: "Первозданная осведомлённость (TCE)" },
  ]);
});

test("optimal lists satisfy every caster's counters and cumulative circle limits", () => {
  for (const className of ["bard", "cleric", "druid", "paladin", "ranger", "sorcerer", "warlock", "wizard", "artificer"]) {
    const value: ExportCharacter = {
      ...base,
      className,
      level: 8,
      abilities: { ...base.abilities, int: 18, wis: 18, cha: 18 },
    };
    const rule = spellSelectionRule(value);
    const selected = optimalSpellIds(value, spells);
    const cantrips = selected.filter(id => spells.find(spell => spell.id === id)?.level === 0);
    const leveled = selected.filter(id => (spells.find(spell => spell.id === id)?.level || 0) > 0);
    assert.equal(cantrips.length, rule.cantrips, `${className}: cantrip recommendation count`);
    assert.equal(leveled.length, rule.leveled, `${className}: leveled recommendation count`);
    for (let circle = 1; circle < (rule.levelLimits?.length || 0); circle += 1) {
      const atOrAbove = leveled.filter(id => (spells.find(spell => spell.id === id)?.level || 0) >= circle).length;
      assert(atOrAbove <= rule.levelLimits![circle], `${className}: circle ${circle} cumulative limit`);
    }
  }
});

test("every generic tool grant becomes a concrete source-specific choice", () => {
  const value: ExportCharacter = {
    ...base,
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
  assert.deepEqual(proficiencyChoiceRequirements(value).map(requirement => requirement.key), [
    "background-artisan", "race-dwarf-artisan", "subclass-battlemaster-artisan",
  ]);
  assert.equal(proficiencyChoicesComplete(value), true);
  const proficiencies = characterProficiencies(value);
  assert(proficiencies.tools.includes("Инструменты кожевника"));
  assert(proficiencies.tools.includes("Инструменты кузнеца"));
  assert(proficiencies.tools.includes("Инструменты ювелира"));
  assert(!proficiencies.tools.some(item => item.includes("Один вид")), "generic placeholders must not reach the sheet");
});

test("subclass armor, weapon and tool proficiencies join the final list", () => {
  const forge = characterProficiencies({ ...base, className: "cleric", subclass: "forge", level: 3 });
  assert(forge.armor.includes("Тяжёлые доспехи"));
  assert(forge.tools.includes("Инструменты кузнеца"));

  const bladesinger: ExportCharacter = {
    ...base,
    className: "wizard",
    subclass: "bladesinging",
    level: 2,
    proficiencyChoices: { "subclass-bladesinger-weapon": ["Рапира"] },
  };
  assert.equal(proficiencyChoicesComplete(bladesinger), true);
  assert(characterProficiencies(bladesinger).weapons.includes("Рапира"));
});
