import test from "node:test";
import assert from "node:assert/strict";
import { createHelpmateExport, createLongStoryShortExport, type ExportCharacter } from "../app/exportFormats";
import { speedBreakdown } from "../app/speed";

const hero = (race = "human", raceVariant = "standard", className = "fighter", level = 1): ExportCharacter => ({
  race, raceVariant, className, level, abilities: { str: 12, dex: 14, con: 12, int: 10, wis: 10, cha: 10 },
  feats: [], advancements: [], inventoryOverride: "", background: "", equipmentSelections: {},
} as unknown as ExportCharacter);

test("racial walking speeds and separate movement modes", () => {
  for (const [race, variant, speed] of [
    ["human", "standard", 30], ["dwarf", "hill", 25], ["halfling", "stout", 25],
    ["gnome", "forest", 25], ["elf", "wood", 35], ["genasi", "motm-air", 35],
    ["genasi", "air", 30], ["centaur", "base", 40],
    ["duergar", "base", 30], ["duergar", "legacy-scag", 25],
    ["deepgnome", "base", 30], ["deepgnome", "legacy-scag", 25],
  ] as const) assert.equal(speedBreakdown(hero(race, variant)).walk, speed, `${race}/${variant}`);
  assert.equal(speedBreakdown(hero("genasi", "motm-water")).swim, 30);
  assert.equal(speedBreakdown(hero("tabaxi", "legacy-vgm")).climb, 20);
  assert.equal(speedBreakdown(hero("fairy")).fly, 30);
});

test("Mobile, barbarian and monk bonuses follow their own armor restrictions", () => {
  assert.equal(speedBreakdown({ ...hero(), feats: ["mobile"] }).walk, 40);
  const barbarian = hero("human", "standard", "barbarian", 5);
  assert.equal(speedBreakdown(barbarian).walk, 40);
  assert.equal(speedBreakdown({ ...barbarian, inventoryOverride: "Кольчуга" }).walk, 20); // STR 12: no Fast Movement, armor penalty
  const dwarf = hero("dwarf", "hill", "barbarian", 5);
  assert.equal(speedBreakdown({ ...dwarf, inventoryOverride: "Кольчуга" }).walk, 25); // dwarf ignores armor STR penalty
  const monk = hero("human", "standard", "monk", 6);
  assert.equal(speedBreakdown(monk).walk, 45);
  assert.equal(speedBreakdown({ ...monk, inventoryOverride: "Щит" }).walk, 30);
  assert.equal(speedBreakdown({ ...monk, inventoryOverride: "Кожаный доспех" }).walk, 30);
  assert.equal(speedBreakdown(hero("human", "standard", "monk", 18)).walk, 60);
});

test("multiclass modifiers combine; conditional movement does not become permanent", () => {
  const character = { ...hero("tabaxi", "base", "barbarian", 11),
    classes: [{ classId: "barbarian", level: 5, acquiredAtCharacterLevel: 1 }, { classId: "monk", level: 6, acquiredAtCharacterLevel: 6 }],
    feats: ["mobile"],
  } as ExportCharacter;
  const speed = speedBreakdown(character);
  assert.equal(speed.walk, 65);
  assert.equal(speed.climb, 65);
  assert(speed.conditions.some(note => note.includes("Кошачья ловкость")));
  assert.equal(speedBreakdown({ ...hero("shifter", "motm-swiftstride") }).walk, 30);
  assert.equal(speedBreakdown({ ...hero("fairy"), inventoryOverride: "Чешуйчатый доспех" }).fly, undefined);
});

test("Helpmate and LSS export the same walking speed as the sheet", () => {
  for (const character of [hero("halfling", "stout"),
    { ...hero("elf", "wood"), feats: ["mobile"] },
    { ...hero("human", "standard", "barbarian", 5), inventoryOverride: "Кольчуга" }]) {
    const complete = { ...character, name: "Test", playerName: "", background: "", classSkills: [],
      backgroundSkills: [], spells: [], currency: { gp: 0, sp: 0, cp: 0, pp: 0 }, alignment: "",
      personality: { traits: "", ideals: "", bonds: "", flaws: "" },
    } as ExportCharacter;
    const context = { character: complete, spells: [], raceFeatureList: [], classFeatureList: [] };
    assert.equal(createHelpmateExport(context).Speed, speedBreakdown(complete).walk);
    const lss = JSON.parse(createLongStoryShortExport(context).data);
    assert.equal(lss.vitality.speed.value, speedBreakdown(complete).walk);
  }
});
