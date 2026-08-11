import assert from "node:assert/strict";
import test from "node:test";
import { hitDiceAfterLongRest, hitDieHealing } from "../app/restRules";

test("level 10 long rest restores five hit dice without exceeding the maximum", () => {
  assert.equal(hitDiceAfterLongRest(9, 10), 4);
  assert.equal(10 - hitDiceAfterLongRest(9, 10), 6);
  assert.equal(hitDiceAfterLongRest(2, 10), 0);
});

test("level 1 long rest always restores at least one hit die", () => assert.equal(hitDiceAfterLongRest(1, 1), 0));

test("hit die healing adds Constitution modifier and never becomes negative", () => {
  assert.equal(hitDieHealing(6, 3), 9);
  assert.equal(hitDieHealing(1, -3), 0);
});

