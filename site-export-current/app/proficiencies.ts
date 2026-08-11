import { backgroundRule } from "./backgroundRules";
import { selectedRaceVariant } from "./characterRules";
import type { ExportCharacter } from "./exportFormats";
import { characterLanguages } from "./languages";
import { classRules, skillKeys } from "./rules";

export const artisanTools = [
  "Инструменты алхимика", "Инструменты пивовара", "Инструменты каллиграфа", "Инструменты плотника",
  "Инструменты картографа", "Инструменты сапожника", "Инструменты повара", "Инструменты стеклодува",
  "Инструменты ювелира", "Инструменты кожевника", "Инструменты каменщика", "Инструменты художника",
  "Инструменты гончара", "Инструменты кузнеца", "Инструменты ремонтника", "Инструменты ткача",
  "Инструменты резчика по дереву",
] as const;

export const musicalInstruments = [
  "Волынка", "Барабан", "Цимбалы", "Флейта", "Лютня", "Лира", "Рожок", "Свирель", "Шалмей", "Виола",
] as const;

export const gamingSets = ["Игральные кости", "Карты", "Драконьи шахматы", "Ставка трёх драконов"] as const;

export const selectableWeapons = [
  "Боевой посох", "Булава", "Дубинка", "Кинжал", "Копьё", "Лёгкий молот", "Метательное копьё", "Палица",
  "Ручной топор", "Серп", "Дротик", "Короткий лук", "Лёгкий арбалет", "Праща",
  "Боевой молот", "Боевой топор", "Длинный меч", "Кнут", "Короткий меч", "Рапира", "Скимитар",
  "Алебарда", "Глефа", "Двуручный меч", "Длинное копьё", "Клевец", "Молот", "Моргенштерн", "Пика", "Секира",
  "Трезубец", "Цеп", "Длинный лук", "Ручной арбалет", "Тяжёлый арбалет",
] as const;

const skillNames = Object.keys(skillKeys);
const allTools = [...artisanTools, ...musicalInstruments, ...gamingSets];

export type ProficiencyChoiceRequirement = {
  key: string;
  title: string;
  source: string;
  description: string;
  count: number;
  options: string[];
  kind: "tool" | "weapon" | "skill-or-tool";
};

const R = (
  key: string,
  title: string,
  source: string,
  description: string,
  count: number,
  options: readonly string[],
  kind: ProficiencyChoiceRequirement["kind"] = "tool",
): ProficiencyChoiceRequirement => ({ key, title, source, description, count, options: [...options], kind });

export function proficiencyChoiceRequirements(character: ExportCharacter): ProficiencyChoiceRequirement[] {
  const requirements: ProficiencyChoiceRequirement[] = [];
  const tools = backgroundRule(character.background).tools;
  if (tools.includes("Один вид ремесленных инструментов")) requirements.push(R("background-artisan", "Ремесленный инструмент", "Предыстория", "Выберите конкретное ремесло, которым владел герой до приключений.", 1, artisanTools));
  if (tools.includes("Один музыкальный инструмент")) requirements.push(R("background-music", "Музыкальный инструмент", "Предыстория", "Выберите конкретный музыкальный инструмент.", 1, musicalInstruments));
  if (tools.includes("Один игровой набор")) requirements.push(R("background-game", "Игровой набор", "Предыстория", "Выберите конкретный игровой набор.", 1, gamingSets));

  if (character.race === "dwarf") requirements.push(R("race-dwarf-artisan", "Дварфийское ремесло", "Раса", "Дварф выбирает один из трёх традиционных инструментов.", 1, ["Инструменты кузнеца", "Инструменты пивовара", "Инструменты каменщика"]));
  if (character.race === "satyr") requirements.push(R("race-satyr-music", "Инструмент гуляки", "Раса", "Сатир владеет одним музыкальным инструментом.", 1, musicalInstruments));
  if (["vedalken", "warforged", "astralelf"].includes(character.race)) requirements.push(R(`race-${character.race}-tool`, "Инструмент происхождения", "Раса", character.race === "astralelf" ? "Выбранное владение можно менять после астрального транса." : "Выберите конкретный инструмент, предоставленный расовой особенностью.", 1, allTools));

  if (character.className === "bard") requirements.push(R("class-bard-music", "Инструменты барда", "Класс", "Бард выбирает три конкретных музыкальных инструмента.", 3, musicalInstruments));
  if (character.className === "monk") requirements.push(R("class-monk-tool", "Инструмент монаха", "Класс", "Выберите один ремесленный или музыкальный инструмент.", 1, [...artisanTools, ...musicalInstruments]));
  if (character.className === "artificer") requirements.push(R("class-artificer-artisan", "Ремесло изобретателя", "Класс", "Изобретатель выбирает один дополнительный вид ремесленных инструментов.", 1, artisanTools));

  if (character.className === "fighter" && character.subclass === "battlemaster" && character.level >= 3) requirements.push(R("subclass-battlemaster-artisan", "Ученик войны", "Подкласс", "Мастер боевых искусств получает владение одним ремесленным инструментом.", 1, artisanTools));
  if (character.className === "bard" && character.subclass === "lore" && character.level >= 3) requirements.push(R("subclass-lore-skills", "Дополнительные навыки", "Подкласс", "Коллегия знаний даёт три дополнительных владения навыками.", 3, skillNames, "skill-or-tool"));
  if (character.className === "rogue" && character.subclass === "mastermind" && character.level >= 3) requirements.push(R("subclass-mastermind-game", "Мастер интриг", "Подкласс", "Выберите игровой набор, которым владеет вдохновитель.", 1, gamingSets));
  if (character.className === "monk" && character.subclass === "kensei" && character.level >= 3) requirements.push(R("subclass-kensei-artisan", "Путь кисти", "Подкласс", "Кэнсэй выбирает каллиграфию или живопись.", 1, ["Инструменты каллиграфа", "Инструменты художника"]));
  if (character.className === "wizard" && character.subclass === "bladesinging" && character.level >= 2) requirements.push(R("subclass-bladesinger-weapon", "Тренировка в войне и песне", "Подкласс", "Выберите один вид одноручного рукопашного оружия.", 1, ["Булава", "Боевой молот", "Боевой топор", "Длинный меч", "Кнут", "Короткий меч", "Рапира", "Скимитар", "Трезубец", "Цеп"], "weapon"));

  return requirements;
}

export function proficiencyChoicesComplete(character: ExportCharacter) {
  const selectedTools: string[] = [];
  const complete = proficiencyChoiceRequirements(character).every(requirement => {
    const selected = character.proficiencyChoices?.[requirement.key] || [];
    if (requirement.kind !== "weapon") selectedTools.push(...selected.filter(value => !skillNames.includes(value)));
    return selected.length === requirement.count && new Set(selected).size === selected.length && selected.every(value => requirement.options.includes(value));
  });
  return complete && new Set(selectedTools).size === selectedTools.length;
}

export function proficiencyChoiceUsedElsewhere(character: ExportCharacter, key: string, value: string) {
  return Object.entries(character.proficiencyChoices || {}).some(([otherKey, selected]) => otherKey !== key && selected.includes(value));
}

const fixedClassTools: Record<string, string[]> = {
  druid: ["Набор травника"],
  rogue: ["Воровские инструменты"],
  artificer: ["Воровские инструменты", "Инструменты ремонтника"],
};

const subclassProficiencies: Record<string, Partial<Record<"skills" | "armor" | "weapons" | "tools", string[]>>> = {
  "bard:valor": { armor: ["Средние доспехи", "Щиты"], weapons: ["Воинское оружие"] },
  "bard:swords": { armor: ["Средние доспехи"], weapons: ["Скимитар"] },
  "cleric:life": { armor: ["Тяжёлые доспехи"] },
  "cleric:war": { armor: ["Тяжёлые доспехи"], weapons: ["Воинское оружие"] },
  "cleric:forge": { armor: ["Тяжёлые доспехи"], tools: ["Инструменты кузнеца"] },
  "cleric:twilight": { armor: ["Тяжёлые доспехи"], weapons: ["Воинское оружие"] },
  "rogue:assassin": { tools: ["Набор для грима", "Набор отравителя"] },
  "rogue:mastermind": { tools: ["Набор для грима", "Набор для фальсификации"] },
  "rogue:scout": { skills: ["Природа", "Выживание"] },
  "monk:drunken": { skills: ["Выступление"], tools: ["Инструменты пивовара"] },
  "warlock:hexblade": { armor: ["Средние доспехи", "Щиты"], weapons: ["Воинское оружие"] },
  "wizard:bladesinging": { armor: ["Лёгкие доспехи"] },
  "artificer:alchemist": { tools: ["Инструменты алхимика"] },
  "artificer:artillerist": { tools: ["Инструменты резчика по дереву"] },
  "artificer:battlesmith": { tools: ["Инструменты кузнеца"] },
  "artificer:armorer": { tools: ["Инструменты кузнеца"], armor: ["Тяжёлые доспехи"] },
};

function unique(values: string[]) {
  const result = [...new Set(values.filter(value => value && value.toLowerCase() !== "нет"))];
  return result;
}

function isGenericChoice(value: string) {
  return /один|одну|выбор|ремесленн|музыкальн|игровой набор/i.test(value);
}

export type CharacterProficiencies = {
  skills: string[];
  armor: string[];
  weapons: string[];
  tools: string[];
  languages: string[];
};

export function characterProficiencies(character: ExportCharacter): CharacterProficiencies {
  const skills = [...(character.raceSkills || []), ...character.backgroundSkills, ...character.classSkills];
  const armor = [classRules[character.className]?.armor || ""];
  const weapons = [classRules[character.className]?.weapons || ""];
  const tools = [...(fixedClassTools[character.className] || [])];
  const variant = selectedRaceVariant(character.race, character.raceVariant);

  for (const value of variant?.proficiencies || []) {
    if (isGenericChoice(value) || skillNames.includes(value)) continue;
    if (/доспех|щит/i.test(value)) armor.push(value);
    else if (/инструмент|набор|транспорт/i.test(value)) tools.push(value);
    else weapons.push(value);
  }

  if (character.race === "dwarf") weapons.push("Боевой топор", "Ручной топор", "Лёгкий молот", "Боевой молот");
  if (character.race === "giff") weapons.push("Огнестрельное оружие");

  for (const value of backgroundRule(character.background).tools) if (!isGenericChoice(value)) tools.push(value);
  const subclass = subclassProficiencies[`${character.className}:${character.subclass || ""}`];
  if (subclass && character.level >= 1) {
    skills.push(...(subclass.skills || []));
    armor.push(...(subclass.armor || []));
    weapons.push(...(subclass.weapons || []));
    tools.push(...(subclass.tools || []));
  }

  for (const requirement of proficiencyChoiceRequirements(character)) {
    for (const value of (character.proficiencyChoices?.[requirement.key] || []).slice(0, requirement.count)) {
      if (requirement.kind === "weapon") weapons.push(value);
      else if (requirement.kind === "skill-or-tool" && skillNames.includes(value)) skills.push(value);
      else tools.push(value);
    }
  }

  for (const value of character.classChoices?.["kensei-weapons"] || []) weapons.push(value.replace(/^weapon-/, ""));
  for (const advancement of character.advancements || []) {
    if (advancement.featId === "skill-expert") skills.push(...(advancement.featChoices?.skill || []));
    if (advancement.featId === "weapon-master") weapons.push(...(advancement.featChoices?.weapons || []));
    if (advancement.featId === "skilled") {
      for (const value of advancement.featChoices?.proficiencies || []) (skillNames.includes(value) ? skills : tools).push(value);
    }
    if (advancement.featId === "artificer-initiate") tools.push(...(advancement.featChoices?.tool || []));
  }
  return {
    skills: unique(skills),
    armor: unique(armor),
    weapons: unique(weapons),
    tools: unique(tools),
    languages: characterLanguages(character),
  };
}

export function characterExpertiseSkills(character: ExportCharacter) {
  const values = [
    ...(character.expertiseSkills || []),
    ...(character.classChoices?.expertise || []).map(value => value.replace(/^skill-/, "")),
    ...(character.className === "rogue" && character.subclass === "scout" && character.level >= 3 ? ["Природа", "Выживание"] : []),
    ...(character.advancements || []).flatMap(advancement => advancement.featId === "skill-expert" ? advancement.featChoices?.expertise || [] : []),
  ];
  return unique(values);
}
