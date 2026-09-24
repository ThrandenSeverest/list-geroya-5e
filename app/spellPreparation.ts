import type { ExportCharacter } from "./exportFormats";
import { spells } from "./catalog";
import { spellSelectionRuleForClass } from "./characterRules";

/** Preparation V1 uses class IDs as keys. Legacy global IDs remain an export compatibility union. */
export function classPreparedSpellIds(character: ExportCharacter, classId: string): string[] {
  const explicit = character.preparedSpellsByClass?.[classId];
  if (Array.isArray(explicit)) return [...new Set(explicit.filter(id => typeof id === "string"))];
  const entry = character.classes?.find(entry => entry.classId === classId);
  const ids = character.spellGrants?.length
    ? character.spellGrants.filter(grant => grant.classId === classId && grant.mode !== "always-prepared").map(grant => grant.spellId)
    : classId === character.className ? character.spells : [];
  const rule = spellSelectionRuleForClass(character, classId, entry?.level || character.level);
  const leveled = ids.filter(id => (spells.find(spell => spell.id === id)?.level || 0) > 0);
  if (rule.mode === "prepared" && !character.mobilePreparedConfigured) return leveled.slice(0, rule.prepared || leveled.length);
  return (character.preparedSpells || []).filter(id => ids.includes(id));
}

export function migrateSpellPreparation(character: ExportCharacter): ExportCharacter {
  const classIds = character.classes?.length ? character.classes.map(entry => entry.classId) : [character.className];
  const preparedSpellsByClass = Object.fromEntries(classIds.filter(Boolean).map(id => [id, classPreparedSpellIds(character, id)]));
  return { ...character, preparationVersion: 1, preparedSpellsByClass,
    preparedSpells: [...new Set(Object.values(preparedSpellsByClass).flat())] };
}

export function setClassPreparedSpells(character: ExportCharacter, classId: string, ids: string[]): ExportCharacter {
  const migrated = migrateSpellPreparation(character);
  const preparedSpellsByClass = { ...migrated.preparedSpellsByClass, [classId]: [...new Set(ids)] };
  return { ...migrated, preparedSpellsByClass, preparedSpells: [...new Set(Object.values(preparedSpellsByClass).flat())] };
}

export function preparedSpellIds(character: ExportCharacter): string[] {
  return migrateSpellPreparation(character).preparedSpells || [];
}
