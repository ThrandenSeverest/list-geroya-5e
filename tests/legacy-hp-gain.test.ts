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
