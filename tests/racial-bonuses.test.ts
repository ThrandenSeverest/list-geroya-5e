import assert from "node:assert/strict";
import test from "node:test";
import { races } from "../app/catalog";
import { raceFeatures } from "../app/rules";
import { baseRaceVariants, finalAbilityScores, raceAbilityBonuses, raceVariants } from "../app/characterRules";
import type { ExportCharacter } from "../app/exportFormats";

const character = (race: string, raceVariant = "base", raceAbilityChoices: ExportCharacter["raceAbilityChoices"] = []): ExportCharacter => ({
  name: "", playerName: "", race, raceVariant, raceAbilityChoices, raceSkills: [], className: "", background: "",
  classSkills: [], backgroundSkills: [], level: 1, spells: [], alignment: "",
  abilities: { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 },
  personality: { traits: "", ideals: "", bonds: "", flaws: "" },
});

test("every catalog race has an ability rule", () => {
  for (const race of races) assert.ok(raceVariants[race.id]?.length || baseRaceVariants[race.id], `${race.id} has no ability rule`);
});

test("every catalog race has concrete rules-level detail", () => {
  const problems: string[] = [];
  for (const race of races) {
    const features = raceFeatures(race.id, "base", race.description, race.tags);
    if (features.length < 2) problems.push(`${race.name}: fewer than two traits`);
    if (!features.every(feature => feature.name.length > 2 && feature.description.length >= 18)) problems.push(`${race.name}: description too short`);
    if (!features.every(feature => !feature.description.includes("ключевая особенность выбранной расы"))) problems.push(`${race.name}: generic fallback`);
  }
  assert.deepEqual(problems, []);
});

test("half-elf applies fixed and chosen bonuses", () => {
  const value = character("halfelf", "base", ["str", "dex"]);
  assert.deepEqual(raceAbilityBonuses(value), { str: 1, dex: 1, con: 0, int: 0, wis: 0, cha: 2 });
  assert.deepEqual(finalAbilityScores(value), { str: 9, dex: 9, con: 8, int: 8, wis: 8, cha: 10 });
});

test("flexible +2/+1 bonuses follow selection order", () => {
  assert.deepEqual(raceAbilityBonuses(character("aasimar", "base", ["wis", "cha"])), { str: 0, dex: 0, con: 0, int: 0, wis: 2, cha: 1 });
});

test("aasimar exposes every VGM kind plus the MPMM variant with concrete bonuses", () => {
  assert.deepEqual(raceVariants.aasimar.map(variant => variant.id), ["protector", "scourge", "fallen", "multiverse"]);
  assert.deepEqual(raceAbilityBonuses(character("aasimar", "protector")), { str: 0, dex: 0, con: 0, int: 0, wis: 1, cha: 2 });
  assert.deepEqual(raceAbilityBonuses(character("aasimar", "scourge")), { str: 0, dex: 0, con: 1, int: 0, wis: 0, cha: 2 });
  assert.deepEqual(raceAbilityBonuses(character("aasimar", "fallen")), { str: 1, dex: 0, con: 0, int: 0, wis: 0, cha: 2 });
  assert.deepEqual(raceAbilityBonuses(character("aasimar", "multiverse", ["dex", "con"])), { str: 0, dex: 2, con: 1, int: 0, wis: 0, cha: 0 });
});
