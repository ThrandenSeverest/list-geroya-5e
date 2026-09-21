import assert from "node:assert/strict";
import test from "node:test";

import { classRules } from "../app/rules";

const druidWeapons = "Боевые посохи, булавы, дротики, дубинки, кинжалы, копья, метательные копья, пращи, серпы, скимитары";

test("druid weapon proficiencies are explicit PHB weapons", () => {
  assert.equal(classRules.druid.weapons, druidWeapons);
});

test("class weapon proficiencies do not invent class-specific weapon categories", () => {
  for (const [classId, rule] of Object.entries(classRules)) {
    assert.doesNotMatch(
      rule.weapons,
      /традиционн(?:ое|ые)\s+оружие|(?:друидск|бардовск|монашеск|воровск|жреческ|магическ)\w*\s+оружие/i,
      `${classId}: use real weapon categories or list the actual weapons`,
    );
  }
});
