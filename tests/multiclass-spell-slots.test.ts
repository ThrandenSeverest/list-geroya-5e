import test from "node:test";
import assert from "node:assert/strict";

import type { ExportCharacter } from "../app/exportFormats";
import { resolvePactMagic, resolveSpellSlots } from "../app/multiclass";

function character(classes: Array<{ classId: string; level: number; subclassId?: string }>, startingClassId = classes[0]?.classId || "") {
  const level = classes.reduce((sum, entry) => sum + entry.level, 0);
  return {
    className: startingClassId,
    startingClassId,
    level,
    classes: classes.map((entry, index) => ({
      ...entry,
      acquiredAtCharacterLevel: index + 1,
      classSkills: [],
      choiceValues: {},
    })),
  } as unknown as ExportCharacter;
}

test("single-class half casters use their class progression", () => {
  assert.deepEqual(resolveSpellSlots(character([{ classId: "paladin", level: 3 }])), [3]);
  assert.deepEqual(resolveSpellSlots(character([{ classId: "ranger", level: 3 }])), [3]);
  assert.deepEqual(resolveSpellSlots(character([{ classId: "paladin", level: 5 }])), [4, 2]);
  assert.deepEqual(resolveSpellSlots(character([{ classId: "ranger", level: 5 }])), [4, 2]);
});

test("multiclass regular spellcasting uses the shared caster level", () => {
  assert.deepEqual(resolveSpellSlots(character([
    { classId: "wizard", level: 3 },
    { classId: "cleric", level: 2 },
  ], "wizard")), [4, 3, 2]);

  assert.deepEqual(resolveSpellSlots(character([
    { classId: "fighter", level: 2 },
    { classId: "wizard", level: 3 },
  ], "fighter")), [4, 2]);
});

test("Pact Magic follows actual warlock level regardless of starting class", () => {
  const fighterWarlock = character([
    { classId: "fighter", level: 2 },
    { classId: "warlock", level: 3 },
  ], "fighter");
  const warlockFighter = character([
    { classId: "warlock", level: 3 },
    { classId: "fighter", level: 2 },
  ], "warlock");

  assert.deepEqual(resolvePactMagic(fighterWarlock), { slots: 2, level: 2 });
  assert.deepEqual(resolvePactMagic(warlockFighter), { slots: 2, level: 2 });
});

test("paladin and ranger gain spell circles at levels 7, 9 and 17", () => {
  for (const classId of ["paladin", "ranger"]) {
    assert.deepEqual(resolveSpellSlots(character([{ classId, level: 7 }])), [4, 3]);
    assert.deepEqual(resolveSpellSlots(character([{ classId, level: 9 }])), [4, 3, 2]);
    assert.deepEqual(resolveSpellSlots(character([{ classId, level: 17 }])), [4, 3, 3, 3, 1]);
  }
});

test("half casters combine only when multiclass Spellcasting applies", () => {
  assert.deepEqual(resolveSpellSlots(character([{ classId: "paladin", level: 7 }, { classId: "ranger", level: 9 }])), [4, 3, 3, 1]);
  assert.deepEqual(resolveSpellSlots(character([{ classId: "ranger", level: 5 }, { classId: "wizard", level: 5 }])), [4, 3, 3, 1]);
  assert.deepEqual(resolveSpellSlots(character([{ classId: "fighter", subclassId: "eldritchknight", level: 6 }, { classId: "rogue", subclassId: "arcanetrickster", level: 6 }])), [4, 3]);
});
