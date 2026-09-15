import type { Feature } from "./rules";
import { classFeatureCorpus, optionalClassFeatureCorpus, subclassFeatureCorpus } from "./generatedRulesCorpus";
import { sheetClassFeatures, sheetOptionalFeatures, sheetSubclassFeatures } from "./generatedSheetRules";

/**
 * Finished characters use canonical rules text, but the final sheet is not a
 * rules encyclopedia. Infrastructure already represented elsewhere on the
 * sheet (spellcasting boilerplate, ASI bookkeeping) is omitted here.
 */
export function detailedFeature(feature: Feature): Feature {
  return { ...feature, description: feature.description?.trim() || "" };
}

export function detailedFeatures(features: Feature[]) {
  return features.map(detailedFeature);
}

function normalizedFeatureKey(value: string) {
  return value
    .toLocaleLowerCase("ru-RU")
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9]+/g, " ")
    .trim();
}

const FINAL_SHEET_HIDDEN_CLASS_FEATURES = new Set([
  "использование заклинаний",
  "увеличение характеристик",
  "увеличение значения характеристик",
  "первобытное знание",
  "многогранность барда",
  "универсальность заговоров",
  "воинская универсальность tce",
  "многогранность воина tcoe",
]);

function usefulFinalClassFeature(feature: Feature) {
  return !FINAL_SHEET_HIDDEN_CLASS_FEATURES.has(normalizedFeatureKey(feature.name));
}

const SUBCLASS_SELECTOR_FEATURES: Record<string, string[]> = {
  barbarian: ["Путь дикости", "Путь варвара"],
  bard: ["Коллегия бардов"],
  cleric: ["Божественный домен"],
  druid: ["Круг друидов"],
  fighter: ["Воинский архетип"],
  monk: ["Монастырская традиция"],
  paladin: ["Священная клятва"],
  ranger: ["Архетип следопыта"],
  rogue: ["Плутовской архетип", "Архетип плута"],
  sorcerer: ["Чародейское происхождение", "Происхождение чародея"],
  warlock: ["Потусторонний покровитель", "Покровитель"],
  wizard: ["Магическая традиция"],
  artificer: ["Специализация изобретателя"],
};

/** Builder/catalog labels sometimes differ from canonical Russian corpus names. */
const SUBCLASS_NAME_ALIASES: Record<string, Record<string, string>> = {
  ranger: {
    "убийца монстров": "убийца чудовищ",
  },
};

function withoutSubclassSelector(classId: string, subclassName: string | undefined, features: Feature[]) {
  if (!subclassName?.trim()) return features;
  const selectors = new Set(SUBCLASS_SELECTOR_FEATURES[classId] || []);
  return features.filter(feature => !selectors.has(feature.name));
}

function subclassByName(
  classId: string,
  subclassName: string | undefined,
  entries: Record<string, Feature[]>,
) {
  const wantedRaw = normalizedFeatureKey(subclassName || "");
  if (!wantedRaw) return undefined;
  const wanted = SUBCLASS_NAME_ALIASES[classId]?.[wantedRaw] || wantedRaw;
  return Object.entries(entries).find(([name]) => {
    const key = normalizedFeatureKey(name);
    return key === wanted || key.startsWith(wanted) || wanted.startsWith(key);
  })?.[1];
}

/**
 * Last-resort resolver for catalog/corpus naming differences. A unique overlap
 * of feature names identifies the canonical subclass without borrowing text
 * from another subclass.
 */
function subclassByFeatureOverlap(entries: Record<string, Feature[]>, fallbackSubclass: Feature[]) {
  const fallbackNames = new Set(
    fallbackSubclass.map(feature => normalizedFeatureKey(feature.name)).filter(Boolean),
  );
  if (!fallbackNames.size) return undefined;

  const ranked = Object.values(entries)
    .map(features => ({
      features,
      score: features.reduce(
        (total, feature) => total + (fallbackNames.has(normalizedFeatureKey(feature.name)) ? 1 : 0),
        0,
      ),
    }))
    .sort((left, right) => right.score - left.score);

  const best = ranked[0];
  const runnerUp = ranked[1];
  if (!best || best.score <= 0) return undefined;
  if (runnerUp && runnerUp.score === best.score) return undefined;
  return best.features;
}

export function documentedClassFeatures(
  classId: string,
  subclassName: string | undefined,
  includeOptional: boolean,
  fallbackClass: Feature[],
  fallbackSubclass: Feature[],
  fallbackOptional: Feature[],
) {
  const sourceBase = sheetClassFeatures[classId]?.length
    ? sheetClassFeatures[classId]
    : classFeatureCorpus[classId]?.length ? classFeatureCorpus[classId] : fallbackClass;
  const base = withoutSubclassSelector(classId, subclassName, sourceBase);
  const subclassEntries = Object.keys(sheetSubclassFeatures[classId] || {}).length
    ? sheetSubclassFeatures[classId]
    : subclassFeatureCorpus[classId] || {};
  const documentedSubclass =
    subclassByName(classId, subclassName, subclassEntries)
    || subclassByFeatureOverlap(subclassEntries, fallbackSubclass);
  const optional = includeOptional
    ? (sheetOptionalFeatures[classId]?.length
      ? sheetOptionalFeatures[classId]
      : optionalClassFeatureCorpus[classId]?.length ? optionalClassFeatureCorpus[classId] : fallbackOptional)
    : [];

  return detailedFeatures([
    ...base,
    ...(documentedSubclass?.length ? documentedSubclass : fallbackSubclass),
    ...optional,
  ]).filter(usefulFinalClassFeature);
}
