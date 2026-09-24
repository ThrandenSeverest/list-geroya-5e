import { classPreparedSpellIds } from "./spellPreparation";
import type { CatalogSpell } from "./catalog";
import { alwaysPreparedSpellEntries, spellSelectionRuleForClass } from "./characterRules";
import type { ExportCharacter, SpellGrant } from "./exportFormats";
import { orderedCharacterClasses } from "./multiclass";

export type SourcedSpell = {
  spell: CatalogSpell;
  classId: string;
  source: string;
  prepared: boolean;
  alwaysPrepared: boolean;
};

export type ClassSpellGroup = {
  classId: string;
  level: number;
  preparedMaximum?: number;
  spells: SourcedSpell[];
};

/** Keep class associations even when two classes grant the same catalog spell. */
export function classSpellGroups(character: ExportCharacter, catalog: CatalogSpell[]): ClassSpellGroup[] {
  const byId = new Map(catalog.map(spell => [spell.id, spell]));
  const grants: SpellGrant[] = character.spellGrants?.length ? character.spellGrants :
    character.spells.map(spellId => ({ spellId, sourceType: "class", sourceId: character.className, classId: character.className, mode: "known" }));
  return orderedCharacterClasses(character).flatMap(entry => {
    const scoped = { ...character, className: entry.classId, subclass: entry.subclassId || "", level: entry.level };
    const rule = spellSelectionRuleForClass(scoped, entry.classId, entry.level);
    if (!rule.caster) return [];
    const automatic = alwaysPreparedSpellEntries(scoped, catalog);
    const spells = new Map<string, SourcedSpell>();
    for (const grant of grants.filter(grant => grant.classId === entry.classId)) {
      const spell = byId.get(grant.spellId);
      if (!spell) continue;
      spells.set(spell.id, {
        spell, classId: entry.classId, source: grant.sourceType === "class" ? entry.classId : grant.sourceId,
        prepared: spell.level === 0 || rule.mode === "known" || classPreparedSpellIds(character, entry.classId).includes(spell.id) || grant.mode === "always-prepared",
        alwaysPrepared: grant.mode === "always-prepared",
      });
    }
    for (const grant of automatic) {
      const spell = byId.get(grant.id);
      if (!spell) continue;
      const existing = spells.get(grant.id);
      spells.set(grant.id, {
        spell, classId: entry.classId, source: grant.source,
        prepared: existing?.prepared || grant.mode === "always-prepared" || grant.mode === "known",
        alwaysPrepared: grant.mode === "always-prepared",
      });
    }
    return [{ classId: entry.classId, level: entry.level, preparedMaximum: rule.prepared,
      spells: [...spells.values()].sort((a, b) => a.spell.level - b.spell.level || a.spell.name.localeCompare(b.spell.name, "ru")) }];
  });
}

export function otherSpellSources(character: ExportCharacter, catalog: CatalogSpell[]): SourcedSpell[] {
  const casterIds = new Set(orderedCharacterClasses(character)
    .filter(entry => spellSelectionRuleForClass(character, entry.classId, entry.level).caster).map(entry => entry.classId));
  const byId = new Map(catalog.map(spell => [spell.id, spell]));
  return (character.spellGrants || []).flatMap(grant => {
    if (grant.classId && casterIds.has(grant.classId)) return [];
    const spell = byId.get(grant.spellId);
    return spell ? [{ spell, classId: "other", source: grant.sourceId || grant.sourceType,
      prepared: true, alwaysPrepared: grant.mode === "always-prepared" }] : [];
  });
}
