import assert from "node:assert/strict";
import { createNativeCharacterFile, parseCharacterFile } from "../app/characterFiles";
import { helpmateClassIds, type ExportCharacter } from "../app/exportFormats";

const empty: ExportCharacter = {
  name: "", playerName: "", race: "", raceVariant: "", className: "", subclass: "", background: "",
  classSkills: [], backgroundSkills: [], level: 1, spells: [], preparedSpells: [], alignment: "",
  abilities: { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 },
  personality: { traits: "", ideals: "", bonds: "", flaws: "" },
};

assert.equal(helpmateClassIds.bard, "12");
assert.equal(helpmateClassIds.artificer, "23");

const native = parseCharacterFile(createNativeCharacterFile({ ...empty, name: "Лира", className: "bard" }), empty);
assert.equal(native.source, "native");
assert.equal(native.character.name, "Лира");
assert.equal(native.character.className, "bard");

const lssInner = {
  name: { value: "Октава" }, hiddenName: "Октава",
  info: {
    charClass: { value: "Бард" }, level: { value: 8 }, race: { value: "Эльф · Высший эльф" },
    background: { value: "Артист" }, playerName: { value: "Игрок" }, alignment: { value: "Хаотично-доброе" },
  },
  stats: { str: { score: 8 }, dex: { score: 16 }, con: { score: 14 }, int: { score: 10 }, wis: { score: 12 }, cha: { score: 18 } },
  skills: { performance: { isProf: 1 }, persuasion: { isProf: 1 } },
  spells: { "level-1-slot-0": { isChecked: true }, "level-1-slot-1": { isChecked: false } },
  text: { "spells-level-0": { value: { data: { content: [{ content: [{ text: "Злая насмешка" }] }] } } } },
};
const lss = parseCharacterFile({ jsonType: "character", data: JSON.stringify(lssInner) }, empty);
assert.equal(lss.source, "long-story-short");
assert.equal(lss.character.className, "bard");
assert.equal(lss.character.level, 8);
assert.deepEqual(lss.character.spellSlotsUsed?.slice(0, 2), [1, 0]);
assert.ok(lss.character.spells.includes("vicious"));

const parameters = ["STR", "DEX", "CON", "INT", "WIS", "CHA"].map(Name => ({ Name, Value: Name === "INT" ? 18 : 10, Abilities: [] }));
const helpmate = parseCharacterFile({
  Classes: [{ Id: "23", Level: 5, SpellCells: [{ Level: 1, Max: 4, Left: 2 }] }],
  Parameters: parameters, UserRace: "Гном — Скальный гном", Spells: ["204"],
}, empty);
assert.equal(helpmate.source, "helpmate");
assert.equal(helpmate.character.className, "artificer");
assert.equal(helpmate.character.abilities.int, 18);
assert.equal(helpmate.character.spellSlotsUsed?.[0], 2);
assert.ok(helpmate.character.spells.includes("firebolt"));

console.log("character file contracts passed");
