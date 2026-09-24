import test from "node:test";
import assert from "node:assert/strict";
import { spells } from "../app/catalog";
import { characterAttacks, lssWeaponAttacks } from "../app/combat";
import type { ExportCharacter } from "../app/exportFormats";

const hero = (level: number, agonizing = false): ExportCharacter => ({
  className: "warlock", level, race: "human", raceVariant: "standard", background: "",
  abilities: { str: 10, dex: 12, con: 12, int: 14, wis: 10, cha: 18 },
  spells: ["eldritch"], inventoryOverride: "",
  classChoices: { invocations: agonizing ? ["agonizing-blast"] : [] },
} as unknown as ExportCharacter);

test("Eldritch Blast has independent attack rows and damage per beam at each tier", () => {
  for (const [level, count] of [[1, 1], [5, 2], [11, 3], [17, 4]]) {
    const attacks = characterAttacks(hero(level, true), spells);
    assert.equal(attacks.length, count);
    assert.equal(new Set(attacks.map(attack => attack.id)).size, count);
    assert(attacks.every(attack => attack.attackBonus === 4 + 2 + Math.floor((level - 1) / 4)));
    assert(attacks.every(attack => attack.damageFormula === "1d10+[CHA]" && attack.damageDisplay === "1d10+4"));
    assert.deepEqual(lssWeaponAttacks(attacks).map(attack => attack.dmg.value), Array(count).fill("1d10+[CHA]"));
  }
});

test("without Agonizing Blast no Charisma damage is added; warlock multiclass uses Charisma for hit", () => {
  assert.equal(characterAttacks(hero(5), spells)[0].damageDisplay, "1d10");
  const multiclass = { ...hero(5, true), className: "wizard", classes: [
    { classId: "wizard", level: 4, acquiredAtCharacterLevel: 1 },
    { classId: "warlock", level: 1, acquiredAtCharacterLevel: 5 },
  ], spellGrants: [{ spellId: "eldritch", sourceType: "class", sourceId: "warlock", classId: "warlock", mode: "known" }] } as ExportCharacter;
  const attacks = characterAttacks(multiclass, spells);
  assert.equal(attacks.length, 2);
  assert(attacks.every(attack => attack.ability === "cha" && attack.attackBonus === 7));
  assert.equal(characterAttacks({ ...multiclass, className: "fighter", classes: [
    { classId: "fighter", level: 4, acquiredAtCharacterLevel: 1 },
    { classId: "warlock", level: 1, acquiredAtCharacterLevel: 5 },
  ] }, spells).length, 2);
});
