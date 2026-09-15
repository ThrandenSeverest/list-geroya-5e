import { proficiencyBonus, type ExportCharacter } from "./exportFormats";
import type { CatalogSpell } from "./catalog";
import { orderedCharacterClasses } from "./multiclass";
import { skillKeys } from "./rules";
import { artisanTools, gamingSets, musicalInstruments } from "./proficiencies";

export type SubclassRuntimeTrigger = "rage" | "short-rest" | "long-rest" | "summon" | "activation" | "per-use" | "random";
export type SubclassRuntimeOption = { id: string; name: string; description?: string };
export type SubclassRuntimeControl = {
  key: string;
  classId: string;
  subclassId: string;
  minLevel: number;
  title: string;
  description: string;
  trigger: SubclassRuntimeTrigger;
  options: SubclassRuntimeOption[];
  randomDie?: number;
};

const O = (id: string, name: string, description = ""): SubclassRuntimeOption => ({ id, name, description });
const yesNo = [O("inactive", "Не активно"), O("active", "Активно")];
const elements5 = [O("acid", "Кислота"), O("cold", "Холод"), O("fire", "Огонь"), O("lightning", "Электричество"), O("poison", "Яд")];
const giantElements = [O("acid", "Кислота"), O("cold", "Холод"), O("fire", "Огонь"), O("lightning", "Электричество"), O("thunder", "Звук")];
const skillsAndTools = [...Object.keys(skillKeys), ...artisanTools, ...musicalInstruments, ...gamingSets].map(value => O(value, value));

const wildSurges = [
  O("1", "1 · Некротический всплеск", "Существа в 30 фт: спасбросок Телосложения, 1к12 некротического; временные хиты по нанесённому урону."),
  O("2", "2 · Телепортация", "Бонусным действием телепортация до 30 фт во время ярости."),
  O("3", "3 · Взрывной дух", "Появляется дух; бонусным действием можно взорвать его возле цели."),
  O("4", "4 · Магическое метательное оружие", "Оружие наносит силовой урон, получает метательное 20/60 и возвращается."),
  O("5", "5 · Ответ силой", "Попавшее по варвару существо получает 1к6 силового урона."),
  O("6", "6 · Защитная магия", "Варвар и союзники в 10 фт получают +1 КД."),
  O("7", "7 · Труднопроходимая аура", "15 фт вокруг варвара — труднопроходимая местность для врагов."),
  O("8", "8 · Ослепляющий луч", "Бонусным действием: спасбросок Телосложения, 1к6 излучением и ослепление."),
];
const spiritTales = Array.from({ length: 12 }, (_, index) => O(String(index + 1), `История ${index + 1}`, "Сохранённый результат «Историй из-за грани»; одновременно хранится одна история."));

function C(classId: string, subclassId: string, minLevel: number, key: string, title: string, description: string, trigger: SubclassRuntimeTrigger, options: SubclassRuntimeOption[], randomDie?: number): SubclassRuntimeControl {
  return { classId, subclassId, minLevel, key: `${classId}:${subclassId}:${key}`, title, description, trigger, options, randomDie };
}

const definitions: SubclassRuntimeControl[] = [
  C("barbarian", "wildmagic", 3, "wild-surge", "Текущий всплеск дикой магии", "Бросается при входе в ярость; на 10-м может быть заменён реакцией, на 14-м выбирается из двух результатов.", "random", wildSurges, 8),
  C("barbarian", "beast", 3, "beast-form", "Форма зверя", "Выбирается при каждом входе в ярость и создаёт только временную атаку.", "rage", [O("bite", "Укус"), O("claws", "Когти"), O("tail", "Хвост")]),
  C("barbarian", "beast", 6, "beast-adaptation", "Звериная адаптация", "Можно менять после каждого короткого или продолжительного отдыха.", "short-rest", [O("swim", "Плавание и дыхание под водой"), O("climb", "Лазание"), O("jump", "Прыжок")]),
  C("barbarian", "giant", 6, "elemental-cleaver", "Стихийный тесак", "Тип урона выбирается при каждой ярости и применяется только к текущему выбранному оружию.", "rage", giantElements),
  C("bard", "creation", 6, "dancing-item", "Оживлённый предмет", "Временный Dancing Item существует до 1 часа; не попадает в постоянный инвентарь.", "activation", yesNo),
  C("bard", "spirits", 3, "spirit-tale", "Сохранённая история духа", "Тратит Вдохновение барда, бросается кость и сохраняется один результат до применения.", "random", spiritTales, 12),
  C("cleric", "knowledge", 2, "knowledge-of-ages", "Знание веков", "Временное владение одним навыком или инструментом на 10 минут; не экспортируется как постоянное.", "activation", skillsAndTools),
  C("cleric", "trickery", 2, "invoke-duplicity", "Призыв двойника", "Иллюзорная позиция, не существо с хитами. На 17-м уровне одновременно до четырёх копий.", "activation", [O("inactive", "Нет двойника"), O("1", "1 двойник"), O("2", "2 двойника"), O("3", "3 двойника"), O("4", "4 двойника")]),
  C("cleric", "peace", 1, "emboldening-bond", "Укрепляющая связь", "Групповое временное состояние на 10 минут; количество участников ограничено БМ.", "activation", yesNo),
  C("druid", "spores", 2, "symbiotic-entity", "Симбиотическая сущность", "Расходует общий ресурс Дикого облика; активна до 10 минут, пока сохраняются её временные хиты.", "activation", yesNo),
  C("druid", "spores", 10, "spreading-spores", "Распространение спор", "10-футовый куб спор на 1 минуту; пока он существует, обычная реакция Ореола спор недоступна.", "activation", yesNo),
  C("fighter", "echo-knight", 3, "echo-count", "Проявленные эха", "Эхо — позиционный объект с КД 14 + БМ и 1 хитом, но не полноценное существо.", "activation", [O("0", "Нет эха"), O("1", "1 эхо"), O("2", "2 эха (только 18 уровень)")]),
  C("monk", "astral-self", 3, "astral-manifestation", "Астральное проявление", "Хранится как временный уровень проявления; атаки рук используют Мудрость и силовой урон.", "activation", [O("none", "Не проявлено"), O("arms", "Руки"), O("arms-visage", "Руки + облик"), O("full", "Пробуждённое астральное тело")]),
  C("monk", "ascendant-dragon", 3, "dragon-strike-element", "Драконий удар: тип урона", "Выбирается на каждую безоружную атаку.", "per-use", elements5),
  C("monk", "ascendant-dragon", 3, "dragon-breath-element", "Дыхание дракона: стихия", "Тип урона выбирается при каждом выдохе.", "per-use", elements5),
  C("monk", "ascendant-dragon", 3, "dragon-breath-shape", "Дыхание дракона: форма", "Форма выбирается при каждом выдохе.", "per-use", [O("cone", "Конус"), O("line", "Линия")]),
  C("monk", "ascendant-dragon", 11, "wyrm-aura", "Облик змея", "При активации выбирается защитное сопротивление либо пугающее присутствие.", "activation", [O("resistance", "Стихийное сопротивление"), O("fear", "Пугающее присутствие")]),
  C("ranger", "drakewarden", 3, "drake-essence", "Сущность дрейка", "Меняется при каждом новом призыве; определяет иммунитет, сопротивление и стихийный урон.", "summon", elements5),
  C("ranger", "drakewarden", 3, "drake-active", "Дрейк-компаньон", "Временный призываемый спутник с динамическими КД, хитами и атакой.", "summon", yesNo),
  C("rogue", "phantom", 3, "whispers-dead", "Шёпот мёртвых", "После короткого или продолжительного отдыха выберите временное владение навыком или инструментом.", "short-rest", skillsAndTools),
  C("warlock", "fathomless", 1, "tentacle", "Щупальце глубин", "Временная позиция без собственных хитов; атака использует параметры колдуна.", "activation", yesNo),
  C("warlock", "undead", 1, "form-of-dread", "Облик ужаса", "Временный режим на 1 минуту; ресурс применений ведётся отдельно.", "activation", yesNo),
  C("warlock", "undead", 14, "necrotic-husk-cooldown", "Некротическая оболочка: восстановление", "После срабатывания бросьте к4. Результат — сколько продолжительных отдыхов осталось до нового применения.", "random", [O("1", "1 продолжительный отдых"), O("2", "2 продолжительных отдыха"), O("3", "3 продолжительных отдыха"), O("4", "4 продолжительных отдыха")], 4),
  C("warlock", "undead", 14, "spirit-projection", "Проекция духа", "Временный режим того же персонажа, не второй персонаж и не копия ресурсов.", "activation", yesNo),
  C("wizard", "graviturgy", 2, "adjust-density", "Изменение плотности", "Временный эффект концентрации: уменьшить либо удвоить вес цели.", "activation", [O("inactive", "Не активно"), O("lighter", "Вес уменьшен вдвое"), O("heavier", "Вес удвоен")]),
  C("wizard", "chronurgy", 10, "arcane-abeyance", "Тайный резерв", "Временная бусина с конкретным заклинанием до 1 часа; хранитель бусины поддерживает концентрацию.", "activation", yesNo),
];

export function subclassRuntimeControls(character: ExportCharacter, spells: CatalogSpell[] = []) {
  const classes = orderedCharacterClasses(character);
  const controls = definitions
    .filter(control => classes.some(entry => entry.classId === control.classId && entry.subclassId === control.subclassId && entry.level >= control.minLevel))
    .map(control => {
      const entry = classes.find(item => item.classId === control.classId);
      if (control.key === "fighter:echo-knight:echo-count" && (entry?.level || 0) < 18) return { ...control, options: control.options.filter(option => option.id !== "2") };
      if (control.key === "cleric:trickery:invoke-duplicity" && (entry?.level || 0) < 17) return { ...control, options: control.options.filter(option => ["inactive", "1"].includes(option.id)) };
      if (control.key === "monk:astral-self:astral-manifestation") {
        const level = entry?.level || 0;
        return { ...control, options: control.options.filter(option => option.id === "none" || option.id === "arms" || (level >= 6 && option.id === "arms-visage") || (level >= 17 && option.id === "full")) };
      }
      return control;
    });
  const spirits = classes.find(entry => entry.classId === "bard" && entry.subclassId === "spirits" && entry.level >= 6);
  if (spirits) {
    const participants = Math.max(1, Math.min(proficiencyBonus(character.level), Number(subclassRuntimeValue(character, "bard:spirits:spirit-session-participants") || proficiencyBonus(character.level))));
    controls.push(C("bard", "spirits", 6, "spirit-session-participants", "Духовный сеанс: участники", "Число добровольных участников определяет максимальный круг временно изученного заклинания.", "long-rest", Array.from({ length: proficiencyBonus(character.level) }, (_, index) => O(String(index + 1), String(index + 1))), undefined));
    controls.push(C("bard", "spirits", 6, "spirit-session-spell", "Духовный сеанс: временное заклинание", `Заклинание школ Прорицания или Некромантии до ${participants}-го круга. Исчезает при начале следующего продолжительного отдыха.`, "long-rest", spells.filter(spell => spell.level > 0 && spell.level <= participants && /прорицани|некроманти/i.test(spell.school)).map(spell => O(spell.id, `${spell.name} · ${spell.level} круг`, spell.description))));
  }
  return controls;
}

export function subclassRuntimeValue(character: ExportCharacter, key: string) {
  return character.subclassState?.[key];
}
export function setSubclassRuntimeValue(character: ExportCharacter, key: string, value: string | number): ExportCharacter {
  return { ...character, subclassState: { ...(character.subclassState || {}), [key]: value } };
}
export function rollSubclassRuntimeControl(character: ExportCharacter, control: SubclassRuntimeControl): ExportCharacter {
  if (!control.randomDie) return character;
  const roll = (crypto.getRandomValues(new Uint32Array(1))[0] % control.randomDie) + 1;
  const option = control.options.find(item => item.id === String(roll)) || control.options[(roll - 1) % control.options.length];
  return setSubclassRuntimeValue(character, control.key, option?.id || String(roll));
}

export const necroticHuskCooldownKey = "warlock:undead:necrotic-husk-cooldown";
export function necroticHuskCooldown(character: ExportCharacter) {
  return Math.max(0, Number(subclassRuntimeValue(character, necroticHuskCooldownKey) || 0));
}
export function startNecroticHuskCooldown(character: ExportCharacter): ExportCharacter {
  const remaining = (crypto.getRandomValues(new Uint32Array(1))[0] % 4) + 1;
  return setSubclassRuntimeValue(character, necroticHuskCooldownKey, remaining);
}
export function applySubclassLongRest(character: ExportCharacter): ExportCharacter {
  const cooldown = necroticHuskCooldown(character);
  const state = { ...(character.subclassState || {}) };
  delete state["bard:spirits:spirit-session-spell"];
  if (cooldown) state[necroticHuskCooldownKey] = Math.max(0, cooldown - 1);
  return { ...character, subclassState: state };
}
