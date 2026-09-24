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

test("2014 versatile weapons expose separate one and two hand damage in sheet and LSS", () => {
  for (const [name, oneHand, twoHands] of [
    ["Боевой посох", "1d6", "1d8"], ["Копьё", "1d6", "1d8"],
    ["Боевой топор", "1d8", "1d10"], ["Длинный меч", "1d8", "1d10"],
    ["Трезубец", "1d6", "1d8"], ["Боевой молот", "1d8", "1d10"],
  ]) {
    const attacks = characterAttacks(hero("fighter", name), []);
    assert.deepEqual(attacks.map(attack => attack.name), [`${name} (1 рука)`, `${name} (2 руки)`]);
    assert.deepEqual(attacks.map(attack => attack.damageDisplay), [`${oneHand}+2`, `${twoHands}+2`]);
    assert.deepEqual(lssWeaponAttacks(attacks).map(attack => attack.dmg.value), [`${oneHand}+[STR]`, `${twoHands}+[STR]`]);
  }
});

test("Dueling applies only to the one hand mode and proficiency applies to both", () => {
  const character = { ...hero("wizard"), classChoices: { "fighting-style": ["dueling"] } } as ExportCharacter;
  const attacks = characterAttacks(character, []);
  assert.deepEqual(attacks.map(attack => attack.damageDisplay), ["1d8+4", "1d10+2"]);
  assert.deepEqual(attacks.map(attack => attack.attackBonus), [2, 2]);
  assert(attacks.every(attack => !attack.proficient && /Нет владения/.test(attack.note || "")));
});

test("missing martial ranged weapons appear with correct damage and proficiency in LSS", () => {
  for (const [name, dice] of [["Ручной арбалет", "1d6"], ["Тяжёлый арбалет", "1d10"], ["Духовая трубка", "1"]]) {
    const attack = weapon(hero("fighter", name));
    assert.equal(attack.name, name);
    assert.equal(attack.ability, "dex");
    assert.equal(attack.attackBonus, 3);
    assert.equal(attack.damageFormula, `${dice}+[DEX]`);
    assert.equal(attack.damageDisplay, `${dice}+1`);
    const exported = lssWeaponAttacks([attack])[0];
    assert.equal(exported.dmg.value, `${dice}+[DEX]`);
    assert.equal(exported.isProf, true);
    assert.equal(weapon(hero("wizard", name)).proficient, false);
  }
  assert.equal(weapon(hero("bard", "Ручной арбалет")).proficient, true);
  assert.equal(weapon(hero("rogue", "Ручной арбалет")).proficient, true);
  assert.equal(weapon(hero("bard", "Тяжёлый арбалет")).proficient, false);
});

test("ranged finesse darts can use Strength while retaining Archery and thrown style", () => {
  const strong = { ...hero("fighter", "Дротик"), classChoices: { "fighting-style": ["archery", "thrown-weapon"] } } as ExportCharacter;
  const attack = weapon(strong);
  assert.equal(attack.ability, "str");
  assert.equal(attack.attackBonus, 6);
  assert.equal(attack.damageDisplay, "1d4+4");
  assert.equal(lssWeaponAttacks([attack])[0].dmg.value, "1d4+[STR]+2");
  assert.equal(weapon({ ...strong, abilities: { ...strong.abilities, dex: 18 } }).ability, "dex");
  assert.equal(weapon(hero("fighter", "Короткий лук")).ability, "dex");
});
