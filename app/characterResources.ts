import type { ExportCharacter } from "./exportFormats";
import { selectedRaceVariant } from "./characterRules";
import { characterLevel, classView, getClassLevel, orderedCharacterClasses } from "./multiclass";

export type CharacterResource = {
  key: string;
  name: string;
  max: number;
  die?: string;
  unit?: number;
  isShortRest: boolean;
  isLongRest: boolean;
};

export function resourceRestLabel(resource: Pick<CharacterResource, "isShortRest" | "isLongRest">) {
  if (resource.isShortRest && resource.isLongRest) return "короткий или продолжительный отдых";
  if (resource.isShortRest) return "короткий отдых";
  if (resource.isLongRest) return "продолжительный отдых";
  return "не восстанавливается отдыхом";
}

function rageMaximum(level: number) {
  if (level >= 17) return 6;
  if (level >= 12) return 5;
  if (level >= 6) return 4;
  if (level >= 3) return 3;
  return 2;
}

const add = (list: CharacterResource[], condition: boolean, resource: CharacterResource) => condition && list.push(resource);

function racialResources(character: ExportCharacter) {
  const resources: CharacterResource[] = [];
  const level = characterLevel(character);
  const pb = 2 + Math.floor((Math.max(1, level) - 1) / 4);
  const modern = selectedRaceVariant(character.race, character.raceVariant || "base")?.source === "MPMM";
  const pool = (race: string, key: string, name: string, max: number, short = false) =>
    add(resources, character.race === race, { key, name, max, isShortRest: short, isLongRest: true });
  pool("dragonborn", "breath-weapon", "Оружие дыхания", 1, true);
  pool("halforc", "relentless-endurance", "Непоколебимая стойкость", 1);
  pool("goliath", "stones-endurance", "Каменная стойкость", modern ? pb : 1, !modern);
  pool("firbolg", "hidden-step", "Скрытый шаг", modern ? pb : 1, !modern);
  pool("goblin", "fury-of-the-small", "Ярость малого", modern ? pb : 1, !modern);
  pool("eladrin", "fey-step", "Фейский шаг", modern ? pb : 1, !modern);
  pool("shadarkai", "blessing-raven-queen", "Благословение Королевы Воронов", modern ? pb : 1);
  pool("reborn", "knowledge-past-life", "Знания из прошлой жизни", pb);
  pool("aasimar", "healing-hands", "Исцеляющие руки", 1);
  if (level >= 3) pool("aasimar", "celestial-revelation", "Небесное откровение", 1);
  pool("lizardfolk", "hungry-jaws", "Голодная пасть", modern ? pb : 1, !modern);
  pool("shifter", "shifting", "Смена", modern ? pb : 1, !modern);
  pool("harengon", "rabbit-hop", "Прыжок кролика", pb);
  pool("hadozee", "hadozee-dodge", "Стойкость хадози", pb);
  pool("giff", "astral-spark", "Астральная искра", pb);
  pool("autognome", "built-for-success", "Создан для успеха", pb);
  pool("dhampir", "vampiric-bite-empowerment", "Вампирский укус · усиление", pb);
  pool("leonin", "daunting-roar", "Ужасающий рёв", 1, true);
  if (modern) {
    pool("orc", "adrenaline-rush", "Выброс адреналина", pb);
    pool("orc", "relentless-endurance", "Непоколебимая стойкость", 1);
    pool("hobgoblin", "fey-gift", "Дар фей", pb);
    pool("hobgoblin", "fortune-from-many", "Удача многих", pb);
    pool("kenku", "kenku-recall", "Воспоминание кенку", pb);
    pool("deepgnome", "svirfneblin-camouflage", "Камуфляж свирфнеблина", pb);
    pool("kobold", "draconic-cry", "Драконий крик", pb);
  } else {
    pool("hobgoblin", "saving-face", "Спасение лица", 1, true);
    pool("kobold", "grovel-cower-beg", "Пресмыкаться и умолять", 1, true);
  }
  return resources;
}

function singleClassResources(character: ExportCharacter) {
  const resources: CharacterResource[] = [];
  const level = getClassLevel(character, character.className) || character.level;
  const pb = 2 + Math.floor((Math.max(1, characterLevel(character)) - 1) / 4);
  const ability = (key: keyof ExportCharacter["abilities"]) => Math.max(1, Math.floor((character.abilities[key] - 10) / 2));
  const subclass = character.subclass || "";
  const featIds = new Set([
    ...(character.feats || []),
    ...(character.advancements || []).map(choice => choice.featId).filter(Boolean),
  ]);

  add(resources, featIds.has("lucky"), { key: "lucky", name: "Везунчик · очки удачи", max: 3, isShortRest: false, isLongRest: true });



  add(resources, character.className === "barbarian", { key: "rage", name: "Ярость", max: rageMaximum(level), isShortRest: false, isLongRest: true });
  add(resources, character.className === "barbarian" && subclass === "wildmagic" && level >= 3, { key: "wild-magic-awareness", name: "Магическое чутьё", max: pb, isShortRest: false, isLongRest: true });
  add(resources, character.className === "barbarian" && subclass === "wildmagic" && level >= 6, { key: "bolstering-magic", name: "Подпитывающая магия", max: pb, isShortRest: false, isLongRest: true });
  add(resources, character.className === "barbarian" && subclass === "beast" && level >= 10, { key: "infectious-fury", name: "Заразная ярость", max: pb, isShortRest: false, isLongRest: true });
  add(resources, character.className === "barbarian" && subclass === "beast" && level >= 14, { key: "call-the-hunt", name: "Призыв охоты", max: pb, isShortRest: false, isLongRest: true });

  add(resources, character.className === "bard", { key: "bardic-inspiration", name: "Вдохновение барда", max: ability("cha"), die: level >= 15 ? "к12" : level >= 10 ? "к10" : level >= 5 ? "к8" : "к6", isShortRest: level >= 5, isLongRest: true });
  add(resources, character.className === "cleric" && level >= 2, { key: "channel-divinity", name: "Божественный канал", max: level >= 18 ? 3 : level >= 6 ? 2 : 1, isShortRest: true, isLongRest: true });
  add(resources, character.className === "cleric" && !!character.useTasha && level >= 2, { key: "harness-divine-power", name: "Направление божественной силы", max: level >= 18 ? 3 : level >= 6 ? 2 : 1, isShortRest: false, isLongRest: true });
  add(resources, character.className === "cleric" && subclass === "tempest" && level >= 1, { key: "wrath-of-storm", name: "Гнев бури", max: ability("wis"), isShortRest: false, isLongRest: true });
  add(resources, character.className === "cleric" && subclass === "peace" && level >= 1, { key: "emboldening-bond", name: "Укрепляющая связь", max: pb, isShortRest: false, isLongRest: true });
  add(resources, character.className === "cleric" && subclass === "order" && level >= 6, { key: "embodiment-of-law", name: "Воплощение закона", max: ability("wis"), isShortRest: false, isLongRest: true });

  add(resources, character.className === "druid" && level >= 2, { key: "wild-shape", name: "Дикий облик", max: 2, isShortRest: true, isLongRest: true });
  add(resources, character.className === "druid" && subclass === "spores" && level >= 6, { key: "fungal-infestation", name: "Грибная инфекция", max: ability("wis"), isShortRest: false, isLongRest: true });

  add(resources, character.className === "fighter", { key: "second-wind", name: "Второе дыхание", max: 1, isShortRest: true, isLongRest: true });
  add(resources, character.className === "fighter" && level >= 2, { key: "action-surge", name: "Всплеск действий", max: level >= 17 ? 2 : 1, isShortRest: true, isLongRest: true });
  add(resources, character.className === "fighter" && level >= 9, { key: "indomitable", name: "Упорный", max: level >= 17 ? 3 : level >= 13 ? 2 : 1, isShortRest: false, isLongRest: true });
  add(resources, character.className === "fighter" && subclass === "battlemaster" && level >= 3, { key: "superiority-dice", name: "Кости превосходства", max: level >= 15 ? 6 : level >= 7 ? 5 : 4, die: level >= 18 ? "к12" : level >= 10 ? "к10" : "к8", isShortRest: true, isLongRest: true });
  add(resources, character.className === "fighter" && subclass === "arcanearcher" && level >= 3, { key: "arcane-shot", name: "Магический выстрел", max: 2, isShortRest: true, isLongRest: true });
  add(resources, character.className === "fighter" && subclass === "runeknight" && level >= 3, { key: "giants-might", name: "Мощь великана", max: pb, isShortRest: false, isLongRest: true });
  add(resources, character.className === "fighter" && subclass === "samurai" && level >= 3, { key: "fighting-spirit", name: "Боевой дух", max: 3, isShortRest: false, isLongRest: true });
  add(resources, character.className === "fighter" && subclass === "echo-knight" && level >= 3, { key: "unleash-incarnation", name: "Высвобождение воплощения", max: ability("con"), isShortRest: false, isLongRest: true });
  add(resources, character.className === "fighter" && subclass === "echo-knight" && level >= 10, { key: "shadow-martyr", name: "Мученик тени", max: 1, isShortRest: true, isLongRest: true });
  add(resources, character.className === "fighter" && subclass === "echo-knight" && level >= 15, { key: "reclaim-potential", name: "Возвращение потенциала", max: ability("con"), isShortRest: false, isLongRest: true });
  add(resources, character.className === "fighter" && subclass === "psi-warrior" && level >= 3, { key: "psi-warrior-dice", name: "Кости псионической энергии", max: pb * 2, die: level >= 17 ? "к12" : level >= 11 ? "к10" : level >= 5 ? "к8" : "к6", isShortRest: false, isLongRest: true });
  add(resources, character.className === "fighter" && subclass === "psi-warrior" && level >= 3, { key: "psi-warrior-recovery", name: "Восстановление псионической кости", max: 1, isShortRest: true, isLongRest: true });

  add(resources, character.className === "monk" && level >= 2, { key: "ki", name: "Ци", max: level, isShortRest: true, isLongRest: true });

  add(resources, character.className === "paladin", { key: "lay-on-hands", name: "Наложение рук", max: level * 5, unit: 5, isShortRest: false, isLongRest: true });
  add(resources, character.className === "paladin" && level >= 3, { key: "channel-divinity", name: "Божественный канал", max: 1, isShortRest: true, isLongRest: true });
  add(resources, character.className === "paladin" && !!character.useTasha && level >= 3, { key: "harness-divine-power", name: "Направление божественной силы", max: level >= 15 ? 3 : level >= 7 ? 2 : 1, isShortRest: false, isLongRest: true });
  add(resources, character.className === "paladin" && subclass === "glory" && level >= 15, { key: "glorious-defense", name: "Славная защита", max: ability("cha"), isShortRest: false, isLongRest: true });

  add(resources, character.className === "ranger" && !!character.useTasha && (character.classChoices?.["tce-favored-foe"] || []).includes("favored-foe"), { key: "favored-foe", name: "Предпочтительный противник", max: pb, isShortRest: false, isLongRest: true });
  add(resources, character.className === "ranger" && !!character.useTasha && (character.classChoices?.["tce-deft-explorer"] || []).includes("deft-explorer") && level >= 10, { key: "tireless", name: "Неутомимый", max: pb, die: "к8", isShortRest: false, isLongRest: true });
  add(resources, character.className === "ranger" && !!character.useTasha && (character.classChoices?.["tce-natures-veil"] || []).includes("natures-veil") && level >= 10, { key: "natures-veil", name: "Покров природы", max: pb, isShortRest: false, isLongRest: true });
  if (character.className === "ranger" && !!character.useTasha && (character.classChoices?.["tce-primal-awareness"] || []).includes("primal-awareness")) {
    for (const [at, key, name] of [[3, "speak-with-animals", "Разговор с животными"], [5, "beast-sense", "Животные чувства"], [9, "speak-with-plants", "Разговор с растениями"], [13, "locate-creature", "Поиск существа"], [17, "commune-with-nature", "Общение с природой"]] as const) {
      add(resources, level >= at, { key: `primal-awareness:${key}`, name: `${name} без ячейки`, max: 1, isShortRest: false, isLongRest: true });
    }
  }
  add(resources, character.className === "ranger" && subclass === "horizonwalker" && level >= 3, { key: "detect-portal", name: "Обнаружение портала", max: 1, isShortRest: true, isLongRest: true });
  add(resources, character.className === "ranger" && subclass === "monster-slayer" && level >= 3, { key: "hunters-sense", name: "Чутьё охотника", max: ability("wis"), isShortRest: false, isLongRest: true });
  add(resources, character.className === "ranger" && subclass === "swarmkeeper" && level >= 7, { key: "writhing-tide", name: "Извивающийся поток", max: pb, isShortRest: false, isLongRest: true });
  add(resources, character.className === "ranger" && subclass === "swarmkeeper" && level >= 15, { key: "swarming-dispersal", name: "Рассеивающий рой", max: pb, isShortRest: false, isLongRest: true });
  add(resources, character.className === "ranger" && subclass === "drakewarden" && level >= 3, { key: "drake-companion-free", name: "Призыв дрейка без ячейки", max: 1, isShortRest: false, isLongRest: true });
  add(resources, character.className === "ranger" && subclass === "drakewarden" && level >= 11, { key: "drake-breath-free", name: "Дыхание дрейка без ячейки", max: 1, isShortRest: false, isLongRest: true });
  add(resources, character.className === "ranger" && subclass === "drakewarden" && level >= 15, { key: "reflexive-resistance", name: "Совершенная связь · сопротивление", max: pb, isShortRest: false, isLongRest: true });

  add(resources, character.className === "rogue" && subclass === "soulknife" && level >= 3, { key: "psionic-energy", name: "Псионическая энергия", max: pb * 2, die: level >= 17 ? "к12" : level >= 11 ? "к10" : level >= 5 ? "к8" : "к6", isShortRest: false, isLongRest: true });
  add(resources, character.className === "rogue" && subclass === "phantom" && level >= 3, { key: "wails-from-grave", name: "Вопли из могилы", max: pb, isShortRest: false, isLongRest: true });
  add(resources, character.className === "rogue" && subclass === "phantom" && level >= 9, { key: "tokens-of-departed", name: "Жетоны усопших", max: pb, isShortRest: false, isLongRest: false });
  add(resources, character.className === "rogue" && subclass === "phantom" && level >= 13, { key: "ghost-walk", name: "Призрачная прогулка", max: 1, isShortRest: false, isLongRest: true });
  add(resources, character.className === "rogue" && level >= 20, { key: "stroke-of-luck", name: "Удачливый поворот", max: 1, isShortRest: true, isLongRest: true });

  add(resources, character.className === "sorcerer" && level >= 2, { key: "sorcery-points", name: "Очки чародейства", max: level, isShortRest: false, isLongRest: true });
  add(resources, character.className === "sorcerer" && subclass === "wildmagic", { key: "tides-of-chaos", name: "Поток хаоса", max: 1, isShortRest: false, isLongRest: true });
  add(resources, character.className === "sorcerer" && subclass === "divinesoul", { key: "favored-by-gods", name: "Благоволение богов", max: 1, isShortRest: true, isLongRest: true });
  add(resources, character.className === "sorcerer" && subclass === "shadow", { key: "strength-of-the-grave", name: "Сила могилы", max: 1, isShortRest: false, isLongRest: true });
  add(resources, character.className === "sorcerer" && subclass === "clockwork" && level >= 1, { key: "restore-balance", name: "Восстановление баланса", max: pb, isShortRest: false, isLongRest: true });
  add(resources, character.className === "sorcerer" && subclass === "clockwork" && level >= 14, { key: "trance-of-order", name: "Транс порядка · бесплатное применение", max: 1, isShortRest: false, isLongRest: true });
  add(resources, character.className === "sorcerer" && subclass === "clockwork" && level >= 18, { key: "clockwork-cavalcade", name: "Заводная кавалькада · бесплатное применение", max: 1, isShortRest: false, isLongRest: true });

  add(resources, character.className === "warlock" && subclass === "archfey", { key: "fey-presence", name: "Фейская внешность", max: 1, isShortRest: true, isLongRest: true });
  add(resources, character.className === "warlock" && subclass === "hexblade", { key: "hexblades-curse", name: "Проклятие клинка", max: 1, isShortRest: true, isLongRest: true });
  add(resources, character.className === "warlock" && subclass === "celestial", { key: "healing-light", name: "Исцеляющий свет", max: level + 1, die: "к6", isShortRest: false, isLongRest: true });
  add(resources, character.className === "warlock" && subclass === "undying" && level >= 6, { key: "defy-death", name: "Бросить вызов смерти", max: 1, isShortRest: false, isLongRest: true });
  add(resources, character.className === "warlock" && subclass === "undying" && level >= 14, { key: "indestructible-life", name: "Несокрушимая жизнь", max: 1, isShortRest: true, isLongRest: true });
  add(resources, character.className === "warlock" && subclass === "fathomless" && level >= 1, { key: "tentacle-of-deeps", name: "Щупальце глубин", max: pb, isShortRest: false, isLongRest: true });
  add(resources, character.className === "warlock" && subclass === "fathomless" && level >= 10, { key: "evards-tentacles-free", name: "Чёрные щупальца Эварда без ячейки", max: 1, isShortRest: false, isLongRest: true });
  add(resources, character.className === "warlock" && subclass === "fathomless" && level >= 14, { key: "fathomless-plunge", name: "Погружение в бездну", max: 1, isShortRest: true, isLongRest: true });
  add(resources, character.className === "warlock" && subclass === "undead" && level >= 1, { key: "form-of-dread", name: "Облик ужаса", max: pb, isShortRest: false, isLongRest: true });
  add(resources, character.className === "warlock" && subclass === "undead" && level >= 14, { key: "spirit-projection", name: "Проекция духа", max: 1, isShortRest: false, isLongRest: true });

  add(resources, character.className === "wizard", { key: "arcane-recovery", name: "Восстановление магии", max: 1, isShortRest: false, isLongRest: true });
  add(resources, character.className === "wizard" && subclass === "bladesinging" && level >= 2, { key: "bladesong", name: "Песнь клинка", max: 2, isShortRest: true, isLongRest: true });
  add(resources, character.className === "wizard" && subclass === "divination" && level >= 2, { key: "portent", name: "Предзнаменование", max: level >= 14 ? 3 : 2, isShortRest: false, isLongRest: true });
  add(resources, character.className === "wizard" && subclass === "chronurgy" && level >= 2, { key: "chronal-shift", name: "Хроно-сдвиг", max: 2, isShortRest: false, isLongRest: true });
  add(resources, character.className === "wizard" && subclass === "chronurgy" && level >= 6, { key: "momentary-stasis", name: "Мгновенный стазис", max: ability("int"), isShortRest: false, isLongRest: true });
  add(resources, character.className === "wizard" && subclass === "chronurgy" && level >= 10, { key: "arcane-abeyance", name: "Тайный резерв", max: 1, isShortRest: true, isLongRest: true });
  add(resources, character.className === "wizard" && subclass === "graviturgy" && level >= 10, { key: "violent-attraction", name: "Жестокое притяжение", max: ability("int"), isShortRest: false, isLongRest: true });
  add(resources, character.className === "wizard" && subclass === "graviturgy" && level >= 14, { key: "event-horizon", name: "Горизонт событий · бесплатное применение", max: 1, isShortRest: false, isLongRest: true });

  add(resources, character.className === "artificer" && level >= 7, { key: "flash-of-genius", name: "Вспышка гениальности", max: ability("int"), isShortRest: false, isLongRest: true });
  add(resources, character.className === "artificer" && subclass === "alchemist" && level >= 3, { key: "experimental-elixir", name: "Экспериментальный эликсир", max: level >= 15 ? 3 : level >= 6 ? 2 : 1, isShortRest: false, isLongRest: true });
  add(resources, character.className === "artificer" && subclass === "artillerist" && level >= 3, { key: "eldritch-cannon", name: "Бесплатная магическая пушка", max: 1, isShortRest: false, isLongRest: true });
  add(resources, character.className === "artificer" && subclass === "armorer" && level >= 3, { key: "defensive-field", name: "Защитное поле", max: pb, isShortRest: false, isLongRest: true });
  add(resources, character.className === "artificer" && subclass === "battlesmith" && level >= 9, { key: "arcane-jolt", name: "Магический импульс", max: ability("int"), isShortRest: false, isLongRest: true });

  return resources;
}

/** Resources are resolved once per source class. Identical named pools such as
 * Channel Divinity remain one shared pool instead of being doubled. */
export function characterResources(character: ExportCharacter) {
  const merged = new Map<string, CharacterResource>(racialResources(character).map(resource => [resource.key, resource]));
  for (const entry of orderedCharacterClasses(character)) {
    for (const resource of singleClassResources(classView(character, entry))) {
      const previous = merged.get(resource.key);
      if (!previous || resource.max > previous.max) merged.set(resource.key, resource);
    }
  }
  return [...merged.values()];
}

export function resourceSpent(character: ExportCharacter, resource: CharacterResource) {
  return Math.max(0, Math.min(resource.max, character.resourceSpent?.[resource.key] || 0));
}

export function resourceCurrent(character: ExportCharacter, resource: CharacterResource) {
  return resource.max - resourceSpent(character, resource);
}

export function spentResourcesAfterLongRest(character: ExportCharacter): Record<string, number> {
  const persistentKeys = new Set(characterResources(character)
    .filter(resource => !resource.isLongRest).map(resource => resource.key));
  return Object.fromEntries(Object.entries(character.resourceSpent || {})
    .filter(([key]) => persistentKeys.has(key)));
}
