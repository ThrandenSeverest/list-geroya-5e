import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spells } from "../app/catalog";
import { parseCharacterFile } from "../app/characterFiles";
import { createLongStoryShortExport, type ExportCharacter } from "../app/exportFormats";

const empty: ExportCharacter = {
  name: "", playerName: "", race: "", raceVariant: "", className: "", subclass: "", background: "",
  classSkills: [], backgroundSkills: [], level: 1, spells: [], abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  equipmentSelections: {}, currency: { gp: 0, sp: 0, cp: 0, pp: 0 }, alignment: "",
  personality: { traits: "", ideals: "", bonds: "", flaws: "" },
};

function textOf(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(textOf).join(" ");
  if (value && typeof value === "object") return Object.values(value as Record<string, unknown>).map(textOf).join(" ");
  return "";
}

test("real LSS 2024 fixture keeps rules edition, sheet edition, cards and spell groups", () => {
  const fixture = JSON.parse(readFileSync(new URL("./fixtures/lss-2024-pirs.json", import.meta.url), "utf8"));
  assert.equal(fixture.edition, "2014");
  assert.equal(fixture.sheetEdition, "2024");
  assert.equal(fixture.spells.mode, "cards");

  const imported = parseCharacterFile(fixture, empty).character;
  const exported = createLongStoryShortExport({ character: imported, spells, raceFeatureList: [], classFeatureList: [] }, { sheetEdition: "2024" });
  assert.equal(exported.edition, "2014");
  assert.equal(exported.sheetEdition, "2024");
  assert.equal(exported.spells.edition, "2014");
  for (const cardId of fixture.spells.prepared) assert(exported.spells.prepared.includes(cardId));

  const inner = JSON.parse(exported.data);
  for (const spellId of imported.spells) {
    const spell = spells.find(item => item.id === spellId);
    if (!spell) continue;
    assert.match(textOf(inner.text[`spells-level-${spell.level}`]), new RegExp(spell.name, "iu"));
  }
});

test("LSS creates only confirmed cards while retaining every spell in text", () => {
  const character: ExportCharacter = {
    ...empty, name: "Проверка карточек", className: "wizard", level: 3,
    spells: ["firebolt", "silvery"], preparedSpells: ["silvery"],
  };
  const exported = createLongStoryShortExport({ character, spells, raceFeatureList: [], classFeatureList: [] }, { sheetEdition: "2024" });
  const inner = JSON.parse(exported.data);
  const cards = [...exported.spells.prepared, ...exported.spells.book];

  assert.equal(exported.edition, "2014");
  assert.equal(exported.sheetEdition, "2024");
  assert.deepEqual(cards, ["65d3c168f3d820fa1add425f"]);
  assert.match(textOf(inner.text["spells-level-0"]), /Огненный снаряд/iu);
  assert.match(textOf(inner.text["spells-level-1"]), /Искусная острота/iu);
});
