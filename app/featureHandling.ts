import type { Feature } from "./rules";
export type EffectHandling = "automatic" | "conditional" | "manual";

// Only verified calculations are automatic. Unhandled effects require manual use.
// Never infer automation from translated prose.
const classHandling: Record<string, Record<string, EffectHandling>> = {
  barbarian: { "Быстрое передвижение": "conditional", "Ярость": "conditional", "Защита без доспехов": "conditional", "Безрассудная атака": "conditional", "Форма зверя": "conditional" },
  bard: { "Мастер на все руки": "automatic" },
  fighter: { "Всплеск действий": "manual" },
  rogue: { "Скрытая атака": "conditional", "Психические клинки": "conditional", "Увёртливость": "conditional" },
  monk: { "Боевые искусства": "conditional", "Защита без доспехов": "conditional", "Движение без доспехов": "conditional", "Руки астрального тела": "conditional", "Луч сияющего солнца": "conditional" },
  paladin: { "Божественная кара": "conditional", "Улучшенная божественная кара": "conditional", "Аура защиты": "conditional" },
  ranger: { "Спутник-дрейк": "conditional", "Дрейк-спутник": "conditional", "Убийца колоссов": "conditional" },
  artificer: { "Мистическая пушка": "conditional", "Стальной защитник": "conditional", "Модель доспеха": "conditional" },
  druid: { "Дикий облик": "manual", "Симбиотическая сущность": "conditional" },
  cleric: { "Божественный удар": "conditional", "Могущественное колдовство": "conditional" },
  warlock: { "Мистические воззвания": "conditional" },
  sorcerer: { "Стихийное родство": "conditional" },
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
  alert: "conditional", observant: "conditional", mobile: "conditional", "medium-armor-master": "conditional",
  "defensive-duelist": "conditional", "dual-wielder": "conditional",
};

export function markFeature(feature: Feature, source: "class" | "race" | "feat" | "background" | "custom", id: string, featId?: string): Feature {
  const name = source === "class" ? feature.name.split(" · ").at(-1) || feature.name : feature.name;
  const effectHandling = feature.effectHandling || (source === "class" ? classHandling[id]?.[name]
    : source === "race" ? raceHandling[id]?.[name] : source === "feat" ? featHandling[featId || ""] : undefined) || "manual";
  return { ...feature, effectHandling };
}
export function effectHandlingLabel(handling: EffectHandling | undefined) {
  return handling === "automatic" ? "Учтено автоматически"
    : handling === "conditional" ? "Условный эффект" : "Применяется вручную";
}
