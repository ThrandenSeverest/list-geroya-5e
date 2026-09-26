import { classPreparedSpellIds } from "./spellPreparation";
import { classes, type CatalogSpell } from "./catalog";
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

/**
 * HB classes are real classes for the duration of the character sheet, but
 * their ids are intentionally not part of the built-in catalog. Register
 * their display names in the shared catalog view so every existing consumer
 * (mobile sheet, spellcasting summary and PDF) resolves the same name instead
 * of leaking ids such as hb:shaman:class:shaman.
 */
function registerHomebrewClasses(character: ExportCharacter) {
  for (const entry of orderedCharacterClasses(character)) {
    if (!entry.classId.startsWith("hb:")) continue;
    if (classes.some(item => item.id === entry.classId)) continue;
    const definition = character.homebrew?.entities?.find(item => item.id === entry.classId && item.type === "class");
    if (definition?.name) classes.push({ id: entry.classId, name: definition.name });
  }
}

/** Keep class associations even when two classes grant the same catalog spell. */
export function classSpellGroups(character: ExportCharacter, catalog: CatalogSpell[]): ClassSpellGroup[] {
  registerHomebrewClasses(character);
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

/** Resolve an internal source id to a user-facing name for exports. */
export function spellSourceDisplayName(
  sourceId: string,
  character: ExportCharacter,
  classCatalog: { id: string; name: string }[],
): string {
  const catalogName = classCatalog.find(item => item.id === sourceId)?.name;
  if (catalogName) return catalogName;

  const hbDefinition = character.homebrew?.entities?.find(item => item.id === sourceId && item.type === "class");
  if (hbDefinition?.name) return hbDefinition.name;

  return sourceId.startsWith("hb:") ? "Хоумбрю" : sourceId;
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
