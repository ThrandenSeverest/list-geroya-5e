import test from 'node:test';
import assert from 'node:assert/strict';
import { backgroundStartingGold, backgroundEquipmentWithoutStartingGold, startingGoldFromBackgroundEquipment } from '../app/backgroundRules';
import { copyHomebrew } from '../app/homebrewCopy';
import { multiclassRequirement } from '../app/multiclass';
import { finalAbilityScores } from '../app/characterRules';
import { retainLevelState } from '../app/levelState';
import type { ExportCharacter } from '../app/exportFormats';
import type { HomebrewElement } from '../app/homebrew';
import shaman from '../app/shamanExample.json';

const hero = { race: 'tiefling', raceVariant: 'base', className: 'wizard', level: 3, startingClassId: 'wizard', classes: [{ classId: 'wizard', level: 3, acquiredAtCharacterLevel: 1 }], abilities: { str: 10, dex: 10, con: 10, int: 15, wis: 10, cha: 12 }, spells: ['mage-hand', 'magic-missile'], preparedSpells: ['magic-missile'], preparedSpellsByClass: { wizard: ['magic-missile'] }, spellSlotsUsed: [1, 1], pactSlotsUsed: 1, resourceSpent: { luck: 1 } } as unknown as ExportCharacter;

test('Cyrillic gold phrases populate wallet once and leave inventory', () => {
  assert.equal(backgroundStartingGold('sage'), 10);
  assert.equal(backgroundStartingGold('hermit'), 5);
  assert.equal(backgroundStartingGold('noble'), 25);
  assert.equal(startingGoldFromBackgroundEquipment(['Кошель с 15 зм', '5 зм', '10 змей']), 20);
  assert.deepEqual(backgroundEquipmentWithoutStartingGold(['Кошель с 15 зм', 'Посох']), ['Посох']);
});
test('multiclass uses final Charisma 14 and checks the current class', () => {
  const effective = { ...hero, abilities: finalAbilityScores(hero) };
  assert.equal(effective.abilities.cha, 14);
  assert.equal(multiclassRequirement(effective, 'bard').passed, true);
  assert.equal(multiclassRequirement({ ...effective, abilities: { ...effective.abilities, int: 12 } }, 'bard').passed, false);
});
test('level increase preserves spells, preparation and spent resources', () => {
  const after = retainLevelState(hero, { ...hero, level: 4, classes: [{ classId: 'wizard', level: 4, acquiredAtCharacterLevel: 1 }] });
  for (const key of ['spells', 'preparedSpells', 'preparedSpellsByClass', 'spellSlotsUsed', 'pactSlotsUsed', 'resourceSpent'] as const) assert.deepEqual(after[key], hero[key]);
});
test('removing a secondary class keeps surviving sources of duplicate spells', () => {
  const before = { ...hero, classes: [...hero.classes!, { classId: 'warlock', level: 1, acquiredAtCharacterLevel: 4 }], spells: ['mage-hand', 'magic-missile', 'eldritch'], spellGrants: [{ spellId: 'mage-hand', classId: 'wizard', sourceType: 'class', sourceId: 'wizard', mode: 'known' }, { spellId: 'mage-hand', classId: 'warlock', sourceType: 'class', sourceId: 'warlock', mode: 'known' }, { spellId: 'magic-missile', classId: 'wizard', sourceType: 'class', sourceId: 'wizard', mode: 'spellbook' }, { spellId: 'eldritch', classId: 'warlock', sourceType: 'class', sourceId: 'warlock', mode: 'known' }] } as ExportCharacter;
  const after = retainLevelState(before, hero);
  assert.deepEqual(after.spells, hero.spells);
  assert.equal(after.spellGrants?.some(grant => grant.classId === 'warlock'), false);
  assert.deepEqual(after.resourceSpent, hero.resourceSpent);
});
test('copy Shaman preserves progression and settings and isolates its dependencies', () => {
  const entities = shaman.entities as unknown as HomebrewElement[];
  const root = entities.find(entity => entity.id === shaman.rootId)!;
  const old = JSON.stringify(entities);
  const copy = copyHomebrew(root, entities);
  assert.notEqual(copy.root.id, root.id);
  assert.equal(copy.root.hitDie, root.hitDie);
  assert.deepEqual(Object.keys(copy.root.advancement || {}), Object.keys(root.advancement || {}));
  assert.ok(copy.related.length > 0);
  const serialized = JSON.stringify([copy.root, ...copy.related]);
  for (const entity of entities) assert.equal(serialized.includes(entity.id), false, entity.id);
  assert.equal(JSON.stringify(entities), old);
});

test('lowering caster level prunes unavailable spells without granting a rest', () => {
  const before = { ...hero, spells: ['mage-hand', 'magic-missile', 'mistystep'], preparedSpells: ['magic-missile', 'mistystep'], preparedSpellsByClass: { wizard: ['magic-missile', 'mistystep'] } };
  const after = retainLevelState(before, { ...before, level: 1, classes: [{ classId: 'wizard', level: 1, acquiredAtCharacterLevel: 1 }] });
  assert.deepEqual(after.spells, ['mage-hand', 'magic-missile']);
  assert.deepEqual(after.preparedSpellsByClass?.wizard, ['magic-missile']);
  assert.deepEqual(after.spellSlotsUsed, before.spellSlotsUsed);
  assert.deepEqual(after.resourceSpent, before.resourceSpent);
});
