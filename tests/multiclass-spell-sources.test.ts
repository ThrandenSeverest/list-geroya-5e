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

import { classPreparedSpellIds, migrateSpellPreparation, setClassPreparedSpells } from "../app/spellPreparation";

test("duplicate prepared spell is independent per class and survives native JSON round trip", () => {
  const legacy = { ...hero(), mobilePreparedConfigured: true, preparedSpells: ["detectmagic"], spells: ["detectmagic"],
    spellGrants: ["wizard", "cleric"].map(classId => ({ spellId: "detectmagic", classId, sourceId: classId, sourceType: "class" as const, mode: "prepared" as const })) };
  const migrated = migrateSpellPreparation(legacy);
  assert.deepEqual(classPreparedSpellIds(migrated, "wizard"), ["detectmagic"]);
  assert.deepEqual(classPreparedSpellIds(migrated, "cleric"), ["detectmagic"]);
  const edited = setClassPreparedSpells(migrated, "wizard", []);
  const loaded = migrateSpellPreparation(JSON.parse(JSON.stringify(edited)));
  assert.deepEqual(classPreparedSpellIds(loaded, "wizard"), []);
  assert.deepEqual(classPreparedSpellIds(loaded, "cleric"), ["detectmagic"]);
  assert.deepEqual(loaded.preparedSpells, ["detectmagic"]);
  const groups = classSpellGroups(loaded, spells);
  assert.equal(groups[0].spells.find(entry => entry.spell.id === "detectmagic")?.prepared, false);
  assert.equal(groups[1].spells.find(entry => entry.spell.id === "detectmagic")?.prepared, true);
  assert.deepEqual(migrateSpellPreparation(loaded), loaded);
});

test("editing wizard preparation preserves defaults and always-prepared domain spells of cleric", () => {
  const legacy = { ...hero(), spells: [...hero().spells, "curewounds"], spellGrants: [...hero().spellGrants!,
    { spellId: "curewounds", classId: "cleric", sourceType: "class" as const, sourceId: "cleric", mode: "prepared" as const }] };
  const edited = setClassPreparedSpells(legacy, "wizard", []);
  assert.deepEqual(classPreparedSpellIds(edited, "cleric"), ["curewounds"]);
  const cleric = classSpellGroups(edited, spells).find(group => group.classId === "cleric")!;
  assert.equal(cleric.spells.find(entry => entry.spell.id === "bless")?.prepared, true);
});
