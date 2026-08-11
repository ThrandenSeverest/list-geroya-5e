import type { CatalogSpell } from "./catalog";
import type { AdvancementChoice, AbilityScores, ExportCharacter } from "./exportFormats";
import { abilityLabels } from "./rules";
import { generatedFeats } from "./generatedRulesCorpus";

export type FeatChoiceGroup = {
  key: string;
  title: string;
  description: string;
  count: number;
  options: Array<{ id: string; name: string; detail?: string }>;
};

const castingClasses = [
  ["bard", "Бард"], ["cleric", "Жрец"], ["druid", "Друид"], ["sorcerer", "Чародей"], ["warlock", "Колдун"], ["wizard", "Волшебник"],
] as const;
const allSkills = ["Акробатика", "Атлетика", "Обман", "История", "Проницательность", "Запугивание", "Расследование", "Магия", "Медицина", "Природа", "Внимательность", "Выступление", "Убеждение", "Религия", "Ловкость рук", "Скрытность", "Выживание", "Уход за животными"];
const abilityOptions = (keys: readonly (keyof AbilityScores)[]) => keys.map(id => ({ id, name: abilityLabels[id] }));
const classOptions = castingClasses.map(([id, name]) => ({ id, name }));
const weapons = ["Боевой топор", "Булава", "Двуручный меч", "Длинный лук", "Длинный меч", "Дубинка", "Кинжал", "Копьё", "Короткий лук", "Короткий меч", "Лёгкий арбалет", "Молот", "Палица", "Пика", "Рапира", "Ручной топор", "Секира", "Тяжёлый арбалет", "Цеп", "Четвертной посох", "Щука", "Ятаган"].map(name => ({ id: name, name }));
const skillsAndTools = [...allSkills, "Воровские инструменты", "Набор для грима", "Набор для фальсификации", "Набор травника", "Инструменты навигатора", "Инструменты повара", "Инструменты кузнеца", "Инструменты плотника", "Инструменты кожевника", "Инструменты каменщика", "Инструменты ювелира", "Инструменты стеклодува", "Инструменты гончара", "Инструменты ткача", "Инструменты резчика по дереву"].map(name => ({ id: name, name }));
const maneuvers = ["Активное уклонение", "Атака с выпадом", "Атака с манёвром", "Атака с угрозой", "Атака с финтом", "Обезоруживающая атака", "Опрокидывающая атака", "Ответный удар", "Отвлекающий удар", "Парирование", "Провоцирующая атака", "Сплочение", "Толкающая атака", "Точная атака", "Удар командующего", "Широкая атака", "Атака с захватом", "Быстрый бросок", "Засада", "Командирский напор", "Подмена", "Тактическая оценка"].map(name => ({ id: name, name }));
const fightingStyles = ["Стрельба", "Оборона", "Дуэлянт", "Сражение большим оружием", "Защита", "Сражение двумя оружиями", "Слепой бой", "Перехват", "Превосходная техника", "Сражение метательным оружием", "Сражение голыми руками"].map(name => ({ id: name, name }));
const metamagic = ["Аккуратное заклинание", "Далёкое заклинание", "Усиленное заклинание", "Продлённое заклинание", "Неодолимое заклинание", "Ускоренное заклинание", "Неуловимое заклинание", "Удвоенное заклинание", "Ищущее заклинание", "Преобразованное заклинание"].map(name => ({ id: name, name }));
const invocations = ["Мучительный взрыв", "Доспех теней", "Звериная речь", "Обманчивое влияние", "Дьявольский взгляд", "Мистическое зрение", "Глаза хранителя рун", "Дьявольская живучесть", "Взгляд двух умов", "Маска многих лиц", "Туманные видения", "Отталкивающий заряд", "Похититель пяти судеб", "Мистический разум"].map(name => ({ id: name, name }));

function choice(choice: AdvancementChoice, key: string) {
  return choice.featChoices?.[key] || [];
}

function classSpellOptions(spells: CatalogSpell[], classId: string, level: number, ritualOnly = false) {
  return spells
    .filter(spell => spell.level === level && spell.classes.includes(classId) && (!ritualOnly || spell.ritual))
    .map(spell => ({ id: spell.id, name: spell.name, detail: spell.description }));
}

const runeSpells = [
  ["disguise-self", "Враг — Маскировка"],
  ["entangle", "Гора — Опутывание"],
  ["chromatic-orb", "Дракон — Цветной шарик"],
  ["speak-with-animals", "Друг — Разговор с животными"],
  ["burning-hands", "Огонь — Огненные ладони"],
  ["fog-cloud", "Облако — Туманное облако"],
  ["sanctuary", "Камень — Убежище"],
  ["command", "Король — Приказ"],
  ["longstrider", "Путешествие — Скороход"],
  ["inflict-wounds", "Смерть — Нанесение ран"],
  ["goodberry", "Холм — Чудо-ягоды"],
  ["armoragathys", "Лёд — Доспех Агатиса"],
  ["thunderwave", "Шторм — Волна грома"],
] as const;

export function featChoiceGroups(choiceValue: AdvancementChoice, spells: CatalogSpell[], characterLevel = choiceValue.level): FeatChoiceGroup[] {
  const feat = choiceValue.featId;
  const tradition = choice(choiceValue, "tradition")[0] || "";
  const groups: FeatChoiceGroup[] = [];
  const ability = (keys: readonly (keyof AbilityScores)[]) => {
    if (groups.some(group => group.key === "ability")) return;
    groups.push({ key: "ability", title: "Бонус характеристики", description: "Выбранная характеристика увеличивается на 1, но не выше 20.", count: 1, options: abilityOptions(keys) });
  };
  const documentedAbilityOptions = generatedFeats.find(item => item.id === feat)?.abilityOptions || [];
  if (documentedAbilityOptions.length > 1) ability(documentedAbilityOptions as (keyof AbilityScores)[]);

  if (feat === "skill-expert") {
    groups.push({ key: "skill", title: "Новое владение навыком", description: "Персонаж получает владение выбранным навыком.", count: 1, options: allSkills.map(name => ({ id: name, name })) });
    groups.push({ key: "expertise", title: "Компетентность", description: "Бонус владения удваивается для выбранного навыка, которым персонаж владеет.", count: 1, options: allSkills.map(name => ({ id: name, name })) });
  }
  if (feat === "skilled") groups.push({ key: "proficiencies", title: "Три владения", description: "Выберите любые три навыка или инструмента.", count: 3, options: skillsAndTools });
  if (feat === "weapon-master") groups.push({ key: "weapons", title: "Владение оружием", description: "Выберите четыре разных вида простого или воинского оружия.", count: 4, options: weapons });
  if (feat === "martial-adept") groups.push({ key: "maneuvers", title: "Два боевых приёма", description: "Выберите два приёма Мастера боевых искусств.", count: 2, options: maneuvers });
  if (feat === "fighting-initiate") groups.push({ key: "fightingStyle", title: "Боевой стиль", description: "Выберите один стиль воина, которого у персонажа ещё нет.", count: 1, options: fightingStyles });
  if (feat === "metamagic-adept") groups.push({ key: "metamagic", title: "Два варианта метамагии", description: "Выберите два варианта метамагии чародея.", count: 2, options: metamagic });
  if (feat === "eldritch-adept") groups.push({ key: "invocation", title: "Таинственное воззвание", description: "Показаны воззвания без специальных предварительных требований.", count: 1, options: invocations });
  if (feat === "linguist") groups.push({ key: "languages", title: "Три языка", description: "Выберите три языка, которые персонаж изучает благодаря черте.", count: 3, options: ["Дварфский", "Эльфийский", "Великаний", "Гномий", "Гоблинский", "Орочий", "Бездны", "Небесный", "Глубинная речь", "Драконий", "Инфернальный", "Первичный", "Сильван", "Подземный"].map(name => ({ id: name, name })) });
  if (feat === "elemental-adept") groups.push({ key: "element", title: "Тип урона", description: "Заклинания выбранной стихии игнорируют сопротивление, а 1 на кости урона считается 2.", count: 1, options: ["Кислота", "Холод", "Огонь", "Электричество", "Звук"].map(name => ({ id: name, name })) });
  if (feat === "rune-shaper") {
    const proficiency = 2 + Math.floor((Math.max(1, characterLevel) - 1) / 4);
    groups.push({ key: "runeAbility", title: "Характеристика рунных заклинаний", description: "Выберите Интеллект, Мудрость или Харизму для бросков атаки и Сл рунных заклинаний.", count: 1, options: abilityOptions(["int", "wis", "cha"]) });
    groups.push({
      key: "runes",
      title: "Известные руны",
      description: "Выберите число рун, равное половине бонуса мастерства с округлением вниз. Каждая руна даёт связанное заклинание 1-го круга.",
      count: Math.max(1, Math.floor(proficiency / 2)),
      options: runeSpells.map(([id, name]) => ({ id, name, detail: spells.find(spell => spell.id === id)?.description })),
    });
  }

  if (feat === "magic-initiate") {
    groups.push({ key: "tradition", title: "Список заклинаний", description: "Он определяет доступные заклинания и базовую характеристику этой черты.", count: 1, options: classOptions });
    if (tradition) {
      groups.push({ key: "cantrips", title: "Два заговора", description: "Вы знаете их постоянно; они не расходуют выбор заклинаний вашего класса.", count: 2, options: classSpellOptions(spells, tradition, 0) });
      groups.push({ key: "spell", title: "Заклинание 1-го круга", description: "Его можно наложить один раз на минимальном круге без ячейки; применение восстанавливается после продолжительного отдыха.", count: 1, options: classSpellOptions(spells, tradition, 1) });
    }
  }
  if (feat === "artificer-initiate") {
    groups.push({ key: "cantrips", title: "Заговор изобретателя", description: "Вы изучаете один заговор из списка изобретателя.", count: 1, options: classSpellOptions(spells, "artificer", 0) });
    groups.push({ key: "spell", title: "Заклинание изобретателя 1-го круга", description: "Вы изучаете одно заклинание 1-го круга и можете раз за продолжительный отдых наложить его без ячейки.", count: 1, options: classSpellOptions(spells, "artificer", 1) });
    groups.push({ key: "tool", title: "Инструмент ремесленника", description: "Выберите инструмент, которым персонаж владеет и может пользоваться как фокусировкой.", count: 1, options: skillsAndTools.filter(option => option.name.startsWith("Инструменты")) });
  }
  if (feat === "ritual-caster") {
    groups.push({ key: "tradition", title: "Ритуальная традиция", description: "Выберите класс, из списка которого составлена ритуальная книга.", count: 1, options: classOptions });
    if (tradition) groups.push({ key: "rituals", title: "Начальные ритуалы", description: "Книга начинается с двух заклинаний 1-го круга с меткой «ритуал».", count: 2, options: classSpellOptions(spells, tradition, 1, true) });
  }
  if (feat === "spell-sniper") {
    groups.push({ key: "tradition", title: "Список заговора", description: "Выберите класс и один его заговор с броском атаки.", count: 1, options: classOptions });
    if (tradition) groups.push({ key: "cantrips", title: "Атакующий заговор", description: "Дальность атакующих заклинаний удваивается, а половина и три четверти укрытия игнорируются.", count: 1, options: classSpellOptions(spells, tradition, 0) });
  }
  if (feat === "fey-touched" || feat === "shadow-touched") {
    const allowedSchools = feat === "fey-touched" ? ["Прорицание", "Очарование"] : ["Иллюзия", "Некромантия"];
    groups.push({ key: "spell", title: "Дополнительное заклинание 1-го круга", description: `Выберите заклинание школы: ${allowedSchools.join(" или ")}. Оно и дарованное чертой заклинание накладываются раз в продолжительный отдых без ячейки.`, count: 1, options: spells.filter(spell => spell.level === 1 && allowedSchools.some(school => spell.school.toLowerCase().includes(school.toLowerCase()))).map(spell => ({ id: spell.id, name: spell.name, detail: spell.description })) });
  }
  if (["adept-of-the-white-robes", "adept-of-the-red-robes", "adept-of-the-black-robes"].includes(feat)) {
    const schools = feat === "adept-of-the-white-robes" ? ["Ограждение", "Прорицание"] : feat === "adept-of-the-red-robes" ? ["Иллюзия", "Преобразование"] : ["Очарование", "Некромантия"];
    groups.push({ key: "spell", title: "Заклинание Высшего волшебства", description: `Выберите заклинание 2-го круга школы: ${schools.join(" или ")}.`, count: 1, options: spells.filter(spell => spell.level === 2 && schools.some(school => spell.school.toLowerCase().includes(school.toLowerCase()))).map(spell => ({ id: spell.id, name: spell.name, detail: spell.description })) });
  }
  return groups;
}

export function advancementChoiceComplete(choiceValue: AdvancementChoice, spells: CatalogSpell[], characterLevel = choiceValue.level) {
  if (!choiceValue.featId) return false;
  if (choiceValue.featId === "asi") return choiceValue.asiChoices.length === 2;
  return featChoiceGroups(choiceValue, spells, characterLevel).every(group => (choiceValue.featChoices?.[group.key] || []).length === group.count);
}

export function featGrantedSpellIds(character: ExportCharacter) {
  const ids = (character.advancements || []).flatMap(choiceValue => {
    if (!choiceValue.featId) return [];
    const choices = choiceValue.featChoices || {};
    const fixed = choiceValue.featId === "fey-touched" ? ["mistystep"] : choiceValue.featId === "shadow-touched" ? ["invisibility"] : [];
    const runeSpells = choiceValue.featId === "rune-shaper" ? ["comprehend-languages", ...(choices.runes || [])] : [];
    return [...fixed, ...runeSpells, ...(choices.cantrips || []), ...(choices.spell || []), ...(choices.rituals || [])];
  });
  return [...new Set(ids)];
}

export function resolvedFeatDescriptions(character: ExportCharacter, spells: CatalogSpell[]) {
  return (character.advancements || []).flatMap(choiceValue => {
    if (!choiceValue.featId || choiceValue.featId === "asi") return [];
    const groups = featChoiceGroups(choiceValue, spells);
    const selections = groups.map(group => {
      const names = (choiceValue.featChoices?.[group.key] || []).map(id => group.options.find(option => option.id === id)?.name || id);
      return names.length ? `${group.title}: ${names.join(", ")}` : "";
    }).filter(Boolean);
    return selections;
  });
}

export function featAbilityBonuses(character: ExportCharacter) {
  const result: Partial<Record<keyof AbilityScores, number>> = {};
  for (const choiceValue of character.advancements || []) {
    const documented = generatedFeats.find(item => item.id === choiceValue.featId)?.abilityOptions || [];
    const fixed = documented.length === 1 ? documented[0] : "";
    const selected = choiceValue.featChoices?.ability?.[0] || fixed;
    if (selected) result[selected as keyof AbilityScores] = (result[selected as keyof AbilityScores] || 0) + 1;
  }
  return result;
}
