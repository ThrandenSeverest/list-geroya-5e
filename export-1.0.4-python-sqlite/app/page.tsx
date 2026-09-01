"use client";

import { ChangeEvent, Component, type MouseEvent, useEffect, useMemo, useRef, useState } from "react";
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
import { backgroundChoiceGroups, backgroundFixedSkills } from "./backgroundChoices";
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
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

type Category = "races" | "classes" | "subclasses" | "backgrounds" | "feats" | "spells";
type BanMode = "deny" | "allow";
type BanList = { version: 2; name: string; mode: BanMode; categories: Record<Category, string[]>; tceOptionalFeaturesBanned?: boolean; tceFullBanned?: boolean };
type PersonalityKey = keyof ExportCharacter["personality"];
type CharacterFolder = { id: string; name: string; createdAt: string };
type CharacterSlot = { id: string; character: ExportCharacter; updatedAt: string; folderId?: string };
type CharacterVault = { version: 1; capacity: number; activeId: string; slots: CharacterSlot[]; folders: CharacterFolder[] };
type FolderImportItem = { key: string; name: string; character: ExportCharacter; selected: boolean };
type FolderImportDraft = { archiveName: string; folderName: string; items: FolderImportItem[] };
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
  backgroundChoices: {},
  expertiseSkills: [],
  level: 1,
  spells: [],
  preparedSpells: [],
  name: "",
  playerName: "",
  experience: 0,
  inspiration: false,
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
  version: "1.0.5",
  publishedAt: "2026-09-01T18:00:00Z",
  changes: [
    "В коллекции персонажей появились папки: создание, переименование и фильтрация сохранений.",
    "Добавлены галочки, массовый перенос между папками и удаление нескольких персонажей.",
    "Папку можно экспортировать ZIP-архивом с JSON-файлами и импортировать с предварительным выбором персонажей.",
  ],
}, {
  version: "1.0.4",
  publishedAt: "2026-08-31T18:00:00Z",
  changes: [
    "Каталог предысторий расширен до полного официального списка 5e14 DND.su: 84 варианта из 19 источников.",
    "Для предысторий добавлены проверенные навыки, инструменты, языки и описания особенностей; варианты с обязательным выбором теперь явно отмечены в интерфейсе.",
    "Данные подготовлены к локализации: предыстории вынесены в отдельный структурированный каталог без изменения текущего русского интерфейса."
  ],
}, {
  version: "1.0.3",
  publishedAt: "2026-08-16T18:00:00Z",
  changes: [
    "Пользовательский backend перенесён с Cloudflare Worker и D1 на FastAPI, SQLite, SQLAlchemy и Alembic.",
    "Сохранены аккаунты, старые PBKDF2-пароли, сессии и Vault; подготовлена отправка писем через SMTP.",
    "Светлый дизайн приведён к чёрной типографике и красным активным состояниям; исправлены мобильные переполнения.",
    "Кнопка финального шага «Экспорт» открывает все способы экспорта, а история обновлений скрыта в мобильном меню."
  ],
}, {
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

function folderId() {
  return `folder-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeVault(value: Partial<CharacterVault> | null | undefined): CharacterVault {
  const folders = Array.isArray(value?.folders)
    ? value.folders.filter(folder => folder && typeof folder.id === "string" && typeof folder.name === "string")
    : [];
  const folderIds = new Set(folders.map(folder => folder.id));
  const slots = Array.isArray(value?.slots) ? value.slots.map(slot => ({
    ...slot,
    character: normalizeCharacter(slot.character),
    folderId: slot.folderId && folderIds.has(slot.folderId) ? slot.folderId : undefined,
  })) : [];
  const activeId = slots.some(slot => slot.id === value?.activeId) ? value!.activeId! : slots[0]?.id || "";
  return { version: 1, capacity: Math.max(5, value?.capacity || 5, slots.length), activeId, slots, folders };
}

function mergeVaults(local: CharacterVault, remote: CharacterVault | null): CharacterVault {
  if (!remote?.slots?.length) return local;
  const remoteNormalized = normalizeVault(remote);
  const folders = new Map<string, CharacterFolder>();
  for (const folder of [...remoteNormalized.folders, ...local.folders]) folders.set(folder.id, folder);
  const slots = new Map<string, CharacterSlot>();
  for (const slot of [...remoteNormalized.slots, ...local.slots]) {
    const previous = slots.get(slot.id);
    if (!previous || Date.parse(slot.updatedAt) >= Date.parse(previous.updatedAt)) {
      slots.set(slot.id, { ...slot, character: normalizeCharacter(slot.character) });
    }
  }
  const mergedSlots = [...slots.values()].sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
  const activeId = mergedSlots.some(slot => slot.id === local.activeId)
    ? local.activeId
    : mergedSlots.some(slot => slot.id === remoteNormalized.activeId) ? remoteNormalized.activeId : mergedSlots[0]?.id || "";
  return { version: 1, capacity: Math.max(5, local.capacity, remoteNormalized.capacity, mergedSlots.length), activeId, slots: mergedSlots, folders: [...folders.values()] };
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
    tceOptionalFeaturesBanned: !!value.tceOptionalFeaturesBanned,
    tceFullBanned: !!value.tceFullBanned,
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

function syncAdvancements(character: ExportCharacter, advancements: AdvancementChoice[] = []) {
  return { ...character, advancements, ...deriveLegacyAdvancementFields(advancements) };
}

type BuilderErrorBoundaryProps = { children: React.ReactNode };
type BuilderErrorBoundaryState = { error: Error | null };

class BuilderErrorBoundary extends Component<BuilderErrorBoundaryProps, BuilderErrorBoundaryState> {
  state: BuilderErrorBoundaryState = { error: null };
  static getDerivedStateFromError(error: Error): BuilderErrorBoundaryState { return { error }; }
  render() {
    if (this.state.error) return <main className="app-shell"><section className="empty-state"><span>!</span><h1>Не удалось обновить лист персонажа</h1><p>{this.state.error.message || "Неизвестная ошибка интерфейса."}</p><button type="button" onClick={() => window.location.reload()}>Перезагрузить страницу</button></section></main>;
    return this.props.children;
  }
}

function normalizeCharacter(value: Partial<ExportCharacter>): ExportCharacter {
  const strings = (input: unknown) => Array.isArray(input) ? input.filter((item): item is string => typeof item === "string") : [];
  const choices = (input: unknown) => input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, string[]> : {};
  const normalized = {
    ...initial,
    ...value,
    abilities: { ...initial.abilities, ...(value.abilities || {}) },
    personality: { ...initial.personality, ...(value.personality || {}) },
    raceAbilityChoices: strings(value.raceAbilityChoices) as ExportCharacter["raceAbilityChoices"],
    raceVariant: value.raceVariant || (value.race && !variantsFor(value.race).length ? "base" : ""),
    raceSkills: strings(value.raceSkills),
    classSkills: strings(value.classSkills),
    backgroundSkills: strings(value.backgroundSkills),
    spells: strings(value.spells),
    feats: strings(value.feats),
    asiChoices: strings(value.asiChoices) as ExportCharacter["asiChoices"],
    advancements: Array.isArray(value.advancements) ? value.advancements : [],
    classChoices: choices(value.classChoices),
    expertiseSkills: strings(value.expertiseSkills),
    equipmentSelections: { ...defaultEquipmentSelections(value.className || ""), ...choices(value.equipmentSelections) },
    currency: { ...initial.currency, ...(value.currency || {}) },
    languages: strings(value.languages),
    backgroundChoices: choices(value.backgroundChoices),
    proficiencyChoices: choices(value.proficiencyChoices),
    resourceSpent: value.resourceSpent && typeof value.resourceSpent === "object" && !Array.isArray(value.resourceSpent) ? value.resourceSpent : {},
    preparedSpells: strings(value.preparedSpells),
    spellSlotsUsed: Array.isArray(value.spellSlotsUsed) ? value.spellSlotsUsed : [],
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
  return (
    <BuilderErrorBoundary>
      <Builder />
    </BuilderErrorBoundary>
  );
}

function Builder() {
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
  const [vault, setVault] = useState<CharacterVault>({ version: 1, capacity: 5, activeId: "", slots: [], folders: [] });
  const [activeFolderId, setActiveFolderId] = useState("all");
  const [selectedSlotIds, setSelectedSlotIds] = useState<string[]>([]);
  const [moveFolderId, setMoveFolderId] = useState("unfiled");
  const [folderImport, setFolderImport] = useState<FolderImportDraft | null>(null);
  const [account, setAccount] = useState<AccountState | null>(null);
  const [cloudState, setCloudState] = useState<"local" | "saving" | "saved" | "error">("local");
  const [importMessage, setImportMessage] = useState<{ source: CharacterFileSource; warnings: string[] } | null>(null);
  const [interactionError, setInteractionError] = useState<string | null>(null);
  const banFileRef = useRef<HTMLInputElement>(null);
  const characterFileRef = useRef<HTMLInputElement>(null);
  const folderFileRef = useRef<HTMLInputElement>(null);
  const cloudSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exportPanelRef = useRef<HTMLDivElement>(null);

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
        loadedVault = normalizeVault(JSON.parse(storedVault) as CharacterVault);
        const active = loadedVault.slots.find(slot => slot.id === loadedVault.activeId);
        setVault(loadedVault);
        if (active) setCharacter(active.character);
      } else {
        const migrated = storedCharacter ? normalizeCharacter(JSON.parse(storedCharacter)) : initial;
        const slot = createSlot(migrated);
        loadedVault = { version: 1, capacity: 5, activeId: slot.id, slots: [slot], folders: [] };
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
      loadedVault = { version: 1, capacity: 5, activeId: slot.id, slots: [slot], folders: [] };
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
  const fixedBackgroundSkills = character.backgroundSkills;
  const unavailableClassSkills = [...new Set([...fixedBackgroundSkills, ...(character.raceSkills || [])])];
  const allSkillNames = [...new Set(Object.values(classSkillRules).flatMap(rule => rule.skills))].sort((a, b) => a.localeCompare(b, "ru"));
  const currentOptions = step === 0 ? availableRaces : step === 1 ? availableClasses : availableBackgrounds;
  const advancementSlots = advancementSlotsFor(character);
  const advancements = advancementSlots.map(slot => character.advancements?.find(choice => choice.key === slot.key) || { ...slot, featId: "", asiChoices: [] });
  const advancementFields = deriveLegacyAdvancementFields(advancements);
  const rulesCharacter = {
    ...character,
    ...advancementFields,
    advancements,
    useTasha: !!character.useTasha && !activeBan?.tceOptionalFeaturesBanned && !activeBan?.tceFullBanned,
    tceFullBanned: !!activeBan?.tceFullBanned,
  };
  const choiceGroups = classChoiceGroups(rulesCharacter, spells);
  const spellRule = spellSelectionRule({ ...rulesCharacter, abilities: finalAbilityScores(rulesCharacter) });
  const sourceAvailableSpells = sourceAvailableSpellCatalog(spells, additionalSpellsUnlocked);
  const availableSpellCatalog = sourceAvailableSpells.filter(spell => allowed(activeBan, "spells", spell.id) && (!rulesCharacter.tceFullBanned || spell.source !== "TCE"));
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
      !!rulesCharacter.useTasha,
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
      setCharacter(current => {
        const safe = normalizeCharacter(current);
        return syncAdvancements({
        ...safe,
        race: id,
        raceVariant: raceVariantOptions.length ? "" : "base",
        raceAbilityChoices: [],
        raceSkills: [],
        feats: [],
        asiChoices: [],
        advancements: [],
        languages: [],
        proficiencyChoices: {},
        }, []);
      });
      if (raceVariantOptions.length) setDetailsId(id);
    }
    if (step === 1) setCharacter(current => {
      const safe = normalizeCharacter(current);
      return syncAdvancements({ ...safe, className: id, subclass: "", classSkills: [], spells: [], preparedSpells: [], lssSpellCards: undefined, classChoices: {}, proficiencyChoices: {}, equipmentSelections: defaultEquipmentSelections(id), spellSlotsUsed: [], pactSlotsUsed: 0, resourceSpent: {} }, []);
    });
    if (step === 3) {
      const option = backgrounds.find(item => item.id === id);
      const backgroundSkills = backgroundFixedSkills(id);
      const startingGold = backgroundStartingGold(id, option);
      setCharacter(current => {
        const safe = normalizeCharacter(current);
        return syncAdvancements({
        ...safe,
        background: id,
        backgroundSkills,
        backgroundChoices: {},
        classSkills: [],
        languages: [],
        proficiencyChoices: {},
        personality: initial.personality,
        currency: { ...initial.currency, ...safe.currency, gp: startingGold },
        }, safe.advancements.filter(choice => !choice.key.startsWith("background-")));
      });
    }
  }

  function selectCatalogOption(event: MouseEvent<HTMLButtonElement>, id: string) {
    event.preventDefault();
    event.stopPropagation();
    try {
      setInteractionError(null);
      pick(id);
    } catch (error) {
      console.error("Ошибка выбора из каталога", error);
      setInteractionError(error instanceof Error ? error.message : "Неизвестная ошибка выбора");
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
    if (step === 3) return !!character.background && backgroundChoiceGroups(character.background, featCatalog).every(group => (character.backgroundChoices?.[group.key] || []).length === group.count);
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
      if (alwaysPreparedSet.has(id)) return current;
      if (current.spells.includes(id)) return {
        ...current,
        spells: current.spells.filter(spell => spell !== id),
        preparedSpells: (current.preparedSpells || []).filter(spell => spell !== id),
      };
      const sameKind = current.spells.filter(spellId => (spells.find(item => item.id === spellId)?.level || 0) === 0 ? level === 0 : level > 0);
      const cap = level === 0 ? spellRule.cantrips : spellRule.leveled;
      if (sameKind.length >= cap) return current;
      if (level > 0 && spellRule.levelLimits) {
        const breaksCumulativeLimit = spellRule.levelLimits.some((limit, circle) =>
          circle > 0 && circle <= level && current.spells.filter(spellId => (spells.find(item => item.id === spellId)?.level || 0) >= circle).length >= limit,
        );
        if (breaksCumulativeLimit) return current;
      }
      return { ...current, spells: [...current.spells, id] };
    });
  }

  function togglePreparedSpell(id: string) {
    setCharacter(current => {
      if (!current.spells.includes(id) || (spells.find(spell => spell.id === id)?.level || 0) === 0) return current;
      const selected = current.preparedSpells || [];
      if (selected.includes(id)) return { ...current, preparedSpells: selected.filter(spell => spell !== id) };
      if (selected.length >= (spellRule.prepared || 0)) return current;
      return { ...current, preparedSpells: [...selected, id] };
    });
  }

  function toggleMobilePreparedSpell(id: string) {
    setCharacter(current => {
      const available = spellRule.mode === "prepared"
        ? availableSpellCatalog.filter(spell => spell.level > 0 && spell.level <= spellRule.maxLevel && spellAvailableToCharacter(current, spell) && !alwaysPreparedSet.has(spell.id)).map(spell => spell.id)
        : current.spells.filter(spellId => (spells.find(spell => spell.id === spellId)?.level || 0) > 0);
      const initialPrepared = spellRule.mode === "prepared" && !current.mobilePreparedConfigured
        ? current.spells.filter(spellId => available.includes(spellId)).slice(0, spellRule.prepared || available.length)
        : (current.preparedSpells || []).filter(spellId => available.includes(spellId));
      const next = initialPrepared.includes(id)
        ? initialPrepared.filter(spellId => spellId !== id)
        : initialPrepared.length < (spellRule.prepared || 0) ? [...initialPrepared, id] : initialPrepared;
      const nextSpells = spellRule.mode === "prepared"
        ? [...current.spells.filter(spellId => (spells.find(spell => spell.id === spellId)?.level || 0) === 0), ...next]
        : current.spells;
      return { ...current, spells: nextSpells, preparedSpells: next, mobilePreparedConfigured: true };
    });
  }

  function toggleTasha(enabled: boolean) {
    setCharacter(current => {
      if (enabled) return { ...current, useTasha: true };
      // This switch governs Optional Class Features only. Published TCE spell
      // lists, styles, invocations and metamagic intentionally stay selected.
      const classChoices = Object.fromEntries(Object.entries(current.classChoices || {}).filter(([key]) => !key.startsWith("tce-")));
      const resourceSpent = Object.fromEntries(Object.entries(current.resourceSpent || {}).filter(([key]) => !["favored-foe", "tireless", "harness-divine-power"].includes(key)));
      return { ...current, useTasha: false, classChoices, resourceSpent };
    });
  }

  function scrollToExports() {
    exportPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function changePointBuy(key: keyof ExportCharacter["abilities"], delta: number) {
    setCharacter(current => {
      const next = current.abilities[key] + delta;
      if (next < 8 || next > 15) return current;
      const abilities = { ...current.abilities, [key]: next };
      if (pointBuySpent(abilities) > 27) return current;
      return { ...current, abilities };
    });
  }

  function chooseOptimalAbilities() {
    setCharacter(current => {
      const build = optimalAbilityBuild(current);
      return { ...current, abilities: build.abilities, raceAbilityChoices: build.raceAbilityChoices };
    });
  }

  function toggleRaceAbility(key: keyof ExportCharacter["abilities"]) {
    const limit = chosenRaceVariant?.chooseBonuses?.count || 0;
    setCharacter(current => {
      const selected = current.raceAbilityChoices || [];
      const next = selected.includes(key) ? selected.filter(item => item !== key) : selected.length < limit ? [...selected, key] : selected;
      return { ...current, raceAbilityChoices: next };
    });
  }

  function chooseRaceSkill(skill: string) {
    setCharacter(current => {
      const limit = raceSkillChoiceCount(current);
      const selected = current.raceSkills || [];
      const next = selected.includes(skill) ? selected.filter(item => item !== skill) : selected.length < limit ? [...selected, skill] : selected;
      return { ...current, raceSkills: next };
    });
  }

  function chooseAdvancementFeat(slotKey: string, id: string) {
    setCharacter(current => {
      const slots = advancementSlotsFor(current);
      const slot = slots.find(item => item.key === slotKey);
      if (!slot || (slot.origin && id === "asi")) return current;
      const feat = feats.find(item => item.id === id);
      const liveCharacter = syncAdvancements(current, current.advancements || []);
      if (feat?.requirement && !featRequirementMet(liveCharacter, feat.requirement)) {
        alert("Требования не соблюдены");
        return current;
      }
      const existing = current.advancements || [];
      const previous = existing.find(choice => choice.key === slotKey);
      const nextChoice: AdvancementChoice = {
        ...slot,
        featId: id,
        asiChoices: id === "asi" && previous?.featId === "asi" ? previous.asiChoices : [],
        featChoices: id && previous?.featId === id ? previous.featChoices || {} : {},
      };
      const next = [...existing.filter(choice => choice.key !== slotKey), ...(id ? [nextChoice] : [])]
        .filter(choice => slots.some(item => item.key === choice.key));
      return syncAdvancements(current, next);
    });
  }

  function toggleFeatChoice(slotKey: string, groupKey: string, id: string, limit: number) {
    setCharacter(current => {
      const existing = current.advancements || [];
      const target = existing.find(choice => choice.key === slotKey);
      if (!target) return current;
      const selected = target.featChoices?.[groupKey] || [];
      const ownedSkills = new Set(characterProficiencies(current).skills);
      if (!selected.includes(id) && groupKey === "skill" && ownedSkills.has(id)) return current;
      if (!selected.includes(id) && groupKey === "expertise" && !ownedSkills.has(id)) return current;
      const nextSelected = selected.includes(id)
        ? selected.filter(value => value !== id)
        : selected.length < limit ? [...selected, id] : limit === 1 ? [id] : selected;
      const featChoices = { ...(target.featChoices || {}), [groupKey]: nextSelected };
      if (groupKey === "tradition") {
        delete featChoices.cantrips;
        delete featChoices.spell;
        delete featChoices.rituals;
      }
      return syncAdvancements(current, existing.map(choice => choice.key === slotKey ? { ...choice, featChoices } : choice));
    });
  }

  function chooseBackgroundChoice(groupKey: string, id: string, count: number, kind: "college" | "feat" | "skill" | "tool", grantsFeatId?: string) {
    setCharacter(current => {
      const selected = current.backgroundChoices?.[groupKey] || [];
      const nextSelected = selected.includes(id)
        ? selected.filter(value => value !== id)
        : selected.length < count ? [...selected, id] : count === 1 ? [id] : selected;
      const backgroundChoices = { ...(current.backgroundChoices || {}), [groupKey]: nextSelected };
      const nextBase = kind === "skill"
        ? { ...current, backgroundChoices, backgroundSkills: [...backgroundFixedSkills(current.background), ...nextSelected] }
        : { ...current, backgroundChoices };
      const featId = grantsFeatId || (kind === "feat" ? nextSelected[0] : "");
      if (!featId) return nextBase;
      const key = `background-${current.background}`;
      const previous = (current.advancements || []).find(choice => choice.key === key);
      const featChoices = featId === "strixhaven-initiate" && nextSelected[0]
        ? { ...(previous?.featChoices || {}), college: nextSelected }
        : featId === previous?.featId ? previous.featChoices || {} : {};
      const slot: AdvancementChoice = { key, level: 1, bonus: true, featId, asiChoices: [], featChoices };
      const advancements = [...(current.advancements || []).filter(choice => choice.key !== key), ...(nextSelected.length ? [slot] : [])];
      return syncAdvancements(nextBase, advancements);
    });
  }

  function changeLevel(level: number) {
    setCharacter(current => {
      const nextBase = {
        ...current,
        level,
        subclass: subclassRule(current.className) && level < (subclassRule(current.className)?.level || 99) ? "" : current.subclass,
        spells: [],
        preparedSpells: [],
        spellSlotsUsed: [],
        pactSlotsUsed: 0,
        resourceSpent: {},
      };
      const validKeys = new Set(advancementSlotsFor(nextBase).map(slot => slot.key));
      return syncAdvancements(nextBase, (current.advancements || []).filter(choice => validKeys.has(choice.key)));
    });
  }

  function toggleClassChoice(groupKey: string, id: string, limit: number) {
    setCharacter(current => {
      const choices = current.classChoices || {};
      const selected = choices[groupKey] || [];
      const next = selected.includes(id) ? selected.filter(value => value !== id) : selected.length < limit ? [...selected, id] : selected;
      return { ...current, classChoices: { ...choices, [groupKey]: next } };
    });
  }

  function setUsedSlots(circle: number, value: number, maximum: number) {
    setCharacter(current => {
      const used = [...(current.spellSlotsUsed || [])];
      used[circle] = Math.max(0, Math.min(maximum, value));
      return { ...current, spellSlotsUsed: used };
    });
  }

  function setResourceCurrent(key: string, value: number, maximum: number) {
    setCharacter(current => ({
      ...current,
      resourceSpent: {
        ...(current.resourceSpent || {}),
        [key]: maximum - Math.max(0, Math.min(maximum, value)),
      },
    }));
  }

  function setCurrentHitPoints(value: number) {
    const next = Math.max(-hitPoints, Math.min(hitPoints, value));
    setCharacter(current => ({
      ...current,
      currentHitPoints: next,
      ...(next > 0 ? { deathSaveSuccesses: 0, deathSaveFailures: 0 } : {}),
    }));
  }

  function applyHitPointAdjustment(direction: 1 | -1) {
    const amount = Math.max(0, Math.floor(hitPointAdjustment || 0));
    if (!amount) return;
    setCurrentHitPoints((character.currentHitPoints || 0) + direction * amount);
  }

  function setDeathSave(kind: "success" | "failure", index: number) {
    const field = kind === "success" ? "deathSaveSuccesses" : "deathSaveFailures";
    setCharacter(current => ({ ...current, [field]: (current[field] || 0) === index + 1 ? index : index + 1 }));
  }

  function takeShortRest() {
    const remaining = Math.max(0, character.level - (character.hitDiceSpent || 0));
    const diceUsed = Math.min(remaining, hitDiceToRoll);
    const die = classRules[character.className]?.hitDie || 8;
    const rolls = Array.from({ length: diceUsed }, () => (crypto.getRandomValues(new Uint32Array(1))[0] % die) + 1);
    const healing = shortRestHitDieHealing(rolls, abilityModifier(finalAbilities.con));
    const nextSpent = { ...(character.resourceSpent || {}) };
    characterResources({ ...character, abilities: finalAbilities }).forEach(resource => {
      if (resource.isShortRest) nextSpent[resource.key] = 0;
    });
    const nextHitPoints = Math.min(hitPoints, (character.currentHitPoints || 0) + healing);
    setCharacter(current => ({
      ...current,
      currentHitPoints: nextHitPoints,
      hitDiceSpent: Math.min(current.level, (current.hitDiceSpent || 0) + diceUsed),
      resourceSpent: nextSpent,
      pactSlotsUsed: 0,
      ...(nextHitPoints > 0 ? { deathSaveSuccesses: 0, deathSaveFailures: 0 } : {}),
    }));
    setHitDiceToRoll(0);
    setLastHitDieRoll(diceUsed ? healing : null);
  }

  function takeLongRest() {
    setCharacter(current => {
      return {
        ...current,
        currentHitPoints: estimatedHitPoints({ ...current, abilities: finalAbilityScores(current) }),
        temporaryHitPoints: 0,
        hitDiceSpent: hitDiceAfterLongRest(current.hitDiceSpent || 0, current.level),
        deathSaveSuccesses: 0,
        deathSaveFailures: 0,
        resourceSpent: {},
        spellSlotsUsed: (current.spellSlotsUsed || []).map(() => 0),
        pactSlotsUsed: 0,
      };
    });
    setHitDiceToRoll(0);
    setLastHitDieRoll(null);
  }

  function changeAsiAbility(slotKey: string, key: keyof ExportCharacter["abilities"], delta: 1 | -1) {
    setCharacter(current => {
      const existing = current.advancements || [];
      const target = existing.find(choice => choice.key === slotKey);
      if (!target || target.featId !== "asi") return current;
      const choices = [...target.asiChoices];
      if (delta < 0) {
        const index = choices.lastIndexOf(key);
        if (index >= 0) choices.splice(index, 1);
      } else {
        const otherAsiBonus = existing
          .filter(choice => choice.key !== slotKey && choice.featId === "asi")
          .flatMap(choice => choice.asiChoices)
          .filter(item => item === key).length;
        const racialScore = current.abilities[key] + raceAbilityBonuses(current)[key] + otherAsiBonus;
        const currentBonus = choices.filter(item => item === key).length;
        if (choices.length >= 2 || currentBonus >= 2 || racialScore + currentBonus >= 20) return current;
        choices.push(key);
      }
      const next = existing.map(choice => choice.key === slotKey ? { ...choice, asiChoices: choices } : choice);
      return syncAdvancements(current, next);
    });
  }

  function chooseOptimalSpells() {
    const value = { ...rulesCharacter, abilities: finalAbilityScores(rulesCharacter) };
    const ids = optimalSpellIds(value, availableSpellCatalog);
    const preparedSpells = optimalPreparedSpellIds(value, availableSpellCatalog, ids);
    setCharacter(current => ({ ...current, spells: ids, preparedSpells, lssSpellCards: undefined }));
  }

  function resetSpells() {
    setCharacter(current => ({ ...current, spells: [], preparedSpells: [], lssSpellCards: undefined }));
  }

  function setPersonality(key: PersonalityKey, value: string) {
    setCharacter(current => ({ ...current, personality: { ...current.personality, [key]: value } }));
  }

  function randomPersonality(key: PersonalityKey) {
    const list = personalityLists[key];
    const randomValue = crypto.getRandomValues(new Uint32Array(1))[0];
    setPersonality(key, list[randomValue % list.length]);
  }

  function randomizeAllPersonality() {
    const randomValues = crypto.getRandomValues(new Uint32Array(Object.keys(personalityNames).length));
    setCharacter(current => ({
      ...current,
      personality: Object.fromEntries(
        (Object.keys(personalityNames) as PersonalityKey[]).map((key, index) => {
          const list = personalityLists[key];
          return [key, list[randomValues[index] % list.length]];
        }),
      ) as ExportCharacter["personality"],
    }));
  }

  function applyBan(list: BanList) {
    const normalizedList = normalizeBanList(list);
    setActiveBan(normalizedList);
    localStorage.setItem("dark-codex-banlist", JSON.stringify(normalizedList));
    setCharacter(current => {
      const next = {
        ...current,
        race: allowed(normalizedList, "races", current.race) ? current.race : "",
        className: allowed(normalizedList, "classes", current.className) ? current.className : "",
        subclass: allowed(normalizedList, "subclasses", `${current.className}:${current.subclass}`) ? current.subclass : "",
        background: allowed(normalizedList, "backgrounds", current.background) ? current.background : "",
        spells: current.spells.filter(id => allowed(normalizedList, "spells", id)),
        advancements: (current.advancements || []).filter(choice => choice.featId === "asi" || allowed(normalizedList, "feats", choice.featId)),
      };
      return syncAdvancements(next, next.advancements);
    });
    setView("builder");
    resetFilters(0);
  }

  function importBan(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (![1, 2].includes(parsed.version) || !parsed.categories || !["deny", "allow"].includes(parsed.mode)) throw new Error();
        applyBan(normalizeBanList(parsed));
      } catch {
        alert("Файл не похож на бан-лист «Листа Героя 5e».");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  function toggleBan(id: string) {
    setBanDraft(current => ({
      ...current,
      categories: {
        ...current.categories,
        [banCategory]: current.categories[banCategory].includes(id)
          ? current.categories[banCategory].filter(value => value !== id)
          : [...current.categories[banCategory], id],
      },
    }));
  }

  function setVisibleBanState(ids: string[], banned: boolean) {
    setBanDraft(current => {
      const values = new Set(current.categories[banCategory]);
      for (const id of ids) {
        const shouldBeListed = current.mode === "deny" ? banned : !banned;
        if (shouldBeListed) values.add(id);
        else values.delete(id);
      }
      return { ...current, categories: { ...current.categories, [banCategory]: [...values] } };
    });
  }

  function setBookBanState(sourceName: string, banned: boolean) {
    setBanDraft(current => ({
      ...current,
      categories: Object.fromEntries((Object.keys(categoryNames) as Category[]).map(category => {
        const values = new Set(current.categories[category]);
        for (const option of catalogs[category].filter(item => item.source === sourceName)) {
          const shouldBeListed = current.mode === "deny" ? banned : !banned;
          if (shouldBeListed) values.add(option.id);
          else values.delete(option.id);
        }
        return [category, [...values]];
      })) as Record<Category, string[]>,
    }));
  }

  function setTceBanState(kind: "optional" | "full", banned: boolean) {
    setBanDraft(current => ({
      ...current,
      ...(kind === "optional" ? { tceOptionalFeaturesBanned: banned } : { tceFullBanned: banned }),
    }));
    if (kind === "full") setBookBanState("TCE", banned);
  }

  function exportHelpmate() {
    const skipped = helpmateSkippedSpells(exportContext).map(spell => spell.name);
    if (skipped.length) {
      setHelpmateExportWarning(skipped);
      return;
    }
    download(createHelpmateExport(exportContext), `${safeName(character.name)} — Helpmate.json`);
  }

  function confirmPartialHelpmateExport() {
    download(createHelpmateExport(exportContext), `${safeName(character.name)} — Helpmate.json`);
    setHelpmateExportWarning(null);
  }

  function exportLongStoryShort() {
    download(createLongStoryShortExport(exportContext), `${safeName(character.name)} — Long Story Short.json`);
  }

  function exportNative() {
    download(createNativeCharacterFile(exportCharacter), `${safeName(character.name)} — Лист Героя 5e.json`);
  }

  function persistVault(next: CharacterVault) {
    setVault(next);
    localStorage.setItem("list-geroya-character-vault-v1", JSON.stringify(next));
  }

  function openCharacterManager() {
    const updatedAt = new Date().toISOString();
    const next = {
      ...vault,
      slots: vault.slots.map(slot => slot.id === vault.activeId ? { ...slot, character, updatedAt } : slot),
    };
    persistVault(next);
    setView("characters");
  }

  function selectSlot(id: string) {
    const slot = vault.slots.find(item => item.id === id);
    if (!slot) return;
    persistVault({ ...vault, activeId: id });
    setCharacter(normalizeCharacter(slot.character));
    setImportMessage(null);
    setView("builder");
    resetFilters(0);
  }

  function addCharacter() {
    if (vault.slots.length >= vault.capacity) {
      alert("Все доступные места заняты. Добавьте ещё 5 слотов.");
      return;
    }
    const slot = createSlot(initial);
    persistVault({ ...vault, activeId: slot.id, slots: [...vault.slots, slot] });
    setCharacter(initial);
    setImportMessage(null);
    setView("builder");
    resetFilters(0);
  }

  function addFiveSlots() {
    persistVault({ ...vault, capacity: vault.capacity + 5 });
  }

  function resetCurrentCharacter() {
    if (!confirm("Сбросить текущего персонажа? Остальные персонажи не изменятся.")) return;
    setCharacter(initial);
    setImportMessage(null);
    setView("builder");
    resetFilters(0);
  }

  function deleteSlot(id: string) {
    const target = vault.slots.find(slot => slot.id === id);
    if (!target || !confirm(`Удалить персонажа «${target.character.name || "Безымянный герой"}»?`)) return;
    let slots = vault.slots.filter(slot => slot.id !== id);
    if (!slots.length) slots = [createSlot(initial)];
    const activeId = id === vault.activeId ? slots[0].id : vault.activeId;
    const next = { ...vault, activeId, slots };
    persistVault(next);
    if (id === vault.activeId) setCharacter(normalizeCharacter(slots[0].character));
  }

  function createFolder() {
    const name = prompt("Название новой папки:")?.trim();
    if (!name) return;
    const folder: CharacterFolder = { id: folderId(), name, createdAt: new Date().toISOString() };
    persistVault({ ...vault, folders: [...vault.folders, folder] });
    setActiveFolderId(folder.id);
  }

  function renameFolder(id: string) {
    const folder = vault.folders.find(item => item.id === id);
    if (!folder) return;
    const name = prompt("Новое название папки:", folder.name)?.trim();
    if (!name || name === folder.name) return;
    persistVault({ ...vault, folders: vault.folders.map(item => item.id === id ? { ...item, name } : item) });
  }

  function toggleSlotSelection(id: string) {
    setSelectedSlotIds(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  }

  function moveSelectedSlots() {
    if (!selectedSlotIds.length) return;
    const destination = moveFolderId === "unfiled" ? undefined : moveFolderId;
    persistVault({ ...vault, slots: vault.slots.map(slot => selectedSlotIds.includes(slot.id) ? { ...slot, folderId: destination, updatedAt: new Date().toISOString() } : slot) });
    setSelectedSlotIds([]);
  }

  function deleteSelectedSlots() {
    if (!selectedSlotIds.length || !confirm(`Удалить выбранных персонажей: ${selectedSlotIds.length}?`)) return;
    let slots = vault.slots.filter(slot => !selectedSlotIds.includes(slot.id));
    if (!slots.length) slots = [createSlot(initial)];
    const activeId = slots.some(slot => slot.id === vault.activeId) ? vault.activeId : slots[0].id;
    persistVault({ ...vault, activeId, slots });
    if (activeId !== vault.activeId) setCharacter(normalizeCharacter(slots[0].character));
    setSelectedSlotIds([]);
  }

  function exportFolder(id: string) {
    const folder = vault.folders.find(item => item.id === id);
    const slots = vault.slots.filter(slot => id === "unfiled" ? !slot.folderId : slot.folderId === id);
    if (!slots.length) {
      alert("В этой папке пока нет персонажей.");
      return;
    }
    const folderName = folder?.name || "Без папки";
    const files: Record<string, Uint8Array> = {
      "manifest.json": strToU8(JSON.stringify({ format: "list-geroya-5e-folder", version: 1, folderName, exportedAt: new Date().toISOString(), count: slots.length }, null, 2)),
    };
    slots.forEach((slot, index) => {
      files[`${String(index + 1).padStart(2, "0")} — ${safeName(slot.character.name)}.json`] = strToU8(JSON.stringify(createNativeCharacterFile(slot.character), null, 2));
    });
    const url = URL.createObjectURL(new Blob([zipSync(files, { level: 6 }) as BlobPart], { type: "application/zip" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${safeName(folderName)} — персонажи.zip`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function importFolderArchive(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const archive = unzipSync(new Uint8Array(await file.arrayBuffer()));
      let folderName = file.name.replace(/\.zip$/i, "").replace(/\s+—\s+персонажи$/i, "");
      if (archive["manifest.json"]) {
        const manifest = JSON.parse(strFromU8(archive["manifest.json"])) as { folderName?: string };
        if (manifest.folderName?.trim()) folderName = manifest.folderName.trim();
      }
      const items: FolderImportItem[] = [];
      for (const [key, bytes] of Object.entries(archive)) {
        if (!key.toLowerCase().endsWith(".json") || key === "manifest.json") continue;
        try {
          const result = parseCharacterFile(JSON.parse(strFromU8(bytes)), initial);
          const imported = normalizeCharacter(result.character);
          items.push({ key, name: imported.name || key.replace(/\.json$/i, ""), character: imported, selected: true });
        } catch { /* отдельный посторонний JSON не отменяет импорт архива */ }
      }
      if (!items.length) throw new Error("В ZIP-архиве не найдено совместимых JSON-файлов персонажей.");
      setFolderImport({ archiveName: file.name, folderName, items });
    } catch (error) {
      alert(error instanceof Error ? error.message : "Не удалось прочитать ZIP-архив.");
    }
  }

  function commitFolderImport() {
    if (!folderImport) return;
    const chosen = folderImport.items.filter(item => item.selected);
    if (!chosen.length) return;
    const folder: CharacterFolder = { id: folderId(), name: folderImport.folderName.trim() || "Импортированная папка", createdAt: new Date().toISOString() };
    const slots = chosen.map(item => ({ ...createSlot(item.character), folderId: folder.id }));
    const capacity = Math.max(vault.capacity, vault.slots.length + slots.length);
    persistVault({ ...vault, capacity, folders: [...vault.folders, folder], slots: [...vault.slots, ...slots] });
    setActiveFolderId(folder.id);
    setFolderImport(null);
  }

  function importCharacterFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const result = parseCharacterFile(JSON.parse(String(reader.result)), initial);
        const imported = normalizeCharacter(result.character);
        const slot = createSlot(imported);
        const capacity = vault.slots.length >= vault.capacity ? vault.capacity + 5 : vault.capacity;
        persistVault({ ...vault, capacity, activeId: slot.id, slots: [...vault.slots, slot] });
        setCharacter(imported);
        setImportMessage({ source: result.source, warnings: result.warnings });
        setView("builder");
        resetFilters(10);
      } catch (error) {
        alert(error instanceof Error ? error.message : "Не удалось импортировать персонажа.");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  if (view === "characters") {
    const free = vault.capacity - vault.slots.length;
    const visibleSlots = vault.slots.filter(slot => activeFolderId === "all" || (activeFolderId === "unfiled" ? !slot.folderId : slot.folderId === activeFolderId));
    const allVisibleSelected = visibleSlots.length > 0 && visibleSlots.every(slot => selectedSlotIds.includes(slot.id));
    const selectedFolder = vault.folders.find(folder => folder.id === activeFolderId);
    return (
      <main className={`app-shell${shellThemeClass}`} data-site-theme={siteTheme}>
        <header className="topbar">
          <button className="brand" onClick={() => setView("builder")}><span className={`brand-mark${usesOrnateIcons ? " experimental-site-mark" : ""}`}>{usesOrnateIcons ? <img src="/experimental/site-mark.png" alt="" /> : "✦"}</span>Лист Героя <small>5E · 2014</small></button>
          <button className={`experimental-toggle theme-${siteTheme}`} onClick={cycleSiteTheme} title={`Включить ${nextThemeName} дизайн`}>Дизайн сайта</button>
          <button className="nav-button" onClick={() => setView("builder")}>← К персонажу</button>
          <details className="mobile-top-menu"><summary aria-label="Открыть меню">☰</summary><div><button className={`experimental-toggle theme-${siteTheme}`} onClick={cycleSiteTheme}>Дизайн сайта</button><button className="nav-button" onClick={() => setView("builder")}>← К персонажу</button></div></details>
        </header>
        <section className="character-library">
          <header className="library-head">
            <div><p className="eyebrow">Локальная коллекция</p><h1>Ваши персонажи</h1><p>До {vault.capacity} слотов на этом устройстве. Каждый лист сохраняется автоматически.</p></div>
            <div className="library-actions">
              <button onClick={() => characterFileRef.current?.click()}>Импорт JSON</button>
              <button onClick={() => folderFileRef.current?.click()}>Импорт папки ZIP</button>
              <button className="primary-action" disabled={free <= 0} onClick={addCharacter}>Новый персонаж</button>
              <input ref={characterFileRef} hidden type="file" accept=".json,application/json" onChange={importCharacterFile} />
              <input ref={folderFileRef} hidden type="file" accept=".zip,application/zip" onChange={importFolderArchive} />
            </div>
          </header>
          <div className="import-guide">
            <div><strong>Long Story Short</strong><span>Основной импорт: характеристики, личные данные, навыки, текстовые заклинания, карточки LSS и потраченные ячейки.</span></div>
            <div><strong>Лист Героя 5e</strong><span>Полный перенос всех решений между устройствами и резервные копии.</span></div>
            <div><strong>Helpmate · экспериментально</strong><span>Базовые параметры, класс, уровень, навыки, заклинания и ячейки; неполные поля нужно проверить.</span></div>
          </div>
          <div className="folder-toolbar">
            <nav className="folder-list" aria-label="Папки персонажей">
              <button className={activeFolderId === "all" ? "active" : ""} onClick={() => { setActiveFolderId("all"); setSelectedSlotIds([]); }}>Все <b>{vault.slots.length}</b></button>
              <button className={activeFolderId === "unfiled" ? "active" : ""} onClick={() => { setActiveFolderId("unfiled"); setSelectedSlotIds([]); }}>Без папки <b>{vault.slots.filter(slot => !slot.folderId).length}</b></button>
              {vault.folders.map(folder => <button key={folder.id} className={activeFolderId === folder.id ? "active" : ""} onClick={() => { setActiveFolderId(folder.id); setSelectedSlotIds([]); }}>{folder.name} <b>{vault.slots.filter(slot => slot.folderId === folder.id).length}</b></button>)}
            </nav>
            <div className="folder-actions">
              <button onClick={createFolder}>+ Новая папка</button>
              {selectedFolder && <button onClick={() => renameFolder(selectedFolder.id)}>Переименовать</button>}
              {activeFolderId !== "all" && <button onClick={() => exportFolder(activeFolderId)}>Экспорт ZIP</button>}
            </div>
          </div>
          <div className="bulk-character-actions">
            <label><input type="checkbox" checked={allVisibleSelected} onChange={() => setSelectedSlotIds(current => allVisibleSelected ? current.filter(id => !visibleSlots.some(slot => slot.id === id)) : [...new Set([...current, ...visibleSlots.map(slot => slot.id)])])} /> Выбрать всех показанных</label>
            <span>Выбрано: {selectedSlotIds.length}</span>
            <select value={moveFolderId} onChange={event => setMoveFolderId(event.target.value)} aria-label="Папка назначения">
              <option value="unfiled">Без папки</option>
              {vault.folders.map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
            </select>
            <button disabled={!selectedSlotIds.length} onClick={moveSelectedSlots}>Перенести</button>
            <button disabled={!selectedSlotIds.length} onClick={deleteSelectedSlots}>Удалить выбранных</button>
          </div>
          <div className="character-grid">
            {visibleSlots.map(slot => {
              const itemClass = classes.find(item => item.id === slot.character.className);
              const itemRace = races.find(item => item.id === slot.character.race);
              return <article key={slot.id} className={slot.id === vault.activeId ? "active" : ""}>
                <label className="character-select"><input type="checkbox" checked={selectedSlotIds.includes(slot.id)} onChange={() => toggleSlotSelection(slot.id)} /><span>Выбрать</span></label>
                <CatalogIcon id={itemClass?.id || itemRace?.id} kind={itemClass ? "class" : "race"} fallback={itemClass?.name || itemRace?.name || "Новый герой"} experimental={usesOrnateIcons} />
                <div><small>{slot.id === vault.activeId ? "Текущий персонаж" : `Сохранён ${new Date(slot.updatedAt).toLocaleDateString("ru-RU")}`}</small><h2>{slot.character.name || "Безымянный герой"}</h2><p>{itemRace?.name || "Раса не выбрана"} · {itemClass?.name || "Класс не выбран"} · {slot.character.level} уровень</p></div>
                <div className="character-card-actions"><button onClick={() => selectSlot(slot.id)}>{slot.id === vault.activeId ? "Продолжить" : "Открыть"}</button><button onClick={() => deleteSlot(slot.id)}>Удалить</button></div>
              </article>;
            })}
          </div>
          {!visibleSlots.length && <div className="empty-folder"><strong>В этой папке пока пусто.</strong><span>Выберите персонажей в разделе «Все» и перенесите их сюда.</span></div>}
          <footer className="slot-footer"><span>Занято {vault.slots.length} из {vault.capacity} · свободно {free}</span><button onClick={addFiveSlots}>Добавить ещё 5 слотов</button></footer>
        </section>
        {folderImport && <div className="modal-backdrop" role="presentation">
          <section className="warning-modal folder-import-modal" role="dialog" aria-modal="true" aria-labelledby="folder-import-title">
            <small>Импорт папки · {folderImport.archiveName}</small>
            <h2 id="folder-import-title">Выберите персонажей для импорта</h2>
            <label className="folder-name-field">Название папки<input value={folderImport.folderName} onChange={event => setFolderImport({ ...folderImport, folderName: event.target.value })} /></label>
            <div className="folder-import-list">
              <label><input type="checkbox" checked={folderImport.items.every(item => item.selected)} onChange={event => setFolderImport({ ...folderImport, items: folderImport.items.map(item => ({ ...item, selected: event.target.checked })) })} /> Выбрать всех</label>
              {folderImport.items.map(item => <label key={item.key}><input type="checkbox" checked={item.selected} onChange={() => setFolderImport({ ...folderImport, items: folderImport.items.map(value => value.key === item.key ? { ...value, selected: !value.selected } : value) })} /><span>{item.name}</span><small>{item.key}</small></label>)}
            </div>
            <div><button onClick={() => setFolderImport(null)}>Отмена</button><button className="primary-action" disabled={!folderImport.items.some(item => item.selected)} onClick={commitFolderImport}>Импортировать выбранных</button></div>
          </section>
        </div>}
        <UpdateHistory />
      </main>
    );
  }

  if (view === "banlist") {
    const allBookSources = [...new Set(Object.values(catalogs).flatMap(options => options.map(option => option.source)))].sort();
    const banSources = ["Все", ...new Set(catalogs[banCategory].map(option => option.source))];
    const list = catalogs[banCategory].filter(option =>
      (banSource === "Все" || option.source === banSource)
      && `${option.name} ${option.description} ${option.source}`.toLowerCase().includes(search.toLowerCase()),
    );
    return (
      <main className={`app-shell${shellThemeClass}`} data-site-theme={siteTheme}>
        <header className="topbar">
          <button className="brand" onClick={() => setView("builder")}><span className={`brand-mark${usesOrnateIcons ? " experimental-site-mark" : ""}`}>{usesOrnateIcons ? <img src="/experimental/site-mark.png" alt="" /> : "✦"}</span>Лист Героя <small>5E · 2014</small></button>
          <button className={`experimental-toggle theme-${siteTheme}`} onClick={cycleSiteTheme} title={`Включить ${nextThemeName} дизайн`}>Дизайн сайта</button>
          <button className="nav-button" onClick={() => setView("builder")}>← К мастеру</button>
          <details className="mobile-top-menu"><summary aria-label="Открыть меню">☰</summary><div><button className={`experimental-toggle theme-${siteTheme}`} onClick={cycleSiteTheme}>Дизайн сайта</button><button className="nav-button" onClick={() => setView("builder")}>← К мастеру</button></div></details>
        </header>
        <div className="ban-page">
          <p className="eyebrow">Правила кампании</p>
          <h1>Конструктор бан-листа</h1>
          <p className="lead">Создайте переносимый файл ограничений. Он работает только с официальным каталогом приложения.</p>
          <div className="ban-controls">
            <label>Название<input value={banDraft.name} onChange={event => setBanDraft({ ...banDraft, name: event.target.value })} /></label>
            <fieldset>
              <legend>Режим</legend>
              <label><input type="radio" checked={banDraft.mode === "deny"} onChange={() => setBanDraft({ ...banDraft, mode: "deny" })} /> Запретить выбранное</label>
              <label><input type="radio" checked={banDraft.mode === "allow"} onChange={() => setBanDraft({ ...banDraft, mode: "allow" })} /> Разрешить только выбранное</label>
            </fieldset>
            <div className="ban-book-control">
              <label>Вся книга<select value={banBookSource} onChange={event => setBanBookSource(event.target.value)}>{allBookSources.map(value => <option key={value}>{value}</option>)}</select></label>
              <button onClick={() => setBookBanState(banBookSource, true)}>Запретить книгу</button>
              <button onClick={() => setBookBanState(banBookSource, false)}>Снять бан книги</button>
              <small>После массового действия можно открыть любую категорию и снять запрет с отдельных рас, классов, предысторий или заклинаний.</small>
            </div>
            <div className="ban-book-control">
              <label>Настройки Tasha’s Cauldron of Everything</label>
              <button onClick={() => setTceBanState("optional", true)}>Запретить опциональные способности TCE</button>
              <button onClick={() => setTceBanState("optional", false)}>Разрешить опциональные способности TCE</button>
              <button onClick={() => setTceBanState("full", true)}>Запретить всю TCE, включая новые боевые стили и заклинания</button>
              <button onClick={() => setTceBanState("full", false)}>Разрешить всю TCE</button>
            </div>
          </div>
          <div className="category-tabs">
            {(Object.keys(categoryNames) as Category[]).map(key => (
              <button key={key} className={banCategory === key ? "active" : ""} onClick={() => { setBanCategory(key); setBanSource("Все"); setSearch(""); }}>
                {categoryNames[key]} <span>{banDraft.categories[key].length}</span>
              </button>
            ))}
          </div>
          <div className="tools">
            <label className="search">⌕<input value={search} onChange={event => setSearch(event.target.value)} placeholder={`Найти: ${categoryNames[banCategory].toLowerCase()}`} /></label>
            <select aria-label="Источник для бан-листа" value={banSource} onChange={event => setBanSource(event.target.value)}>{banSources.map(value => <option key={value}>{value}</option>)}</select>
          </div>
          <div className="ban-bulk-actions">
            <span>{banSource === "Все" ? `Показано: ${list.length}` : `${banSource}: ${list.length}`}</span>
            <button onClick={() => setVisibleBanState(list.map(option => option.id), true)}>Запретить все показанные</button>
            <button onClick={() => setVisibleBanState(list.map(option => option.id), false)}>Снять запрет со всех показанных</button>
          </div>
          <div className="ban-grid">
            {list.map(option => (
              <button key={option.id} className={banDraft.categories[banCategory].includes(option.id) ? "selected" : ""} onClick={() => toggleBan(option.id)}>
                <span>{banDraft.categories[banCategory].includes(option.id) ? "✓" : "+"}</span>
                <div><strong>{option.name}</strong><small>{option.source}{banCategory === "spells" ? ` · ${levelLabel((option as typeof spells[number]).level)}` : ""}</small></div>
              </button>
            ))}
          </div>
          <div className="ban-actions">
            <button onClick={() => setBanDraft({ ...emptyBan, name: banDraft.name })}>Очистить</button>
            <button onClick={() => download(banDraft, `${banDraft.name || "ban-list"}.json`)}>Скачать JSON</button>
            <button className="primary-action" onClick={() => applyBan(banDraft)}>Применить к мастеру</button>
          </div>
        </div>
        <UpdateHistory />
      </main>
    );
  }

  const headings = ["Выберите расу и подрасу", "Выберите класс", "Распределите характеристики", "Выберите предысторию", "Выберите владения навыками", "Выберите стартовое снаряжение", "Уровень, подкласс и черты", "Выберите заклинания", "Выберите языки и инструменты", "Опишите характер", "Лист персонажа"];
  const stepDescription = step < 2 || step === 3
    ? "Откройте «Подробнее», чтобы увидеть механические особенности и доступные варианты. Каталог исключает UA, Homebrew и неофициальные классы."
    : step === 2
      ? "Point Buy 2014: начните с шести восьмёрок и потратьте ровно 27 очков. Расовые бонусы показаны отдельно."
      : step === 4
      ? "Предыстория выдаёт свои навыки, а класс позволяет выбрать только из собственного списка."
      : step === 5
        ? "Выберите каждый вариант стартового снаряжения класса. Старт с золотом намеренно не используется."
        : step === 6
          ? "Выберите уровень, обязательный подкласс и каждый доступный выбор черты или повышения характеристик по прогрессии класса."
          : step === 7
            ? "Счётчики основаны на таблице выбранного класса. Заклинания подкласса показаны отдельно и не занимают лимит."
            : step === 8
              ? "Языки и все конкретные инструменты собраны здесь по источникам. Общие формулировки вроде «ремесленный инструмент» в итоговый лист не попадут."
              : step === 9
                ? "Каждый пункт можно написать самому, выбрать из списка предыстории или определить случайно."
                : "Лист повторяет структуру Long Story Short и готов к печати или экспорту.";

  return (
    <main className={`app-shell${shellThemeClass}`} data-site-theme={siteTheme}>
      <header className="topbar">
        <button className="brand" onClick={() => resetFilters(0)}><span className={`brand-mark${usesOrnateIcons ? " experimental-site-mark" : ""}`}>{usesOrnateIcons ? <img src="/experimental/site-mark.png" alt="" /> : "✦"}</span>Лист Героя <small>5E · 2014</small></button>
        <button className={`experimental-toggle theme-${siteTheme}`} onClick={cycleSiteTheme} title={`Включить ${nextThemeName} дизайн`}>Дизайн сайта</button>
        <div className="top-actions">
          <button className="nav-button character-nav" onClick={openCharacterManager}>Персонажи <b>{vault.slots.length}/{vault.capacity}</b></button>
          <button className="nav-button" onClick={() => { setView("banlist"); setSearch(""); }}>Создать бан-лист</button>
          <button className="nav-button" onClick={() => banFileRef.current?.click()}>Загрузить бан-лист</button>
          <input ref={banFileRef} hidden type="file" accept=".json,application/json" onChange={importBan} />
          {account?.authenticated
            ? <span className="account-state"><span>●</span>{account.displayName} · {cloudState === "saving" ? "сохраняется" : cloudState === "error" ? "ошибка синхронизации" : "сохранено"}<a href="/account">Аккаунт</a></span>
            : <span className="account-warning">Без входа персонажи хранятся только в этом браузере.<a href="/account">Войти и сохранить</a></span>}
        </div>
        <details className="mobile-top-menu">
          <summary aria-label="Открыть меню">☰</summary>
          <div>
            <button className={`experimental-toggle theme-${siteTheme}`} onClick={cycleSiteTheme}>Дизайн сайта</button>
            <button className="nav-button character-nav" onClick={openCharacterManager}>Персонажи <b>{vault.slots.length}/{vault.capacity}</b></button>
            <button className="nav-button" onClick={() => { setView("banlist"); setSearch(""); }}>Создать бан-лист</button>
            <button className="nav-button" onClick={() => banFileRef.current?.click()}>Загрузить бан-лист</button>
            {account?.authenticated ? <a href="/account">Аккаунт · {account.displayName}</a> : <a href="/account">Войти и сохранить</a>}
          </div>
        </details>
      </header>
      {showAdditionalSpellWarning && <div className="modal-backdrop" role="presentation">
        <section className="warning-modal" role="dialog" aria-modal="true" aria-labelledby="additional-spells-warning-title">
          <small>Совместимость экспорта</small>
          <h2 id="additional-spells-warning-title">Экспорт в Helpmate может быть неполным.</h2>
          <p>Некоторые заклинания из выбранных дополнительных источников отсутствуют во внутренней базе Helpmate и не смогут быть корректно перенесены при экспорте.</p>
          <div><button onClick={() => setShowAdditionalSpellWarning(false)}>Отмена</button><button className="primary-action" onClick={confirmAdditionalSpells}>Всё равно включить</button></div>
        </section>
      </div>}
      {helpmateExportWarning && <div className="modal-backdrop" role="presentation">
        <section className="warning-modal" role="dialog" aria-modal="true" aria-labelledby="helpmate-export-warning-title">
          <small>Helpmate</small>
          <h2 id="helpmate-export-warning-title">Экспорт в Helpmate будет неполным.</h2>
          <p>Helpmate не содержит следующие заклинания:</p>
          <ul>{helpmateExportWarning.map(name => <li key={name}>{name}</li>)}</ul>
          <p>Остальные заклинания будут экспортированы нормально.</p>
          <div><button onClick={() => setHelpmateExportWarning(null)}>Отмена</button><button className="primary-action" onClick={confirmPartialHelpmateExport}>Экспортировать совместимые</button></div>
        </section>
      </div>}
      <MissingChoiceNavigator signature={`${step}:${character.race}:${character.className}:${character.background}:${character.level}:${JSON.stringify(character.advancements)}:${JSON.stringify(character.classChoices)}:${character.spells.join(",")}:${(character.preparedSpells || []).join(",")}:${(character.languages || []).join(",")}`} />
      {activeBan && (
        <div className="ban-status">
          <span>Активен: <strong>{activeBan.name}</strong> · {activeBan.mode === "deny" ? "запрещены выбранные" : "разрешены только выбранные"} · скрыто {hiddenCount}</span>
          <button onClick={() => { setActiveBan(null); localStorage.removeItem("dark-codex-banlist"); }}>Отключить</button>
        </div>
      )}
      <div className="workspace">
        <nav className="steps">
          <p className="eyebrow">Создание</p>
          {steps.map((label, index) => (
            <button key={label} className={`step ${index === step ? "active" : ""} ${index < step ? "done" : ""}`} onClick={() => resetFilters(index)}>
              <span>{index < step ? "✓" : index + 1}</span><strong>{label}</strong>
            </button>
          ))}
          <div className="compass">✦<small>2014 EDITION</small></div>
        </nav>
        <section className="content">
          {importMessage && (
            <div className={`import-result ${importMessage.warnings.length ? "warning" : "success"}`}>
              <div>
                <strong>{importMessage.source === "native" ? "Создан новый импортированный персонаж" : importMessage.source === "long-story-short" ? "Long Story Short импортирован как новый персонаж" : "Helpmate импортирован как новый персонаж"}</strong>
                {importMessage.warnings.map(warning => <p key={warning}>{warning}</p>)}
              </div>
              <button onClick={() => setImportMessage(null)}>Скрыть</button>
            </div>
          )}
          {interactionError && <div className="import-result warning"><div><strong>Выбор не применён</strong><p>{interactionError}</p></div><button type="button" onClick={() => setInteractionError(null)}>Скрыть</button></div>}
          <header className="content-head">
            <p className="eyebrow">Шаг {step + 1} · официальный каталог</p>
            <h1>{headings[step]}</h1>
            <p>{stepDescription}</p>
          </header>

          {(step === 0 || step === 7) && <section className={`additional-spell-access${additionalSpellsUnlocked ? " unlocked" : ""}`}>
            <div><small>Дополнительные заклинания</small><strong>{additionalSpellsUnlocked ? "Источники разблокированы" : "Совместимый с Helpmate набор"}</strong><p>{additionalSpellsUnlocked ? "FTD, EGW, AI, SAS, PAM, BMT и Create Magen доступны в выборе заклинаний. Бан-лист мастера продолжает действовать." : "FTD, EGW, AI, SAS, PAM, BMT и Create Magen скрыты. Их можно включить для PDF, LSS и игры в «Листе Героя»."}</p></div>
            <button onClick={requestAdditionalSpells}>{additionalSpellsUnlocked ? "Скрыть дополнительные источники" : "Разблокировать дополнительные источники"}</button>
          </section>}

          {(step < 2 || step === 3) && (
            <>
              <div className="tools">
                <label className="search">⌕<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Поиск по каталогу" /></label>
                <div className="source-filter" aria-label="Фильтр по книгам">
                  {(step === 0 || step === 3) && <button className={sources.every(value => selectedSources.includes(value)) ? "active" : ""} onClick={() => setSelectedSources(current => sources.every(value => current.includes(value)) ? ["PHB"] : sources)}>Все</button>}
                  {sources.map(value => <button key={value} className={selectedSources.includes(value) ? "active" : ""} onClick={() => toggleSource(value)}>{value}</button>)}
                </div>
              </div>
              <div className="catalog-meta">{filtered.length} вариантов · только официальные источники</div>
              <div className="card-grid">
                {filtered.map(option => {
                  const selected = (step === 0 ? character.race : step === 1 ? character.className : character.background) === option.id;
                  const detailFeatures = step === 0
                    ? raceFeatures(option.id, option.id === character.race ? character.raceVariant : "", option.description, option.tags)
                    : step === 1
                      ? documentedClassFeatures(option.id, undefined, false, classRules[option.id]?.features || [], [], [])
                      : [{ ...backgroundRule(option.id, option).feature }];
                  return (
                    <article key={option.id} className={`choice-card ${selected ? "selected" : ""}`}>
                      <CatalogIcon id={option.id} kind={step === 0 ? "race" : step === 1 ? "class" : "background"} fallback={option.name} experimental={usesOrnateIcons} />
                      <div>
                        <div className="card-title"><h2>{option.name}</h2><em>{option.source}</em></div>
                        <p>{option.description}</p>
                        <div className="tags">{option.tags?.map(tag => <span key={tag}>{tag}</span>)}</div>
                        <div className="card-actions">
                          <button type="button" onClick={event => selectCatalogOption(event, option.id)}>{selected ? "Выбрано" : "Выбрать"}</button>
                          <button className="details-button" onClick={() => setDetailsId(detailsId === option.id ? "" : option.id)}>Подробнее</button>
                        </div>
                      </div>
                      {selected && <span className="check">✓</span>}
                      {detailsId === option.id && (
                        <div className="option-details">
                          <h3>Правила и особенности</h3>
                          {step === 0 && (() => {
                            const variantId = option.id === character.race ? character.raceVariant : "base";
                            const rule = selectedRaceVariant(option.id, variantId);
                            if (!rule) return null;
                            const bonuses = Object.entries(rule.bonuses || {}).map(([key, value]) => `${abilityLabels[key as keyof ExportCharacter["abilities"]]} +${value}`);
                            return <div className="background-mechanics race-mechanics">
                              <p><b>Вариант:</b> {rule.name} · {rule.source}</p>
                              <p><b>Характеристики:</b> {bonuses.join(", ") || (rule.chooseBonuses ? rule.description : "нет фиксированных бонусов")}</p>
                              <p><b>Владения:</b> {raceProficiencies({ ...character, race: option.id, raceVariant: rule.id }).join(", ") || "нет"}</p>
                            </div>;
                          })()}
                          {detailFeatures.length ? (
                            <div className="feature-preview">
                              {detailFeatures.map(feature => (
                                <div key={`${feature.level}-${feature.name}`}>
                                  <strong>{feature.level ? `${feature.level} ур. · ` : ""}{feature.name}</strong>
                                  <p>{feature.description}</p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <ul>
                              {(option.details?.length ? option.details : [`Источник: ${option.source}.`, option.description, ...(option.tags || []).map(tag => `Ключевая особенность: ${tag}.`)]).map(value => <li key={value}>{value}</li>)}
                            </ul>
                          )}
                          {step === 3 && (() => {
                            const rule = backgroundRule(option.id, option);
                            const startingGold = backgroundStartingGold(option.id, option);
                            return <div className="background-mechanics">
                              <p><b>Навыки:</b> {rule.skills.join(", ") || "нет"}{rule.skillChoice ? `; выбор: ${rule.skillChoice}` : ""}</p>
                              <p><b>Инструменты:</b> {rule.tools.join(", ") || "нет"}{rule.toolChoice ? `; выбор: ${rule.toolChoice}` : ""}</p>
                              <p><b>Языки:</b> {rule.languageChoices ? `${rule.languageChoices} на выбор` : rule.languageNote || "не даёт"}</p>
                              <p><b>Снаряжение:</b> {backgroundEquipmentWithoutStartingGold(rule.equipment).join(", ") || "согласуйте с Мастером"}</p>
                              <p><b>Кошелёк:</b> {startingGold} зм — будет записан в поле ЗМ.</p>
                            </div>;
                          })()}
                          {step === 0 && variantsFor(option.id).length > 0 && (
                            <fieldset className="variant-picker">
                              <legend>Обязательный вариант / подраса</legend>
                              {variantsFor(option.id).map(variant => (
                                <label key={variant.id}>
                                  <input
                                    type="radio"
                                    checked={character.race === option.id && character.raceVariant === variant.id}
                                    onChange={() => setCharacter(current => ({
                                      ...current,
                                      race: option.id,
                                      raceVariant: variant.id,
                                      raceAbilityChoices: [],
                                      raceSkills: [],
                                      feats: [],
                                      asiChoices: [],
                                      advancements: [],
                                    }))}
                                  />
                                  <span>
                                    <strong>{variant.name} · {variant.source}</strong>{variant.description}
                                    <small className="variant-bonus-line">
                                      {Object.keys(variant.bonuses || {}).length
                                        ? `Характеристики: ${Object.entries(variant.bonuses).map(([key, value]) => `${abilityLabels[key as keyof ExportCharacter["abilities"]]} +${value}`).join(", ")}`
                                        : variant.chooseBonuses ? "Характеристики выбираются по правилам варианта" : "Без фиксированного бонуса"}
                                      {variant.proficiencies?.length ? ` · Владения: ${variant.proficiencies.join(", ")}` : ""}
                                    </small>
                                    {variant.features?.length ? <span className="variant-feature-list">{variant.features.map(feature => <small className="variant-feature-line" key={feature.name}><b>{feature.name}.</b> {feature.description}</small>)}</span> : null}
                                  </span>
                                </label>
                              ))}
                            </fieldset>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </>
          )}

          {step === 3 && character.background && backgroundChoiceGroups(character.background, featCatalog).length > 0 && (
            <section className="feat-choice-builder background-choice-builder">
              <div className="ability-editor-head"><div><small>Обязательные решения предыстории</small><h2>Настройте «{selectedBackground?.name}»</h2></div></div>
              {backgroundChoiceGroups(character.background, featCatalog).map(group => {
                const selected = character.backgroundChoices?.[group.key] || [];
                return <section className="feat-choice-group" key={group.key}>
                  <header><div><h3>{group.title}</h3><p>{group.description}</p></div><strong>{selected.length} / {group.count}</strong></header>
                  <div className="feat-choice-options">{group.options.map(option => <button type="button" key={option.id} className={selected.includes(option.id) ? "selected" : ""} onClick={() => chooseBackgroundChoice(group.key, option.id, group.count, group.kind, group.grantsFeatId)}><span>{selected.includes(option.id) ? "✓" : "+"}</span><strong>{option.name}</strong>{option.detail && <small>{option.detail}</small>}</button>)}</div>
                </section>;
              })}
            </section>
          )}

          {step === 2 && (
            <div className="pointbuy-layout">
              <div className={`pointbuy-status ${pointRemaining === 0 ? "complete" : ""}`} data-incomplete={pointRemaining !== 0}>
                <div><span>Осталось очков</span><strong>{pointRemaining}</strong></div>
                <small>Стоимость: 8→0 · 9→1 · 10→2 · 11→3 · 12→4 · 13→5 · 14→7 · 15→9</small>
                <button onClick={chooseOptimalAbilities}>Оптимальные характеристики</button>
              </div>
              <div className="pointbuy-grid">
                {(Object.keys(abilityLabels) as (keyof ExportCharacter["abilities"])[]).map(key => (
                  <section key={key}>
                    <small>{abilityLabels[key]}</small>
                    <div className="score-control">
                      <button onClick={() => changePointBuy(key, -1)} disabled={character.abilities[key] <= 8}>−</button>
                      <strong>{character.abilities[key]}</strong>
                      <button onClick={() => changePointBuy(key, 1)} disabled={character.abilities[key] >= 15 || pointRemaining <= 0}>+</button>
                    </div>
                    <p>Цена: {({ 8:0, 9:1, 10:2, 11:3, 12:4, 13:5, 14:7, 15:9 } as Record<number, number>)[character.abilities[key]]} · бонус расы: {variantBonus[key] ? `+${variantBonus[key]}` : "—"}</p>
                    <b>Итог {finalAbilities[key]} ({abilityModifier(finalAbilities[key]) >= 0 ? "+" : ""}{abilityModifier(finalAbilities[key])})</b>
                  </section>
                ))}
              </div>
              {chosenRaceVariant?.chooseBonuses && (
                <div className="racial-choice" data-incomplete={(character.raceAbilityChoices || []).length !== chosenRaceVariant.chooseBonuses.count}>
                  <div><small>{chosenRaceVariant.name}</small><h2>Выберите {chosenRaceVariant.chooseBonuses.count} бонуса характеристик</h2></div>
                  <div className="proficiency-grid">
                    {(Object.keys(abilityLabels) as (keyof ExportCharacter["abilities"])[])
                      .filter(key => !chosenRaceVariant.chooseBonuses?.exclude?.includes(key))
                      .map(key => (
                        <button key={key} className={(character.raceAbilityChoices || []).includes(key) ? "selected" : ""} onClick={() => toggleRaceAbility(key)}>
                          <span>{(character.raceAbilityChoices || []).includes(key) ? "✓" : "+"}</span>{abilityLabels[key]} {(character.raceAbilityChoices || []).includes(key)
                            ? `+${chosenRaceVariant.chooseBonuses?.amounts?.[(character.raceAbilityChoices || []).indexOf(key)] ?? chosenRaceVariant.chooseBonuses?.amount ?? 0}`
                            : chosenRaceVariant.chooseBonuses?.amounts ? `(+${chosenRaceVariant.chooseBonuses.amounts.join(" / +")})` : `+${chosenRaceVariant.chooseBonuses?.amount}`}
                        </button>
                      ))}
                  </div>
                </div>
              )}
              {raceSkillChoiceCount(character) > 0 && (
                <div className="racial-choice" data-incomplete={character.raceSkills.length !== raceSkillChoiceCount(character)}>
                  <div><small>{chosenRaceVariant?.name || selectedRace?.name}</small><h2>Выберите расовые владения навыками: {character.raceSkills.length} / {raceSkillChoiceCount(character)}</h2></div>
                  <div className="proficiency-grid">
                    {allSkillNames.map(skill => (
                      <button key={skill} className={(character.raceSkills || []).includes(skill) ? "selected" : ""} onClick={() => chooseRaceSkill(skill)}>
                        <span>{(character.raceSkills || []).includes(skill) ? "✓" : "+"}</span>{skill}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="skill-sections">
              <div className="skill-source" data-incomplete={character.classSkills.length !== classRule.count}>
                <div className="skill-source-head"><div><small>Предыстория</small><h2>{selectedBackground?.name}</h2></div><strong>{fixedBackgroundSkills.length}</strong></div>
                <p>Эти владения выдаются выбранной предысторией.</p>
                <div className="proficiency-grid">{fixedBackgroundSkills.map(skill => <button disabled className="selected" key={skill}><span>✓</span>{skill}</button>)}</div>
              </div>
              <div className="skill-source">
                <div className="skill-source-head"><div><small>Класс</small><h2>{selectedClass?.name}</h2></div><strong>{character.classSkills.length} / {classRule.count}</strong></div>
                <p>Выберите {classRule.count}; владения предыстории автоматически исключены.</p>
                <div className="proficiency-grid">
                  {classRule.skills.filter(skill => !unavailableClassSkills.includes(skill)).map(skill => (
                    <button key={skill} className={character.classSkills.includes(skill) ? "selected" : ""} onClick={() => toggleSkill(skill)}>
                      <span>{character.classSkills.includes(skill) ? "✓" : "+"}</span>{skill}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="equipment-builder">
              <div className="equipment-toolbar">
                <div><small>{selectedClass?.name}</small><h2>Стартовое снаряжение класса</h2><p>Рекомендация учитывает Силу {finalAbilities.str}, Ловкость {finalAbilities.dex}, владения и выбранный боевой стиль. Вариант старта с золотом не используется.</p></div>
                <button onClick={chooseOptimalEquipment}>✦ Выбрать оптимальный</button>
              </div>
              {classEquipment.groups.map(group => {
                const selected = character.equipmentSelections?.[group.key] || [];
                const recommended = optimalEquipmentSelections(character.className, finalAbilities, {
                  classChoices: character.classChoices,
                  subclass: character.subclass,
                })[group.key] || [];
                return <section className="equipment-group" key={group.key} data-incomplete={selected.length !== group.count}>
                  <header><div><small>Обязательный выбор</small><h3>{group.label}</h3></div><strong className={selected.length === group.count ? "complete" : ""}>{selected.length} / {group.count}</strong></header>
                  <div className="equipment-options">
                    {group.options.map(option => {
                      const advice = equipmentOptionAdvice(option, finalAbilities);
                      return <button key={option.id} className={`${selected.includes(option.id) ? "selected" : ""} ${advice.startsWith("Не рекомендуется") ? "not-recommended" : ""}`} onClick={() => toggleEquipment(group.key, option.id, group.count)}>
                        <span>{selected.includes(option.id) ? "✓" : "+"}</span><strong>{option.label}</strong>
                        {((group.key !== "focus" && recommended.includes(option.id)) || advice) && <small className={group.key !== "focus" && recommended.includes(option.id) ? "recommended-label" : "equipment-advice"}>{group.key !== "focus" && recommended.includes(option.id) ? "✦ рекомендуется для ваших характеристик" : advice}</small>}
                      </button>;
                    })}
                  </div>
                </section>;
              })}
              <section className="equipment-fixed"><h3>Также получаете автоматически</h3><p>{[...classEquipment.fixed, ...backgroundEquipmentWithoutStartingGold(selectedBackgroundRule.equipment)].join(" · ") || "Нет фиксированного снаряжения."}</p>{classEquipment.fixed.includes("Кольчуга") && finalAbilities.str < 13 && <small>Кольчуга предусмотрена стартовым набором класса, но при Силе ниже 13 снижает скорость на 10 футов. Она не считается оптимальной рекомендацией.</small>}</section>
              <section className="currency-editor" aria-label="Монеты персонажа">
                <div><small>Учёт на основном листе</small><h3>Кошелёк</h3><p>Эти значения сохраняются вместе с персонажем и показываются на первой странице листа.</p></div>
                <div className="currency-inputs">
                  {(["gp", "sp", "cp", "pp"] as const).map(key => {
                    const labels = { gp: ["ЗМ", "золото"], sp: ["СМ", "серебро"], cp: ["ММ", "медь"], pp: ["ПМ", "платина"] } as const;
                    return <label key={key}><span>{labels[key][0]}</span><input aria-label={`${labels[key][1]}: количество`} type="number" min="0" value={character.currency?.[key] || 0} onChange={event => setCharacter(current => ({ ...current, currency: { ...initial.currency, ...current.currency, [key]: Math.max(0, Number(event.target.value) || 0) } }))} /><small>{labels[key][1]}</small></label>;
                  })}
                </div>
              </section>
            </div>
          )}

          {step === 6 && (
            <div className="level-layout">
              <div className="level-panel">
                <div className="level-number">{character.level}</div>
                <input aria-label="Уровень персонажа" type="range" min="1" max="20" value={character.level} onChange={event => changeLevel(+event.target.value)} />
                <div className="level-ticks"><span>1</span><span>5</span><span>10</span><span>15</span><span>20</span></div>
                <p>Бонус владения: <strong>+{proficiency}</strong> · кость хитов: <strong>к{classRules[character.className]?.hitDie || 8}</strong></p>
              </div>
              <div className="spell-progression">
                <div className="ability-editor-head"><div><small>Заклинательства на этом уровне</small><h2>{spellRule.caster ? spellRule.title : "Без базовой магии"}</h2></div><span>{spellRule.maxLevel ? `до ${spellRule.maxLevel} круга` : "—"}</span></div>
                {spellRule.caster ? (
                  <>
                    <div className="progression-facts">
                      <div><span>Заговоры</span><strong>{spellRule.cantrips}</strong></div>
                      <div><span>{spellRule.mode === "prepared" ? "Подготовить" : spellRule.mode === "spellbook" ? "В книге" : "Известно"}</span><strong>{spellRule.leveled}</strong></div>
                      {spellRule.prepared !== undefined && spellRule.mode === "spellbook" && <div><span>Подготовить</span><strong>{spellRule.prepared}</strong></div>}
                      <div><span>Макс. круг</span><strong>{spellRule.maxLevel}</strong></div>
                    </div>
                    {spellRule.pact ? (
                      <div className="slot-row"><span>Магия договора</span><b>{spellRule.pact.slots} яч. {spellRule.pact.level} круга</b><small>Восстанавливаются после короткого отдыха</small></div>
                    ) : (
                      <div className="slot-grid">
                        {spellRule.slots.map((count, index) => <div key={index}><small>{index + 1} круг</small><strong>{count}</strong><span>ячеек</span></div>)}
                      </div>
                    )}
                  </>
                ) : <p className="muted">У выбранного класса на этом уровне нет базового выбора заклинаний.</p>}
              </div>
              <div className="spell-progression resource-progression">
                <div className="ability-editor-head"><div><small>Счётчики на листе</small><h2>Классовые ресурсы</h2></div><span>{resources.length || "—"}</span></div>
                {resources.length ? <div className="resource-preview-grid">
                  {resources.map(resource => <div key={resource.key}><span>{resource.name}</span><div className="resource-marks preview-resource-marks">{Array.from({ length: Math.ceil(resource.max / (resource.unit || 1)) }, (_, index) => <i key={index} />)}</div><small>{resource.unit && resource.unit > 1 ? `1 круг = ${resource.unit} хитов · ` : resource.die ? `${resource.die} · ` : ""}{resourceRestLabel(resource)} отдых</small></div>)}
                </div> : <p className="muted">На этом уровне нет ограниченного классового ресурса.</p>}
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
                <label><input type="checkbox" checked={!!rulesCharacter.useTasha} disabled={!!activeBan?.tceOptionalFeaturesBanned || !!activeBan?.tceFullBanned} onChange={event => toggleTasha(event.target.checked)} /><span><strong>Опциональные способности Tasha’s Cauldron of Everything</strong>Включает только заменяемые и дополнительные классовые способности. Расширенные списки заклинаний, боевые стили, воззвания и метамагия не зависят от этой галочки; они отключаются только полным запретом TCE в бан-листе.</span></label>
                {activeBan?.tceOptionalFeaturesBanned && <p className="muted">Опциональные способности TCE запрещены текущим бан-листом.</p>}
                {rulesCharacter.useTasha && <div className="feature-preview">{(optionalClassFeatures[character.className] || []).filter(feature => (feature.level || 1) <= character.level).map(feature => <div key={feature.name}><strong>{feature.level} ур. · {feature.name}</strong><p>{feature.description}</p></div>)}</div>}
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
                        const ownedSkills = new Set(proficiencies.skills);
                        const options = group.key === "expertise"
                          ? group.options.filter(option => ownedSkills.has(option.id) || selected.includes(option.id))
                          : (group.key === "skill" || group.key === "proficiencies")
                            ? group.options.filter(option => !ownedSkills.has(option.id) || selected.includes(option.id))
                            : group.options;
                        return <section className="feat-choice-group" key={group.key}>
                          <header><div><h3>{group.title}</h3><p>{group.description}</p></div><strong>{selected.length} / {group.count}</strong></header>
                          <div className="feat-choice-options">
                            {options.map(option => <button key={option.id} className={selected.includes(option.id) ? "selected" : ""} onClick={() => toggleFeatChoice(activeAdvancement.key, group.key, option.id, group.count)}>
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
                <label>Опыт<input type="number" min="0" value={character.experience || 0} onChange={event => setCharacter(current => ({ ...current, experience: Math.max(0, Number(event.target.value) || 0) }))} /></label>
                <label>Мировоззрение<select value={character.alignment} onChange={event => setCharacter(current => ({ ...current, alignment: event.target.value }))}>{alignments.map(value => <option key={value} value={value}>{value || "Не выбрано"}</option>)}</select></label>
                <label>Вдохновение<select value={character.inspiration ? "yes" : "no"} onChange={event => setCharacter(current => ({ ...current, inspiration: event.target.value === "yes" }))}><option value="no">Нет</option><option value="yes">Есть</option></select></label>
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
                  experience: character.experience || 0,
                  inspiration: !!character.inspiration,
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
