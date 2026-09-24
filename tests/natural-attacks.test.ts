import test from "node:test";
import assert from "node:assert/strict";
import { characterAttacks, lssWeaponAttacks } from "../app/combat";
import type { ExportCharacter } from "../app/exportFormats";
const hero = (race: string, raceVariant = "base") => ({ race, raceVariant, className: "fighter", level: 5,
  abilities: { str: 14, dex: 18, con: 16, int: 10, wis: 12, cha: 8 }, inventoryOverride: "", spells: [] } as unknown as ExportCharacter);
test("natural attacks preserve published racial edition dice and Strength", () => {
  for (const [race, variant] of [["aarakocra", "legacy-ee"], ["centaur", "legacy-ggr"], ["satyr", "legacy-mot"], ["tabaxi", "legacy-vgm"], ["tortle", "legacy-tp"]]) {
    const modern = characterAttacks(hero(race), [])[0];
    const legacy = characterAttacks(hero(race, variant), [])[0];
    assert.equal(modern.damageDisplay, "1d6+2");
    assert.equal(legacy.damageDisplay, "1d4+2");
    assert.equal(modern.attackBonus, 5);
    assert.equal(lssWeaponAttacks([modern])[0].dmg.value, "1d6+[STR]");
  }
  for (const race of ["minotaur", "lizardfolk"]) assert.equal(characterAttacks(hero(race), [])[0].damageDisplay, "1d6+2");
  assert.equal(characterAttacks(hero("leonin"), [])[0].damageDisplay, "1d4+2");
  assert.equal(characterAttacks(hero("human"), []).length, 0);
});
test("dhampir uses CON; shifter bite and monk alternatives retain explicit conditions", () => {
  const bite = characterAttacks(hero("dhampir"), [])[0];
  assert.equal(bite.ability, "con"); assert.equal(bite.attackBonus, 6); assert.equal(bite.damageFormula, "1d4+[CON]");
  assert.match(characterAttacks(hero("shifter", "motm-longtooth"), [])[0].note!, /Только во время Смены/);
  assert.equal(characterAttacks(hero("shifter", "motm-wildhunt"), []).length, 0);
  const monk = characterAttacks({ ...hero("tabaxi"), className: "monk", level: 11 }, []);
  assert.equal(monk[0].damageDisplay, "1d6+2"); assert.equal(monk[1].damageDisplay, "1d8+4");
  assert.match(monk[1].note!, /без доспехов и щита/);
});
