import type { Feature } from "./rules";
export type EffectHandling = "automatic" | "conditional" | "manual";

// Curated catalogue keys only. Unknown features stay unmarked until reviewed.
const classHandling: Record<string, Record<string, EffectHandling>> = {
  barbarian: { "Быстрое передвижение": "conditional", "Ярость": "manual" },
  bard: { "Мастер на все руки": "automatic" },
  fighter: { "Всплеск действий": "manual" },
  rogue: { "Скрытая атака": "manual" },
};
const raceHandling: Record<string, Record<string, EffectHandling>> = {
  tabaxi: { "Кошачья ловкость": "conditional", "Кошачье проворство": "conditional", "Кошачьи когти": "automatic" },
  tortle: { "Когти": "automatic", "Защита панцирем": "conditional", "Защита в панцире": "conditional" },
  minotaur: { "Рога": "automatic", "Бодание с разбега": "conditional" },
  centaur: { "Копыта": "automatic", "Разбег": "conditional" },
  aarakocra: { "Когти": "automatic" },
  leonin: { "Когти": "automatic" },
  lizardfolk: { "Укус": "automatic", "Голодная пасть": "conditional" },
  dhampir: { "Вампирский укус": "automatic" },
  shifter: { "Клыки длиннозуба": "conditional" },
};
const featHandling: Record<string, EffectHandling> = {
  alert: "automatic", observant: "automatic", mobile: "automatic", "medium-armor-master": "automatic",
  "defensive-duelist": "conditional", "dual-wielder": "conditional",
};

export function markFeature(feature: Feature, source: "class" | "race" | "feat", id: string, featId?: string): Feature {
  const name = source === "class" ? feature.name.split(" · ").at(-1) || feature.name : feature.name;
  const effectHandling = source === "class" ? classHandling[id]?.[name]
    : source === "race" ? raceHandling[id]?.[name] : featHandling[featId || ""];
  return effectHandling ? { ...feature, effectHandling } : feature;
}
export function effectHandlingLabel(handling: EffectHandling | undefined) {
  return handling === "automatic" ? "Учтено автоматически"
    : handling === "conditional" ? "Условный эффект" : handling === "manual" ? "Применяется вручную" : "";
}
