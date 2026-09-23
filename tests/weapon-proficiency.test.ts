import test from "node:test";
import assert from "node:assert/strict";
import type { ExportCharacter } from "../app/exportFormats";
import { characterAttacks, lssWeaponAttacks } from "../app/combat";

const hero = (className = "wizard", inventoryOverride = "Длинный меч"): ExportCharacter => ({
  race: "human", raceVariant: "standard", className, level: 3, background: "",
  classSkills: [], backgroundSkills: [], abilities: { str: 14, dex: 12, con: 12, int: 14, wis: 10, cha: 10 },
  spells: [], inventoryOverride,
} as ExportCharacter);

const weapon = (character: ExportCharacter) => characterAttacks(character, [])[0];

test("untrained inventory weapon excludes PB and warns in sheet and LSS", () => {
  const attack = weapon(hero());
  assert.equal(attack.proficient, false);
  assert.equal(attack.attackBonus, 2);
  assert.match(attack.note || "", /Нет владения/);
  assert.equal(lssWeaponAttacks([attack])[0].isProf, false);
});

test("specific and category proficiency resolve without guessing", () => {
  assert.equal(weapon(hero("wizard", "Кинжал")).attackBonus, 4);
  assert.equal(weapon(hero("fighter")).attackBonus, 4);
  assert.equal(weapon(hero("bard", "Рапира")).proficient, true);
  assert.equal(weapon(hero("monk", "Короткий меч")).proficient, true);
  assert.equal(weapon(hero("druid", "Боевой посох")).proficient, true);
  assert.equal(weapon(hero("druid", "Длинный меч")).proficient, false);
});

test("racial and multiclass weapon training applies", () => {
  assert.equal(weapon({ ...hero(), race: "elf", raceVariant: "high" }).proficient, true);
  assert.equal(weapon({ ...hero("wizard", "Боевой топор"), race: "dwarf", raceVariant: "hill" }).proficient, true);
  const multiclass = { ...hero(), level: 4, classes: [
    { classId: "wizard", level: 3, acquiredAtCharacterLevel: 1 },
    { classId: "fighter", level: 1, acquiredAtCharacterLevel: 4 },
  ] } as ExportCharacter;
  assert.equal(weapon(multiclass).proficient, true);
  assert.equal(weapon(multiclass).attackBonus, 4);
});
