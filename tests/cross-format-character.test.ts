import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { spells } from "../app/catalog";
import { PdfCharacterSheet } from "../app/PdfCharacterSheet";
import { armorClass } from "../app/armor";
import { characterAttacks, lssWeaponAttacks } from "../app/combat";
import { passivePerceptionBreakdown } from "../app/derivedSkills";
import { markFeature } from "../app/featureHandling";
import { createHelpmateExport, createLongStoryShortExport, estimatedHitPoints, type ExportCharacter } from "../app/exportFormats";
import { initiativeBreakdown } from "../app/initiative";
import { resolvePactMagic, resolveSpellSlots } from "../app/multiclass";
import { speedBreakdown } from "../app/speed";
import { classSpellGroups } from "../app/spellSources";
import { migrateSpellPreparation } from "../app/spellPreparation";

const character: ExportCharacter = migrateSpellPreparation({
  name: "Тестовый герой", playerName: "", experience: 0, className: "wizard", level: 7,
  race: "tabaxi", raceVariant: "legacy-vgm", background: "", classSkills: [], backgroundSkills: ["Внимательность"],
  classes: [{ classId: "wizard", level: 5, acquiredAtCharacterLevel: 1 }, { classId: "warlock", level: 2, acquiredAtCharacterLevel: 6 }],
  abilities: { str: 10, dex: 14, con: 14, int: 16, wis: 12, cha: 16 },
  inventoryOverride: "Кинжал", currency: { gp: 0, sp: 0, cp: 0, pp: 0 }, alignment: "",
  personality: { traits: "", ideals: "", bonds: "", flaws: "" },
  spells: ["firebolt", "eldritch", "detectmagic"], preparedSpells: ["detectmagic"],
  spellGrants: [
    { spellId: "firebolt", classId: "wizard", sourceId: "wizard", sourceType: "class", mode: "known" },
    { spellId: "detectmagic", classId: "wizard", sourceId: "wizard", sourceType: "class", mode: "spellbook" },
    { spellId: "eldritch", classId: "warlock", sourceId: "warlock", sourceType: "class", mode: "known" },
  ],
} as ExportCharacter);

test("a multiclass fixture agrees across sheet, PDF, LSS, Helpmate and native JSON", () => {
  const hero = JSON.parse(JSON.stringify(character)) as ExportCharacter;
  const ac = armorClass(hero), initiative = initiativeBreakdown(hero).value;
  const speed = speedBreakdown(hero).walk, hp = estimatedHitPoints(hero);
  const passive = passivePerceptionBreakdown(hero).value;
  const attacks = characterAttacks(hero, spells), slots = resolveSpellSlots(hero), pact = resolvePactMagic(hero);
  assert.deepEqual([ac, initiative, speed, hp, passive], [12, 2, 30, 46, 14]);
  assert.deepEqual(slots, [4, 3, 2]); assert.deepEqual(pact, { slots: 2, level: 1 });
  assert.equal(attacks.filter(attack => attack.name.includes("луч")).length, 2);
  const context = { character: hero, spells, raceFeatureList: [], classFeatureList: [] };
  const helpmate = createHelpmateExport(context);
  const lss = JSON.parse(createLongStoryShortExport(context).data);
  assert.deepEqual([helpmate.Armor, helpmate.IniBonus, helpmate.Speed, helpmate.HitPoints, helpmate.Bditelnost], [ac, initiative, speed, hp, passive]);
  assert.equal(lss.vitality.ac.value, ac); assert.equal(lss.vitality.speed.value, speed);
  assert.equal(lss.vitality["hp-max"].value, hp);
  assert.deepEqual(slots.map((_, i) => lss.spells[`slots-${i + 1}`].value), slots);
  assert.equal(lss.spellsPact.slots.value, pact.slots);
  assert.deepEqual(lss.weaponsList.map((attack: { dmg: { value: string } }) => attack.dmg.value), lssWeaponAttacks(attacks).map(attack => attack.dmg.value));
  assert(helpmate.Classes.some((item: { SpellCells: Array<{ Level: number; Max: number }> }) => item.SpellCells.some(cell => cell.Level === 3 && cell.Max === 2)));
  assert(helpmate.Classes.some((item: { SpellCells: Array<{ Level: number; Max: number }> }) => item.SpellCells.some(cell => cell.Level === 1 && cell.Max === 2)));
  const pdf = renderToStaticMarkup(createElement(PdfCharacterSheet, {
    identity: { name: hero.name, playerName: "", experience: 0, inspiration: false, className: "Волшебник / Колдун", raceName: "Табакси", backgroundName: "", alignment: "", level: 7 },
    classId: "wizard", abilities: hero.abilities, proficiency: 3, savingThrows: [],
    proficiencies: { skills: ["Внимательность"], expertise: [], armor: [], weapons: [], tools: [], languages: [] },
    ac, initiative, speed, hitPoints: hp, hitDie: 6, passivePerception: passive, attacks, resources: [],
    classFeatures: [markFeature({ name: "Воин · Всплеск действий", description: "Дополнительное действие." }, "class", "fighter")], raceFeatures: [], featFeatures: [], backgroundFeature: { name: "", description: "" },
    equipment: ["Кинжал"], currency: hero.currency, personality: hero.personality,
    spellAbility: "Интеллект", spellSaveDc: 14, spellAttackBonus: 6, spellSlots: slots, pactSlots: pact,
    spells: classSpellGroups(hero, spells).flatMap(group => group.spells.map(({ spell, prepared, alwaysPrepared }) => ({ ...spell, prepared, alwaysPrepared, classSource: group.classId }))),
  }));
  assert.match(pdf, /Тестовый герой/);
  assert.match(pdf, /Договор · 1 круг/);
  assert.match(pdf, /detectmagic|Обнаружение магии/);
  assert.match(pdf, /Кинжал/);
  assert.match(pdf, /Применяется вручную/);
});
