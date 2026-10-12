import test from "node:test";
import assert from "node:assert/strict";
import { spells } from "../app/catalog";
import { createHelpmateExport, type ExportCharacter } from "../app/exportFormats";

/**
 * Helpmate uses array indices in Parameters[].Abilities. A skill's position
 * is its external identifier; no name or key is serialized alongside it.
 * The reference order is alphabetic within each ability in Helpmate's
 * Russian character sheet, where Расследование = Анализ and
 * Уход за животными = Дрессировка.
 */
const helpmateOrder = [
  ["STR", ["Атлетика"]],
  ["DEX", ["Акробатика", "Ловкость рук", "Скрытность"]],
  ["CON", []],
  ["INT", ["Расследование", "История", "Магия", "Природа", "Религия"]],
  ["WIS", ["Внимательность", "Выживание", "Медицина", "Проницательность", "Уход за животными"]],
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
