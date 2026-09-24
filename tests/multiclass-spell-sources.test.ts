import test from "node:test";
import assert from "node:assert/strict";
import { spells } from "../app/catalog";
import type { ExportCharacter } from "../app/exportFormats";
import { classSpellGroups, otherSpellSources } from "../app/spellSources";
import { resolvePactMagic, resolveSpellSlots } from "../app/multiclass";

const hero = (): ExportCharacter => ({
  className: "wizard", level: 5, race: "human", raceVariant: "standard", background: "",
  abilities: { str: 10, dex: 10, con: 10, int: 16, wis: 16, cha: 14 },
  spells: ["mage-hand", "magic-missile", "eldritch"], preparedSpells: ["magic-missile"],
  classes: [
    { classId: "wizard", level: 3, acquiredAtCharacterLevel: 1 },
    { classId: "cleric", subclassId: "life", level: 1, acquiredAtCharacterLevel: 4 },
    { classId: "warlock", level: 1, acquiredAtCharacterLevel: 5 },
  ],
  spellGrants: [
    { spellId: "mage-hand", sourceType: "class", sourceId: "wizard", classId: "wizard", mode: "known" },
    { spellId: "mage-hand", sourceType: "class", sourceId: "warlock", classId: "warlock", mode: "known" },
    { spellId: "magic-missile", sourceType: "class", sourceId: "wizard", classId: "wizard", mode: "spellbook" },
    { spellId: "eldritch", sourceType: "class", sourceId: "warlock", classId: "warlock", mode: "known" },
  ],
} as unknown as ExportCharacter);

test("spell list retains each class source, including duplicate spells and automatic domain grants", () => {
  const groups = classSpellGroups(hero(), spells);
  assert.deepEqual(groups.map(group => group.classId), ["wizard", "cleric", "warlock"]);
  assert.equal(groups[0].spells.find(entry => entry.spell.id === "mage-hand")?.classId, "wizard");
  assert.equal(groups[2].spells.find(entry => entry.spell.id === "mage-hand")?.classId, "warlock");
  assert.equal(groups[0].spells.find(entry => entry.spell.id === "magic-missile")?.prepared, true);
  assert.equal(groups[1].spells.find(entry => entry.spell.id === "bless")?.alwaysPrepared, true);
  assert.match(groups[1].spells.find(entry => entry.spell.id === "bless")?.source || "", /жизни/i);
  assert.equal(groups[1].spells.some(entry => entry.spell.id === "magic-missile"), false);
});

test("regular multiclass spell slots and pact slots stay separate", () => {
  assert.deepEqual(resolveSpellSlots(hero()), [4, 3]);
  assert.deepEqual(resolvePactMagic(hero()), { level: 1, slots: 1 });
});

test("race and item grants without a caster class retain their source", () => {
  const character = hero();
  character.spellGrants = [...(character.spellGrants || []),
    { spellId: "bless", sourceType: "race", sourceId: "Расовая особенность", mode: "granted" },
    { spellId: "magic-missile", sourceType: "item", sourceId: "Волшебная палочка", mode: "granted" },
  ];
  assert.deepEqual(otherSpellSources(character, spells).map(entry => entry.source), ["Расовая особенность", "Волшебная палочка"]);
});
