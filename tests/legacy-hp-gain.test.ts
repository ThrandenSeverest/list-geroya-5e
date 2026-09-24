import test from "node:test";
import assert from "node:assert/strict";
import { estimatedHitPoints, type ExportCharacter } from "../app/exportFormats";

test("legacy roll/manual hpGain remains an already calculated per-level gain", () => {
  const character = {
    className: "fighter", level: 4, abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 10, cha: 10 },
    classes: [
      { classId: "fighter", level: 1, acquiredAtCharacterLevel: 1 },
      { classId: "wizard", level: 3, acquiredAtCharacterLevel: 2 },
    ],
    levelHistory: [
      { characterLevel: 1, classId: "fighter", classLevelAfter: 1 },
      { characterLevel: 2, classId: "wizard", classLevelAfter: 1, hpMode: "roll", hpGain: 5 },
      { characterLevel: 3, classId: "wizard", classLevelAfter: 2, hpMode: "manual", hpGain: 7 },
      { characterLevel: 4, classId: "wizard", classLevelAfter: 3, hpMode: "average" },
    ],
  } as unknown as ExportCharacter;
  // Fighter 10+2; saved gains 5 and 7; wizard average 4+2.
  assert.equal(estimatedHitPoints(character), 30);
  // The old JSON does not retain the original die rolls or CON at each gain.
  // Preserve the stored final gains until an explicit versioned migration exists.
  assert.equal(estimatedHitPoints({ ...character, abilities: { ...character.abilities, con: 16 } }), 32);
});

test("explicit raw-roll format adds CON and tracks later changes, including minimum gain", () => {
  const old = {
    className: "fighter", level: 3, abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 10, cha: 10 },
    levelHistory: [
      { characterLevel: 1, classId: "fighter", classLevelAfter: 1 },
      { characterLevel: 2, classId: "fighter", classLevelAfter: 2, hpMode: "roll", hpGain: 4, hpGainFormat: "raw-roll-plus-con-v1" },
      { characterLevel: 3, classId: "fighter", classLevelAfter: 3, hpMode: "roll", hpGain: 1, hpGainFormat: "raw-roll-plus-con-v1" },
    ],
  } as unknown as ExportCharacter;
  assert.equal(estimatedHitPoints(old), 12 + 6 + 3);
  assert.equal(estimatedHitPoints({ ...old, abilities: { ...old.abilities, con: 16 } }), 13 + 7 + 4);
  assert.equal(estimatedHitPoints({ ...old, abilities: { ...old.abilities, con: 4 } }), 7 + 1 + 1);
  assert.equal(estimatedHitPoints(JSON.parse(JSON.stringify(old))), 21);
});

import { setHitPointRoll } from "../app/hpProgress";
test("an explicit level edit records a raw die and never silently migrates another legacy gain", () => {
  const old = {
    className: "fighter", level: 3,
    abilities: { str: 10, dex: 10, con: 14, int: 10, wis: 10, cha: 10 },
    levelHistory: [
      { characterLevel: 1, classId: "fighter", classLevelAfter: 1 },
      { characterLevel: 2, classId: "fighter", classLevelAfter: 2, hpMode: "roll", hpGain: 5 },
      { characterLevel: 3, classId: "fighter", classLevelAfter: 3, hpMode: "manual", hpGain: 7 },
    ], currentHitPoints: 21,
  } as unknown as ExportCharacter;
  const edited = setHitPointRoll(old, 2, 4);
  assert.equal(edited.levelHistory?.[1].hpGainFormat, "raw-roll-plus-con-v1");
  assert.deepEqual(edited.levelHistory?.[2], old.levelHistory?.[2]);
  assert.equal(estimatedHitPoints(edited), 12 + 6 + 7);
  assert.equal(setHitPointRoll(edited, 2, 11), edited);
  const average = setHitPointRoll(edited, 2, null);
  assert.equal(average.levelHistory?.[1].hpMode, "average");
  assert.equal(average.levelHistory?.[1].hpGain, undefined);
  assert.equal(estimatedHitPoints(average), 12 + 8 + 7);
});
