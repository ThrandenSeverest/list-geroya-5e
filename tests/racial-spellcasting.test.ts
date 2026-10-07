import test from "node:test";
import assert from "node:assert/strict";
import { spells } from "../app/catalog";
import type { ExportCharacter } from "../app/exportFormats";
import { characterResources, resourceCurrent, spentResourcesAfterLongRest } from "../app/characterResources";
import { otherSpellSources } from "../app/spellSources";
import { racialSpellcastingRegistry, resolvedRacialSpells } from "../app/racialSpellcasting";

const hero = (race: string, level: number, raceVariant = "base"): ExportCharacter => ({
  name: "Проверка", playerName: "", experience: 0, inspiration: false, className: "fighter", level, race, raceVariant,
  background: "", classSkills: [], backgroundSkills: [], spells: [], alignment: "",
  abilities: { str: 10, dex: 10, con: 10, int: 12, wis: 14, cha: 16 },
  personality: { traits: "", ideals: "", bonds: "", flaws: "" }, currency: { gp: 0, sp: 0, cp: 0, pp: 0 },
});

test("tiefling racial magic unlocks by total character level without making fighter a caster", () => {
  assert.deepEqual(resolvedRacialSpells(hero("tiefling", 1), spells).map(entry => entry.spell.id), ["thaumaturgy"]);
  assert.deepEqual(resolvedRacialSpells(hero("tiefling", 3), spells).map(entry => entry.spell.id), ["thaumaturgy", "spell-doc-hellish_rebuke"]);
  const levelFive = hero("tiefling", 5);
  levelFive.classes = [{ classId: "fighter", level: 2, acquiredAtCharacterLevel: 1 }, { classId: "rogue", level: 3, acquiredAtCharacterLevel: 3 }];
  const resolved = resolvedRacialSpells(levelFive, spells);
  assert.deepEqual(resolved.map(entry => entry.spell.id), ["thaumaturgy", "spell-doc-hellish_rebuke", "darkness"]);
  assert.equal(resolved[1].ability, "cha");
  assert.equal(resolved[1].freeCastLevel, 2);
  assert.equal(resolved[1].castWithSlots, false);
  assert.equal(otherSpellSources(levelFive, spells).filter(entry => entry.classId === "race").length, 3);
});

test("racial spells use independent resources, spent uses and long-rest recovery", () => {
  const character = hero("tiefling", 5);
  const key = "racial-spell:tiefling:spell-doc-hellish_rebuke";
  character.resourceSpent = { [key]: 1 };
  const resource = characterResources(character).find(entry => entry.key === key)!;
  assert(resource);
  assert.equal(resourceCurrent(character, resource), 0);
  assert.equal(spentResourcesAfterLongRest(character)[key], undefined);
});

test("modern flexible magic chooses the best mental ability and respects a saved choice", () => {
  const fairy = hero("fairy", 5);
  assert(resolvedRacialSpells(fairy, spells).every(entry => entry.ability === "cha"));
  fairy.raceChoices = { "spellcasting-ability": ["wis"] };
  assert(resolvedRacialSpells(fairy, spells).every(entry => entry.ability === "wis"));
  assert(resolvedRacialSpells(fairy, spells).filter(entry => entry.spell.level > 0).every(entry => entry.castWithSlots));
});

test("chosen racial cantrips resolve without affecting class spell storage", () => {
  const elf = hero("elf", 1, "high");
  elf.raceChoices = { "high-elf-cantrip": ["minorillusion"] };
  assert.deepEqual(resolvedRacialSpells(elf, spells).map(entry => entry.spell.id), ["minorillusion"]);
  assert.deepEqual(elf.spells, []);
  assert.equal(elf.spellGrants, undefined);
});

test("every fixed racial spell id exists in the production catalogue", () => {
  const ids = new Set(spells.map(spell => spell.id));
  for (const definition of racialSpellcastingRegistry) for (const spell of definition.spells) {
    if (spell.spellId) assert(ids.has(spell.spellId), `${definition.race}/${definition.source}: ${spell.spellId}`);
  }
});
