import type { ExportCharacter } from './exportFormats';
import { spells, type CatalogSpell } from './catalog';
import { orderedCharacterClasses } from './multiclass';
import { spellSelectionRuleForClass } from './characterRules';

/** Level edits do not constitute a rest. Prune only choices that become illegal. */
export function retainLevelState(before: ExportCharacter, after: ExportCharacter, catalog: CatalogSpell[] = spells): ExportCharacter {
  const classes = orderedCharacterClasses(after);
  const legal = new Map<string, Set<string>>();
  for (const entry of classes) {
    const previous = orderedCharacterClasses(before).find(row => row.classId === entry.classId);
    const ids = before.spellGrants?.length ? before.spellGrants.filter(grant => grant.classId === entry.classId && grant.mode !== 'always-prepared').map(grant => grant.spellId) : entry.classId === before.className ? before.spells : [];
    if (previous && entry.level >= previous.level) { legal.set(entry.classId, new Set(ids)); continue; }
    const rule = spellSelectionRuleForClass({ ...after, homebrew: before.homebrew }, entry.classId, entry.level);
    let cantrips = 0, leveled = 0;
    legal.set(entry.classId, new Set(ids.filter(id => {
      const spell = catalog.find(row => row.id === id);
      if (!spell) return true; // Unknown imported definitions must not be silently erased.
      if (!rule.caster || spell.level > rule.maxLevel) return false;
      return spell.level === 0 ? cantrips++ < rule.cantrips : leveled++ < rule.leveled;
    })));
  }
  const spellGrants = before.spellGrants?.filter(grant => !grant.classId || (grant.mode === 'always-prepared' ? classes.some(entry => entry.classId === grant.classId) : legal.get(grant.classId)?.has(grant.spellId)));
  const retained = new Set([...legal.values()].flatMap(ids => [...ids]));
  for (const grant of spellGrants || []) retained.add(grant.spellId);
  const preparedSpellsByClass = Object.fromEntries(Object.entries(before.preparedSpellsByClass || {}).filter(([id]) => legal.has(id)).map(([id, values]) => {
    const entry = classes.find(row => row.classId === id)!;
    const rule = spellSelectionRuleForClass({ ...after, homebrew: before.homebrew }, id, entry.level);
    return [id, values.filter(spell => legal.get(id)?.has(spell)).slice(0, rule.prepared ?? values.length)];
  }));
  return { ...after, spells: before.spells.filter(id => retained.has(id)), spellGrants,
    preparedSpellsByClass: before.preparedSpellsByClass ? preparedSpellsByClass : undefined,
    preparedSpells: before.preparedSpellsByClass ? [...new Set(Object.values(preparedSpellsByClass).flat())] : before.preparedSpells?.filter(id => retained.has(id)),
    spellSlotsUsed: before.spellSlotsUsed, pactSlotsUsed: before.pactSlotsUsed, resourceSpent: before.resourceSpent };
}
