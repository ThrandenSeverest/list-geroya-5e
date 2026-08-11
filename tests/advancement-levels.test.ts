import assert from "node:assert/strict";
import test from "node:test";
import { asiLevelsForClass } from "../app/characterRules";

test("standard classes receive every 2014 ASI/feat opportunity", () => {
  assert.deepEqual(asiLevelsForClass("wizard"), [4, 8, 12, 16, 19]);
});

test("fighter receives additional opportunities at levels 6 and 14", () => {
  assert.deepEqual(asiLevelsForClass("fighter"), [4, 6, 8, 12, 14, 16, 19]);
});

test("rogue receives its additional opportunity at level 10", () => {
  assert.deepEqual(asiLevelsForClass("rogue"), [4, 8, 10, 12, 16, 19]);
});
