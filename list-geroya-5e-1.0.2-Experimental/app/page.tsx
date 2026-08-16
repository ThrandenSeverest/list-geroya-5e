Warning: truncated output (original token count: 45796)
Total output lines: 2412

"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { backgrounds, CatalogOption, type CatalogSpell, classes, classSkillRules, races, spells } from "./catalog";
import {
  abilityModifier,
  createHelpmateExport,
  createLongStoryShortExport,
  estimatedHitPoints,
  helpmateSkippedSpells,
  type AdvancementChoice,
  type ExportCharacter,
  proficiencyBonus,
} from "./exportFormats";
import { abilityLabels, classRules, personalityOptions, raceFeatures } from "./rules";
import {
  alwaysPreparedSpellEntries,
  asiLevelsForClass,
  feats,
  finalAbilityScores,
  isTashaAdditionalSpell,
  optimalSpellIds,
  optimalPreparedSpellIds,
  optionalClassFeatures,
  optimalAbilityBuild,
  pointBuySpent,
  raceAbilityBonuses,
  raceProficiencies,
  raceSkillChoiceCount,
  selectedRaceVariant,
  selectedSubclass,
  spellAvailableToCharacter,
  spellSelectionRule,
  subclasses,
  subclassRule,
  variantsFor,
} from "./characterRules";
import { CatalogIcon } from "./catalogIcons";
import { classChoiceGroups, classChoicesComplete, resolvedClassChoiceFeatures } from "./classChoices";
import { knownLanguageOptions, languageRule } from "./languages";
import { characterResources, resourceCurrent, resourceRestLabel } from "./characterResources";
import { backgroundEquipmentWithoutStartingGold, backgroundRule, backgroundStartingGold } from "./backgroundRules";
import { defaultEquipmentSelections, equipmentComplete, equipmentOptionAdvice, equipmentRule, optimalEquipmentSelections, selectedEquipment } from "./equipment";
import { characterAttacks } from "./combat";
import { knownLimitations } from "./knownLimitations";
import { characterExpertiseSkills, characterProficiencies, proficiencyChoiceRequirements, proficiencyChoicesComplete, proficiencyChoiceUsedElsewhere } from "./proficiencies";
import { createNativeCharacterFile, parseCharacterFile, type CharacterFileSource } from "./characterFiles";
import { advancementChoiceComplete, featChoiceGroups, featGrantedSpellIds } from "./featChoices";
import { armorClassBreakdown } from "./armor";
import { detailedFeatures, documentedClassFeatures } from "./featureDetails";
import { catalogSources, matchesSources, sourceTokens } from "./catalogFilters";
import { featRequirementMet } from "./featRequirements";
import { PdfCharacterSheet } from "./PdfCharacterSheet";
import { additionalSpellSources, sourceAvailableSpellCatalog } from "./spellCompatibility";
import { hitDiceAfterLongRest, shortRestHitDieHealing } from "./restRules";

type Category = "races" | "classes" | "subclasses" | "backgrounds" | "feats" | "spells";
type BanMode = "deny" | "allow";
type BanList = { version: 2; name: string; mode: BanMode; categories: Record<Category, string[]> };
type PersonalityKey = keyof ExportCharacter["personality"];
type CharacterSlot = { id: string; character: ExportCharacter; updatedAt: string };
type CharacterVault = { version: 1; capacity: number; activeId: string; slots: CharacterSlot[] };
type AccountState = { authenticated: true; email: string; displayName: string; authProvider?: "email" | "chatgpt"; emailVerified?: boolean } | { authenticated: false };
type MobileSheetTab = "overview" | "combat" | "spells" | "resources" | "equipment" | "notes";
type SiteTheme = "classic" | "parchment" | "legacy";

const steps = ["Раса", "Класс", "Характеристики", "Предыстория", "Навыки", "Снаряжение", "Уровень", "Заклинания", "Языки и инструменты", "Характер", "Итог"];
const initial: ExportCharacter = {
  race: "",
  raceVariant: "",
  raceAbilityChoices: [],
  raceSkills: [],
  className: "",
  subclass: "",
  background: "",
  classSkills: [],
  backgroundSkills: [],
  expertiseSkills: [],
  level: 1,
  spells: [],
  preparedSpells: [],
  name: "",
  playerName: "",
  alignment: "",
  abilities: { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 },
  feats: [],
  asiChoices: [],
  advancements: [],
  classChoices: {},
  equipmentSelections: {},
  inventoryOverride: undefined,
  currency: { gp: 0, sp: 0, cp: 0, pp: 0 },
  languages: [],
  proficiencyChoices: {},
  resourceSpent: {},
  spellSlotsUsed: [],
  pactSlotsUsed: 0,
  currentHitPoints: 0,
  temporaryHitPoints: 0,
  hitDiceSpent: 0,
  deathSaveSuccesses: 0,
  deathSaveFailures: 0,
  useTasha: false,
  personality: { traits: "", ideals: "", bonds: "", flaws: "" },
};
const subclassCatalog: CatalogOption[] = Object.entries(subclasses).flatMap(([classId, rule]) => rule.options.map(option => ({ ...option, id: `${classId}:${option.id}` })));
const featCatalog: CatalogOption[] = feats.filter(feat => feat.id !== "asi");
const emptyBan: BanList = { version: 2, name: "Правила кампании", mode: "deny", categories: { races: [], classes: [], subclasses: [], backgrounds: [], feats: [], spells: [] } };
const categoryNames: Record<Category, string> = { races: "Расы", classes: "Классы", subclasses: "Подклассы", backgrounds: "Предыстории", feats: "Черты", spells: "Заклинания" };
const catalogs: Record<Category, CatalogOption[]> = { races, classes, subclasses: subclassCatalog, backgrounds, feats: featCatalog, spells };
const personalityNames: Record<PersonalityKey, string> = {
  traits: "Черты характера",
  ideals: "Идеалы",
  bonds: "Привязанности",
  flaws: "Слабости",
};
const personalityHints: Record<PersonalityKey, string> = {
  traits: "Как герой ведёт себя, говорит и реагирует?",
  ideals: "Какой принцип определяет его решения?",
  bonds: "Кого, что или какое обещание он защищает?",
  flaws: "Какая слабость регулярно создаёт проблемы?",
};
const alignments = ["", "Законно-доброе", "Нейтрально-доброе", "Хаотично-доброе", "Законно-нейтральное", "Истинно нейтральное", "Хаотично-нейтральное", "Законно-злое", "Нейтрально-злое", "Хаотично-злое"];
const siteChangelog = [{
  version: "1.0.1",
  publishedAt: "2026-08-11T23:00:00Z",
  changes: [
    "Добавлены три дизайна по кругу: синий с золотом и новыми иконками, светлый пергамент с чёрными иконками и старый упрощённый интерфейс.",
    "Карточки 514 заклинаний получили точные материальные компоненты, стоимость и отметки расходования из обновлённого каталога.",
    "Мобильный лист получил отдельное изменение хитов, выбор костей до короткого отдыха и спасброски от смерти; перепроверены таблицы заговоров и известных заклинаний.",
  ],
}, {
  version: "1.0.0",
  publishedAt: "2026-08-11T18:00:00Z",
  changes: [
    "Новый интерфейс с иконками стал основным: пергаментный фон, чёрный текст и красные акценты; прежний тёмный вариант доступен через кнопку «Дизайн сайта».",
    "Добавлен экспериментальный мобильный лист с вкладками, текущими хитами, подготовкой заклинаний, ресурсами, коротким и длинным отдыхом и расходованием костей хитов.",
    "Возвращены аккаунты по email и паролю, безопасные сессии и объединение локальных персонажей с облачным Vault; подтверждение email полностью подготовлено, но выключено настройкой.",
  ],
}, {
  version: "0.9.0",
  publishedAt: "2026-08-11T12:00:00Z",
  changes: [
    "Ресурсы охватывают расходуемые расовые, классовые и подклассовые способности, включая Ярость и Песнь клинка, и показывают восстановление после короткого или продолжительного отдыха.",
    "В фильтре рас появилась кнопка «Все», а экспериментальные иконки Хадози и Возрождённого возвращены на свои места.",
    "Книга заклинаний плотнее заполняет страницу, показывает максимум подготовленных заклинаний и позволяет очистить печатные отметки подготовки независимо от инвентаря.",
  ],
}, {
  version: "0.8.6",
  publishedAt: "2026-08-11T05:00:00Z",
  changes: [
    "Экспериментальные иконки классов и рас увеличены и получили точное покадровое кадрирование без соседних фрагментов спрайта.",
    "Книга заклинаний разбита на две колонки; ритуалы отмечаются буквой «Р», а компоненты — компактными обозначениями В/С/М и М*.",
    "Длинная книга заклинаний автоматически создаёт страницы-продолжения, поэтому заклинания 8-го и 9-го круга больше не обрезаются.",
  ],
}, {
  version: "0.8.5",
  publishedAt: "2026-08-10T08:00:00Z",
  changes: [
    "Добавлен экспериментальный переключатель UI с новыми иконками классов, рас и сайта; обычный интерфейс не меняется.",
    "На лист добавлены текущие и временные хиты, а также кость хитов с максимумом и оставшимся числом.",
    "Для альтернативного человека с чертой «Мастер большого оружия» рекомендации стартового снаряжения отдают приоритет двуручному мечу или молоту.",
  ],
}, {
  version: "0.8.4",
  publishedAt: "2026-08-08T20:00:00Z",
  changes: [
    "При сворачивании или очистке инвентаря рамки и подписи ЗМ, СМ, ММ и ПМ остаются на листе; во втором режиме скрываются только значения монет.",
    "Стартовые монеты предыстории теперь автоматически записываются в ЗМ, а строка «Кошелёк с … зм» удалена из инвентаря и из списка стартового снаряжения.",
  ],
}, {
  version: "0.8.3",
  publishedAt: "2026-08-08T19:00:00Z",
  changes: [
    "Инвентарь теперь есть только на первом листе; повтор на странице истории удалён.",
    "Под спасбросками возвращены инструменты, языки, доспехи и оружие, а под атаками — компактные расовые особенности, включая тёмное зрение.",
    "Инвентарь можно циклически переключить между подробным списком, компактной строкой и пустым местом для записей от руки; кнопка не попадает в печать.",
  ],
}, {
  version: "0.8.2",
  publishedAt: "2026-08-08T18:00:00Z",
  changes: [
    "Первая страница снова посвящена быстрой игре: вместо черт на ней теперь инвентарь и отдельные счётчики золотых, серебряных, медных и платиновых монет.",
    "Черты, расовые особенности и особенность предыстории перенесены после классовых способностей; перерасчёт заполнения убирает почти пустые листы-продолжения.",
    "Навыки на листе теперь подписываются по-русски, а спасброски выделены отдельным заметным блоком.",
  ],
}, {
  version: "0.8.1",
  publishedAt: "2026-08-08T00:30:00Z",
  changes: [
    "Добавлено явное предупреждение: собственный вход по почте и паролю предназначен для самостоятельного хостинга и может не работать на chatgpt.site.",
    "На chatgpt.site сохранён поддерживаемый вход ChatGPT и синхронизация персонажей через него.",
  ],
}, {
  version: "0.8.0",
  publishedAt: "2026-08-08T00:00:00Z",
  changes: [
    "Экранный итоговый лист и PDF теперь используют один и тот же A4-макет без расхождений.",
    "Первая страница заполнена чертами, расовыми особенностями, предысторией, владениями и языками.",
    "Особые атаки и боевые приёмы перенесены в начало классовых способностей; обычное оружие и боевые заговоры остались на основном листе.",
    "Классовые способности автоматически создают страницы-продолжения вместо обрезания текста.",
  ],
}, {
  version: "0.7.0",
  publishedAt: "2026-08-09T01:00:22Z",
  changes: [
    "FTD, EGW, AI, SAS, PAM и BMT скрыты в обычном выборе заклинаний до явной разблокировки с предупреждением о Helpmate; бан-листы по-прежнему видят полный каталог.",
    "Create Magen перенесён из ошибочного PHB в IDRotF, скрывается вместе с дополнительными заклинаниями и отмечен как отсутствующий в Helpmate.",
    "Helpmate использует 477 проверенных соответствий конкретных заклинаний, включая строковые TCoE_* и подтверждённые алиасы названий.",
    "Неполный экспорт Helpmate больше не падает: показывает список пропусков и переносит все совместимые заклинания.",
  ],
}, {
  version: "0.6.0",
  publishedAt: "2026-08-08T23:40:00Z",
  changes: [
    "Экспорт Long Story Short больше не теряет выбранные черты: игровые эффекты сохраняются, а расовые особенности перенесены в «Прочие владения и языки».",
    "Стихийный адепт учитывает выбранный тип урона в атаках заклинаниями и напоминает об игнорировании сопротивления и замене единиц на костях.",
    "Незавершённый дополнительный выбор отмечается рядом с названием черты в таблице уровней.",
    "Классовые способности упорядочены по уровню; дополнительная атака и увёртливость закреплены сверху, а атаки собраны в отдельном блоке.",
    "Добавлен новый печатный лист на 4 страницы для немагических героев и 5 страниц для заклинателей; последняя страница посвящена заклинаниям.",
    "Каталог расширен приложенными 514 карточками заклинаний; вместе с уже поддерживаемым заклинанием SCC доступно 515 уникальных записей.",
  ],
}, {
  version: "0.5.0",
  publishedAt: "2026-08-08T22:48:06Z",
  changes: [
    "В фильтре черт добавлены выбор всех источников и сворачивание списка; стрелки ведут к пропущенным обязательным выборам выше или ниже.",
    "На шаге заклинаний добавлены полный сброс, отдельный список книги и подготовка ниже него; оптимальный список пересобирает оба набора и использует круги вплоть до 9-го.",
    "Экспорт Long Story Short сокращает дублирующие описания, сохраняет игровые действия, реакции и спасброски и распределяет способности между пятью заметками.",
    "Черта «Ваятель рун» получила выбор характеристики, известные руны по бонусу мастерства и связанные заклинания.",
    "Требования черт проверяются динамически после каждого изменения персонажа и больше не сохраняют устаревшее состояние блокировки.",
  ],
}, {
  version: "0.4.0",
  publishedAt: "2026-08-08T22:08:27Z",
  changes: [
    "Комбинируемые фильтры книг добавлены для рас, классов, черт и заклинаний; по умолчанию активен только PHB.",
    "Черты при нескольких источниках разделяются по книгам, а невыполненные требования подсвечиваются красным и блокируют выбор с объяснением.",
    "Заклинания фильтруются по источнику, кругу и ритуальности; рекомендации дополнены вариантами 9-го круга.",
    "Восстановлены обязательные выборы оружия, приёмов, боевых стилей, воззваний, метамагии, владений, языков и заклинаний для соответствующих черт.",
    "Каждое повышение характеристик остаётся отдельным видимым блоком своего уровня.",
    "Заблокированная кнопка «Продолжить» теперь сообщает точную причину, а полный список черт не обрезается после пятой позиции.",
  ],
}, {
  version: "0.3.0",
  publishedAt: "2026-08-08T20:55:30Z",
  changes: [
    "Бан-листы получили массовый запрет и снятие запрета по книге с возможностью точечных исключений; добавлены подклассы и черты.",
    "Интегрированы полные способности 13 классов и официальных подклассов из приложенных документов, а также 105 официальных черт.",
    "Исправлены альтернативный человек, отдельные повышения характеристик и видимость незавершённого распределения очков.",
    "Добавлены оптимальные Point Buy характеристики с учётом класса, расовых бонусов, брони и чётных итоговых значений.",
    "Уточнены КД доспехов, содержимое дорожных наборов и выдача боеприпасов стартовым снаряжением.",
    "Добавлен вход и синхронизация персонажей с аккаунтом; локальные данные автоматически переносятся после входа.",
    "Мобильная история обновлений перенесена наверх и свернута до номера версии.",
  ],
}, {
  version: "0.2.0",
  publishedAt: "2026-08-01T23:58:29Z",
  changes: [
    "Автоматическое сопоставление заклинаний Long Story Short по ссылкам dnd.su без ручного выбора.",
    "Импорт и экспорт компетентности с учётом уровня барда, плута и черты «Эксперт в навыке».",
    "Восстановление Point Buy и повышений характеристик из итоговых значений LSS.",
    "Добавлена история обновлений сайта.",
  ],
}];

function UpdateHistory() {
  const [open, setOpen] = useState(false);
  return <aside className={`update-history${open ? " open" : ""}`}>
    <button className="update-history-toggle" onClick={() => setOpen(value => !value)} aria-expanded={open} aria-label={`История обновлений, версия ${siteChangelog[0].version}`}><span className="history-label">История обновлений</span><b>v{siteChangelog[0].version}</b></button>
    {open && <div className="update-history-panel">
      <header><div><small>Лист Героя 5e</small><h2>История обновлений</h2></div><button aria-label="Закрыть историю обновлений" onClick={() => setOpen(false)}>×</button></header>
      {siteChangelog.map(entry => <article key={entry.version}>
        <div><strong>v{entry.version}</strong><time dateTime={entry.publishedAt}>{new Date(entry.publishedAt).toLocaleString("ru-RU", { dateStyle: "medium", timeStyle: "short" })}</time></div>
        <ul>{entry.changes.map(change => <li key={change}>{change}</li>)}</ul>
      </article>)}
    </div>}
  </aside>;
}

function MissingChoiceNavigator({ signature }: { signature: string }) {
  const [directions, setDirections] = useState({ up: false, down: false });
  useEffect(() => {
    const refresh = () => {
      const targets = [...document.querySelectorAll<HTMLElement>('[data-incomplete="true"]')].filter(target => target.offsetParent !== null);
      const middle = window.innerHeight / 2;
      setDirections({
        up: targets.some(target => target.getBoundingClientRect().bottom < middle - 24),
        down: targets.some(target => target.getBoundingClientRect().top > middle + 24),
      });
    };
    const frame = requestAnimationFrame(refresh);
    window.addEventListener("scroll", refresh, { passive: true });
    window.addEventListener("resize", refresh);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", refresh);
      window.removeEventListener("resize", refresh);
    };
  }, [signature]);

  const go = (direction: "up" | "down") => {
    const middle = window.innerHeight / 2;
    const targets = [...document.querySelectorAll<HTMLElement>('[data-incomplete="true"]')].filter(target => target.offsetParent !== null);
    const candidates = targets.filter(target => direction === "up" ? target.getBoundingClientRect().bottom < middle : target.getBoundingClientRect().top > middle);
    candidates.sort((left, right) => direction === "up" ? right.getBoundingClientRect().bottom - left.getBoundingClientRect().bottom : left.getBoundingClientRect().top - right.getBoundingClientRect().top);
    const target = candidates[0];
    if (!target) return;
    if (target.matches("button")) target.click();
    requestAnimationFrame(() => target.scrollIntoView({ behavior: "smooth", block: "center" }));
  };

  if (!directions.up && !directions.down) return null;
  return <nav className="missing-choice-navigator" aria-label="Навигация к незаполненным выборам">
    {directions.up && <button onClick={() => go("up")} title="К ближайшему пропущенному выбору выше">↑<span>Пропущено выше</span></button>}
    {directions.down && <button onClick={() => go("down")} title="К ближайшему пропущенному выбору ниже">↓<span>Пропущено ниже</span></button>}
  </nav>;
}

function download(payload: unknown, name: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function safeName(value: string) {
  return (value || "герой").replace(/[\\/:*?"<>|]+/g, "-").trim();
}

function slotId() {
  return `hero-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createSlot(character: ExportCharacter = initial): CharacterSlot {
  return { id: slotId(), character, updatedAt: new Date().toISOString() };
}

function mergeVaults(local: CharacterVault, remote: CharacterVault | null): CharacterVault {
  if (!remote?.slots?.length) return local;
  const slots = new Map<string, CharacterSlot>();
  for (const slot of [...remote.slots, ...local.slots]) {
    const previous = slots.get(slot.id);
    if (!previous || Date.parse(slot.updatedAt) >= Date.parse(previous.updatedAt)) {
      slots.set(slot.id, { ...slot, character: normalizeCharacter(slot.character) });
    }
  }
  const mergedSlots = [...slots.values()].sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
  const activeId = mergedSlots.some(slot => slot.id === local.activeId)
    ? local.activeId
    : mergedSlots.some(slot => slot.id === remote.activeId) ? remote.activeId : mergedSlots[0]?.id || "";
  return { version: 1, capacity: Math.max(5, local.capacity, remote.capacity, mergedSlots.length), activeId, slots: mergedSlots };
}

function allowed(list: BanList | null, category: Category, id: string) {
  if (!list) return true;
  const hit = list.categories[category]?.includes(id);
  return list.mode === "deny" ? !hit : !!hit;
}

function normalizeBanList(value: Partial<BanList> & { version?: number }): BanList {
  const mode: BanMode = value.mode === "allow" ? "allow" : "deny";
  return {
    version: 2,
    name: typeof value.name === "string" ? value.name : "Правила кампании",
    mode,
    categories: Object.fromEntries((Object.keys(categoryNames) as Category[]).map(category => [
      category,
      Array.isArray(value.categories?.[category])
        ? value.categories![category]
        : mode === "allow" ? catalogs[category].map(option => option.id) : [],
    ])) as Record<Category, string[]>,
  };
}

function levelLabel(value: number) {
  return value === 0 ? "Заговор" : `${value} круг`;
}

function hasOriginFeat(character: Pick<ExportCharacter, "race" | "raceVariant">) {
  return (character.race === "human" && character.raceVariant === "variant") || character.race === "customlineage";
}

function advancementSlotsFor(character: Pick<ExportCharacter, "race" | "raceVariant" | "className" | "level"> & Partial<Pick<ExportCharacter, "advancements" | "feats">>) {
  const regular = [
    ...(hasOriginFeat(character) ? [{ key: "origin-1", level: 1, origin: true }] : []),
    ...asiLevelsForClass(character.className)
      .filter(level => level <= character.level)
      .map(level => ({ key: `class-${level}`, level, origin: false })),
  ];
  const savedBonus = (character.advancements || []).filter(choice => choice.bonus).map(choice => ({ key: choice.key, level: choice.level, bonus: true }));
  const requiredBonusCount = Math.max(0, (character.feats?.length || 0) - regular.length - savedBonus.length);
  const generatedBonus = Array.from({ length: requiredBonusCount }, (_, index) => ({ key: `bonus-${savedBonus.length + index + 1}`, level: character.level, bonus: true }));
  return [...regular, ...savedBonus, ...generatedBonus];
}

function deriveLegacyAdvancementFields(advancements: AdvancementChoice[]) {
  return {
    feats: advancements.map(choice => choice.featId).filter(Boolean),
    asiChoices: advancements.flatMap(choice => choice.featId === "asi" ? choice.asiChoices : []),
  };
}

function syncAdvancements(character: ExportCharacter, advancements: AdvancementChoice[]) {
      return { ...character, advancements, ...deriveLegacyAdvancementFields(advancements) };
}

function normalizeCharacter(value: Partial<ExportCharacter>): ExportCharacter {
  const normalized = {
    ...initial,
    ...value,
    abilities: { ...initial.abilities, ...(value.abilities || {}) },
    personality: { ...initial.personality, ...(value.personality || {}) },
    raceAbilityChoices: value.raceAbilityChoices || [],
    raceVariant: value.raceVariant || (value.race && !variantsFor(value.race).length ? "base" : ""),
    raceSkills: value.raceSkills || [],
    feats: value.feats || [],
    asiChoices: value.asiChoices || [],
    advancements: value.advancements || [],
    classChoices: value.classChoices || {},
    expertiseSkills: value.expertiseSkills || [],
    equipmentSelections: { ...defaultEquipmentSelections(value.className || ""), ...(value.equipmentSelections || {}) },
    currency: { ...initial.currency, ...(value.currency || {}) },
    languages: value.languages || [],
    proficiencyChoices: value.proficiencyChoices || {},
    resourceSpent: value.resourceSpent || {},
    preparedSpells: value.preparedSpells || [],
    spellSlotsUsed: value.spellSlotsUsed || [],
    pactSlotsUsed: value.pactSlotsUsed || 0,
    subclass: value.subclass || "",
    useTasha: !!value.useTasha,
  };
  if (!normalized.advancements.length && (normalized.feats || []).length) {
    const regularSlots = advancementSlotsFor({ ...normalized, feats: [] });
    const extraSlots = Array.from({ length: Math.max(0, normalized.feats.length - regularSlots.length) }, (_, index) => ({ key: `bonus-${index + 1}`, level: normalized.level, bonus: true }));
    const slots = [...regularSlots, ...extraSlots];
    const legacyAsi = [...(normalized.asiChoices || [])];
    normalized.advancements = slots.slice(0, normalized.feats.length).map((slot, index) => {
      const featId = normalized.feats?.[index] || "";
      return { ...slot, featId, asiChoices: featId === "asi" ? legacyAsi.splice(0, 2) : [] };
    });
  }
  if (value.preparedSpells === undefined && normalized.spells.length) {
    normalized.preparedSpells = optimalPreparedSpellIds(normalized, spells, normalized.spells);
  }
  return syncAdvancements(normalized, normalized.advancements);
}

export default function Home() {
  const [view, setView] = useState<"builder" | "banlist" | "characters">("builder");
  const [step, setStep] = useState(0);
  const [character, setCharacter] = useState<ExportCharacter>(initial);
  const [banDraft, setBanDraft] = useState<BanList>(emptyBan);
  const [activeBan, setActiveBan] = useState<BanList | null>(null);
  const [ready, setReady] = useState(false);
  const [banCategory, setBanCategory] = useState<Category>("races");
  const [banSource, setBanSource] = useState("Все");
  const [banBookSource, setBanBookSource] = useState("PHB");
  const [search, setSearch] = useState("");
  const [selectedSources, setSelectedSources] = useState<string[]>(["PHB"]);
  const [additionalSpellsUnlocked, setAdditionalSpellsUnlocked] = useState(false);
  const [additionalSpellsAcknowledged, setAdditionalSpellsAcknowledged] = useState(false);
  const [siteTheme, setSiteTheme] = useState<SiteTheme>("classic");
  const [mobileSheet, setMobileSheet] = useState(false);
  const [mobileSheetTab, setMobileSheetTab] = useState<MobileSheetTab>("overview");
  const [hitDiceToRoll, setHitDiceToRoll] = useState(0);
  const [hitPointAdjustment, setHitPointAdjustment] = useState(0);
  const [lastHitDieRoll, setLastHitDieRoll] = useState<number | null>(null);
  const [showAdditionalSpellWarning, setShowAdditionalSpellWarning] = useState(false);
  const [helpmateExportWarning, setHelpmateExportWarning] = useState<string[] | null>(null);
  const [spellLevel, setSpellLevel] = useState<number | "all">("all");
  const [ritualFilter, setRitualFilter] = useState<"all" | "ritual" | "nonritual">("all");
  const [featsExpanded, setFeatsExpanded] = useState(true);
  const [advancementKey, setAdvancementKey] = useState("");
  const [detailsId, setDetailsId] = useState("");
  const [vault, setVault] = useState<CharacterVault>({ version: 1, capacity: 5, activeId: "", slots: [] });
  const [account, setAccount] = useState<AccountState | null>(null);
  const [cloudState, setCloudState] = useState<"local" | "saving" | "saved" | "error">("local");
  const [importMessage, setImportMessage] = useState<{ source: CharacterFileSource; warnings: string[] } | null>(null);
  const banFileRef = useRef<HTMLInputElement>(null);
  const characterFileRef = useRef<HTMLInputElement>(null);
  const exportPanelRef = useRef<HTMLDivElement>(null);
  const cloudSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function connectAccount(localVault: CharacterVault) {
    try {
      const accountResponse = await fetch("/api/account", { cache: "no-store" });
      const accountValue = await accountResponse.json() as AccountState;
      if (!accountValue.authenticated) {
        setAccount({ authenticated: false });
        return;
      }
      const vaultResponse = await fetch("/api/vault", { cache: "no-store" });
      const remotePayload = vaultResponse.ok ? await vaultResponse.json() as { vault: CharacterVault | null } : { vault: null };
      const merged = mergeVaults(localVault, remotePayload.vault);
      setVault(merged);
      const active = merged.slots.find(slot => slot.id === merged.activeId);
      if (active) setCharacter(active.character);
      localStorage.setItem("list-geroya-character-vault-v1", JSON.stringify(merged));
      setCloudState("saving");
      const saveResponse = await fetch("/api/vault", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ vault: merged }) });
      setCloudState(saveResponse.ok ? "saved" : "error");
      setAccount(accountValue);
    } catch {
      setAccount({ authenticated: false });
      setCloudState("error");
    }
  }

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    let loadedVault: CharacterVault;
    try {
      const storedVault = localStorage.getItem("list-geroya-character-vault-v1");
      const storedCharacter = localStorage.getItem("dark-codex-character");
      if (storedVault) {
        const parsed = JSON.parse(storedVault) as CharacterVault;
        const slots = (parsed.slots || []).map(slot => ({ ...slot, character: normalizeCharacter(slot.character) }));
        const activeId = slots.some(slot => slot.id === parsed.activeId) ? parsed.activeId : slots[0]?.id || "";
        const active = slots.find(slot => slot.id === activeId);
        loadedVault = { version: 1, capacity: Math.max(5, parsed.capacity || 5, slots.length), activeId, slots };
        setVault(loadedVault);
        if (active) setCharacter(active.character);
      } else {
        const migrated = storedCharacter ? normalizeCharacter(JSON.parse(storedCharacter)) : initial;
        const slot = createSlot(migrated);
        loadedVault = { version: 1, capacity: 5, activeId: slot.id, slots: [slot] };
        setVault(loadedVault);
        setCharacter(migrated);
      }
      const storedBan = localStorage.getItem("dark-codex-banlist");
      if (storedBan) setActiveBan(normalizeBanList(JSON.parse(storedBan)));
      setAdditionalSpellsUnlocked(localStorage.getItem("list-geroya-additional-spells") === "enabled");
      setAdditionalSpellsAcknowledged(localStorage.getItem("list-geroya-additional-spells-warning") === "acknowledged");
      const storedTheme = localStorage.getItem("list-geroya-site-theme");
      setSiteTheme(storedTheme === "parchment" || storedTheme === "legacy" ? storedTheme : "classic");
    } catch {
      const slot = createSlot(initial);
      loadedVault = { version: 1, capacity: 5, activeId: slot.id, slots: [slot] };
      setVault(loadedVault);
    }
    setReady(true);
    void connectAccount(loadedVault!);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!ready || !vault.activeId) return;
    const updatedAt = new Date().toISOString();
    const next = {
      ...vault,
      slots: vault.slots.map(slot => slot.id === vault.activeId ? { ...slot, character, updatedAt } : slot),
    };
    localStorage.setItem("list-geroya-character-vault-v1", JSON.stringify(next));
    localStorage.setItem("dark-codex-character", JSON.stringify(character));
    if (account?.authenticated) {
      if (cloudSaveTimerRef.current) clearTimeout(cloudSaveTimerRef.current);
      cloudSaveTimerRef.current = setTimeout(async () => {
        setCloudState("saving");
        try {
          const response = await fetch("/api/vault", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ vault: next }) });
          setCloudState(response.ok ? "saved" : "error");
        } catch { setCloudState("error"); }
      }, 650);
    }
  }, [account, character, ready, vault]);

  const usesOrnateIcons = siteTheme !== "legacy";
  const shellThemeClass = siteTheme === "parchment" ? " modern-design" : siteTheme === "legacy" ? " legacy-design" : "";
  const nextThemeName = siteTheme === "classic" ? "пергаментный" : siteTheme === "parchment" ? "старый упрощённый" : "синий с золотом";

  function cycleSiteTheme() {
    const next: SiteTheme = siteTheme === "classic" ? "parchment" : siteTheme === "parchment" ? "legacy" : "classic";
    setSiteTheme(next);
    localStorage.setItem("list-geroya-site-theme", next);
  }

  const availableRaces = useMemo(() => races.filter(option => allowed(activeBan, "races", option.id)), [activeBan]);
  const availableClasses = useMemo(() => classes.filter(option => allowed(activeBan, "classes", option.id)), [activeBan]);
  const availableBackgrounds = useMemo(
    () => backgrounds.filter(option => allowed(activeBan, "backgrounds", option.id)),
    [activeBan],
  );
  const selectedRace = races.find(option => option.id === character.race);
  const selectedClass = classes.find(option => option.id === character.className);
  const selectedBackground = backgrounds.find(option => option.id === character.background);
  const selectedBackgroundRule = backgroundRule(character.background, selectedBackground);
  const classRule = classSkillRules[character.className] || { count: 0, skills: [] };
  const fixedBackgroundSkills = selectedBackgroundRule.skills;
  const unavailableClassSkills = [...new Set([...fixedBackgroundSkills, ...(character.raceSkills || [])])];
  const allSkillNames = [...new Set(Object.values(classSkillRules).flatMap(rule => rule.skills))].sort((a, b) => a.localeCompare(b, "ru"));
  const currentOptions = step === 0 ? availableRaces : step === 1 ? availableClasses : availableBackgrounds;
  const advancementSlots = advancementSlotsFor(character);
  const advancements = advancementSlots.map(slot => character.advancements?.find(choice => choice.key === slot.key) || { ...slot, featId: "", asiChoices: [] });
  const advancementFields = deriveLegacyAdvancementFields(advancements);
  const rulesCharacter = { ...character, ...advancementFields, advancements };
  const choiceGroups = classChoiceGroups(rulesCharacter, spells);
  const spellRule = spellSelectionRule({ ...rulesCharacter, abilities: finalAbilityScores(rulesCharacter) });
  const sourceAvailableSpells = sourceAvailableSpellCatalog(spells, additionalSpellsUnlocked);
  const availableSpellCatalog = sourceAvailableSpells.filter(spell => allowed(activeBan, "spells", spell.id));
  const alwaysPreparedEntries = alwaysPreparedSpellEntries(rulesCharacter, availableSpellCatalog);
  const alwaysPrepared = alwaysPreparedEntries.map(entry => entry.id);
  const alwaysPreparedSet = new Set(alwaysPrepared);
  const sources = catalogSources(step === 7 ? sourceAvailableSpells : currentOptions);
  const filtered = currentOptions.filter(option => matchesSources(option.source, selectedSources) && `${option.name} ${option.description}`.toLowerCase().includes(search.toLowerCase()));
  const selectableSpells = availableSpellCatalog.filter(spell => spellAvailableToCharacter(rulesCharacter, spell) && spell.level <= spellRule.maxLevel && !alwaysPreparedSet.has(spell.id));
  const filteredSpells = selectableSpells.filter(spell => (spellLevel === "all" || spell.level === spellLevel) && matchesSources(spell.source, selectedSources) && (ritualFilter === "all" || (ritualFilter === "ritual" ? !!spell.ritual : !spell.ritual)) && `${spell.name} ${spell.description} ${spell.school}`.toLowerCase().includes(search.toLowerCase()));
  const hiddenCount = activeBan ? Object.keys(catalogs).reduce((count, key) => count + catalogs[key as Category].filter(option => !allowed(activeBan, key as Category, option.id)).length, 0) : 0;
  const chosenRaceVariant = selectedRaceVariant(character.race, character.raceVariant);
  const selectedRaceFeatures = [
    ...raceFeatures(character.race, character.raceVariant, selectedRace?.description, selectedRace?.tags),
    ...(chosenRaceVariant?.features || []),
  ];
  const chosenSubclass = selectedSubclass(character.className, character.subclass || "");
  const selectedClassFeatures = detailedFeatures(resolvedClassChoiceFeatures(rulesCharacter,
    documentedClassFeatures(
      character.className,
      chosenSubclass?.name,
      !!character.useTasha,
      classRules[character.className]?.features || [],
      chosenSubclass?.features || [],
      optionalClassFeatures[character.className] || [],
    ).filter(feature => (feature.level || 1) <= character.level),
    spells,
  ));
  const personalityLists = personalityOptions(character.background);
  const proficiency = proficiencyBonus(character.level);
  const finalAbilities = finalAbilityScores(rulesCharacter);
  const exportCharacter = { ...rulesCharacter, abilities: finalAbilities };
  const classEquipment = equipmentRule(character.className);
  const equipmentItems = selectedEquipment(exportCharacter);
  const displayedInventory = character.inventoryOverride === undefined
    ? equipmentItems
    : character.inventoryOverride.split(/\n|\s*·\s*/).map(item => item.trim()).filter(Boolean);
  const languageRequirements = languageRule(exportCharacter);
  const proficiencyRequirements = proficiencyChoiceRequirements(exportCharacter);
  const proficiencies = characterProficiencies(exportCharacter);
  const expertise = characterExpertiseSkills(exportCharacter);
  const knownLanguages = proficiencies.languages;
  const resources = characterResources(exportCharacter);
  const resourceMarkCount = resources.reduce((sum, resource) => sum + Math.ceil(resource.max / (resource.unit || 1)), 0);
  const resourceDensity = resources.length >= 6 || resourceMarkCount >= 32 ? "micro" : resources.length >= 4 || resourceMarkCount >= 22 ? "dense" : resources.length >= 3 || resourceMarkCount >= 14 ? "compact" : "normal";
  const spellAbilityKey = classRules[character.className]?.spellAbility as keyof ExportCharacter["abilities"] | undefined;
  const spellcastingModifier = spellAbilityKey ? abilityModifier(finalAbilities[spellAbilityKey]) : 0;
  const spellSaveDc = spellAbilityKey ? 8 + proficiency + spellcastingModifier : 0;
  const spellAttackBonus = spellAbilityKey ? proficiency + spellcastingModifier : 0;
  const hitPoints = estimatedHitPoints(exportCharacter);
  const passivePerception = 10 + abilityModifier(finalAbilities.wis) + (proficiencies.skills.includes("Внимательность") ? proficiency : 0);
  const pointSpent = pointBuySpent(character.abilities);
  const pointRemaining = 27 - pointSpent;
  const variantBonus = raceAbilityBonuses(character);
  const racialProficiencies = raceProficiencies(character);
  const subclassData = subclassRule(character.className);
  const ordinarySpellIds = character.spells.filter(id => !alwaysPreparedSet.has(id));
  const selectedCantrips = ordinarySpellIds.filter(id => spells.find(item => item.id === id)?.level === 0);
  const selectedLeveled = ordinarySpellIds.filter(id => (spells.find(item => item.id === id)?.level || 0) > 0);
  const selectedPrepared = (character.preparedSpells || []).filter(id => selectedLeveled.includes(id));
  const mobilePreparedIds = spellRule.mode === "prepared" && !character.mobilePreparedConfigured
    ? selectedLeveled.slice(0, spellRule.prepared || selectedLeveled.length)
    : selectedPrepared;
  const selectedByLevel = Array.from({ length: spellRule.maxLevel + 1 }, (_, level) => ordinarySpellIds.filter(id => spells.find(item => item.id === id)?.level === level).length);
  const selectedAtOrAbove = Array.from({ length: spellRule.maxLevel + 1 }, (_, level) => level === 0 ? selectedCantrips.length : selectedByLevel.slice(level).reduce((total, count) => total + count, 0));
  const featSlots = advancementSlots.length;
  const completedAdvancements = advancements.filter(choice => advancementChoiceComplete(choice, spells, character.level));
  const selectedFeatNames = advancementFields.feats.map(id => feats.find(item => item.id === id)?.name).filter(Boolean) as string[];
  const grantedFeatSpells = featGrantedSpellIds(exportCharacter);
  const mobileSpellPool = [...new Map((spellRule.mode === "prepared"
    ? [
        ...selectedCantrips.map(id => spells.find(spell => spell.id === id)),
        ...availableSpellCatalog.filter(spell => spell.level > 0 && spell.level <= spellRule.maxLevel && spellAvailableToCharacter(rulesCharacter, spell)),
        ...alwaysPrepared.map(id => spells.find(spell => spell.id === id)),
        ...grantedFeatSpells.map(id => spells.find(spell => spell.id === id)),
      ]
    : [...new Set([...ordinarySpellIds, ...alwaysPrepared, ...grantedFeatSpells])].map(id => spells.find(spell => spell.id === id)))
    .filter((spell): spell is CatalogSpell => Boolean(spell))
    .map(spell => [spell.id, spell])).values()]
    .sort((left, right) => left.level - right.level || left.name.localeCompare(right.name, "ru"));
  const selectedFeatFeatures = advancements.flatMap(choice => {
    const feat = feats.find(item => item.id === choice.featId);
    if (!feat || feat.id === "asi") return [];
    const details = featChoiceGroups(choice, spells, character.level).map(group => {
      const names = (choice.featChoices?.[group.key] || []).map(id => group.options.find(option => option.id === id)?.name || id);
      return names.length ? `${group.title}: ${names.join(", ")}` : "";
    }).filter(Boolean);
    return [{ name: feat.name, description: [feat.description, ...details].join(" ") }];
  });
  const attacks = characterAttacks({ ...exportCharacter, spells: [...new Set([...exportCharacter.spells, ...grantedFeatSpells])] }, spells);
  const ac = armorClassBreakdown(exportCharacter);
  const activeAdvancement = advancements.find(choice => choice.key === advancementKey) || advancements.find(choice => !choice.featId) || advancements[0];
  const incompleteAsiAdvancements = advancements.filter(choice => choice.featId === "asi" && choice.asiChoices.length < 2);
  const exportContext = {
    character: exportCharacter,
    race: selectedRace,
    characterClass: selectedClass,
    background: selectedBackground,
    spells,
    raceFeatureList: selectedRaceFeatures,
    classFeatureList: selectedClassFeatures,
    raceProficiencies: racialProficiencies,
    subclassName: chosenSubclass?.name,
    raceVariantName: chosenRaceVariant?.name,
    featNames: selectedFeatNames,
    featFeatureList: selectedFeatFeatures,
    featSpellIds: grantedFeatSpells,
    alwaysPreparedSpellIds: alwaysPrepared,
  };

  const availableFeatOptions = feats.filter(feat => {
    if (feat.id === "asi") return false;
    if (!allowed(activeBan, "feats", feat.id) || !matchesSources(feat.source, selectedSources)) return false;
    if (feat.repeatable || activeAdvancement?.featId === feat.id) return true;
    return !advancements.some(choice => choice.key !== activeAdvancement?.key && choice.featId === feat.id);
  });
  const featSourceGroups = selectedSources.length > 1
    ? selectedSources.map(book => ({ book, feats: availableFeatOptions.filter(feat => sourceTokens(feat.source).includes(book)) })).filter(group => group.feats.length)
    : [{ book: selectedSources[0] || "PHB", feats: availableFeatOptions }];

  function resetFilters(nextStep: number) {
    setStep(nextStep);
    setSearch("");
    setSelectedSources(["PHB"]);
    setDetailsId("");
    setSpellLevel("all");
    setRitualFilter("all");
    setFeatsExpanded(true);
  }

  function toggleSource(book: string) {
    setSelectedSources(current => current.includes(book) ? (current.length > 1 ? current.filter(value => value !== book) : current) : [...current, book]);
  }

  function toggleAllRaceSources() {
    const allRaceSources = catalogSources(availableRaces);
    setSelectedSources(current => allRaceSources.every(source => current.includes(source)) ? ["PHB"] : allRaceSources);
  }

  function requestAdditionalSpells() {
    if (additionalSpellsUnlocked) {
      setAdditionalSpellsUnlocked(false);
      localStorage.removeItem("list-geroya-additional-spells");
      setSelectedSources(current => current.filter(source => !additionalSpellSources.has(source) && source !== "IDRotF"));
      return;
    }
    if (additionalSpellsAcknowledged) {
      setAdditionalSpellsUnlocked(true);
      localStorage.setItem("list-geroya-additional-spells", "enabled");
      return;
    }
    setShowAdditionalSpellWarning(true);
  }

  function confirmAdditionalSpells() {
    setAdditionalSpellsUnlocked(true);
    setAdditionalSpellsAcknowledged(true);
    setShowAdditionalSpellWarning(false);
    localStorage.setItem("list-geroya-additional-spells", "enabled");
    localStorage.setItem("list-geroya-additional-spells-warning", "acknowledged");
  }

  function pick(id: string) {
    if (step === 0) {
      const raceVariantOptions = variantsFor(id);
      setCharacter(current => ({
        ...current,
        race: id,
        raceVariant: raceVariantOptions.length ? "" : "base",
        raceAbilityChoices: [],
        raceSkills: [],
        feats: [],
        asiChoices: [],
        advancements: [],
        languages: [],
        proficiencyChoices: {},
      }));
      if (raceVariantOptions.length) setDetailsId(id);
    }
    if (step === 1) setCharacter(current => syncAdvancements({ ...current, className: id, subclass: "", classSkills: [], spells: [], preparedSpells: [], lssSpellCards: undefined, classChoices: {}, proficiencyChoices: {}, equipmentSelections: defaultEquipmentSelections(id), spellSlotsUsed: [], pactSlotsUsed: 0, resourceSpent: {} }, []));
    if (step === 3) {
      const option = backgrounds.find(item => item.id === id);
      const backgroundSkills = backgroundRule(id, option).skills;
      const startingGold = backgroundStartingGold(id, option);
      setCharacter(current => ({
        ...current,
        background: id,
        backgroundSkills,
        classSkills: [],
        languages: [],
        proficiencyChoices: {},
        personality: initial.personality,
        currency: { ...initial.currency, ...current.currency, gp: startingGold },
      }));
    }
  }

  function canContinue() {
    if (step === 0) return !!character.race && (!variantsFor(character.race).length || !!character.raceVariant);
    if (step === 1) return !!character.className;
    if (step === 2) {
      const choiceCount = chosenRaceVariant?.chooseBonuses?.count || 0;
      const raceSkillCount = raceSkillChoiceCount(character);
      return pointRemaining === 0 && (character.raceAbilityChoices || []).length === choiceCount && (character.raceSkills || []).length === raceSkillCount;
    }
    if (step === 3) return !!character.background;
    if (step === 4) return character.classSkills.length === classRule.count;
    if (step === 5) return equipmentComplete(character);
    if (step === 6) {
      const needsSubclass = !!subclassData && character.level >= subclassData.level;
      const allComplete = advancements.every(choice => advancementChoiceComplete(choice, spells, character.level));
      return (!needsSubclass || !!character.subclass) && completedAdvancements.length === featSlots && allComplete && classChoicesComplete(rulesCharacter, spells);
    }
    if (step === 7 && spellRule.caster) {
      const legalLevels = !spellRule.levelLimits || spellRule.levelLimits.every((limit, level) => level === 0 || selectedAtOrAbove[level] <= limit);
      const preparedComplete = spellRule.mode !== "spellbook" || selectedPrepared.length === spellRule.prepared;
      return selectedCantrips.length === spellRule.cantrips && selectedLeveled.length === spellRule.leveled && legalLevels && preparedComplete;
    }
    if (step === 8) return (character.languages || []).length === languageRequirements.choices && proficiencyChoicesComplete(exportCharacter);
    if (step === 9) return Object.values(character.personality).every(Boolean);
    return true;
  }

  function continueBlockReason() {
    if (step === 0) return !character.race ? "Выберите расу." : "Выберите обязательный вариант расы или подрасу.";
    if (step === 1) return "Выберите класс.";
    if (step === 2) {
      if (pointRemaining !== 0) return pointRemaining > 0 ? `Распределите ещё ${pointRemaining} очк. Point Buy.` : "Распределение превышает 27 очков Point Buy.";
      const choiceCount = chosenRaceVariant?.chooseBonuses?.count || 0;
      if ((character.raceAbilityChoices || []).length !== choiceCount) return `Выберите ${choiceCount} расовых бонуса характеристик.`;
      return `Выберите ${raceSkillChoiceCount(character)} расовых владения навыками.`;
    }
    if (step === 3) return "Выберите предысторию.";
    if (step === 4) return `Выберите навыки класса: ${character.classSkills.length} из ${classRule.count}.`;
    if (step === 5) return "Заполните каждый обязательный выбор стартового снаряжения.";
    if (step === 6) {
      if (subclassData && character.level >= subclassData.level && !character.subclass) return "Выберите подкласс.";
      const unfinished = advancements.find(choice => !advancementChoiceComplete(choice, spells, character.level));
      if (unfinished) return `Завершите выбор ${unfinished.origin ? "черты происхождения" : `на ${unfinished.level}-м уровне`}: черту, повышение характеристик и все дополнительные решения.`;
      if (!classChoicesComplete(rulesCharacter, spells)) return "Заполните все обязательные выборы способностей класса.";
    }
    if (step === 7 && spellRule.caster) {
      if (selectedCantrips.length !== spellRule.cantrips) return `Выберите заговоры: ${selectedCantrips.length} из ${spellRule.cantrips}.`;
      if (selectedLeveled.length !== spellRule.leveled) return `Выберите ${spellRule.title.toLowerCase()}: ${selectedLeveled.length} из ${spellRule.leveled}.`;
      if (spellRule.levelLimits?.some((limit, level) => level > 0 && selectedAtOrAbove[level] > limit)) return "Превышен допустимый лимит заклинаний высокого круга.";
      if (spellRule.mode === "spellbook" && selectedPrepared.length !== spellRule.prepared) return `Подготовьте заклинания из книги: ${selectedPrepared.length} из ${spellRule.prepared}.`;
    }
    if (step === 8) {
      if ((character.languages || []).length !== languageRequirements.choices) return `Выберите дополнительные языки: ${(character.languages || []).length} из ${languageRequirements.choices}.`;
      return "Заполните все обязательные владения инструментами и другие выборы.";
    }
    if (step === 9) return "Заполните черты характера, идеал, привязанность и слабость.";
    return "Завершите обязательные выборы на этом шаге.";
  }

  function tryContinue() {
    if (!canContinue()) {
      alert(continueBlockReason());
      return;
    }
    resetFilters(step + 1);
  }

  function toggleSkill(name: string) {
    setCharacter(current => {
      const has = current.classSkills.includes(name);
      if (!has && current.classSkills.length >= classRule.count) return current;
      return { ...current, classSkills: has ? current.classSkills.filter(skill => skill !== name) : [...current.classSkills, name] };
    });
  }

  function toggleLanguage(name: string) {
    setCharacter(current => {
      const selected = current.languages || [];
      const next = selected.includes(name)
        ? selected.filter(language => language !== name)
        : selected.length < languageRequirements.choices ? [...selected, name] : selected;
      return { ...current, languages: next };
    });
  }

  function toggleProficiencyChoice(key: string, value: string, limit: number) {
    setCharacter(current => {
      const choices = current.proficiencyChoices || {};
      const selected = choices[key] || [];
      if (!selected.includes(value) && proficiencyChoiceUsedElsewhere(current, key, value)) return current;
      const next = selected.includes(value)
        ? selected.filter(item => item !== value)
        : selected.length < limit ? [...selected, value] : limit === 1 ? [value] : selected;
      return { ...current, proficiencyChoices: { ...choices, [key]: next } };
    });
  }

  function toggleEquipment(groupKey: string, optionId: string, limit: number) {
    setCharacter(current => {
      const selections = current.equipmentSelections || {};
      const selected = selections[groupKey] || [];
      const next = selected.includes(optionId)
        ? selected.filter(id => id !== optionId)
        : selected.length < limit ? [...selected, optionId] : limit === 1 ? [optionId] : selected;
      return { ...current, equipmentSelections: { ...selections, [groupKey]: next } };
    });
  }

  function chooseOptimalEquipment() {
    setCharacter(current => ({
      ...current,
      equipmentSelections: optimalEquipmentSelections(current.className, finalAbilityScores(current), {
        classChoices: current.classChoices,
        subclass: current.subclass,
        feats: deriveLegacyAdvancementFields(current.advancements || []).feats,
      }),
    }));
  }

  function toggleSpell(id: string) {
    const level = spells.find(spell => spell.id === id)?.level || 0;
    setCharacter(current => {
   …15796 tokens truncated…овне нет ограниченного классового ресурса.</p>}
              </div>
              {subclassData && character.level >= subclassData.level && (
                <div className="subclass-picker" data-incomplete={!character.subclass}>
                  <div className="ability-editor-head"><div><small>С {subclassData.level} уровня</small><h2>Выберите подкласс</h2></div><span>{subclassData.options.length} вариантов</span></div>
                  <div className="subclass-grid">
                    {subclassData.options.filter(option => allowed(activeBan, "subclasses", `${character.className}:${option.id}`)).map(option => (
                      <button key={option.id} className={character.subclass === option.id ? "selected" : ""} onClick={() => setCharacter(current => ({ ...current, subclass: option.id, spells: [], preparedSpells: [], classChoices: {}, proficiencyChoices: {} }))}>
                        <span>{option.source}</span><strong>{option.name}</strong><p>{option.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {choiceGroups.length > 0 && (
                <div className="class-choice-section">
                  <div className="ability-editor-head"><div><small>Обязательные решения класса</small><h2>Настройка способностей</h2></div><span>{choiceGroups.filter(group => (character.classChoices?.[group.key] || []).length === group.count).length} / {choiceGroups.length}</span></div>
                  <p>Здесь собраны все постоянные выборы, которые открылись на выбранном уровне. Продолжить можно после заполнения каждой ветви.</p>
                  {choiceGroups.map(group => {
                    const selected = character.classChoices?.[group.key] || [];
                    return (
                      <section className="class-choice-group" key={group.key} data-incomplete={selected.length !== group.count}>
                        <header><div><small>{group.level} уровень</small><h3>{group.title}</h3><p>{group.description}</p></div><strong className={selected.length === group.count ? "complete" : ""}>{selected.length} / {group.count}</strong></header>
                        <div className="class-choice-grid">
                          {group.options.map(option => (
                            <button key={option.id} className={selected.includes(option.id) ? "selected" : ""} onClick={() => toggleClassChoice(group.key, option.id, group.count)}>
                              <span>{option.source}</span><strong>{option.name}</strong><p>{option.description}</p>{option.minLevel && <small>Требование: {option.minLevel} уровень</small>}
                            </button>
                          ))}
                        </div>
                      </section>
                    );
                  })}
                </div>
              )}
              <div className="tasha-panel">
                <label><input type="checkbox" checked={!!character.useTasha} onChange={event => toggleTasha(event.target.checked)} /><span><strong>Опциональные способности Tasha’s Cauldron of Everything</strong>Включить официальные дополнения, замены классовых способностей и расширенные списки заклинаний. При отключении выборы, доступные только по TCE, будут удалены.</span></label>
                {character.useTasha && <div className="feature-preview">{(optionalClassFeatures[character.className] || []).filter(feature => (feature.level || 1) <= character.level).map(feature => <div key={feature.name}><strong>{feature.level} ур. · {feature.name}</strong><p>{feature.description}</p></div>)}</div>}
              </div>
              {featSlots > 0 && (
                <div className="feat-picker">
                  <div className="ability-editor-head"><div><small>Прогрессия {selectedClass?.name || "класса"}</small><h2>Черты и увеличение характеристик</h2></div><span>{completedAdvancements.length} / {featSlots}</span></div>
                  <p>Каждый достигнутый уровень повышения даёт отдельный выбор. Воин получает дополнительные выборы на 6-м и 14-м уровнях, плут — на 10-м.</p>
                  {incompleteAsiAdvancements.length > 0 && <div className="advancement-warning">
                    <strong>Остались нераспределённые повышения характеристик</strong>
                    <p>Выбор черты на следующем уровне не скрывает их: вернитесь к каждому повышению и распределите обе единицы.</p>
                    <div>{incompleteAsiAdvancements.map(choice => <button key={choice.key} onClick={() => setAdvancementKey(choice.key)}>{choice.origin ? "Происхождение" : choice.bonus ? "Дополнительная черта" : `${choice.level} уровень`}: {choice.asiChoices.length}/2</button>)}</div>
                  </div>}
                  <div className="advancement-tabs">
                    {advancements.map(choice => (
                      <button
                        key={choice.key}
                        className={(activeAdvancement?.key === choice.key ? "active " : "") + (advancementChoiceComplete(choice, spells, character.level) ? "complete" : "")}
                        data-incomplete={!advancementChoiceComplete(choice, spells, character.level)}
                        onClick={() => setAdvancementKey(choice.key)}
                      >
                        <span>{choice.origin ? "Происхождение" : choice.bonus ? "Дополнительная черта" : `${choice.level} уровень`}</span>
                        <strong>{choice.featId ? feats.find(feat => feat.id === choice.featId)?.name : "Не выбрано"}</strong>
                        {choice.featId && choice.featId !== "asi" && !advancementChoiceComplete(choice, spells, character.level) && <em className="choice-required">требуется выбор</em>}
                      </button>
                    ))}
                  </div>
                  {activeAdvancement && <>
                  <div className="advancement-current">
                      <span>{activeAdvancement.origin ? "Черта происхождения" : activeAdvancement.bonus ? "Дополнительная черта" : `Выбор ${activeAdvancement.level}-го уровня`}</span>
                      {activeAdvancement.featId && <button onClick={() => chooseAdvancementFeat(activeAdvancement.key, "")}>Очистить выбор</button>}
                    </div>
                  <div className="feat-source-tools">
                    <label className="search">⌕<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Поиск по чертам" /></label>
                    <div className="feat-toolbar-actions">
                      <button onClick={() => setSelectedSources(catalogSources(featCatalog))}>Выбрать все источники</button>
                      <button onClick={() => setFeatsExpanded(value => !value)} aria-expanded={featsExpanded}>{featsExpanded ? "Свернуть черты" : "Развернуть черты"}</button>
                    </div>
                    <div className="source-filter" aria-label="Источники черт">{catalogSources(featCatalog).map(value => <button key={value} className={selectedSources.includes(value) ? "active" : ""} onClick={() => toggleSource(value)}>{value}</button>)}</div>
                  </div>
                  {!activeAdvancement.origin && <div className="feat-grid asi-option-grid">
                    <button className={activeAdvancement.featId === "asi" ? "selected" : ""} onClick={() => chooseAdvancementFeat(activeAdvancement.key, "asi")}><span>PHB</span><strong>Увеличение характеристик</strong><p>+2 к одной характеристике или +1 к двум (максимум 20).</p></button>
                  </div>}
                  {featsExpanded && featSourceGroups.map(group => {
                    const visible = group.feats.filter(feat => `${feat.name} ${feat.description} ${feat.requirement || ""}`.toLowerCase().includes(search.toLowerCase()));
                    if (!visible.length) return null;
                    return <section className="feat-source-table" key={group.book}>
                      {selectedSources.length > 1 && <h3>{group.book} <span>{visible.length}</span></h3>}
                      <div className="feat-grid">
                        {visible.map(feat => {
                          const met = featRequirementMet(rulesCharacter, feat.requirement);
                          return <button key={`${feat.id}-${met ? "open" : "locked"}`} className={`${activeAdvancement.featId === feat.id ? "selected " : ""}${!met ? "requirements-missed" : ""}`} onClick={() => chooseAdvancementFeat(activeAdvancement.key, feat.id)}>
                            <span>{feat.source}</span><strong>{feat.name}</strong><p>{feat.description}</p>{feat.requirement && <small>Требование: {feat.requirement}{!met ? " · требования не соблюдены" : ""}</small>}
                          </button>;
                        })}
                      </div>
                    </section>;
                  })}
                  {activeAdvancement.featId !== "asi" && featChoiceGroups(activeAdvancement, spells, character.level).length > 0 && (
                    <div className="feat-choice-builder" data-incomplete={!advancementChoiceComplete(activeAdvancement, spells, character.level)}>
                      <div className="ability-editor-head">
                        <div><small>Обязательные решения черты</small><h2>Настройте «{feats.find(feat => feat.id === activeAdvancement.featId)?.name}»</h2></div>
                        <span>{advancementChoiceComplete(activeAdvancement, spells, character.level) ? "Готово" : "Не завершено"}</span>
                      </div>
                      {featChoiceGroups(activeAdvancement, spells, character.level).map(group => {
                        const selected = activeAdvancement.featChoices?.[group.key] || [];
                        return <section className="feat-choice-group" key={group.key}>
                          <header><div><h3>{group.title}</h3><p>{group.description}</p></div><strong>{selected.length} / {group.count}</strong></header>
                          <div className="feat-choice-options">
                            {group.options.map(option => <button key={option.id} className={selected.includes(option.id) ? "selected" : ""} onClick={() => toggleFeatChoice(activeAdvancement.key, group.key, option.id, group.count)}>
                              <span>{selected.includes(option.id) ? "✓" : "+"}</span><strong>{option.name}</strong>{option.detail && <small>{option.detail}</small>}
                            </button>)}
                          </div>
                        </section>;
                      })}
                    </div>
                  )}
                  </>}
                  <div className="asi-stack">
                    {advancements.filter(choice => choice.featId === "asi").map(choice => (
                      <div className="asi-picker" key={choice.key} data-incomplete={choice.asiChoices.length < 2}>
                        <div className="ability-editor-head">
                          <div><small>Повышение характеристик</small><h2>Повышение характеристик {choice.level} уровень</h2></div>
                          <span>{choice.asiChoices.length} / 2</span>
                        </div>
                        <p>Добавьте +2 к одной характеристике или +1 к двум. Этот блок остаётся видимым независимо от выбора на следующих уровнях.</p>
                        <div className="asi-grid">
                          {(Object.keys(abilityLabels) as (keyof ExportCharacter["abilities"])[]).map(key => {
                            const count = choice.asiChoices.filter(item => item === key).length;
                            const previousBonus = advancements.filter(item => item.key !== choice.key && item.featId === "asi" && item.level <= choice.level).flatMap(item => item.asiChoices).filter(item => item === key).length;
                            const beforeAsi = character.abilities[key] + raceAbilityBonuses(character)[key] + previousBonus;
                            return <section key={key}>
                              <small>{abilityLabels[key]}</small>
                              <div className="score-control"><button onClick={() => changeAsiAbility(choice.key, key, -1)} disabled={count === 0}>−</button><strong>+{count}</strong><button onClick={() => changeAsiAbility(choice.key, key, 1)} disabled={choice.asiChoices.length >= 2 || count >= 2 || beforeAsi + count >= 20}>+</button></div>
                              <b>{beforeAsi} → {beforeAsi + count}</b>
                            </section>;
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 7 && (
            <>
              {!spellRule.caster ? (
                <div className="empty-state"><span>◇</span><h2>У класса нет базового выбора заклинаний</h2><p>Перейдите к характеру или вернитесь к выбору класса.</p></div>
              ) : (
                <>
                  <div className="spell-requirements" data-incomplete={selectedCantrips.length !== spellRule.cantrips || selectedLeveled.length !== spellRule.leveled}>
                    <div><span>Заговоры</span><strong className={selectedCantrips.length === spellRule.cantrips ? "complete" : ""}>{selectedCantrips.length} / {spellRule.cantrips}</strong></div>
                    <div><span>{spellRule.title}</span><strong className={selectedLeveled.length === spellRule.leveled ? "complete" : ""}>{selectedLeveled.length} / {spellRule.leveled}</strong></div>
                    {spellRule.mode === "spellbook" && <div><span>Подготовлено из книги</span><strong className={selectedPrepared.length === spellRule.prepared ? "complete" : ""}>{selectedPrepared.length} / {spellRule.prepared}</strong></div>}
                    <div><span>Доступный круг</span><strong>0–{spellRule.maxLevel}</strong></div>
                    <button onClick={chooseOptimalSpells}>✦ Выбрать оптимальный готовый список</button>
                    <button className="spell-reset" onClick={resetSpells}>Сбросить заклинания</button>
                  </div>
                  {spellRule.levelLimits ? (
                    <div className="spell-level-quotas">
                      {spellRule.levelLimits.slice(1).map((limit, index) => {
                        const level = index + 1;
                        const selected = selectedAtOrAbove[level] || 0;
                        return <div key={level} className={selected >= limit ? "at-limit" : ""}><span>{level} круг и выше</span><strong>{selected} / {limit}</strong><small>максимум</small></div>;
                      })}
                    </div>
                  ) : (
                    <p className="rule-note">Подготавливаемые заклинания можно распределять между доступными кругами в любой комбинации: ограничение задаёт общий размер подготовленного списка.</p>
                  )}
                  {!!alwaysPreparedEntries.length && (
                    <div className="always-prepared">
                      <div><small>Класс и подкласс</small><h2>Всегда подготовлены</h2><p>Добавляются автоматически, не занимают лимит и недоступны для повторного выбора.</p></div>
                      <div>{alwaysPreparedEntries.map(entry => {
                        const spell = spells.find(item => item.id === entry.id);
                        return spell ? <span className="always-prepared-spell" key={spell.id}><a href={spell.url || `https://dnd.su/spells/?search=${encodeURIComponent(spell.name)}`} target="_blank" rel="noreferrer">{spell.name} · {levelLabel(spell.level)} ↗</a><small>{entry.source}</small></span> : null;
                      })}</div>
                    </div>
                  )}
                  <div className="known-spell-picker" data-incomplete={selectedCantrips.length !== spellRule.cantrips || selectedLeveled.length !== spellRule.leveled}>
                    <div className="ability-editor-head">
                      <div><small>{spellRule.mode === "spellbook" ? "Книга заклинаний" : "Список персонажа"}</small><h2>{spellRule.mode === "spellbook" ? "Известные заклинания — в книге" : "Известные заклинания"}</h2></div>
                      <span>{selectedCantrips.length + selectedLeveled.length} / {spellRule.cantrips + spellRule.leveled}</span>
                    </div>
                    <p>Это полный выбранный список. Кнопка «Выбрать оптимальный» сначала очищает прежний список и заново заполняет и книгу, и подготовку.</p>
                    <div>{ordinarySpellIds.map(id => {
                      const spell = spells.find(item => item.id === id);
                      return spell ? <button key={id} onClick={() => toggleSpell(id)}><span>×</span><strong>{spell.name}</strong><small>{levelLabel(spell.level)}</small></button> : null;
                    })}</div>
                  </div>
                  {spellRule.mode === "spellbook" && (
                    <div className="prepared-picker" data-incomplete={selectedPrepared.length !== spellRule.prepared}>
                      <div className="ability-editor-head"><div><small>Текущий список на день</small><h2>Подготовить из книги</h2></div><span>{selectedPrepared.length} / {spellRule.prepared}</span></div>
                      <p>Заговоры не подготавливаются. Выберите заклинания из книги; автоматически подготовленные заклинания находятся выше и не расходуют этот лимит.</p>
                      <div>
                        {selectedLeveled.map(id => {
                          const spell = spells.find(item => item.id === id);
                          return spell ? <button key={id} className={selectedPrepared.includes(id) ? "selected" : ""} onClick={() => togglePreparedSpell(id)}><span>{selectedPrepared.includes(id) ? "✓" : "+"}</span><strong>{spell.name}</strong><small>{levelLabel(spell.level)}</small></button> : null;
                        })}
                      </div>
                    </div>
                  )}
                  <div className="tools">
                    <label className="search">⌕<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Название, школа или эффект" /></label>
                    <div className="source-filter" aria-label="Источники заклинаний">{sources.map(value => <button key={value} className={selectedSources.includes(value) ? "active" : ""} onClick={() => toggleSource(value)}>{value}</button>)}</div>
                  </div>
                  <div className="spell-level-filter" aria-label="Фильтр заклинаний по кругу">
                    <button className={spellLevel === "all" ? "active" : ""} onClick={() => setSpellLevel("all")}>Все</button>
                    {Array.from({ length: spellRule.maxLevel + 1 }, (_, level) => (
                      <button key={level} className={spellLevel === level ? "active" : ""} onClick={() => setSpellLevel(level)}>{levelLabel(level)}</button>
                    ))}
                  </div>
                  <div className="spell-level-filter ritual-filter" aria-label="Фильтр заклинаний по ритуальности">
                    <button className={ritualFilter === "all" ? "active" : ""} onClick={() => setRitualFilter("all")}>Все</button>
                    <button className={ritualFilter === "ritual" ? "active" : ""} onClick={() => setRitualFilter("ritual")}>Ритуалы</button>
                    <button className={ritualFilter === "nonritual" ? "active" : ""} onClick={() => setRitualFilter("nonritual")}>Не ритуалы</button>
                  </div>
                  <div className="spell-list">
                    {filteredSpells.map(spell => (
                      <article key={spell.id} className={character.spells.includes(spell.id) ? "selected" : ""}>
                        <span className="spell-level">{spell.level}</span>
                        <div><h3>{spell.name}</h3><small>{levelLabel(spell.level)} · {spell.school} · {spell.source}{spell.ritual ? " · ритуал" : ""}{isTashaAdditionalSpell(character, spell.id) && !spell.classes.includes(character.className) ? " · расширенный список TCE" : ""}{chosenSubclass?.expandedSpells?.includes(spell.id) && !spell.classes.includes(character.className) ? ` · список: ${chosenSubclass.name}` : ""}</small><p>{spell.description}</p></div>
                        <div className="spell-actions"><a href={spell.url || `https://dnd.su/spells/?search=${encodeURIComponent(spell.name)}`} target="_blank" rel="noreferrer" aria-label={`Открыть ${spell.name} на dnd.su`}>dnd.su ↗</a><button onClick={() => toggleSpell(spell.id)}>{character.spells.includes(spell.id) ? "✓" : "+"}</button></div>
                      </article>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {step === 8 && (
            <div className="skill-sections language-step proficiency-choice-step">
              <section className="skill-source" data-incomplete={(character.languages || []).length !== languageRequirements.choices}>
                <div className="skill-source-head"><div><small>Раса, подраса, класс и предыстория</small><h2>Известные языки</h2></div><strong>{(character.languages || []).length} / {languageRequirements.choices}</strong></div>
                <p>Фиксированные языки отмечены галочкой. Выберите ещё {languageRequirements.choices}; этот выбор попадёт на итоговый лист и в оба экспорта.</p>
                <div className="proficiency-grid">
                  {languageRequirements.fixed.map(language => <button disabled className="selected" key={language}><span>✓</span>{language}</button>)}
                  {knownLanguageOptions.filter(language => !languageRequirements.fixed.includes(language)).map(language => (
                    <button key={language} className={(character.languages || []).includes(language) ? "selected" : ""} onClick={() => toggleLanguage(language)}>
                      <span>{(character.languages || []).includes(language) ? "✓" : "+"}</span>{language}
                    </button>
                  ))}
                </div>
              </section>
              {proficiencyRequirements.map(requirement => {
                const selected = character.proficiencyChoices?.[requirement.key] || [];
                return <section className="skill-source" key={requirement.key} data-incomplete={selected.length !== requirement.count}>
                  <div className="skill-source-head"><div><small>{requirement.source}</small><h2>{requirement.title}</h2></div><strong>{selected.length} / {requirement.count}</strong></div>
                  <p>{requirement.description}</p>
                  <div className="proficiency-grid">
                    {requirement.options.map(option => {
                      const usedElsewhere = !selected.includes(option) && proficiencyChoiceUsedElsewhere(exportCharacter, requirement.key, option);
                      return <button key={option} disabled={usedElsewhere} title={usedElsewhere ? "Этот вариант уже выбран в другой таблице" : undefined} className={selected.includes(option) ? "selected" : ""} onClick={() => toggleProficiencyChoice(requirement.key, option, requirement.count)}>
                      <span>{selected.includes(option) ? "✓" : "+"}</span>{option}
                      {usedElsewhere && <small>Уже выбрано</small>}
                    </button>;})}
                  </div>
                </section>;
              })}
              {!proficiencyRequirements.length && <section className="skill-source"><div className="skill-source-head"><div><small>Инструменты</small><h2>Дополнительного выбора нет</h2></div><strong>✓</strong></div><p>Все владения инструментами, оружием и доспехами этого персонажа выдаются фиксированно и уже внесены в итоговый список.</p></section>}
            </div>
          )}

          {step === 9 && (
            <div className="personality-builder">
              <div className="personality-toolbar">
                <div><small>Основано на предыстории</small><strong>{selectedBackground?.name}</strong></div>
                <button onClick={randomizeAllPersonality}>Случайно заполнить всё</button>
              </div>
              {(Object.keys(personalityNames) as PersonalityKey[]).map(key => (
                <section key={key} className="personality-card">
                  <header><div><small>{personalityHints[key]}</small><h2>{personalityNames[key]}</h2></div><button onClick={() => randomPersonality(key)}>⚄ Случайно</button></header>
                  <textarea value={character.personality[key]} onChange={event => setPersonality(key, event.target.value)} placeholder="Напишите свой вариант…" />
                  <label>
                    <span>Или выберите готовый вариант</span>
                    <select value="" onChange={event => event.target.value && setPersonality(key, event.target.value)}>
                      <option value="">Выбрать из списка…</option>
                      {personalityLists[key].map(value => <option key={value} value={value}>{value}</option>)}
                    </select>
                  </label>
                </section>
              ))}
            </div>
          )}

          {step === 10 && (
            <div className="final-workspace">
              <div className="identity-editor">
                <label>Имя персонажа<input value={character.name} onChange={event => setCharacter(current => ({ ...current, name: event.target.value }))} placeholder="Введите имя" /></label>
                <label>Имя игрока<input value={character.playerName} onChange={event => setCharacter(current => ({ ...current, playerName: event.target.value }))} placeholder="Необязательно" /></label>
                <label>Мировоззрение<select value={character.alignment} onChange={event => setCharacter(current => ({ ...current, alignment: event.target.value }))}>{alignments.map(value => <option key={value} value={value}>{value || "Не выбрано"}</option>)}</select></label>
                <button className={`mobile-sheet-toggle${mobileSheet ? " active" : ""}`} onClick={() => setMobileSheet(value => !value)}>Мобильный лист <small>ЭКСПЕРИМЕНТАЛЬНО</small></button>
              </div>
              {mobileSheet && <section className="mobile-character-sheet">
                <header>
                  <div><small>{selectedRace?.name} · {selectedClass?.name} {character.level}</small><h2>{character.name || "Безымянный герой"}</h2></div>
                  <button onClick={() => setMobileSheet(false)} aria-label="Закрыть мобильный лист">×</button>
                </header>
                <nav className="mobile-sheet-tabs" aria-label="Разделы мобильного листа">
                  {([
                    ["overview", "Обзор"], ["combat", "Бой"], ["spells", "Заклинания"],
                    ["resources", "Ресурсы"], ["equipment", "Снаряжение"], ["notes", "Заметки"],
                  ] as [MobileSheetTab, string][]).map(([id, label]) => <button key={id} className={mobileSheetTab === id ? "active" : ""} onClick={() => setMobileSheetTab(id)}>{label}</button>)}
                </nav>

                {mobileSheetTab === "overview" && <div className="mobile-sheet-panel mobile-overview">
                  <div className="mobile-stat-grid">
                    {(Object.keys(abilityLabels) as (keyof ExportCharacter["abilities"])[]).map(key => <div key={key}><small>{abilityLabels[key]}</small><strong>{finalAbilities[key]}</strong><span>{abilityModifier(finalAbilities[key]) >= 0 ? "+" : ""}{abilityModifier(finalAbilities[key])}</span></div>)}
                  </div>
                  <div className="mobile-quick-grid"><div><small>КД</small><strong>{ac.value}</strong></div><div><small>Инициатива</small><strong>{abilityModifier(finalAbilities.dex) >= 0 ? "+" : ""}{abilityModifier(finalAbilities.dex)}</strong></div><div><small>Скорость</small><strong>{character.race === "dwarf" ? 25 : chosenRaceVariant?.id === "wood" ? 35 : 30}</strong></div><div><small>Бонус мастерства</small><strong>+{proficiency}</strong></div></div>
                  <p><b>Раса:</b> {selectedRace?.name} · <b>Класс:</b> {selectedClass?.name} · <b>Предыстория:</b> {selectedBackground?.name}</p>
                </div>}

                {mobileSheetTab === "combat" && <div className="mobile-sheet-panel">
                  <div className="mobile-hp-card mobile-current-hp">
                    <div><label>Текущие хиты</label><strong>{character.currentHitPoints || 0}</strong><span>из {hitPoints}</span></div>
                    <div className="mobile-hp-adjuster" aria-label="Изменить текущие хиты"><button onClick={() => applyHitPointAdjustment(-1)} aria-label="Вычесть хиты">−</button><input type="number" min="0" value={hitPointAdjustment || ""} placeholder="0" onChange={event => setHitPointAdjustment(Math.max(0, Number(event.target.value) || 0))} aria-label="Число хитов для изменения" /><button onClick={() => applyHitPointAdjustment(1)} aria-label="Добавить хиты">+</button></div>
                  </div>
                  <div className="mobile-hp-card"><label>Временные хиты<input type="number" min="0" value={character.temporaryHitPoints || 0} onChange={event => setCharacter(current => ({ ...current, temporaryHitPoints: Math.max(0, Number(event.target.value) || 0) }))} /></label></div>
                  {(character.currentHitPoints || 0) <= 0 && <section className="mobile-death-saves" aria-label="Спасброски от смерти">
                    <strong>Спасброски от смерти</strong>
                    {(["success", "failure"] as const).map(kind => <div key={kind}><small>{kind === "success" ? "Успехи" : "Провалы"}</small><span>{[0, 1, 2].map(index => { const filled = (kind === "success" ? character.deathSaveSuccesses : character.deathSaveFailures) || 0; return <button key={index} className={filled > index ? "filled" : ""} onClick={() => setDeathSave(kind, index)} aria-label={`${kind === "success" ? "Успех" : "Провал"} ${index + 1}`} />; })}</span></div>)}
                  </section>}
                  <div className="mobile-rest-row"><div><span>к{classRules[character.className]?.hitDie || 8}</span><small>{character.level - (character.hitDiceSpent || 0)} / {character.level}</small><b>к отдыху: {hitDiceToRoll}</b></div><button className="hit-die-step" onClick={() => setHitDiceToRoll(value => Math.max(0, value - 1))} disabled={!hitDiceToRoll} aria-label="Уменьшить число костей хитов">−</button><button className="hit-die-button" onClick={() => setHitDiceToRoll(value => Math.min(character.level - (character.hitDiceSpent || 0), value + 1))} disabled={character.level - (character.hitDiceSpent || 0) <= hitDiceToRoll} aria-label="Добавить кость хитов к короткому отдыху">+</button><button onClick={takeShortRest}>Короткий отдых</button><button onClick={takeLongRest}>Длинный отдых</button></div>
                  {lastHitDieRoll !== null && <p className="mobile-roll-result">Восстановлено хитов: <b>{lastHitDieRoll}</b> (бросок выбранных костей + модификатор Телосложения к каждой)</p>}
                  <div className="mobile-attack-list">{attacks.map(attack => <article key={attack.id}><strong>{attack.name}</strong><span>{attack.attackBonus !== undefined ? `${attack.attackBonus >= 0 ? "+" : ""}${attack.attackBonus}` : `Сл ${attack.saveDc}`}</span><code>{attack.damageDisplay}</code></article>)}</div>
                </div>}

                {mobileSheetTab === "spells" && <div className="mobile-sheet-panel">
                  <div className="mobile-prepared-head"><h3>Заклинания</h3><span>{mobileSpellPool.length}</span></div>
                  {spellRule.prepared !== undefined && <p className="mobile-prepared-limit">Подготовлено: <b>{mobilePreparedIds.length}</b> из <b>{spellRule.prepared}</b>. Заговоры и всегда подготовленные заклинания лимит не занимают.</p>}
                  {!spellRule.caster && !mobileSpellPool.length ? <p>У персонажа нет доступных заклинаний.</p> : <div className="mobile-spell-list">{mobileSpellPool.map(spell => {
                    const automatic = spell.level === 0 || alwaysPreparedSet.has(spell.id) || grantedFeatSpells.includes(spell.id);
                    const prepared = automatic || mobilePreparedIds.includes(spell.id);
                    const canToggle = spell.level > 0 && !automatic && spellRule.prepared !== undefined;
                    return <button key={spell.id} className={prepared ? "prepared" : ""} onClick={() => canToggle && toggleMobilePreparedSpell(spell.id)} aria-disabled={!canToggle} title={canToggle ? "Подготовить или снять подготовку" : automatic ? "Доступно всегда" : "Известное заклинание"}><span>{spell.level === 0 ? "∞" : automatic ? "◆" : prepared ? "●" : "○"}</span><strong>{spell.name}</strong><small>{levelLabel(spell.level)}</small></button>;
                  })}</div>}
                  {spellRule.slots.length > 0 && <div className="mobile-slot-list mobile-spell-slots"><h3>Ячейки заклинаний</h3>{spellRule.slots.map((maximum, circle) => <article key={circle}><span>{circle + 1} круг</span><button onClick={() => setUsedSlots(circle, Math.min(maximum, (character.spellSlotsUsed?.[circle] || 0) + 1), maximum)}>Потратить</button><b>{maximum - (character.spellSlotsUsed?.[circle] || 0)} / {maximum}</b><button onClick={() => setUsedSlots(circle, Math.max(0, (character.spellSlotsUsed?.[circle] || 0) - 1), maximum)}>Вернуть</button></article>)}</div>}
                  {spellRule.pact && <div className="mobile-slot-list mobile-spell-slots"><h3>Ячейки договора · {spellRule.pact.level} круг</h3><article><span>Договор</span><button onClick={() => setCharacter(current => ({ ...current, pactSlotsUsed: Math.min(spellRule.pact!.slots, (current.pactSlotsUsed || 0) + 1) }))}>Потратить</button><b>{spellRule.pact.slots - (character.pactSlotsUsed || 0)} / {spellRule.pact.slots}</b><button onClick={() => setCharacter(current => ({ ...current, pactSlotsUsed: Math.max(0, (current.pactSlotsUsed || 0) - 1) }))}>Вернуть</button></article></div>}
                </div>}

                {mobileSheetTab === "resources" && <div className="mobile-sheet-panel">
                  <div className="mobile-rest-actions"><button onClick={takeShortRest}>Восстановить после короткого отдыха</button><button onClick={takeLongRest}>Восстановить после длинного отдыха</button></div>
                  <div className="mobile-resource-list">{resources.map(resource => <article key={resource.key}><div><strong>{resource.name}</strong><small>{resourceRestLabel(resource)} отдых</small></div><button onClick={() => setResourceCurrent(resource.key, Math.max(0, resourceCurrent(exportCharacter, resource) - (resource.unit || 1)), resource.max)}>−</button><b>{resourceCurrent(exportCharacter, resource)} / {resource.max}</b><button onClick={() => setResourceCurrent(resource.key, Math.min(resource.max, resourceCurrent(exportCharacter, resource) + (resource.unit || 1)), resource.max)}>+</button></article>)}</div>
                  {spellRule.slots.length > 0 && <div className="mobile-slot-list"><h3>Ячейки заклинаний</h3>{spellRule.slots.map((maximum, circle) => <article key={circle}><span>{circle + 1} круг</span><button onClick={() => setUsedSlots(circle, Math.min(maximum, (character.spellSlotsUsed?.[circle] || 0) + 1), maximum)}>Потратить</button><b>{maximum - (character.spellSlotsUsed?.[circle] || 0)} / {maximum}</b><button onClick={() => setUsedSlots(circle, Math.max(0, (character.spellSlotsUsed?.[circle] || 0) - 1), maximum)}>Вернуть</button></article>)}</div>}
                </div>}

                {mobileSheetTab === "equipment" && <div className="mobile-sheet-panel mobile-equipment-editor"><h3>Снаряжение</h3><label>Инвентарь<textarea value={character.inventoryOverride ?? equipmentItems.join("\n")} onChange={event => setCharacter(current => ({ ...current, inventoryOverride: event.target.value }))} aria-label="Инвентарь персонажа" placeholder="По одному предмету на строку" /></label><small>Можно переписать список полностью. Изменения сохраняются вместе с персонажем.</small><h3>Монеты</h3><div className="mobile-coin-grid">{(["gp", "sp", "cp", "pp"] as const).map(key => { const labels = { gp: "ЗМ", sp: "СМ", cp: "ММ", pp: "ПМ" } as const; return <label key={key}><span>{labels[key]}</span><input type="number" min="0" value={character.currency?.[key] || 0} onChange={event => setCharacter(current => ({ ...current, currency: { ...initial.currency, ...current.currency, [key]: Math.max(0, Number(event.target.value) || 0) } }))} aria-label={`${labels[key]}: количество`} /></label>; })}</div></div>}
                {mobileSheetTab === "notes" && <div className="mobile-sheet-panel mobile-notes"><h3>Характер и заметки</h3>{(Object.keys(personalityNames) as PersonalityKey[]).map(key => <label key={key}>{personalityNames[key]}<textarea value={character.personality[key]} onChange={event => setCharacter(current => ({ ...current, personality: { ...current.personality, [key]: event.target.value } }))} /></label>)}</div>}
              </section>}
              <div className="sheet-page">
                <header className="sheet-header">
                  <div className="sheet-name"><h2>{character.name || "Безымянный герой"}</h2><small>ИМЯ ПЕРСОНАЖА</small></div>
                  <div className="sheet-identity">
                    <div><strong>{selectedClass?.name} {character.level}{chosenSubclass ? ` · ${chosenSubclass.name}` : ""}</strong><small>КЛАСС, УРОВЕНЬ И ПОДКЛАСС</small></div>
                    <div><strong>{selectedBackground?.name}</strong><small>ПРЕДЫСТОРИЯ</small></div>
                    <div><strong>{character.playerName || "—"}</strong><small>ИМЯ ИГРОКА</small></div>
                    <div><strong>{selectedRace?.name}{chosenRaceVariant ? ` · ${chosenRaceVariant.name}` : ""}</strong><small>РАСА И ПОДРАСА</small></div>
                    <div><strong>{character.alignment || "—"}</strong><small>МИРОВОЗЗРЕНИЕ</small></div>
                    <div><strong>2014</strong><small>РЕДАКЦИЯ</small></div>
                  </div>
                </header>
                <div className="sheet-main">
                  <section className="sheet-stats">
                    {(Object.keys(abilityLabels) as (keyof ExportCharacter["abilities"])[]).map(key => (
                      <div className="stat-block" key={key}><small>{abilityLabels[key]}</small><strong>{abilityModifier(finalAbilities[key]) >= 0 ? "+" : ""}{abilityModifier(finalAbilities[key])}</strong><span>{finalAbilities[key]}</span></div>
                    ))}
                    <div className="sheet-box passive"><strong>{passivePerception}</strong><span>ПАССИВНАЯ МУДРОСТЬ</span></div>
                    <div className="sheet-box prof-list"><h3>ВЛАДЕНИЯ И ЯЗЫКИ</h3><p><b>Навыки:</b> {proficiencies.skills.join(", ") || "нет"}</p><p><b>Компетентность:</b> {expertise.join(", ") || "нет"}</p><p><b>Инструменты:</b> {proficiencies.tools.join(", ") || "нет"}</p><p><b>Языки:</b> {proficiencies.languages.join(", ") || "нет"}</p><p><b>Доспехи:</b> {proficiencies.armor.join(", ") || "нет"}</p><p><b>Оружие:</b> {proficiencies.weapons.join(", ") || "нет"}</p></div>
                  </section>
                  <section className="sheet-combat">
                    <div className="combat-row">
                      <div className="shield" title={`${ac.base}${ac.bonuses.length ? `; ${ac.bonuses.join(", ")}` : ""}`}><strong>{ac.value}</strong><span>КД</span></div>
                      <div className="combat-tile"><strong>{abilityModifier(finalAbilities.dex) >= 0 ? "+" : ""}{abilityModifier(finalAbilities.dex)}</strong><span>ИНИЦИАТИВА</span></div>
                      <div className="combat-tile"><strong>{character.race === "dwarf" ? 25 : chosenRaceVariant?.id === "wood" ? 35 : 30}</strong><span>СКОРОСТЬ</span></div>
                    </div>
                    <div className="sheet-box hp"><strong>{hitPoints}</strong><span>МАКСИМУМ ХИТОВ</span></div>
                    <div className="sheet-box hp-current"><label>ТЕКУЩИЕ ХИТЫ<input aria-label="Текущие хиты" type="number" min="0" max={hitPoints} value={character.currentHitPoints || ""} placeholder=" " onChange={event => setCharacter(current => ({ ...current, currentHitPoints: Math.max(0, Math.min(hitPoints, Number(event.target.value) || 0)) }))} /></label><label>ВРЕМЕННЫЕ ХИТЫ<input aria-label="Временные хиты" type="number" min="0" value={character.temporaryHitPoints || ""} placeholder=" " onChange={event => setCharacter(current => ({ ...current, temporaryHitPoints: Math.max(0, Number(event.target.value) || 0) }))} /></label></div>
                    <div className="sheet-box hit-dice"><strong>к{classRules[character.className]?.hitDie || 8}</strong><span>КОСТИ ХИТОВ</span><label><input aria-label="Оставшиеся кости хитов" type="number" min="0" max={character.level} value={character.level - (character.hitDiceSpent || 0)} onChange={event => setCharacter(current => ({ ...current, hitDiceSpent: Math.max(0, Math.min(current.level, current.level - (Number(event.target.value) || 0))) }))} /> / {character.level}</label></div>
                    {resources.length > 0 && <div className={`sheet-box sheet-resources sheet-resources--${resourceDensity}`}>
                      {resources.map(resource => {
                        const unit = resource.unit || 1;
                        const marks = Math.ceil(resource.max / unit);
                        const spentMarks = Math.ceil((resource.max - resourceCurrent(exportCharacter, resource)) / unit);
                        return <div className="sheet-resource" key={resource.key}><span>{resource.name}{resource.die ? ` (${resource.die})` : ""}{unit > 1 ? ` · 1 круг = ${unit} хитов` : ""}</span><div className="resource-marks">{Array.from({ length: marks }, (_, index) => <button type="button" className={index < spentMarks ? "spent" : ""} aria-label={`${resource.name}: ${index < spentMarks ? "снять" : "отметить"} расход ${index + 1}`} onClick={() => setResourceCurrent(resource.key, resource.max - (index < spentMarks ? index : index + 1) * unit, resource.max)} key={index} />)}</div><small>{resourceRestLabel(resource)} отдых</small></div>;
                      })}
                      <h3>РЕСУРСЫ</h3>
                    </div>}
                    <div className="sheet-box spell-summary">
                      <h3>АТАКИ И ЗАКЛИНАНИЯ</h3>
                      <div className="attack-table">
                        <div className="attack-head"><b>Атака</b><b>Попадание / Сл</b><b>Урон</b></div>
                        {attacks.length ? attacks.map(attack => (
                          <div className="attack-line" key={attack.id}>
                            <span>{attack.name}{attack.kind === "cantrip" ? " ✦" : ""}</span>
                            <b>{attack.attackBonus !== undefined ? `${attack.attackBonus >= 0 ? "+" : ""}${attack.attackBonus}` : `Сл ${attack.saveDc}`}</b>
                            <code>{attack.damageDisplay}</code>
                            {attack.note && <small>{attack.note}</small>}
                          </div>
                        )) : <p>Выберите стартовое оружие или боевой заговор.</p>}
                      </div>
                      {spellAbilityKey && <p><b>Сл заклинаний:</b> {spellSaveDc} · <b>атака:</b> {spellAttackBonus >= 0 ? "+" : ""}{spellAttackBonus}</p>}
                      {[...new Set([...character.spells, ...grantedFeatSpells, ...alwaysPrepared])].length ? [...new Set([...character.spells, ...grantedFeatSpells, ...alwaysPrepared])].map(id => {
                        const spell = spells.find(item => item.id === id);
                        if (!spell) return null;
                        const status = alwaysPrepared.includes(id)
                          ? "всегда подготовлено, вне лимита"
                          : spellRule.mode === "spellbook" && spell.level > 0
                            ? selectedPrepared.includes(id) ? "подготовлено" : "в книге"
                            : spellRule.mode === "prepared" && spell.level > 0 ? "подготовлено" : "";
                        return <p key={id}><a href={spell.url || `https://dnd.su/spells/?search=${encodeURIComponent(spell.name)}`} target="_blank" rel="noreferrer"><b>{spell.name}</b></a> — {levelLabel(spell.level)}, {spell.school}. {spell.description}{status ? ` (${status})` : ""}</p>;
                      }) : <p>Заклинания не выбраны.</p>}
                    </div>
                  </section>
                  <section className="sheet-story">
                    {(Object.keys(personalityNames) as PersonalityKey[]).map(key => (
                      <div className="sheet-box story-box" key={key}><p>{character.personality[key] || "—"}</p><h3>{personalityNames[key]}</h3></div>
                    ))}
                    <div className="sheet-box feature-box">
                      <h3>УМЕНИЯ И СПОСОБНОСТИ</h3>
                      <h4>{selectedRace?.name}: расовые особенности</h4>
                      {chosenRaceVariant && <p><b>{chosenRaceVariant.name}.</b> {chosenRaceVariant.description}</p>}
                      {selectedRaceFeatures.map(feature => <p key={feature.name}><b>{feature.name}.</b> {feature.description}</p>)}
                      <h4>{selectedClass?.name}: классовые особенности до {character.level} уровня</h4>
                      {selectedClassFeatures.map(feature => <p key={`${feature.level}-${feature.name}`}><b>{feature.name}.</b> {feature.description}</p>)}
                      {selectedFeatFeatures.length > 0 && <><h4>Черты</h4>{selectedFeatFeatures.map(feature => <p key={feature.name}><b>{feature.name}.</b> {feature.description}</p>)}</>}
                      <h4>{selectedBackground?.name}: предыстория</h4>
                      <p>{selectedBackground?.description}</p>
                      <p><b>{selectedBackgroundRule.feature.name}.</b> {selectedBackgroundRule.feature.description}</p>
                    </div>
                    <div className="sheet-box feature-box"><h3>СТАРТОВОЕ СНАРЯЖЕНИЕ</h3><p>{displayedInventory.join(" · ") || "Не выбрано"}</p><p><b>Расчёт КД:</b> {ac.base}{ac.bonuses.length ? `; ${ac.bonuses.join(", ")}` : ""} = <b>{ac.value}</b></p></div>
                  </section>
                </div>
              </div>
              <PdfCharacterSheet
                identity={{
                  name: character.name,
                  playerName: character.playerName,
                  className: selectedClass?.name || "Класс не выбран",
                  subclassName: chosenSubclass?.name,
                  raceName: [selectedRace?.name, chosenRaceVariant?.name].filter(Boolean).join(" · ") || "Раса не выбрана",
                  backgroundName: selectedBackground?.name || "Предыстория не выбрана",
                  alignment: character.alignment,
                  level: character.level,
                }}
                classId={character.className}
                abilities={finalAbilities}
                proficiency={proficiency}
                savingThrows={classRules[character.className]?.saves || []}
                proficiencies={{ ...proficiencies, expertise }}
                ac={ac.value}
                initiative={abilityModifier(finalAbilities.dex)}
                speed={character.race === "dwarf" ? 25 : chosenRaceVariant?.id === "wood" ? 35 : 30}
                hitPoints={hitPoints}
                hitDie={classRules[character.className]?.hitDie || 8}
                currentHitPoints={character.currentHitPoints}
                temporaryHitPoints={character.temporaryHitPoints}
                hitDiceRemaining={character.level - (character.hitDiceSpent || 0)}
                passivePerception={passivePerception}
                attacks={attacks}
                resources={[
                  ...resources.map(resource => ({ name: resource.name, current: resourceCurrent(exportCharacter, resource), max: resource.max, die: resource.die, unit: resource.unit, isShortRest: resource.isShortRest, isLongRest: resource.isLongRest })),
                ]}
                classFeatures={selectedClassFeatures}
                raceFeatures={selectedRaceFeatures}
                featFeatures={selectedFeatFeatures}
                backgroundFeature={selectedBackgroundRule.feature}
                equipment={displayedInventory}
                currency={character.currency || initial.currency}
                personality={character.personality}
                spellAbility={spellAbilityKey ? abilityLabels[spellAbilityKey] : undefined}
                spellSaveDc={spellAbilityKey ? spellSaveDc : undefined}
                spellAttackBonus={spellAbilityKey ? spellAttackBonus : undefined}
                spellSlots={spellRule.slots}
                preparedMaximum={spellRule.prepared}
                spells={[...new Set([...character.spells, ...grantedFeatSpells, ...alwaysPrepared])].map(id => spells.find(spell => spell.id === id)).filter(Boolean).map(spell => ({
                  ...spell!,
                  prepared: mobilePreparedIds.includes(spell!.id),
                  alwaysPrepared: alwaysPrepared.includes(spell!.id),
                }))}
              />
              <div ref={exportPanelRef} className="export-panel">
                <div>
                  <small>Проверено по приложенным образцам</small>
                  <h2>Экспорт листа</h2>
                  <p>Укажите уже потраченные ячейки, если переносите персонажа из текущей игры. У нового героя оставьте нули.</p>
                  <p className="export-compatibility">Long Story Short получает выбранные здесь заклинания текстовым списком по кругам со ссылками dnd.su. При импорте общая ссылка автоматически связывает карточку с нашим каталогом; исходные ID сохраняются для обратного переноса. Helpmate получает только проверенные внутренние ID конкретных заклинаний и заранее показывает отсутствующие карточки.</p>
                  <details className="known-limitations">
                    <summary>Известные ограничения и временные решения</summary>
                    {knownLimitations.map(item => <p key={item.area}><b>{item.area} · {item.status}.</b> {item.text}</p>)}
                  </details>
                </div>
                {spellRule.slots.length > 0 && <div className="slot-usage-editor">
                  {spellRule.slots.map((maximum, circle) => <label key={circle}><span>{circle + 1} круг</span><input type="number" min="0" max={maximum} value={character.spellSlotsUsed?.[circle] || 0} onChange={event => setUsedSlots(circle, +event.target.value, maximum)} /><small>потрачено из {maximum}</small></label>)}
                </div>}
                {spellRule.pact && <div className="slot-usage-editor"><label><span>Ячейки договора</span><input type="number" min="0" max={spellRule.pact.slots} value={character.pactSlotsUsed || 0} onChange={event => setCharacter(current => ({ ...current, pactSlotsUsed: Math.max(0, Math.min(spellRule.pact!.slots, +event.target.value)) }))} /><small>потрачено из {spellRule.pact.slots}</small></label></div>}
                {resources.length > 0 && <div className="slot-usage-editor resource-usage-editor">
                  {resources.map(resource => <label key={resource.key}><span>{resource.name}</span><input type="number" min="0" max={resource.max} value={resourceCurrent(exportCharacter, resource)} onChange={event => setResourceCurrent(resource.key, +event.target.value, resource.max)} /><small>осталось из {resource.max}{resource.die ? ` · ${resource.die}` : ""}</small></label>)}
                </div>}
                <button onClick={resetCurrentCharacter}>Сбросить</button>
                <button onClick={exportNative}>Наш JSON</button>
                <button onClick={() => window.print()}>PDF-лист · страницы создаются автоматически</button>
                <button onClick={exportHelpmate}>Helpmate JSON</button>
                <button className="primary-action" onClick={exportLongStoryShort}>Long Story Short JSON</button>
              </div>
            </div>
          )}

          <div className="mobile-actions">
            {step > 0 && <button onClick={() => resetFilters(step - 1)}>← Назад</button>}
            {step < steps.length - 1 && <button className={!canContinue() ? "blocked" : ""} aria-disabled={!canContinue()} onClick={tryContinue}>Продолжить →</button>}
            {step === steps.length - 1 && <button onClick={scrollToExports}>Экспорт ↓</button>}
          </div>
        </section>
        <aside className="summary">
          <div className="summary-ornament">✦</div>
          <p className="eyebrow">Ваш герой</p>
          <CatalogIcon
            id={selectedClass?.id || selectedRace?.id}
            kind={selectedClass ? "class" : "race"}
            fallback={selectedClass?.name || selectedRace?.name || "Новый герой"}
            className="portrait"
            experimental={usesOrnateIcons}
          />
          <h2>{character.name || selectedRace?.name || "Новый герой"}</h2>
          <p className="summary-line">{selectedRace?.name || "Раса не выбрана"} · {selectedClass?.name || "Класс не выбран"}</p>
          <div className="summary-facts">
            <div><span>Уровень</span><strong>{character.level}</strong></div>
            <div><span>Предыстория</span><strong>{selectedBackground?.name || "—"}</strong></div>
            <div><span>Владения</span><strong>{proficiencies.skills.length || "—"}</strong></div>
            <div><span>Языки</span><strong>{knownLanguages.length || "—"}</strong></div>
            <div><span>Снаряжение</span><strong>{displayedInventory.length || "—"}</strong></div>
            <div><span>Заклинания</span><strong>{character.spells.length + alwaysPrepared.length || "—"}</strong></div>
          </div>
          <div className="progress-label"><span>Шаг {step + 1} из {steps.length}</span><span>{Math.round((step + 1) / steps.length * 100)}%</span></div>
          <div className="progress"><i style={{ width: `${(step + 1) / steps.length * 100}%` }} /></div>
          {step > 0 && <button className="back" onClick={() => resetFilters(step - 1)}>← Назад</button>}
          {step < steps.length - 1
            ? <button className={`primary-action${!canContinue() ? " blocked" : ""}`} aria-disabled={!canContinue()} onClick={tryContinue}>Продолжить <span>→</span></button>
            : <button className="primary-action" onClick={scrollToExports}>Экспорт <span>↓</span></button>}
        </aside>
      </div>
      <footer>Неофициальный инструмент для личного некоммерческого использования. Dungeons &amp; Dragons и названия книг принадлежат правообладателям. Описания оригинально сформулированы для этого приложения.</footer>
      <UpdateHistory />
    </main>
  );
}
