import assert from 'node:assert/strict';
import { characterResources, resourceCurrent } from '../app/characterResources';
import { raceVariants } from '../app/characterRules';
import { resolvedRaceFeatures, racialTraitKey } from '../app/racialTraits';
import type { ExportCharacter } from '../app/exportFormats';

const hero = (race: string, raceVariant = 'base', level = 9) => ({ race, raceVariant, level, className: 'wizard', abilities: { str: 16, dex: 12, con: 14, int: 14, wis: 10, cha: 8 }, feats: [], advancements: [] } as unknown as ExportCharacter);
for (const [level, expected] of [[1,2], [5,3], [9,4], [13,5], [17,6]]) {
  const resource = characterResources(hero('orc', 'base', level)).find(r => r.key === 'adrenaline-rush')!;
  assert.equal(resource.max, expected);
  assert.equal(resource.isShortRest, false);
  assert.equal(resourceCurrent({...hero('orc', 'base', level), resourceSpent: {'adrenaline-rush': 1}}, resource), expected - 1);
}
for (const variant of ['base', 'motm-111']) {
  const traits = resolvedRaceFeatures('orc', variant);
  assert.equal(traits.length, 4);
  const adrenaline = traits.find(f => f.name === 'Выброс адреналина')!;
  assert.match(adrenaline.description, /временных хитов, равное вашему бонусу мастерства/);
  assert.match(adrenaline.description, /количество раз, равное вашему бонусу мастерства/);
}
for (const variant of ['legacy-vgm', 'legacy-eberron']) {
  assert(!resolvedRaceFeatures('orc', variant).some(f => /адреналин|стойкость/i.test(f.name)));
  assert(!characterResources(hero('orc', variant)).some(r => /adrenaline|relentless/.test(r.key)));
}
const multiclass = {...hero('orc'), classes: [{classId:'barbarian', level:3, subclassId:'wildmagic', acquiredAtCharacterLevel:1}, {classId:'wizard', level:6, acquiredAtCharacterLevel:4}]};
const pools = characterResources(multiclass);
assert.equal(pools.filter(r => r.key === 'adrenaline-rush').length, 1);
assert.equal(pools.find(r => r.key === 'adrenaline-rush')!.max, 4);
assert.equal(pools.find(r => r.key === 'rage')!.max, 3);
for (const [race, legacy, key, oldShort] of [
  ['goliath','legacy-ee','stones-endurance',true], ['firbolg','legacy-vgm','hidden-step',true],
  ['goblin','legacy-vgm','fury-of-the-small',true], ['eladrin','legacy-mtf','fey-step',true],
  ['shadarkai','legacy-mtf','blessing-raven-queen',false], ['lizardfolk','legacy-vgm','hungry-jaws',true],
] as const) {
  const modern = characterResources(hero(race)).find(r => r.key === key)!;
  const old = characterResources(hero(race, legacy)).find(r => r.key === key)!;
  assert.equal(modern.max, 4, race); assert.equal(modern.isShortRest, false, race);
  assert.equal(old.max, 1, race); assert.equal(old.isShortRest, oldShort, race);
}
assert(!resolvedRaceFeatures('duergar','base').some(f => /солнеч|солнц/i.test(f.name)));
assert(!resolvedRaceFeatures('yuanpure','legacy-vgm').some(f => f.name === 'Стойкость к яду'));
for (const [race, variants] of Object.entries(raceVariants)) for (const variant of variants) {
  const traits = resolvedRaceFeatures(race, variant.id);
  assert.equal(new Set(traits.map(f => racialTraitKey(f.name))).size, traits.length, `${race}/${variant.id}`);
}
console.log('Racial regression checks passed: PB levels, multiclass, legacy separation, spent uses, all variant trait keys.');
