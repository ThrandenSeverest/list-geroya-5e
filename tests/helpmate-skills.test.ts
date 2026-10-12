import test from "node:test";
import assert from "node:assert/strict";
import { spells } from "../app/catalog";
import { createHelpmateExport, helpmateSkillSlots, type ExportCharacter } from "../app/exportFormats";

/**
 * Helpmate uses array indices in Parameters[].Abilities. A skill's position
 * is its external identifier; no name or key is serialized alongside it.
 * The reference order is taken directly from Helpmate's
 * Russian character sheet (2026-10-12 screenshot), where Расследование = Анализ and
 * Уход за животными = Дрессировка.
 */
const helpmateOrder = [
  ["STR", ["Атлетика"]],
  ["DEX", ["Акробатика", "Ловкость рук", "Скрытность"]],
  ["CON", []],
  ["INT", ["Расследование", "История", "Магия", "Природа", "Религия"]],
  ["WIS", ["Внимательность", "Проницательность", "Выживание", "Медицина", "Уход за животными"]],
  ["CHA", ["Выступление", "Запугивание", "Обман", "Убеждение"]],
] as const;

function exportWithSkills(chosen: readonly string[]) {
  const character: ExportCharacter = {
    name: "Проверка навыков Helpmate",
    playerName: "", className: "wizard", level: 1,
    race: "", raceVariant: "", background: "",
    classSkills: [], backgroundSkills: [...chosen],
    abilities: { str: 10, dex: 14, con: 12, int: 16, wis: 14, cha: 10 },
    spells: [], currency: { gp: 0, sp: 0, cp: 0, pp: 0 },
    alignment: "",
    personality: { traits: "", ideals: "", bonds: "", flaws: "" },
  };
  return createHelpmateExport({ character, spells, raceFeatureList: [], classFeatureList: [] });
}

function markedSkills(chosen: readonly string[]) {
  const result = exportWithSkills(chosen);
  assert.deepEqual(result.Parameters.map(param => param.Name), helpmateOrder.map(([name]) => name));
  return result.Parameters.flatMap((parameter, index) => {
    const [ability, skillNames] = helpmateOrder[index];
    assert.equal(parameter.Name, ability);
    assert.equal(parameter.Abilities.length, skillNames.length, `Incorrect number of ${ability} skills`);
    return parameter.Abilities.flatMap((skill, position) => skill.Proficiency ? [skillNames[position]] : []);
  });
}

test("Helpmate exports the exact reported five proficiencies without substituting other skills", () => {
  const selected = ["Внимательность", "Акробатика", "Выживание", "История", "Магия"];
  assert.deepEqual(markedSkills(selected).sort(), [...selected].sort());
});

test("All 18 Helpmate skill positions preserve proficiency, one skill at a time", () => {
  const all = helpmateOrder.flatMap(([, skills]) => [...skills]);
  assert.equal(all.length, 18);
  assert.equal(new Set(all).size, 18);
  for (const name of all) {
    assert.deepEqual(markedSkills([name]), [name], `Incorrect position for ${name}`);
  }
  assert.deepEqual(markedSkills(all).sort(), [...all].sort());
  assert.deepEqual(markedSkills([]), []);
});

test("Screenshot regression: Helpmate receives all skill bonuses including expertise", () => {
  const proficient = [
    "Ловкость рук", "Скрытность", "Внимательность", "Проницательность",
    "Запугивание", "Обман", "Убеждение",
  ];
  const expertise = ["Обман", "Убеждение"];
  const hero: ExportCharacter = {
    name: "Регрессия: 18 навыков и экспертиза",
    playerName: "", className: "rogue", level: 5,
    race: "", raceVariant: "", background: "",
    classSkills: [], backgroundSkills: proficient, expertiseSkills: expertise,
    abilities: { str: 8, dex: 14, con: 14, int: 8, wis: 14, cha: 18 },
    spells: [], currency: { gp: 0, sp: 0, cp: 0, pp: 0 },
    alignment: "",
    personality: { traits: "", ideals: "", bonds: "", flaws: "" },
  };
  const result = createHelpmateExport({ character: hero, spells, raceFeatureList: [], classFeatureList: [] });
  const pb = 3; // character level 5
  const abilityKeys = ["str", "dex", "con", "int", "wis", "cha"] as const;
  const expectedBonus: Record<string, number> = {
    "Атлетика": -1,
    "Акробатика": 2, "Ловкость рук": 5, "Скрытность": 5,
    "Расследование": -1, "История": -1, "Магия": -1, "Природа": -1, "Религия": -1,
    "Внимательность": 5, "Проницательность": 5, "Выживание": 2,
    "Медицина": 2, "Уход за животными": 2,
    "Выступление": 4, "Запугивание": 7, "Обман": 10, "Убеждение": 10,
  };
  const actualBonus: Record<string, number> = {};
  for (const [index, [abilityName, names]] of helpmateOrder.entries()) {
    const parameter = result.Parameters[index];
    assert.equal(parameter.Name, abilityName);
    const modifier = Math.floor((hero.abilities[abilityKeys[index]] - 10) / 2);
    for (const [position, name] of names.entries()) {
      const entry = parameter.Abilities[position];
      assert.equal(entry.Proficiency, proficient.includes(name), `Wrong proficiency for ${name}`);
      assert.equal(entry.UserValue, expertise.includes(name) ? pb : 0, `Wrong expertise for ${name}`);
      actualBonus[name] = modifier + (entry.Proficiency ? pb : 0) + entry.UserValue;
    }
  }
  assert.deepEqual(actualBonus, expectedBonus);
});


test("Helpmate skill slots agree with all 18 unique numeric labels from its native editor", () => {
  // Read directly from a Helpmate-authored JSON and screenshot, independently of code.
  const reference: Array<[string, number, string]> = [
    ["STR", 0, "Атлетика"],
    ["DEX", 1, "Акробатика"], ["DEX", 2, "Ловкость рук"], ["DEX", 3, "Скрытность"],
    ["INT", 4, "Расследование"], ["INT", 5, "История"], ["INT", 6, "Магия"],
    ["INT", 7, "Природа"], ["INT", 8, "Религия"],
    ["WIS", 9, "Внимательность"], ["WIS", 10, "Проницательность"],
    ["WIS", 11, "Выживание"], ["WIS", 12, "Медицина"], ["WIS", 13, "Уход за животными"],
    ["CHA", 14, "Выступление"], ["CHA", 15, "Запугивание"],
    ["CHA", 16, "Обман"], ["CHA", 17, "Убеждение"],
  ];
  assert.deepEqual(
    Object.entries(helpmateSkillSlots).flatMap(([ability, slots]) => slots.map(([id, skill]) => [ability.toUpperCase(), id, skill])),
    reference,
  );
});

test("Helpmate clean-import regression: all 18 bonuses of a level-5 bard with expertise", () => {
  const character: ExportCharacter = {
    name: "Тест экспорта барда", playerName: "",
    className: "bard", startingClassId: "bard", level: 5,
    classes: [{ classId: "bard", level: 5, acquiredAtCharacterLevel: 1,
      classSkills: ["Убеждение", "Внимательность", "Проницательность"] }],
    race: "", raceVariant: "", background: "",
    classSkills: ["Убеждение", "Внимательность", "Проницательность"],
    raceSkills: ["Скрытность", "Запугивание"],
    backgroundSkills: ["Ловкость рук", "Обман"],
    expertiseSkills: ["Обман", "Убеждение"],
    abilities: { str: 8, dex: 14, con: 14, int: 9, wis: 14, cha: 19 },
    spells: [], currency: { gp: 0, sp: 0, cp: 0, pp: 0 },
    alignment: "",
    personality: { traits: "", ideals: "", bonds: "", flaws: "" },
  };
  const exported = createHelpmateExport({ character, spells, raceFeatureList: [], classFeatureList: [] });
  const abilities = ["str", "dex", "con", "int", "wis", "cha"] as const;
  const expectedBonuses = [
    [-1], [2, 5, 5], [], [-1, -1, -1, -1, -1],
    [5, 5, 2, 2, 2], [4, 7, 10, 10],
  ];
  for (const [index, ability] of abilities.entries()) {
    const base = Math.floor((character.abilities[ability] - 10) / 2);
    const calculated = exported.Parameters[index].Abilities.map(skill =>
      base + (skill.Proficiency ? 3 : 0) + skill.UserValue);
    assert.deepEqual(calculated, expectedBonuses[index], "Wrong skills for " + ability);
  }
  assert.equal(exported.Parameters[4].Abilities[1].Proficiency, true);
  assert.equal(exported.Parameters[4].Abilities[3].Proficiency, false);
  assert.equal(exported.Parameters[5].Abilities[2].UserValue, 3);
  assert.equal(exported.Parameters[5].Abilities[3].UserValue, 3);
});
