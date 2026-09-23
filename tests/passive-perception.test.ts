import test from "node:test";
import assert from "node:assert/strict";
import { createHelpmateExport, type ExportCharacter } from "../app/exportFormats";
import { passivePerceptionBreakdown, skillBonusBreakdown } from "../app/derivedSkills";

const hero = (backgroundSkills: string[] = [], expertiseSkills: string[] = [], feats: string[] = []): ExportCharacter => ({
  name: "Test", playerName: "", race: "human", raceVariant: "standard", className: "fighter", level: 5,
  background: "", classSkills: [], backgroundSkills, expertiseSkills, feats, spells: [],
  currency: { gp: 0, sp: 0, cp: 0, pp: 0 }, alignment: "",
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 14, cha: 10 },
  personality: { traits: "", ideals: "", bonds: "", flaws: "" },
} as ExportCharacter);

test("Perception proficiency, expertise and Observant stack only when selected", () => {
  const cases: Array<[ExportCharacter, number, number]> = [
    [hero(), 12, 0],
    [hero(["Внимательность"]), 15, 3],
    [hero(["Внимательность"], ["Внимательность"]), 18, 6],
    [hero([], [], ["observant"]), 17, 0],
    [hero(["Внимательность"], ["Внимательность"], ["observant"]), 23, 6],
  ];
  for (const [character, expected, training] of cases) {
    const result = passivePerceptionBreakdown(character);
    assert.equal(result.value, expected);
    assert.equal(result.skill.training, training);
    assert.equal(createHelpmateExport({ character, spells: [], raceFeatureList: [], classFeatureList: [] }).Bditelnost, expected);
  }
});

test("expertise without proficiency is not doubled; feats in advancements count", () => {
  assert.equal(skillBonusBreakdown(hero([], ["Внимательность"]), "Внимательность").value, 2);
  const character = { ...hero(["Внимательность"]), advancements: [{ key: "4", level: 4, featId: "observant", asiChoices: [] }] };
  assert.equal(passivePerceptionBreakdown(character).value, 20);
});
