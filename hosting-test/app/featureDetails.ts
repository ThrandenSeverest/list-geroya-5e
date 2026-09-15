import type { Feature } from "./rules";
import { classFeatureCorpus, optionalClassFeatureCorpus, subclassFeatureCorpus } from "./generatedRulesCorpus";

/**
 * Finished characters must keep the complete rules text that is already attached
 * to a feature. Compact builder-era descriptions are never allowed to replace it.
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

/**
 * Some builder labels intentionally differ from the Russian names used by the
 * canonical corpus. Keep explicit aliases for known translation variants.
 */
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
 * Last-resort resolver for catalog/corpus naming differences. The compact
 * subclass object still contains feature names, so a unique overlap identifies
 * the canonical subclass without ever borrowing descriptions from another one.
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
  const sourceBase = classFeatureCorpus[classId]?.length ? classFeatureCorpus[classId] : fallbackClass;
  const base = withoutSubclassSelector(classId, subclassName, sourceBase);
  const subclassEntries = subclassFeatureCorpus[classId] || {};
  const documentedSubclass =
    subclassByName(classId, subclassName, subclassEntries)
    || subclassByFeatureOverlap(subclassEntries, fallbackSubclass);
  const optional = includeOptional
    ? (optionalClassFeatureCorpus[classId]?.length ? optionalClassFeatureCorpus[classId] : fallbackOptional)
    : [];

  return detailedFeatures([
    ...base,
    ...(documentedSubclass?.length ? documentedSubclass : fallbackSubclass),
    ...optional,
  ]);
}
