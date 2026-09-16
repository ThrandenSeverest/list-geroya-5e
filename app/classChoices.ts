import type { CatalogSpell } from "./catalog";
import type { ExportCharacter } from "./exportFormats";
import type { Feature } from "./rules";
import { classView, getStartingClassId, migrateMulticlassCharacter, orderedCharacterClasses } from "./multiclass";
import { sheetChoiceDescriptions, sheetClassFeatures, sheetOptionalFeatures, sheetSubclassFeatures } from "./generatedSheetRules";

export type ClassChoiceOption = {
  id: string;
  name: string;
  source: string;
  /** Brief text for selection cards. Never use it for the finished sheet. */
  summary?: string;
  description: string;
  /** Complete rules text for the finished sheet, PDF and game mode. */
  fullDescription?: string;
  minLevel?: number;
  pact?: string;
  tasha?: boolean;
  mode?: "catalog" | "replace" | "passthrough" | "grant";
  canonicalFeatureName?: string;
  replacesFeatureName?: string;
  emitFeature?: boolean;
  disabledReason?: string;
};

export type ClassChoiceGroup = {
  key: string;
  title: string;
  description: string;
  level: number;
  count: number;
  options: ClassChoiceOption[];
  defaultOptionId?: string;
};

function normalizedName(value: string) {
  return value.toLocaleLowerCase("ru-RU").replace(/ё/g, "е").replace(/\b(?:tce|tcoe)\b/gi, "").replace(/[^a-zа-я0-9]+/g, " ").trim();
}

const O = (id: string, name: string, source: string, description: string, extra: Partial<ClassChoiceOption> = {}): ClassChoiceOption => ({
  id, name, source, description, ...extra,
  fullDescription: extra.fullDescription || sheetChoiceDescriptions[normalizedName(name)],
});

function sheetFeature(classId: string, name: string, subclass = "") {
  const wanted = normalizedName(name);
  const pools = [
    sheetClassFeatures[classId] || [],
    sheetOptionalFeatures[classId] || [],
    ...Object.entries(sheetSubclassFeatures[classId] || {})
      .filter(([subclassName]) => !subclass || normalizedName(subclassName).includes(normalizedName(subclass)) || normalizedName(subclass).includes(normalizedName(subclassName)))
      .map(([, features]) => features),
  ];
  return pools.flat().find(feature => {
    const candidate = normalizedName(feature.name);
    return candidate === wanted || candidate.startsWith(wanted) || wanted.startsWith(candidate);
  });
}

function documentedOption(classId: string, id: string, name: string, source: string, summary: string, extra: Partial<ClassChoiceOption> = {}) {
  const documented = sheetFeature(classId, extra.canonicalFeatureName || name);
  return O(id, documented?.name || name, source, summary, { ...extra, fullDescription: documented?.description || extra.fullDescription });
}

const fightingStyles = [
  O("archery", "Стрельба", "PHB", "+2 к броскам атаки дальнобойным оружием."),
  O("defense", "Оборона", "PHB", "+1 к КД, пока вы носите доспех."),
  O("dueling", "Дуэлянт", "PHB", "+2 к урону одноручным оружием, когда во второй руке нет оружия."),
  O("great-weapon", "Сражение большим оружием", "PHB", "Перебрасывает 1 и 2 на костях урона двуручного оружия."),
  O("protection", "Защита", "PHB", "Реакцией создаёт помеху атаке по соседнему союзнику, если у вас есть щит."),
  O("two-weapon", "Сражение двумя оружиями", "PHB", "Добавляет модификатор характеристики к урону второй атаки."),
  O("blind-fighting", "Слепой бой", "TCE", "Даёт слепое зрение в пределах 10 футов.", { tasha: true }),
  O("interception", "Перехват", "TCE", "Реакцией уменьшает урон по соседней цели.", { tasha: true }),
  O("superior-technique", "Превосходная техника", "TCE", "Даёт один манёвр и одну кость превосходства к6.", { tasha: true }),
  O("thrown-weapon", "Сражение метательным оружием", "TCE", "Позволяет доставать метательное оружие частью атаки и добавляет +2 к урону.", { tasha: true }),
  O("unarmed-fighting", "Сражение без оружия", "TCE", "Безоружные удары наносят 1к6 + Сила, либо 1к8 + Сила при свободных руках; захваченная цель получает 1к4 урона в начале вашего хода.", { tasha: true }),
  O("blessed-warrior", "Благословенный воин", "TCE", "Вы изучаете два заговора жреца. Для них используется Харизма паладина.", { tasha: true, mode: "grant" }),
  O("druidic-warrior", "Воин-друид", "TCE", "Вы изучаете два заговора друида. Для них используется Мудрость следопыта.", { tasha: true, mode: "grant" }),
];

const metamagic = [
  O("careful", "Аккуратное заклинание", "PHB", "Защищает выбранных существ от худшего результата спасброска вашего заклинания."),
  O("distant", "Далёкое заклинание", "PHB", "Удваивает дистанцию заклинания или превращает касание в дистанцию 30 футов."),
  O("empowered", "Усиленное заклинание", "PHB", "Позволяет перебросить часть костей урона."),
  O("extended", "Продлённое заклинание", "PHB", "Удваивает длительность заклинания, максимум до 24 часов."),
  O("heightened", "Неодолимое заклинание", "PHB", "Даёт одной цели помеху на первый спасбросок от заклинания."),
  O("quickened", "Ускоренное заклинание", "PHB", "Меняет время накладывания с действия на бонусное действие."),
  O("subtle", "Неуловимое заклинание", "PHB", "Позволяет обойти словесные и соматические компоненты."),
  O("twinned", "Удвоенное заклинание", "PHB", "Добавляет вторую цель заклинанию, которое обычно нацеливается только на одно существо."),
  O("seeking", "Ищущее заклинание", "TCE", "Позволяет перебросить промах броска атаки заклинанием.", { tasha: true }),
  O("transmuted", "Преобразованное заклинание", "TCE", "Меняет один стихийный тип урона заклинания на другой.", { tasha: true }),
];

const maneuvers = [
  O("ambush", "Засада", "TCE", "Добавляет кость превосходства к Скрытности или инициативе.", { tasha: true }),
  O("bait-switch", "Обманный манёвр", "TCE", "Меняется местами с союзником и повышает КД одного из вас.", { tasha: true }),
  O("brace", "Стойка", "TCE", "Реакцией атакует существо, вошедшее в досягаемость.", { tasha: true }),
  O("commanding-presence", "Командное присутствие", "TCE", "При проверке Харизмы (Запугивание, Выступление или Убеждение) потратьте кость превосходства и добавьте её к проверке.", { tasha: true }),
  O("grappling-strike", "Захватывающий удар", "TCE", "После попадания рукопашной атакой потратьте кость и бонусным действием попытайтесь захватить цель, добавив кость к Атлетике.", { tasha: true }),
  O("quick-toss", "Быстрый бросок", "TCE", "Бонусным действием потратьте кость и атакуйте метательным оружием; при попадании добавьте кость к урону.", { tasha: true }),
  O("tactical-assessment", "Тактическая оценка", "TCE", "Добавьте кость превосходства к проверке Расследования, Истории или Проницательности.", { tasha: true }),
  O("commanders-strike", "Командирская атака", "PHB", "Отдаёт одну атаку союзнику реакцией."),
  O("disarming", "Обезоруживающая атака", "PHB", "Усиливает попадание и заставляет цель выронить предмет."),
  O("distracting", "Отвлекающая атака", "PHB", "Следующая атака союзника по цели получает преимущество."),
  O("evasive-footwork", "Манёвр уклонения", "PHB", "Добавляет кость превосходства к КД во время перемещения."),
  O("feinting", "Ложный выпад", "PHB", "Бонусным действием получает преимущество и дополнительный урон."),
  O("goading", "Провоцирующая атака", "PHB", "Цели сложнее атаковать кого-либо, кроме вас."),
  O("lunging", "Атака с выпадом", "PHB", "Увеличивает досягаемость и урон атаки."),
  O("maneuvering", "Маневрирующая атака", "PHB", "Позволяет союзнику безопасно переместиться реакцией."),
  O("menacing", "Устрашающая атака", "PHB", "Может напугать поражённую цель."),
  O("parry", "Парирование", "PHB", "Реакцией уменьшает урон атаки ближнего боя."),
  O("precision", "Точная атака", "PHB", "Добавляет кость превосходства к броску атаки."),
  O("pushing", "Толкающая атака", "PHB", "Отталкивает цель после попадания."),
  O("rally", "Сплочение", "PHB", "Бонусным действием даёт союзнику временные хиты."),
  O("riposte", "Ответный удар", "PHB", "Реакцией атакует промахнувшегося противника."),
  O("sweeping", "Размашистая атака", "PHB", "Переносит часть урона на вторую соседнюю цель."),
  O("trip", "Сбивающая атака", "PHB", "Может сбить цель с ног после попадания."),
];

const arcaneShots = [
  O("banishing-arrow", "Изгоняющая стрела", "XGE", "На время отправляет поражённую цель в безвредное место в Стране Фей."),
  O("beguiling-arrow", "Обманная стрела", "XGE", "Наносит психический урон и может очаровать цель одним из союзников."),
  O("bursting-arrow", "Разрывная стрела", "XGE", "Взрывается силовой энергией и ранит существ рядом с целью."),
  O("enfeebling-arrow", "Ослабляющая стрела", "XGE", "Наносит некротический урон и ослабляет урон оружием цели."),
  O("grasping-arrow", "Опутывающая стрела", "XGE", "Опутывает цель колючими растениями, замедляя и раня при движении."),
  O("piercing-arrow", "Пронзающая стрела", "XGE", "Проходит линией сквозь существ и препятствия."),
  O("seeking-arrow", "Ищущая стрела", "XGE", "Ищет известную вам цель за укрытиями и поворотами."),
  O("shadow-arrow", "Теневая стрела", "XGE", "Наносит психический урон и резко ограничивает зрение цели."),
];

const invocations = [
  O("agonizing-blast", "Мучительный взрыв", "PHB", "Добавляет модификатор Харизмы к урону мистического заряда."),
  O("armor-shadows", "Доспех теней", "PHB", "Позволяет без ячейки накладывать на себя доспехи мага."),
  O("beast-speech", "Звериная речь", "PHB", "Позволяет без ячейки накладывать разговор с животными."),
  O("beguiling-influence", "Обманчивое влияние", "PHB", "Даёт владение Обманом и Убеждением."),
  O("devils-sight", "Дьявольский взгляд", "PHB", "Позволяет видеть в обычной и магической тьме на 120 футов."),
  O("eldritch-sight", "Мистическое зрение", "PHB", "Позволяет без ячейки накладывать обнаружение магии."),
  O("eyes-rune-keeper", "Глаза хранителя рун", "PHB", "Позволяет читать любые письмена."),
  O("fiendish-vigor", "Дьявольская живучесть", "PHB", "Позволяет без ячейки накладывать на себя ложную жизнь."),
  O("gaze-two-minds", "Взгляд двух умов", "PHB", "Позволяет воспринимать мир чувствами согласного гуманоида."),
  O("mask-many-faces", "Маска многих лиц", "PHB", "Позволяет без ячейки накладывать маскировку."),
  O("misty-visions", "Туманные видения", "PHB", "Позволяет без ячейки накладывать безмолвный образ."),
  O("repelling-blast", "Отталкивающий заряд", "PHB", "Мистический заряд отталкивает поражённую цель."),
  O("thief-five-fates", "Похититель пяти судеб", "PHB", "Позволяет раз в отдых наложить порчу ячейкой колдуна."),
  O("voice-chain-master", "Голос хозяина цепи", "PHB", "Позволяет общаться и воспринимать мир через фамильяра.", { pact: "chain" }),
  O("book-ancient-secrets", "Книга древних секретов", "PHB", "Добавляет ритуалы в Книгу Теней.", { pact: "tome" }),
  O("improved-pact-weapon", "Улучшенное оружие договора", "XGE", "Оружие договора становится фокусировкой и получает бонус, если ещё не магическое.", { pact: "blade" }),
  O("gift-ever-living", "Дар вечноживых", "XGE", "Рядом с фамильяром вы получаете максимальный результат костей лечения.", { pact: "chain" }),
  O("tomb-levistus", "Гробница Левистуса", "XGE", "Реакцией заключает вас в защитный лёд.", { minLevel: 5 }),
  O("cloak-flies", "Покров мух", "XGE", "Бонусным действием создаёт вокруг себя наносящую урон ауру.", { minLevel: 5 }),
  O("eldritch-smite", "Мистическая кара", "XGE", "Тратит ячейку договора, чтобы усилить попадание и сбить цель.", { minLevel: 5, pact: "blade" }),
  O("ghostly-gaze", "Призрачный взгляд", "XGE", "На короткое время позволяет видеть сквозь твёрдые предметы.", { minLevel: 7 }),
  O("relentless-hex", "Неотступное проклятие", "XGE", "Телепортирует вас к проклятой цели.", { minLevel: 7 }),
  O("shroud-shadow", "Покров тени", "XGE", "Позволяет без ячейки накладывать невидимость.", { minLevel: 15 }),
  O("eldritch-mind", "Мистический разум", "TCE", "Даёт преимущество на спасброски Телосложения для концентрации.", { tasha: true }),
  O("investment-chain-master", "Вложение хозяина цепи", "TCE", "Усиливает фамильяра договора и управление им.", { pact: "chain", tasha: true }),
  O("bond-talisman", "Узы талисмана", "TCE", "Действием телепортирует владельца талисмана к вам или вас к нему; число применений равно бонусу мастерства за продолжительный отдых.", { minLevel: 12, pact: "talisman", tasha: true }),
  O("far-scribe", "Дальний писец", "TCE", "В Книге Теней появляется страница имён; с записанным существом можно обмениваться сообщениями без ячейки.", { minLevel: 5, pact: "tome", tasha: true }),
  O("gift-protectors", "Дар защитников", "TCE", "Записанное в Книге Теней существо вместо падения до 0 хитов остаётся с 1; после срабатывания способность восстанавливается после продолжительного отдыха.", { minLevel: 9, pact: "tome", tasha: true }),
  O("protection-talisman", "Защита талисмана", "TCE", "Провалив спасбросок, носитель талисмана может добавить к4 и потенциально превратить провал в успех.", { minLevel: 7, pact: "talisman", tasha: true }),
  O("rebuke-talisman", "Возмездие талисмана", "TCE", "Когда носителя талисмана поражают в пределах 30 футов, реакцией нанесите атакующему психический урон и оттолкните его.", { pact: "talisman", tasha: true }),
  O("undying-servitude", "Бессмертное служение", "TCE", "Один раз за продолжительный отдых позволяет наложить оживление мертвеца без ячейки и материальных компонентов.", { minLevel: 5, tasha: true }),
];

const infusions = [
  O("enhanced-defense", "Усиленная защита", "TCE", "Даёт доспеху или щиту магический бонус к КД."),
  O("enhanced-weapon", "Усиленное оружие", "TCE", "Даёт оружию магический бонус к атаке и урону."),
  O("enhanced-focus", "Усиленная магическая фокусировка", "TCE", "Улучшает броски атаки заклинаниями и игнорирует часть укрытия."),
  O("homunculus", "Слуга-гомункул", "TCE", "Создаёт летающего магического слугу."),
  O("mind-sharpener", "Укрепитель разума", "TCE", "Помогает сохранять концентрацию на заклинаниях."),
  O("repeating-shot", "Повторяющий выстрел", "TCE", "Улучшает оружие с боеприпасами и создаёт собственные снаряды."),
  O("returning-weapon", "Возвращающееся оружие", "TCE", "Улучшает метательное оружие и возвращает его в руку."),
  O("repulsion-shield", "Отталкивающий щит", "TCE", "Улучшает щит и может оттолкнуть ударившего врага.", { minLevel: 6 }),
  O("resistant-armor", "Доспех сопротивления", "TCE", "Даёт доспеху сопротивление выбранному типу урона.", { minLevel: 6 }),
  O("boots-winding", "Ботинки извилистого пути", "TCE", "Телепортируют в недавно покинутое место.", { minLevel: 6 }),
  O("arcane-propulsion", "Доспех магической тяги", "TCE", "Усиливает скорость и превращает перчатки в метательное оружие.", { minLevel: 14 }),
];

const runes = [
  O("cloud-rune", "Облачная руна", "TCE", "Даёт ловкость обмана и реакцией перенаправляет попадание."),
  O("fire-rune", "Огненная руна", "TCE", "Усиливает работу инструментами и может заковать цель в огненные цепи."),
  O("frost-rune", "Ледяная руна", "TCE", "Усиливает обращение с животными, запугивание и силовые проверки."),
  O("stone-rune", "Каменная руна", "TCE", "Даёт тёмное зрение и может очаровать противника реакцией."),
  O("hill-rune", "Холмовая руна", "TCE", "Даёт стойкость к яду и временную устойчивость к оружейному урону.", { minLevel: 7 }),
  O("storm-rune", "Штормовая руна", "TCE", "Позволяет реакцией давать преимущество или помеху броскам.", { minLevel: 7 }),
];

const fourElementsDisciplines = [
  O("fangs-fire-snake", "Клыки огненной змеи", "PHB", "1 ци: увеличивает досягаемость безоружных атак и позволяет наносить огненный урон."),
  O("fist-four-thunders", "Кулак четырёх громов", "PHB", "2 ци: Волна грома."),
  O("fist-unbroken-air", "Кулак несокрушимого воздуха", "PHB", "2+ ци: силовой толчок, урон и падение ничком."),
  O("rush-gale-spirits", "Порыв духов бури", "PHB", "2 ци: Порыв ветра."),
  O("shape-flowing-river", "Форма текущей реки", "PHB", "1 ци: формирование воды и льда."),
  O("sweeping-cinder-strike", "Размашистый удар угля", "PHB", "2 ци: Огненные ладони."),
  O("water-whip", "Водяной кнут", "PHB", "2+ ци: урон, подтягивание или падение ничком."),
  O("clench-north-wind", "Объятия северного ветра", "PHB", "3 ци: Удержание личности.", { minLevel: 6 }),
  O("gong-summit", "Гонг вершины", "PHB", "3 ци: Дребезги.", { minLevel: 6 }),
  O("flames-phoenix", "Пламя феникса", "PHB", "4 ци: Огненный шар.", { minLevel: 11 }),
  O("mist-stance", "Стойка тумана", "PHB", "4 ци: Газообразная форма на себя.", { minLevel: 11 }),
  O("ride-wind", "Оседлать ветер", "PHB", "4 ци: Полёт на себя.", { minLevel: 11 }),
  O("breath-winter", "Дыхание зимы", "PHB", "6 ци: Конус холода.", { minLevel: 17 }),
  O("eternal-mountain-defense", "Защита вечной горы", "PHB", "5 ци: Каменная кожа на себя без материального компонента.", { minLevel: 17 }),
  O("river-hungry-flame", "Река голодного пламени", "PHB", "5 ци: Стена огня.", { minLevel: 17 }),
  O("wave-rolling-earth", "Волна катящейся земли", "PHB", "6 ци: Каменная стена.", { minLevel: 17 }),
];

const expertiseOptions = ["Акробатика", "Атлетика", "Обман", "История", "Проницательность", "Запугивание", "Расследование", "Магия", "Медицина", "Природа", "Внимательность", "Выступление", "Убеждение", "Религия", "Ловкость рук", "Скрытность", "Выживание", "Уход за животными"].map(name => O(`skill-${name}`, name, "PHB", "Удваивает бонус владения для выбранного навыка."));

const choiceCount = (level: number, rows: [number, number][]) => rows.reduce((value, [at, count]) => level >= at ? count : value, 0);

function available(options: ClassChoiceOption[], character: ExportCharacter, pact = "") {
  return options
    .filter(option => !option.tasha || !character.tceFullBanned)
    .map(option => ({
      ...option,
      disabledReason: option.minLevel && character.level < option.minLevel
        ? `Требуется ${option.minLevel} уровень`
        : option.pact && option.pact !== pact ? `Требуется договор: ${option.pact}` : undefined,
    }));
}

function spellOptions(spells: CatalogSpell[], predicate: (spell: CatalogSpell) => boolean) {
  return spells.filter(predicate).map(spell => O(spell.id, spell.name, spell.source, spell.description));
}

const clericSubclassNames: Record<string, string> = {
  tempest: "Домен бури", war: "Домен войны", life: "Домен жизни", knowledge: "Домен знаний",
  trickery: "Домен обмана", nature: "Домен природы", light: "Домен света", death: "Домен смерти",
  arcana: "Домен магии", forge: "Домен кузни", grave: "Домен упокоения", peace: "Домен мира",
  order: "Домен порядка", twilight: "Домен сумерек",
};

function clericEighthLevelFeature(subclassId: string) {
  const subclassName = clericSubclassNames[subclassId];
  const features = subclassName ? sheetSubclassFeatures.cleric?.[subclassName] || [] : [];
  return features.find(feature => feature.level === 8 && /божественный удар|могущественное колдовство/i.test(feature.name));
}

function singleClassChoiceGroups(character: ExportCharacter, spells: CatalogSpell[] = []): ClassChoiceGroup[] {
  const groups: ClassChoiceGroup[] = [];
  const add = (group: ClassChoiceGroup) => group.count > 0 && groups.push(group);
  const level = character.level;
  const subclass = character.subclass || "";
  const selected = character.classChoices || {};

  if (character.useTasha && !character.tceFullBanned) {
    if (character.className === "barbarian" && level >= 3) add({ key: "tce-primal-knowledge", title: "Первобытное знание", description: "TCE: дополнительный навык; на 10-м уровне выбирается второй.", level: 3, count: level >= 10 ? 2 : 1, options: ["Атлетика", "Внимательность", "Выживание", "Запугивание", "Природа", "Уход за животными"].map(name => O(name, name, "TCE", "Дополнительное владение навыком.")) });
    if (character.className === "monk" && level >= 2) add({ key: "tce-dedicated-weapon", title: "Выбранное оружие", description: "TCE: выбранное подходящее оружие считается монашеским до следующей тренировки.", level: 2, count: 1, options: ["Боевой посох", "Короткий меч", "Копьё", "Ручной топор", "Кнут"].map(name => O(name, name, "TCE", "Подходящее оружие становится монашеским.")) });
    if (character.className === "ranger") {
      add({ key: "tce-favored-foe", title: "Избранный враг или Предпочтительный противник", description: "Tasha открывает альтернативу; PHB остаётся активным, пока вы явно не выберете замену.", level: 1, count: 1, defaultOptionId: "favored-enemy", options: [
        documentedOption("ranger", "favored-enemy", "Избранный враг", "PHB · базовое правило", "Выберите тип избранных врагов: вы получаете преимущество на их выслеживание и знания о них, а также изучаете связанный язык.", { mode: "passthrough", canonicalFeatureName: "Избранный враг", emitFeature: false }),
        documentedOption("ranger", "favored-foe", "Предпочтительный противник", "TCE · опциональная замена", "После попадания пометьте цель с концентрацией: раз в ход добавляйте урон, растущий с уровнем; применений — бонус мастерства за продолжительный отдых.", { mode: "replace", canonicalFeatureName: "Предпочтительный противник", replacesFeatureName: "Избранный враг", tasha: true }),
      ] });
      add({ key: "tce-deft-explorer", title: "Исследователь природы или Искусный исследователь", description: "Выберите исходную PHB-способность либо комплексную замену TCE.", level: 1, count: 1, defaultOptionId: "natural-explorer", options: [
        documentedOption("ranger", "natural-explorer", "Исследователь природы", "PHB · базовое правило", "Выберите любимую местность и получайте преимущества в путешествии, навигации, выслеживании и выживании в ней.", { mode: "passthrough", canonicalFeatureName: "Исследователь природы", emitFeature: false }),
        documentedOption("ranger", "deft-explorer", "Искусный исследователь", "TCE · опциональная замена", "Хитрец даёт экспертизу и два языка; Бродяга улучшает скорость, лазание и плавание; Неутомимый даёт временные хиты и помогает снять истощение.", { mode: "replace", canonicalFeatureName: "Искусный исследователь", replacesFeatureName: "Исследователь природы", tasha: true }),
      ] });
      if ((selected["tce-deft-explorer"] || []).includes("deft-explorer")) add({ key: "tce-deft-explorer-skill", title: "Хитрец", description: "Выберите известный навык для компетентности.", level: 1, count: 1, options: ["Акробатика", "Атлетика", "Внимательность", "Выживание", "Запугивание", "Природа", "Проницательность", "Расследование", "Скрытность", "Уход за животными"].map(name => O(name, name, "TCE", "Бонус мастерства удваивается.")) });
      if (level >= 3) add({ key: "tce-primal-awareness", title: "Первозданная или Изначальная осведомлённость", description: "Выберите PHB-способность либо замену TCE с тематическими заклинаниями.", level: 3, count: 1, defaultOptionId: "primeval-awareness", options: [
        documentedOption("ranger", "primeval-awareness", "Первобытная осведомлённость", "PHB · базовое правило", "Расходуйте ячейку следопыта, чтобы на 1 минуту за круг ячейки ощущать определённые типы существ в пределах местности.", { mode: "passthrough", canonicalFeatureName: "Первобытная осведомлённость", emitFeature: false }),
        documentedOption("ranger", "primal-awareness", "Изначальная осведомлённость", "TCE · опциональная замена", "Получайте тематические заклинания на уровнях 3/5/9/13/17; каждое можно раз за продолжительный отдых наложить без ячейки.", { mode: "replace", canonicalFeatureName: "Изначальная осведомлённость", replacesFeatureName: "Первобытная осведомлённость", tasha: true }),
      ] });
      if (level >= 10) add({ key: "tce-natures-veil", title: "Маскировка на виду или Покров природы", description: "Выберите подготовку маскировки PHB либо быструю невидимость TCE.", level: 10, count: 1, defaultOptionId: "hide-in-plain-sight", options: [
        documentedOption("ranger", "hide-in-plain-sight", "Маскировка на виду", "PHB · базовое правило", "За 1 минуту создайте природную маскировку, дающую +10 к Скрытности, пока вы не двигаетесь и не действуете.", { mode: "passthrough", canonicalFeatureName: "Маскировка на виду", emitFeature: false }),
        documentedOption("ranger", "natures-veil", "Покров природы", "TCE · опциональная замена", "Бонусным действием станьте невидимым до начала следующего хода; применений — бонус мастерства за продолжительный отдых.", { mode: "replace", canonicalFeatureName: "Покров природы", replacesFeatureName: "Маскировка на виду", tasha: true }),
      ] });
    }
    if (character.className === "cleric" && level >= 8) {
      const phb = clericEighthLevelFeature(subclass);
      add({ key: "tce-blessed-strikes", title: `${phb?.name || "Доменная способность"} или Благословлённые удары`, description: "Tasha открывает альтернативу и не заменяет доменную способность автоматически.", level: 8, count: 1, defaultOptionId: "domain-feature", options: [
        O("domain-feature", phb?.name || "Доменная способность 8-го уровня", "PHB · базовое правило", phb?.description || "Оставляет исходную способность вашего домена.", { mode: "passthrough", canonicalFeatureName: phb?.name, emitFeature: false, fullDescription: phb?.description }),
        documentedOption("cleric", "blessed-strikes", "Благословлённые удары", "TCE · опциональная замена", "Раз в свой ход добавьте 1к8 урона излучением существу, получившему урон от вашего заговора или атаки оружием.", { mode: "replace", canonicalFeatureName: "Благословлённые удары", replacesFeatureName: phb?.name || "Божественный удар", tasha: true }),
      ] });
    }
  }

  if (character.className === "fighter") {
    add({ key: "fighting-style", title: "Боевой стиль", description: "Основная специализация воина.", level: 1, count: 1 + (subclass === "champion" && level >= 10 ? 1 : 0), options: available(fightingStyles.filter(option => !["blessed-warrior", "druidic-warrior"].includes(option.id)), character) });
    if (subclass === "battlemaster" && level >= 3) add({ key: "maneuvers", title: "Боевые приёмы", description: "3 приёма на 3-м уровне и ещё по 2 на 7-м, 10-м и 15-м.", level: 3, count: choiceCount(level, [[3,3],[7,5],[10,7],[15,9]]), options: available(maneuvers, character) });
    if (subclass === "arcanearcher" && level >= 3) add({ key: "arcane-shots", title: "Варианты магического выстрела", description: "Два варианта на 3-м уровне и новые с уровнем.", level: 3, count: choiceCount(level, [[3,2],[7,3],[10,4],[15,5],[18,6]]), options: arcaneShots });
    if (subclass === "runeknight" && level >= 3) add({ key: "runes", title: "Руны", description: "Известные руны Рунного рыцаря.", level: 3, count: choiceCount(level, [[3,2],[7,3],[10,4],[15,5]]), options: available(runes, character) });
  }
  if (character.className === "paladin" && level >= 2) {
    add({ key: "fighting-style", title: "Боевой стиль", description: "Боевая специализация паладина.", level: 2, count: 1, options: available(fightingStyles.filter(o => ["defense", "dueling", "great-weapon", "protection", "blind-fighting", "interception", "blessed-warrior"].includes(o.id)), character) });
    if ((selected["fighting-style"] || []).includes("blessed-warrior")) add({ key: "blessed-warrior-cantrips", title: "Благословенный воин: заговоры жреца", description: "Выберите два заговора жреца; для них используется Харизма паладина.", level: 2, count: 2, options: spellOptions(spells, spell => spell.level === 0 && spell.classes.includes("cleric")) });
  }
  if (character.className === "ranger" && level >= 2) {
    add({ key: "fighting-style", title: "Боевой стиль", description: "Боевая специализация следопыта.", level: 2, count: 1, options: available(fightingStyles.filter(o => ["archery", "defense", "dueling", "two-weapon", "blind-fighting", "thrown-weapon", "druidic-warrior"].includes(o.id)), character) });
    if ((selected["fighting-style"] || []).includes("druidic-warrior")) add({ key: "druidic-warrior-cantrips", title: "Воин-друид: заговоры друида", description: "Выберите два заговора друида; для них используется Мудрость следопыта.", level: 2, count: 2, options: spellOptions(spells, spell => spell.level === 0 && spell.classes.includes("druid")) });
  }
  if (character.className === "bard" && level >= 3) add({ key: "expertise", title: "Компетентность", description: "Два навыка на 3-м уровне и ещё два на 10-м.", level: 3, count: level >= 10 ? 4 : 2, options: expertiseOptions });
  if (character.className === "bard" && subclass === "swords" && level >= 3) add({ key: "fighting-style", title: "Боевой стиль Коллегии клинков", description: "Выберите стиль.", level: 3, count: 1, options: fightingStyles.filter(option => ["dueling", "two-weapon"].includes(option.id)) });
  if (character.className === "bard") {
    const secretCount = (subclass === "lore" && level >= 6 ? 2 : 0) + choiceCount(level, [[10,2],[14,4],[18,6]]);
    if (secretCount) add({ key: "magical-secrets", title: "Тайны магии", description: "Заклинания любых классов становятся заклинаниями барда.", level: subclass === "lore" ? 6 : 10, count: secretCount, options: spellOptions(spells, spell => spell.level <= Math.min(9, Math.ceil(level / 2))) });
  }
  if (character.className === "rogue") add({ key: "expertise", title: "Компетентность", description: "Два навыка на 1-м уровне и ещё два на 6-м.", level: 1, count: level >= 6 ? 4 : 2, options: expertiseOptions });
  if (character.className === "sorcerer") {
    if (subclass === "draconic") add({ key: "draconic-ancestor", title: "Предок-дракон", description: "Определяет связанный тип урона.", level: 1, count: 1, options: ["Чёрный — кислота", "Синий — электричество", "Латунный — огонь", "Бронзовый — электричество", "Медный — кислота", "Золотой — огонь", "Зелёный — яд", "Красный — огонь", "Серебряный — холод", "Белый — холод"].map((name, i) => O(`dragon-${i}`, name, "PHB", "Выбранное происхождение.")) });
    if (level >= 3) add({ key: "metamagic", title: "Метамагия", description: "Два варианта на 3-м уровне, ещё по одному на 10-м и 17-м.", level: 3, count: choiceCount(level, [[3,2],[10,3],[17,4]]), options: available(metamagic, character) });
  }
  if (character.className === "warlock") {
    const pact = selected["pact-boon"]?.[0] || "";
    if (level >= 2) add({ key: "invocations", title: "Таинственные воззвания", description: "Количество известных воззваний растёт с уровнем.", level: 2, count: choiceCount(level, [[2,2],[5,3],[7,4],[9,5],[12,6],[15,7],[18,8]]), options: available(invocations, character, pact) });
    if (level >= 3) add({ key: "pact-boon", title: "Предмет договора", description: "Дар покровителя.", level: 3, count: 1, options: available([O("chain", "Договор цепи", "PHB", "Даёт улучшенного фамильяра."), O("blade", "Договор клинка", "PHB", "Связывает оружие договора."), O("tome", "Договор гримуара", "PHB", "Даёт Книгу Теней."), O("talisman", "Договор талисмана", "TCE", "Помогает проваленным проверкам.", { tasha: true })], character) });
    for (const [circle, at] of [[6,11],[7,13],[8,15],[9,17]] as const) if (level >= at) {
      const warlockSpells = spells.filter(s => s.level === circle && s.classes.includes("warlock"));
      const fallback = spells.filter(s => s.level === circle);
      add({ key: `arcanum-${circle}`, title: `Мистический арканум ${circle}-го круга`, description: "Одно заклинание арканума.", level: at, count: 1, options: (warlockSpells.length ? warlockSpells : fallback).map(s => O(s.id, s.name, s.source, s.description)) });
    }
  }
  if (character.className === "artificer" && level >= 2) add({ key: "infusions", title: "Известные инфузии", description: "Формулы временных магических предметов.", level: 2, count: choiceCount(level, [[2,4],[6,6],[10,8],[14,10]]), options: available(infusions, character) });
  if (character.className === "artificer" && subclass === "armorer" && level >= 3) add({ key: "armor-model", title: "Начальная модель доспеха", description: "Модель можно менять после отдыха.", level: 3, count: 1, options: character.tceFullBanned ? [] : [O("guardian", "Страж", "TCE", "Передовая модель."), O("infiltrator", "Лазутчик", "TCE", "Скрытная модель.")] });

  if (character.className === "barbarian" && subclass === "totem") {
    const totems = [O("bear", "Медведь", "PHB", "Защитные и силовые качества."), O("eagle", "Орёл", "PHB", "Подвижность и зрение."), O("wolf", "Волк", "PHB", "Командная охота."), O("elk", "Лось", "SCAG", "Скорость."), O("tiger", "Тигр", "SCAG", "Прыжки и навыки.")];
    for (const at of [3,6,14]) if (level >= at) add({ key: `totem-${at}`, title: at === 3 ? "Тотемный дух" : at === 6 ? "Аспект зверя" : "Тотемная гармония", description: "На каждом уровне зверя можно выбирать заново.", level: at, count: 1, options: totems });
  }
  if (character.className === "druid" && subclass === "land" && level >= 2) add({ key: "land-circle", title: "Земля круга", description: "Определяет дополнительные заклинания.", level: 2, count: 1, options: ["Арктика", "Берег", "Пустыня", "Лес", "Луга", "Горы", "Болото", "Подземье"].map(name => O(`land-${name}`, name, "PHB", "Набор заклинаний местности.")) });
  if (character.className === "ranger" && subclass === "hunter") {
    const hunter: Record<number, ClassChoiceOption[]> = {
      3: [O("colossus", "Убийца колоссов", "PHB", "Дополнительный урон раненой цели."), O("giant-killer", "Убийца великанов", "PHB", "Реакционная атака."), O("horde-breaker", "Сокрушитель орды", "PHB", "Дополнительная атака по соседней цели.")],
      7: [O("escape-horde", "Спасение от орды", "PHB", "Помеха провоцированным атакам."), O("multiattack-defense", "Защита от множественных атак", "PHB", "Защита от повторных атак."), O("steel-will", "Стальная воля", "PHB", "Преимущество против испуга.")],
      11: [O("volley", "Залп", "PHB", "Атаки по множеству целей."), O("whirlwind", "Вихревая атака", "PHB", "Атаки по соседним противникам.")],
      15: [O("evasion", "Увёртливость", "PHB", "Защита от эффектов Ловкости."), O("stand-tide", "Стоять против течения", "PHB", "Перенаправляет промах."), O("uncanny-dodge", "Невероятное уклонение", "PHB", "Половина урона видимой атаки.")],
    };
    for (const at of [3,7,11,15]) if (level >= at) add({ key: `hunter-${at}`, title: `Выбор охотника ${at}-го уровня`, description: "Боевой приём Охотника.", level: at, count: 1, options: hunter[at] });
  }
  if (character.className === "ranger" && subclass === "beastmaster" && level >= 3) add({ key: "beast-companion", title: "Спутник следопыта", description: "Выберите стартовый тип спутника.", level: 3, count: 1, options: available([O("classic-beast", "Классический зверь", "PHB", "Зверь PHB."), O("beast-land", "Зверь земли", "TCE", "Первозданный зверь земли.", { tasha: true }), O("beast-sea", "Зверь моря", "TCE", "Первозданный зверь моря.", { tasha: true }), O("beast-sky", "Зверь неба", "TCE", "Первозданный зверь неба.", { tasha: true })], character) });
  if (character.className === "monk" && subclass === "kensei" && level >= 3) add({ key: "kensei-weapons", title: "Оружие кэнсэя", description: "Два вида на 3-м и новые с уровнем.", level: 3, count: choiceCount(level, [[3,2],[6,3],[11,4],[17,5]]), options: ["Боевой посох", "Длинный меч", "Короткий меч", "Боевой молот", "Кнут", "Длинный лук", "Короткий лук", "Лёгкий арбалет", "Ручной арбалет", "Дротик"].map(name => O(`weapon-${name}`, name, "PHB", "Оружие кэнсэя.")) });
  if (character.className === "sorcerer" && subclass === "lunar") add({ key: "lunar-phase", title: "Начальная лунная фаза", description: "Определяет начальный набор лунной магии.", level: 1, count: 1, options: [O("full-moon", "Полная луна", "SDQ", "Защитная магия."), O("new-moon", "Новолуние", "SDQ", "Тёмная магия."), O("crescent-moon", "Полумесяц", "SDQ", "Преобразующая магия.")] });

  // Missing official subclasses: permanent choices only. Per-rest/per-rage/per-summon
  // decisions intentionally remain runtime state rather than irreversible level choices.
  if (character.className === "barbarian" && subclass === "stormherald" && level >= 3) add({ key: "storm-herald-environment", title: "Среда буревестника", description: "Пустыня, море или тундра. При получении нового уровня варвара выбор можно изменить.", level: 3, count: 1, options: [O("desert", "Пустыня", "XGE", "Огненная аура и сопротивление огню."), O("sea", "Море", "XGE", "Электрическая аура и морские свойства."), O("tundra", "Тундра", "XGE", "Временные хиты и сопротивление холоду.")] });
  if (character.className === "barbarian" && subclass === "giant" && level >= 3) add({ key: "giant-cantrip", title: "Сила великана: заговор", description: "Выберите Искусство друидов или Чудотворство; базовая характеристика — Мудрость.", level: 3, count: 1, options: spellOptions(spells, spell => spell.level === 0 && ["Искусство друидов", "Чудотворство"].includes(spell.name)) });
  if (character.className === "cleric" && subclass === "nature" && level >= 1) add({ key: "nature-druid-cantrip", title: "Служитель природы: заговор", description: "Один заговор друида становится заговором жреца.", level: 1, count: 1, options: spellOptions(spells, spell => spell.level === 0 && spell.classes.includes("druid")) });
  if (character.className === "cleric" && subclass === "death" && level >= 1) add({ key: "death-necromancy-cantrip", title: "Жнец: заговор", description: "Один заговор школы Некромантии из любого списка становится заговором жреца.", level: 1, count: 1, options: spellOptions(spells, spell => spell.level === 0 && /некромант/i.test(spell.school)) });
  if (character.className === "cleric" && subclass === "arcana" && level >= 1) add({ key: "arcana-wizard-cantrips", title: "Посвящённый в тайны", description: "Два заговора волшебника становятся заговорами жреца.", level: 1, count: 2, options: spellOptions(spells, spell => spell.level === 0 && spell.classes.includes("wizard")) });
  if (character.className === "cleric" && subclass === "arcana" && level >= 17) for (const circle of [6,7,8,9]) add({ key: `arcana-mastery-${circle}`, title: `Тайное мастерство: ${circle}-й круг`, description: "Выбранное заклинание волшебника всегда подготовлено как заклинание жреца.", level: 17, count: 1, options: spellOptions(spells, spell => spell.level === circle && spell.classes.includes("wizard")) });
  if (character.className === "monk" && subclass === "four-elements" && level >= 3) add({ key: "four-elements-disciplines", title: "Стихийные дисциплины", description: "Настройка на стихии выдаётся автоматически; выберите остальные известные дисциплины. При изучении новой одну старую можно заменить.", level: 3, count: choiceCount(level, [[3,1],[6,2],[11,3],[17,4]]), options: available(fourElementsDisciplines, character) });
  if (character.className === "sorcerer" && subclass === "clockwork") {
    const defaults = [
      [1, "default-0", "Тревога"], [1, "default-1", "Защита от добра и зла"],
      [3, "default-2", "Подмога"], [3, "default-3", "Малое восстановление"],
      [5, "default-4", "Рассеивание магии"], [5, "default-5", "Защита от энергии"],
      [7, "default-6", "Свобода перемещения"], [7, "default-7", "Призыв конструкта"],
      [9, "default-8", "Высшее восстановление"], [9, "default-9", "Стена силы"],
    ] as const;
    defaults.forEach(([at, id, name], index) => {
      if (level < at) return;
      const circle = Math.ceil(at / 2);
      const replacement = spells.filter(spell => spell.level === circle && (spell.classes.includes("sorcerer") || spell.classes.includes("warlock") || spell.classes.includes("wizard")) && /огражден|преобразован/i.test(spell.school));
      const defaultOption = O(id, name, "TCE", "Исходное заклинание Заводной магии.");
      const options = [defaultOption, ...spellOptions(replacement, () => true).filter(option => option.id !== id)];
      add({ key: `clockwork-magic-${index}`, title: `Заводная магия: ${name}`, description: "Оставьте исходное заклинание или замените его на заклинание Ограждения/Преобразования того же круга из списка чародея, колдуна или волшебника.", level: at, count: 1, options });
    });
  }

  if (character.className === "wizard" && level >= 18) add({ key: "spell-mastery-1", title: "Мастерство заклинателя: 1-й круг", description: "Заклинание 1-го круга из книги.", level: 18, count: 1, options: spellOptions(spells, spell => spell.level === 1 && spell.classes.includes("wizard")) });
  if (character.className === "wizard" && level >= 18) add({ key: "spell-mastery-2", title: "Мастерство заклинателя: 2-й круг", description: "Заклинание 2-го круга из книги.", level: 18, count: 1, options: spellOptions(spells, spell => spell.level === 2 && spell.classes.includes("wizard")) });
  if (character.className === "wizard" && level >= 20) add({ key: "signature-spells", title: "Фирменные заклинания", description: "Два заклинания 3-го круга из книги.", level: 20, count: 2, options: spellOptions(spells, spell => spell.level === 3 && spell.classes.includes("wizard")) });
  return groups;
}

function entryLocalChoices(character: ExportCharacter, classId: string) {
  const entry = orderedCharacterClasses(character).find(item => item.classId === classId);
  const local = { ...(entry?.choiceValues || {}) };
  const prefix = `${classId}:`;
  for (const [key, value] of Object.entries(character.classChoices || {})) if (key.startsWith(prefix)) local[key.slice(prefix.length)] = value;
  if (classId === getStartingClassId(character)) for (const [key, value] of Object.entries(character.classChoices || {})) if (!key.includes(":")) local[key] = value;
  return local;
}

export function classChoiceGroups(character: ExportCharacter, spells: CatalogSpell[] = []): ClassChoiceGroup[] {
  const entries = orderedCharacterClasses(character);
  if (!entries.length) return singleClassChoiceGroups(character, spells);
  if (entries.length === 1) {
    const entry = entries[0];
    return singleClassChoiceGroups(classView({ ...character, classChoices: entryLocalChoices(character, entry.classId) }, entry), spells);
  }
  return entries.flatMap(entry => singleClassChoiceGroups(classView({ ...character, classChoices: entryLocalChoices(character, entry.classId) }, entry), spells).map(group => ({ ...group, key: `${entry.classId}:${group.key}` })));
}

function selectedForGroup(character: ExportCharacter, key: string, defaultOptionId?: string) {
  const global = character.classChoices?.[key];
  if (global?.length) return global;
  const separator = key.indexOf(":");
  if (separator > 0) {
    const classId = key.slice(0, separator);
    const localKey = key.slice(separator + 1);
    const selected = orderedCharacterClasses(character).find(entry => entry.classId === classId)?.choiceValues?.[localKey] || [];
    return selected.length ? selected : defaultOptionId ? [defaultOptionId] : [];
  }
  const starting = orderedCharacterClasses(character).find(entry => entry.classId === getStartingClassId(character));
  const selected = starting?.choiceValues?.[key] || [];
  return selected.length ? selected : defaultOptionId ? [defaultOptionId] : [];
}

export function selectedClassChoiceIds(character: ExportCharacter, group: ClassChoiceGroup) {
  return selectedForGroup(character, group.key, group.defaultOptionId);
}

export function clearTashaOptionalState(character: ExportCharacter): ExportCharacter {
  const isTceKey = (key: string) => key.split(":").at(-1)?.startsWith("tce-");
  const classChoices = Object.fromEntries(Object.entries(character.classChoices || {}).filter(([key]) => !isTceKey(key)));
  const classes = (character.classes || []).map(entry => ({
    ...entry,
    choiceValues: Object.fromEntries(Object.entries(entry.choiceValues || {}).filter(([key]) => !isTceKey(key))),
  }));
  const resourceSpent = Object.fromEntries(Object.entries(character.resourceSpent || {}).filter(([key]) =>
    !["favored-foe", "tireless", "natures-veil", "harness-divine-power"].includes(key)
    && !key.startsWith("primal-awareness:"),
  ));
  return migrateMulticlassCharacter({ ...character, useTasha: false, classes, classChoices, resourceSpent });
}

function choiceBelongsOnSheet(groupKey: string, option: ClassChoiceOption) {
  if (option.mode === "replace") return true;
  const key = groupKey.includes(":") ? groupKey.slice(groupKey.indexOf(":") + 1) : groupKey;
  if (["expertise", "tce-primal-knowledge", "tce-deft-explorer-skill", "blessed-warrior-cantrips", "druidic-warrior-cantrips", "magical-secrets", "kensei-weapons"].includes(key)) return false;
  if (/^(arcanum-|arcana-mastery-|clockwork-magic-|signature-spells|spell-mastery-)/.test(key)) return false;
  return true;
}

export function chosenClassChoiceFeatures(character: ExportCharacter, spells: CatalogSpell[] = []): Feature[] {
  const groups = classChoiceGroups(character, spells);
  return groups.flatMap(group => selectedForGroup(character, group.key, group.defaultOptionId).map(id => {
    const option = group.options.find(item => item.id === id);
    if (!option || option.disabledReason || option.emitFeature === false || option.mode === "passthrough" || !choiceBelongsOnSheet(group.key, option)) return null;
    return { level: group.level, name: option.name, description: option.fullDescription || option.description };
  }).filter(Boolean) as Feature[]);
}

const placeholderFeatureNames: Record<string, string[]> = {
  "fighting-style": ["Боевой стиль"], expertise: ["Компетентность"], metamagic: ["Метамагия"], invocations: ["Таинственные воззвания"],
  "pact-boon": ["Предмет договора"], infusions: ["Инфузии"], "draconic-ancestor": ["Драконий предок"], "land-circle": ["Земля круга"],
  "beast-companion": ["Спутник следопыта"], "armor-model": ["Модель доспеха"], "lunar-phase": ["Лунная фаза"],
};

export function resolvedClassChoiceFeatures(character: ExportCharacter, baseFeatures: Feature[], spells: CatalogSpell[] = []): Feature[] {
  const groups = classChoiceGroups(character, spells);
  const selectedGroups = groups.filter(group => selectedForGroup(character, group.key, group.defaultOptionId).length > 0);
  const placeholders = new Set(selectedGroups.flatMap(group => {
    const localKey = group.key.includes(":") ? group.key.slice(group.key.indexOf(":") + 1) : group.key;
    return [...(placeholderFeatureNames[localKey] || []), ...(localKey.startsWith("arcanum-") ? ["Мистический арканум"] : [])];
  }));
  const replacementOptions = groups.flatMap(group => selectedForGroup(character, group.key, group.defaultOptionId)
    .map(id => group.options.find(option => option.id === id))
    .filter((option): option is ClassChoiceOption => !!option && option.mode === "replace"));
  const replacementNames = new Set(groups.flatMap(group => group.options
    .filter(option => option.mode === "replace")
    .map(option => option.canonicalFeatureName || option.name)));
  const suppressed = new Set(replacementOptions.map(option => option.replacesFeatureName).filter(Boolean) as string[]);
  const concrete = chosenClassChoiceFeatures(character, spells);
  const seen = new Set<string>();
  return [...baseFeatures.filter(feature => !placeholders.has(feature.name) && !suppressed.has(feature.name) && !replacementNames.has(feature.name)), ...concrete].filter(feature => {
    const key = `${feature.level || 0}:${feature.name}:${feature.description}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function classChoicesComplete(character: ExportCharacter, spells: CatalogSpell[] = []) {
  return classChoiceGroups(character, spells).every(group => {
    const valid = new Set(group.options.filter(option => !option.disabledReason).map(option => option.id));
    const selected = [...new Set(selectedForGroup(character, group.key, group.defaultOptionId))].filter(id => valid.has(id));
    return selected.length === group.count;
  });
}
