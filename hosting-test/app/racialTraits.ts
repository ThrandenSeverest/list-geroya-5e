import { raceFeatures, type Feature } from "./rules";
import { selectedRaceVariant } from "./characterRules";

// Different translations of the same trait must not become independent features.
const aliases = [
  ["Выброс адреналина", "Адреналиновый рывок", "Прилив адреналина"],
  ["Мощное телосложение", "Могучее телосложение"],
  ["Непоколебимая стойкость", "Неумолимая стойкость"],
  ["Длиннорукий", "Длинные конечности"],
  ["Лошадиное телосложение", "Конское телосложение"],
  ["Фирболгская магия", "Магия фирболгов"],
  ["Заячья реакция", "Заячье чутьё"],
  ["Заячья удача", "Счастливая работа ног"],
  ["Прыжок кролика", "Кроличий прыжок"],
  ["Экспертное копирование", "Экспертная подделка"],
  ["Бодание с разбега", "Бодание"],
  ["Отбрасывающие рога", "Сокрушительный толчок"],
  ["Лабиринтная память", "Лабиринтное чутьё"],
  ["Весёлые прыжки", "Радостные прыжки"],
  ["Бараньи рога", "Рога"],
  ["Кошачья ловкость", "Кошачье проворство"],
  ["Защита панцирем", "Защита в панцире"],
  ["Управление воздухом и водой", "Магия глубин"],
  ["Врождённое колдовство", "Змеиная магия", "Змеиное колдовство"],
  ["Голодная пасть", "Голодные челюсти"],
  ["Фея", "Тип существа"],
  ["Дар свирфнеблина", "Сверкневская магия"],
  ["Дуэргарская магия", "Псионика"],
  ["Псионика гитьянки", "Псионика гитъянки"],
  ["Псионика гитцерая", "Псионика гитзерая"],
];
export function racialTraitKey(name: string) {
  return (aliases.find(group => group.includes(name))?.[0] || name).toLocaleLowerCase("ru").replace(/ё/g, "е");
}

const FINAL_SHEET_HIDDEN_RACE_FEATURES = new Set([
  "универсальность",
  "человеческая универсальность",
  "языки",
  "язык",
  "дополнительный язык",
  "увеличение характеристик",
  "увеличение значения характеристик",
  "возраст",
  "мировоззрение",
  "размер",
  "скорость",
]);

function usefulFinalRaceFeature(feature: Feature) {
  const key = racialTraitKey(feature.name).replace(/[^a-zа-я0-9]+/g, " ").trim();
  if (FINAL_SHEET_HIDDEN_RACE_FEATURES.has(key)) return false;
  const text = feature.description.toLocaleLowerCase("ru").replace(/ё/g, "е");
  if (/\+1\s+ко\s+всем\s+(шести\s+)?характеристик/.test(text)) return false;
  if (/общ(ий|его)\s+и\s+од(ин|ного)\s+дополнительн(ый|ого)\s+язык/.test(text)) return false;
  return true;
}

// Legacy variants supply their own mechanics; only genuinely shared traits
// are inherited. In particular, Volo orcs never inherit Adrenaline Rush.
const legacyCommon: Record<string, string[]> = {
  aarakocra: [], bugbear: ["Скрытность"], centaur: ["Родство с природой"],
  deepgnome: ["Гномья магическая стойкость"], duergar: [], eladrin: ["Наследие фей", "Транс", "Сезоны"],
  fairy: ["Тип существа"], firbolg: [], githyanki: [], githzerai: ["Ментальная дисциплина"],
  goblin: ["Тёмное зрение"], goliath: [], harengon: ["Внимательность"],
  hobgoblin: ["Тёмное зрение"], kenku: [], kobold: ["Тёмное зрение"],
  lizardfolk: ["Задержка дыхания"], minotaur: [], orc: ["Тёмное зрение"],
  satyr: ["Гуляка"], seafelf: ["Наследие фей", "Транс"],
  shadarkai: ["Наследие фей", "Транс"], tabaxi: ["Тёмное зрение", "Кошачий талант"],
  tortle: ["Задержка дыхания"], triton: [], yuanpure: ["Тёмное зрение"],
};

export function resolvedRaceFeatures(raceId: string, variantId: string, description = "", tags: string[] = []): Feature[] {
  const variant = selectedRaceVariant(raceId, variantId || "base");
  const modern = variant?.source === "MPMM";
  let common = raceFeatures(raceId, variantId, description, tags);
  if (variantId.startsWith("legacy-") && legacyCommon[raceId]) {
    common = common.filter(feature => legacyCommon[raceId].includes(feature.name));
  }
  if (modern && raceId === "goliath") common = common.filter(f => !["Могучее телосложение", "Прирождённый атлет"].includes(f.name));
  if (modern && raceId === "duergar") common = common.filter(f => f.name !== "Солнечная чувствительность");
  if (modern && raceId === "deepgnome") common = common.filter(f => f.name !== "Маскировка в камне");
  if (raceId === "aasimar" && !modern) common = common.filter(f => f.name !== "Небесное откровение");
  if (raceId === "shifter") common = common.filter(f => f.name !== "Наследие");
  const merged = new Map<string, Feature>();
  for (const feature of [...common, ...(variant?.features || [])]) merged.set(racialTraitKey(feature.name), feature);
  const put = (name: string, text: string) => merged.set(racialTraitKey(name), { name, description: text });
  // These senses were omitted from the short base catalog.
  if (["aasimar", "bugbear", "eladrin", "seafelf", "shadarkai", "shifter"].includes(raceId) || (raceId === "triton" && modern)) {
    put("Тёмное зрение", "В пределах 60 футов видит при тусклом свете как при ярком, в темноте — как при тусклом; цвета в темноте различает оттенками серого.");
  }
  if (raceId === "deepgnome" && !modern) put("Гномья магическая стойкость", "Преимущество на спасброски Интеллекта, Мудрости и Харизмы против магии.");
  if (raceId === "aasimar") put("Исцеляющие руки", modern
    ? "Действием касается существа и восстанавливает ему хиты: бросьте число к4, равное бонусу мастерства, и сложите результаты. Одно применение за продолжительный отдых."
    : "Действием касается существа и восстанавливает ему хиты в количестве, равном уровню персонажа. Одно применение за продолжительный отдых.");
  if (raceId === "shifter") put("Смена", modern
    ? "Бонусным действием принимает звериный облик на 1 минуту и получает временные хиты в количестве 2 × бонус мастерства. Применений — бонус мастерства; восстановление после продолжительного отдыха. Заканчивается при смерти или досрочно бонусным действием."
    : "Бонусным действием принимает звериный облик на 1 минуту и получает временные хиты: уровень персонажа + модификатор Телосложения (минимум 1). Одно применение за короткий или продолжительный отдых. Заканчивается при смерти или досрочно бонусным действием.");
  return [...merged.values()].filter(usefulFinalRaceFeature);
}
