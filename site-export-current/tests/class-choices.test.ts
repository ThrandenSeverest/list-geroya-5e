import assert from "node:assert/strict";
import test from "node:test";
import { classChoiceGroups, classChoicesComplete } from "../app/classChoices";
import { spells } from "../app/catalog";
import type { ExportCharacter } from "../app/exportFormats";

const base: ExportCharacter = {
  name: "", playerName: "", race: "human", raceVariant: "standard", className: "fighter", subclass: "", background: "", classSkills: [], backgroundSkills: [], level: 1, spells: [], alignment: "", abilities: { str: 15, dex: 14, con: 14, int: 10, wis: 10, cha: 8 }, personality: { traits: "", ideals: "", bonds: "", flaws: "" }, classChoices: {},
};

const character = (className: string, subclass: string, level: number, useTasha = false): ExportCharacter => ({ ...base, className, subclass, level, useTasha, classChoices: {} });

test("sorcerer metamagic follows the 2014 progression", () => {
  assert.equal(classChoiceGroups(character("sorcerer", "wildmagic", 2), spells).find(group => group.key === "metamagic"), undefined);
  assert.equal(classChoiceGroups(character("sorcerer", "wildmagic", 3), spells).find(group => group.key === "metamagic")?.count, 2);
  assert.equal(classChoiceGroups(character("sorcerer", "wildmagic", 10), spells).find(group => group.key === "metamagic")?.count, 3);
  assert.equal(classChoiceGroups(character("sorcerer", "wildmagic", 17), spells).find(group => group.key === "metamagic")?.count, 4);
});

test("warlock receives pact, invocations and every unlocked arcanum", () => {
  const groups = classChoiceGroups(character("warlock", "fiend", 17), spells);
  assert.equal(groups.find(group => group.key === "invocations")?.count, 7);
  assert.equal(groups.find(group => group.key === "pact-boon")?.count, 1);
  assert.deepEqual(groups.filter(group => group.key.startsWith("arcanum-")).map(group => group.key), ["arcanum-6", "arcanum-7", "arcanum-8", "arcanum-9"]);
  assert.ok(groups.every(group => group.options.length >= group.count), "every required group must be selectable");
});

test("fighter subclass branches expose the correct cumulative choices", () => {
  assert.equal(classChoiceGroups(character("fighter", "champion", 10), spells).find(group => group.key === "fighting-style")?.count, 2);
  assert.equal(classChoiceGroups(character("fighter", "battlemaster", 15), spells).find(group => group.key === "maneuvers")?.count, 9);
  assert.equal(classChoiceGroups(character("fighter", "arcanearcher", 18), spells).find(group => group.key === "arcane-shots")?.count, 6);
  assert.equal(classChoiceGroups(character("fighter", "runeknight", 15), spells).find(group => group.key === "runes")?.count, 5);
});

test("hunter gets a separate decision at levels 3, 7, 11 and 15", () => {
  assert.deepEqual(classChoiceGroups(character("ranger", "hunter", 15), spells).filter(group => group.key.startsWith("hunter-")).map(group => group.level), [3, 7, 11, 15]);
});

test("completion rejects removed or prerequisite-ineligible options", () => {
  const value = character("sorcerer", "wildmagic", 3);
  value.classChoices = { metamagic: ["seeking", "quickened"] };
  assert.equal(classChoicesComplete(value, spells), false);
  value.useTasha = true;
  assert.equal(classChoicesComplete(value, spells), true);
});
