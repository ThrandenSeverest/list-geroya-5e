import test from "node:test";
import assert from "node:assert/strict";
import { createHelpmateExport, type ExportCharacter } from "../app/exportFormats";
import { initiativeBreakdown } from "../app/initiative";

const hero = (className = "fighter", level = 5): ExportCharacter => ({
  name: "Test", playerName: "", race: "human", raceVariant: "standard", className, level,
  background: "", classSkills: [], backgroundSkills: [], spells: [],
  currency: { gp: 0, sp: 0, cp: 0, pp: 0 }, alignment: "",
  abilities: { str: 10, dex: 14, con: 10, int: 16, wis: 12, cha: 16 },
  personality: { traits: "", ideals: "", bonds: "", flaws: "" },
} as ExportCharacter);

test("permanent bonuses appear in the sheet and Helpmate", () => {
  const cases: Array<[ExportCharacter, number]> = [
    [hero(), 2], [ { ...hero(), feats: ["alert"] }, 7 ],
    [hero("bard", 5), 3], [ { ...hero(), race: "harengon" }, 5 ],
    [ { ...hero("rogue"), subclass: "swashbuckler" }, 5 ],
    [ { ...hero("wizard"), subclass: "warmagic" }, 5 ],
    [ { ...hero("wizard"), subclass: "chronurgy" }, 5 ],
    [ { ...hero("ranger"), subclass: "gloomstalker" }, 3 ],
  ];
  for (const [character, expected] of cases) {
    assert.equal(initiativeBreakdown(character).value, expected);
    assert.equal(createHelpmateExport({ character, spells: [], raceFeatureList: [], classFeatureList: [] }).IniBonus, expected);
  }
});

test("full PB excludes Jack of All Trades and half-PB class features do not stack", () => {
  const multiclass = { ...hero("bard", 9), race: "harengon", feats: ["alert"],
    classes: [{ classId: "bard", level: 2, acquiredAtCharacterLevel: 1 },
      { classId: "rogue", level: 3, subclassId: "swashbuckler", acquiredAtCharacterLevel: 3 },
      { classId: "wizard", level: 4, subclassId: "warmagic", acquiredAtCharacterLevel: 6 }],
  } as ExportCharacter;
  assert.equal(initiativeBreakdown(multiclass).value, 17); // DEX 2 + PB 4 + Alert 5 + CHA 3 + INT 3
  const championBard = { ...hero("fighter", 9),
    classes: [{ classId: "fighter", level: 7, subclassId: "champion", acquiredAtCharacterLevel: 1 },
      { classId: "bard", level: 2, acquiredAtCharacterLevel: 8 }],
  } as ExportCharacter;
  assert.equal(initiativeBreakdown(championBard).value, 4); // DEX 2 + ceil(PB 4/2)
});

test("advantage and situational auras are notes, not permanent modifiers", () => {
  const barbarian = initiativeBreakdown(hero("barbarian", 7));
  assert.equal(barbarian.value, 2);
  assert(barbarian.notes.some(note => note.includes("преимущество")));
  const watchers = initiativeBreakdown({ ...hero("paladin", 7), subclass: "watchers" });
  assert.equal(watchers.value, 2);
  assert(watchers.notes.some(note => note.includes("Аура стража")));
});
