import type { AbilityScores, ExportCharacter, CharacterClassProgress, CharacterLevelEntry } from "./exportFormats";
import { classRules } from "./rules";

/** 2014/Legacy multiclass support. `className` and `level` remain a read-only
 * compatibility view for older screens; `classes` and `levelHistory` are the
 * source of truth for every multiclass-aware calculation. */
export const multiclassRuleset = "5e-2014" as const;

export function classProgresses(character: ExportCharacter): CharacterClassProgress[] {
  const valid = (character.classes || []).filter(entry => entry.classId && entry.level > 0);
  if (valid.length) return valid;
  if (!character.className) return [];
  return [{ classId: character.className, level: Math.max(1, character.level || 1), subclassId: character.subclass || "", acquiredAtCharacterLevel: 1, classSkills: character.classSkills || [] }];
}

export function characterLevel(character: ExportCharacter) {
  const classes = classProgresses(character);
  return classes.length ? classes.reduce((sum, entry) => sum + entry.level, 0) : Math.max(1, character.level || 1);
}

export function getClassProgress(character: ExportCharacter, classId: string) {
  return classProgresses(character).find(entry => entry.classId === classId);
}

export function getClassLevel(character: ExportCharacter, classId: string) {
  return getClassProgress(character, classId)?.level || 0;
}

export function hasClass(character: ExportCharacter, classId: string) {
  return getClassLevel(character, classId) > 0;
}

export function getStartingClassId(character: ExportCharacter) {
  return character.startingClassId || classProgresses(character)[0]?.classId || character.className;
}

export function orderedCharacterClasses(character: ExportCharacter) {
  const starting = getStartingClassId(character);
  return [...classProgresses(character)].sort((a, b) => {
    if (a.classId === starting) return -1;
    if (b.classId === starting) return 1;
    return a.acquiredAtCharacterLevel - b.acquiredAtCharacterLevel;
  });
}

export function isMulticlass(character: ExportCharacter) {
  return classProgresses(character).length > 1;
}

export function normalizedLevelHistory(character: ExportCharacter): CharacterLevelEntry[] {
  if ((character.levelHistory || []).length === characterLevel(character)) return [...character.levelHistory!];
  const history: CharacterLevelEntry[] = [];
  for (const entry of orderedCharacterClasses(character)) {
    for (let level = 1; level <= entry.level; level += 1) history.push({ characterLevel: history.length + 1, classId: entry.classId, classLevelAfter: level });
  }
  return history;
}

export function migrateMulticlassCharacter(character: ExportCharacter): ExportCharacter {
  const classes = orderedCharacterClasses(character);
  const totalLevel = classes.reduce((sum, entry) => sum + entry.level, 0) || 1;
  const startingClassId = character.startingClassId || classes[0]?.classId || character.className;
  const levelHistory = (character.levelHistory || []).length === totalLevel ? character.levelHistory! : normalizedLevelHistory({ ...character, classes, startingClassId });
  const starting = classes.find(entry => entry.classId === startingClassId) || classes[0];
  return {
    ...character,
    schemaVersion: 4,
    rulesetId: "5e-2014",
    startingClassId,
    classes,
    levelHistory,
    // Compatibility view for older UI fragments. It always represents the
    // starting class, while class-aware callers must use getClassLevel().
    className: starting?.classId || character.className,
    subclass: starting?.subclassId || character.subclass,
    level: totalLevel,
    hitDiceSpentByClass: character.hitDiceSpentByClass || (starting ? { [starting.classId]: character.hitDiceSpent || 0 } : {}),
  };
}

export function classView(character: ExportCharacter, entry: CharacterClassProgress): ExportCharacter {
  return { ...character, className: entry.classId, subclass: entry.subclassId || "", level: entry.level, classSkills: entry.classSkills || [] };
}

const prerequisites: Record<string, Array<keyof AbilityScores>> = {
  barbarian: ["str"], bard: ["cha"], cleric: ["wis"], druid: ["wis"],
  fighter: [], monk: ["dex", "wis"], paladin: ["str", "cha"], ranger: ["dex", "wis"],
  rogue: ["dex"], sorcerer: ["cha"], warlock: ["cha"], wizard: ["int"], artificer: ["int"],
};

export function multiclassRequirement(character: ExportCharacter, classId: string) {
  const needs = prerequisites[classId] || [];
  const alternatives = classId === "fighter" ? ["str", "dex"] as Array<keyof AbilityScores> : [];
  const passed = alternatives.length ? alternatives.some(key => character.abilities[key] >= 13) : needs.every(key => character.abilities[key] >= 13);
  const labels: Record<keyof AbilityScores, string> = { str: "Сила", dex: "Ловкость", con: "Телосложение", int: "Интеллект", wis: "Мудрость", cha: "Харизма" };
  const required = alternatives.length ? alternatives.map(key => `${labels[key]} 13`).join(" или ") : needs.map(key => `${labels[key]} 13`).join(" и ");
  return { passed, required, missing: alternatives.length ? (passed ? [] : alternatives.map(key => `${labels[key]} ${character.abilities[key]}`)) : needs.filter(key => character.abilities[key] < 13).map(key => `${labels[key]} ${character.abilities[key]}`) };
}

const fullCasterSlots = [[], [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1], [4, 3, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 3, 2, 2, 1, 1]];

export function spellcastingContribution(character: ExportCharacter, entry: CharacterClassProgress) {
  const level = entry.level;
  if (["bard", "cleric", "druid", "sorcerer", "wizard"].includes(entry.classId)) return level;
  if (["paladin", "ranger"].includes(entry.classId)) return Math.floor(level / 2);
  if (entry.classId === "artificer") return Math.ceil(level / 2);
  if (entry.classId === "fighter" && entry.subclassId === "eldritchknight") return Math.floor(level / 3);
  if (entry.classId === "rogue" && entry.subclassId === "arcanetrickster") return Math.floor(level / 3);
  return 0;
}

export function multiclassCasterLevel(character: ExportCharacter) {
  return orderedCharacterClasses(character).reduce((sum, entry) => sum + spellcastingContribution(character, entry), 0);
}

export function resolveSpellSlots(character: ExportCharacter) {
  const regularCasters = orderedCharacterClasses(character).filter(entry => spellcastingContribution(character, entry) > 0);
  if (!regularCasters.length) return [];
  if (regularCasters.length === 1) {
    const entry = regularCasters[0];
    const level = entry.level;
    if (["bard", "cleric", "druid", "sorcerer", "wizard"].includes(entry.classId)) return fullCasterSlots[level] || [];
    if (["paladin", "ranger"].includes(entry.classId)) return fullCasterSlots[Math.floor(level / 2)] || [];
    if (entry.classId === "artificer") return fullCasterSlots[Math.ceil(level / 2)] || [];
    if (["fighter", "rogue"].includes(entry.classId)) return fullCasterSlots[Math.floor(level / 3)] || [];
  }
  return fullCasterSlots[multiclassCasterLevel(character)] || [];
}

export function resolvePactMagic(character: ExportCharacter) {
  const level = getClassLevel(character, "warlock");
  if (!level) return { slots: 0, level: 0 };
  return { slots: level === 1 ? 1 : level < 11 ? 2 : level < 17 ? 3 : 4, level: Math.min(5, Math.ceil(level / 2)) };
}

export function hitDicePools(character: ExportCharacter) {
  const spent = character.hitDiceSpentByClass || {};
  const pools = new Map<number, { die: number; max: number; spent: number; sources: string[] }>();
  for (const entry of orderedCharacterClasses(character)) {
    const die = classRules[entry.classId]?.hitDie || 8;
    const pool = pools.get(die) || { die, max: 0, spent: 0, sources: [] };
    pool.max += entry.level;
    pool.spent += Math.min(entry.level, spent[entry.classId] || 0);
    pool.sources.push(entry.classId);
    pools.set(die, pool);
  }
  return [...pools.values()].sort((a, b) => b.die - a.die);
}
