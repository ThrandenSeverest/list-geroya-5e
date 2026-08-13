import type { CatalogSpell } from "./catalog";
import type { ExportCharacter } from "./exportFormats";
import type { Feature } from "./rules";

export type ClassChoiceOption = {
  id: string;
  name: string;
  source: string;
  description: string;
  minLevel?: number;
  pact?: string;
  tasha?: boolean;
};

export type ClassChoiceGroup = {
  key: string;
  title: string;
  description: string;
  level: number;
  count: number;
  options: ClassChoiceOption[];
};

const O = (id: string, name: string, source: string, description: string, extra: Partial<ClassChoiceOption> = {}): ClassChoiceOption => ({ id, name, source, description, ...extra });

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

const expertiseOptions = ["Акробатика", "Атлетика", "Обман", "История", "Проницательность", "Запугивание", "Расследование", "Магия", "Медицина", "Природа", "Внимательность", "Выступление", "Убеждение", "Религия", "Ловкость рук", "Скрытность", "Выживание", "Уход за животными"].map(name => O(`skill-${name}`, name, "PHB", "Удваивает бонус владения для выбранного навыка."));

const choiceCount = (level: number, rows: [number, number][]) => rows.reduce((value, [at, count]) => level >= at ? count : value, 0);

function available(options: ClassChoiceOption[], character: ExportCharacter, pact = "") {
  return options.filter(option => (!option.minLevel || character.level >= option.minLevel) && (!option.tasha || character.useTasha) && (!option.pact || option.pact === pact));
}

export function classChoiceGroups(character: ExportCharacter, spells: CatalogSpell[] = []): ClassChoiceGroup[] {
  const groups: ClassChoiceGroup[] = [];
  const add = (group: ClassChoiceGroup) => group.count > 0 && groups.push(group);
  const level = character.level;
  const subclass = character.subclass || "";
  const selected = character.classChoices || {};

  if (character.className === "fighter") {
    add({ key: "fighting-style", title: "Боевой стиль", description: "Основная специализация воина.", level: 1, count: 1 + (subclass === "champion" && level >= 10 ? 1 : 0), options: available(fightingStyles, character) });
    if (subclass === "battlemaster" && level >= 3) add({ key: "maneuvers", title: "Боевые приёмы", description: "Мастер боевых искусств знает 3 приёма на 3-м уровне и ещё по 2 на 7-м, 10-м и 15-м.", level: 3, count: choiceCount(level, [[3,3],[7,5],[10,7],[15,9]]), options: available(maneuvers, character) });
    if (subclass === "arcanearcher" && level >= 3) add({ key: "arcane-shots", title: "Варианты магического выстрела", description: "Два варианта на 3-м уровне и ещё по одному на 7-м, 10-м, 15-м и 18-м.", level: 3, count: choiceCount(level, [[3,2],[7,3],[10,4],[15,5],[18,6]]), options: arcaneShots });
    if (subclass === "runeknight" && level >= 3) add({ key: "runes", title: "Руны", description: "Известные руны Рунного рыцаря.", level: 3, count: choiceCount(level, [[3,2],[7,3],[10,4],[15,5]]), options: available(runes, character) });
  }
  if (character.className === "paladin" && level >= 2) add({ key: "fighting-style", title: "Боевой стиль", description: "Боевая специализация паладина.", level: 2, count: 1, options: available(fightingStyles.filter(o => !["archery", "two-weapon"].includes(o.id)), character) });
  if (character.className === "ranger" && level >= 2) add({ key: "fighting-style", title: "Боевой стиль", description: "Боевая специализация следопыта.", level: 2, count: 1, options: available(fightingStyles.filter(o => !["great-weapon", "protection"].includes(o.id)), character) });
  if (character.className === "bard" && level >= 3) add({ key: "expertise", title: "Компетентность", description: "Удваивает владение двумя навыками на 3-м уровне и ещё двумя на 10-м.", level: 3, count: level >= 10 ? 4 : 2, options: expertiseOptions });
  if (character.className === "bard" && subclass === "swords" && level >= 3) add({ key: "fighting-style", title: "Боевой стиль Коллегии клинков", description: "Выберите стиль для сценического владения клинком.", level: 3, count: 1, options: fightingStyles.filter(option => ["dueling", "two-weapon"].includes(option.id)) });
  if (character.className === "bard") {
    const secretCount = (subclass === "lore" && level >= 6 ? 2 : 0) + choiceCount(level, [[10,2],[14,4],[18,6]]);
    if (secretCount) add({ key: "magical-secrets", title: "Тайны магии", description: "Заклинания любых классов становятся заклинаниями барда и входят в число известных.", level: subclass === "lore" ? 6 : 10, count: secretCount, options: spells.filter(spell => spell.level <= Math.min(9, Math.ceil(level / 2))).map(spell => O(spell.id, spell.name, spell.source, spell.description)) });
  }
  if (character.className === "rogue") add({ key: "expertise", title: "Компетентность", description: "Удваивает владение двумя навыками на 1-м уровне и ещё двумя на 6-м.", level: 1, count: level >= 6 ? 4 : 2, options: expertiseOptions });
  if (character.className === "sorcerer") {
    if (subclass === "draconic") add({ key: "draconic-ancestor", title: "Предок-дракон", description: "Определяет связанный тип урона и драконий язык.", level: 1, count: 1, options: ["Чёрный — кислота", "Синий — электричество", "Латунный — огонь", "Бронзовый — электричество", "Медный — кислота", "Золотой — огонь", "Зелёный — яд", "Красный — огонь", "Серебряный — холод", "Белый — холод"].map((name, i) => O(`dragon-${i}`, name, "PHB", "Выбранное драконье происхождение.")) });
    if (level >= 3) add({ key: "metamagic", title: "Метамагия", description: "Два варианта на 3-м уровне, ещё по одному на 10-м и 17-м.", level: 3, count: choiceCount(level, [[3,2],[10,3],[17,4]]), options: available(metamagic, character) });
  }
  if (character.className === "warlock") {
    const pact = selected["pact-boon"]?.[0] || "";
    if (level >= 2) add({ key: "invocations", title: "Таинственные воззвания", description: "Количество известных воззваний растёт с уровнем; требования учитываются автоматически.", level: 2, count: choiceCount(level, [[2,2],[5,3],[7,4],[9,5],[12,6],[15,7],[18,8]]), options: available(invocations, character, pact) });
    if (level >= 3) add({ key: "pact-boon", title: "Предмет договора", description: "Дар покровителя определяет дальнейшие возможности и требования воззваний.", level: 3, count: 1, options: [O("chain", "Договор цепи", "PHB", "Даёт улучшенного фамильяра."), O("blade", "Договор клинка", "PHB", "Создаёт или связывает оружие договора."), O("tome", "Договор гримуара", "PHB", "Даёт Книгу Теней и три заговора любых классов."), O("talisman", "Договор талисмана", "TCE", "Талисман помогает проваленным проверкам.", { tasha: true })].filter(o => !o.tasha || character.useTasha) });
    for (const [circle, at] of [[6,11],[7,13],[8,15],[9,17]] as const) if (level >= at) {
      const warlockSpells = spells.filter(s => s.level === circle && s.classes.includes("warlock"));
      const fallback = spells.filter(s => s.level === circle);
      add({ key: `arcanum-${circle}`, title: `Мистический арканум ${circle}-го круга`, description: "Одно заклинание арканума можно применить раз за продолжительный отдых без ячейки договора.", level: at, count: 1, options: (warlockSpells.length ? warlockSpells : fallback).map(s => O(s.id, s.name, s.source, s.description)) });
    }
  }
  if (character.className === "artificer" && level >= 2) add({ key: "infusions", title: "Известные инфузии", description: "Формулы для создания временных магических предметов.", level: 2, count: choiceCount(level, [[2,4],[6,6],[10,8],[14,10]]), options: available(infusions, character) });
  if (character.className === "artificer" && subclass === "armorer" && level >= 3) add({ key: "armor-model", title: "Начальная модель доспеха", description: "Модель можно менять после отдыха; здесь сохраняется выбранная начальная конфигурация.", level: 3, count: 1, options: [O("guardian", "Страж", "TCE", "Громовые перчатки и защитное поле для передовой."), O("infiltrator", "Лазутчик", "TCE", "Молниемёт, дополнительная скорость и преимущество Скрытности.")] });
  if (character.className === "barbarian" && subclass === "totem") {
    const totems = [O("bear", "Медведь", "PHB", "Защитные и силовые качества тотемного зверя."), O("eagle", "Орёл", "PHB", "Подвижность, зрение и полёт на высших уровнях."), O("wolf", "Волк", "PHB", "Командная охота и выслеживание."), O("elk", "Лось", "SCAG", "Скорость и мощный проход сквозь врагов."), O("tiger", "Тигр", "SCAG", "Прыжки, навыки и дополнительные атаки.")];
    for (const at of [3,6,14]) if (level >= at) add({ key: `totem-${at}`, title: at === 3 ? "Тотемный дух" : at === 6 ? "Аспект зверя" : "Тотемная гармония", description: "На каждом уровне тотема зверя можно выбирать заново.", level: at, count: 1, options: totems });
  }
  if (character.className === "druid" && subclass === "land" && level >= 2) add({ key: "land-circle", title: "Земля круга", description: "Определяет дополнительные заклинания Круга земли.", level: 2, count: 1, options: ["Арктика", "Берег", "Пустыня", "Лес", "Луга", "Горы", "Болото", "Подземье"].map(name => O(`land-${name}`, name, "PHB", "Набор заклинаний выбранной местности.")) });
  if (character.className === "ranger" && subclass === "hunter") {
    const hunter: Record<number, ClassChoiceOption[]> = {
      3: [O("colossus", "Убийца колоссов", "PHB", "Раз за ход наносит дополнительный урон уже раненой цели."), O("giant-killer", "Убийца великанов", "PHB", "Реакцией атакует Большое или более крупное существо после его атаки."), O("horde-breaker", "Сокрушитель орды", "PHB", "Раз за ход совершает дополнительную атаку по соседней цели.")],
      7: [O("escape-horde", "Спасение от орды", "PHB", "Провоцированные атаки по вам совершаются с помехой."), O("multiattack-defense", "Защита от множественных атак", "PHB", "После первого попадания цель получает штраф к следующим атакам по вам."), O("steel-will", "Стальная воля", "PHB", "Даёт преимущество против испуга.")],
      11: [O("volley", "Залп", "PHB", "Позволяет атаковать множество целей в небольшой области дальнобойным оружием."), O("whirlwind", "Вихревая атака", "PHB", "Позволяет атаковать всех соседних противников.")],
      15: [O("evasion", "Увёртливость", "PHB", "Снижает или полностью предотвращает урон эффектов со спасброском Ловкости."), O("stand-tide", "Стоять против течения", "PHB", "Заставляет промахнувшегося врага повторить атаку по другой цели."), O("uncanny-dodge", "Невероятное уклонение", "PHB", "Реакцией уменьшает вдвое урон видимой атаки.")],
    };
    for (const at of [3,7,11,15]) if (level >= at) add({ key: `hunter-${at}`, title: `Выбор охотника ${at}-го уровня`, description: "Особый боевой приём архетипа Охотника.", level: at, count: 1, options: hunter[at] });
  }
  if (character.className === "ranger" && subclass === "beastmaster" && level >= 3) add({ key: "beast-companion", title: "Спутник следопыта", description: "Выберите стартовый тип спутника; конкретный облик можно описать в имени персонажа.", level: 3, count: 1, options: [O("classic-beast", "Классический зверь", "PHB", "Зверь с ПО не выше 1/4, подходящим размером и без постоянной скорости полёта."), O("beast-land", "Зверь земли", "TCE", "Универсальный первозданный зверь земли.", { tasha: true }), O("beast-sea", "Зверь моря", "TCE", "Первозданный спутник для воды.", { tasha: true }), O("beast-sky", "Зверь неба", "TCE", "Малый летающий первозданный спутник.", { tasha: true })].filter(option => !option.tasha || character.useTasha) });
  if (character.className === "monk" && subclass === "kensei" && level >= 3) add({ key: "kensei-weapons", title: "Оружие кэнсэя", description: "Два вида оружия на 3-м уровне и ещё по одному на 6-м, 11-м и 17-м.", level: 3, count: choiceCount(level, [[3,2],[6,3],[11,4],[17,5]]), options: ["Боевой посох", "Длинный меч", "Короткий меч", "Боевой молот", "Кнут", "Длинный лук", "Короткий лук", "Лёгкий арбалет", "Ручной арбалет", "Дротик"].map(name => O(`weapon-${name}`, name, "PHB", "Выбранное оружие становится оружием кэнсэя.")) });
  if (character.className === "sorcerer" && subclass === "lunar") add({ key: "lunar-phase", title: "Начальная лунная фаза", description: "Фазу можно менять позже; выбор определяет начальный набор лунной магии.", level: 1, count: 1, options: [O("full-moon", "Полная луна", "SDQ", "Защитная и поддерживающая лунная магия."), O("new-moon", "Новолуние", "SDQ", "Тёмная и подавляющая лунная магия."), O("crescent-moon", "Полумесяц", "SDQ", "Преобразующая и подвижная лунная магия.")] });
  if (character.className === "wizard" && level >= 18) add({ key: "spell-mastery-1", title: "Мастерство заклинателя: 1-й круг", description: "Выбранное заклинание 1-го круга должно находиться в книге и быть подготовлено.", level: 18, count: 1, options: spells.filter(spell => spell.level === 1 && spell.classes.includes("wizard")).map(spell => O(spell.id, spell.name, spell.source, spell.description)) });
  if (character.className === "wizard" && level >= 18) add({ key: "spell-mastery-2", title: "Мастерство заклинателя: 2-й круг", description: "Выбранное заклинание 2-го круга должно находиться в книге и быть подготовлено.", level: 18, count: 1, options: spells.filter(spell => spell.level === 2 && spell.classes.includes("wizard")).map(spell => O(spell.id, spell.name, spell.source, spell.description)) });
  if (character.className === "wizard" && level >= 20) add({ key: "signature-spells", title: "Фирменные заклинания", description: "Выберите два заклинания 3-го круга из книги.", level: 20, count: 2, options: spells.filter(spell => spell.level === 3 && spell.classes.includes("wizard")).map(spell => O(spell.id, spell.name, spell.source, spell.description)) });
  return groups;
}

export function chosenClassChoiceFeatures(character: ExportCharacter, spells: CatalogSpell[] = []): Feature[] {
  const groups = classChoiceGroups(character, spells);
  return groups.flatMap(group => (character.classChoices?.[group.key] || []).map(id => {
    const option = group.options.find(item => item.id === id);
    return option ? { level: group.level, name: `${group.title}: ${option.name}`, description: option.description } : null;
  }).filter(Boolean) as Feature[]);
}

const placeholderFeatureNames: Record<string, string[]> = {
  "fighting-style": ["Боевой стиль"],
  expertise: ["Компетентность"],
  metamagic: ["Метамагия"],
  invocations: ["Таинственные воззвания"],
  "pact-boon": ["Предмет договора"],
  infusions: ["Инфузии"],
  "draconic-ancestor": ["Драконий предок"],
  "land-circle": ["Земля круга"],
  "beast-companion": ["Спутник следопыта"],
  "armor-model": ["Модель доспеха"],
  "lunar-phase": ["Лунная фаза"],
};

/**
 * Replaces generic "choose one" class entries with the concrete options the
 * character actually selected. This is shared by the on-site sheet and both
 * exporters so they cannot drift apart again.
 */
export function resolvedClassChoiceFeatures(
  character: ExportCharacter,
  baseFeatures: Feature[],
  spells: CatalogSpell[] = [],
): Feature[] {
  const groups = classChoiceGroups(character, spells);
  const selectedGroups = groups.filter(group => (character.classChoices?.[group.key] || []).length > 0);
  const placeholders = new Set(selectedGroups.flatMap(group => [
    ...(placeholderFeatureNames[group.key] || []),
    ...(group.key.startsWith("arcanum-") ? ["Мистический арканум"] : []),
  ]));
  const concrete = chosenClassChoiceFeatures(character, spells);
  const seen = new Set<string>();
  return [...baseFeatures.filter(feature => !placeholders.has(feature.name)), ...concrete].filter(feature => {
    const key = `${feature.level || 0}:${feature.name}:${feature.description}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function classChoicesComplete(character: ExportCharacter, spells: CatalogSpell[] = []) {
  return classChoiceGroups(character, spells).every(group => {
    const valid = new Set(group.options.map(option => option.id));
    const selected = [...new Set(character.classChoices?.[group.key] || [])].filter(id => valid.has(id));
    return selected.length === group.count;
  });
}
