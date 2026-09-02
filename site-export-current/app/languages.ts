import type { ExportCharacter } from "./exportFormats";
import { backgroundRule } from "./backgroundRules";

export const knownLanguageOptions = [
  "Общий", "Дварфский", "Эльфийский", "Великаний", "Гномий", "Гоблинский", "Полуросликов", "Орочий",
  "Бездны", "Небесный", "Драконий", "Глубинная речь", "Инфернальный", "Первичный", "Сильван", "Подземный",
] as const;

type LanguageRule = { fixed?: string[]; choices?: number };

const raceLanguages: Record<string, LanguageRule> = {
  human: { fixed: ["Общий"], choices: 1 },
  customlineage: { fixed: ["Общий"], choices: 1 },
  dwarf: { fixed: ["Общий", "Дварфский"] }, duergar: { fixed: ["Общий", "Дварфский", "Подземный"] },
  elf: { fixed: ["Общий", "Эльфийский"] }, eladrin: { fixed: ["Общий", "Эльфийский"] }, shadarkai: { fixed: ["Общий", "Эльфийский"] },
  seafelf: { fixed: ["Общий", "Эльфийский", "Первичный"] }, halfelf: { fixed: ["Общий", "Эльфийский"], choices: 1 },
  halfling: { fixed: ["Общий", "Полуросликов"] }, dragonborn: { fixed: ["Общий", "Драконий"] },
  gnome: { fixed: ["Общий", "Гномий"] }, deepgnome: { fixed: ["Общий", "Гномий", "Подземный"] },
  halforc: { fixed: ["Общий", "Орочий"] }, orc: { fixed: ["Общий", "Орочий"] }, tiefling: { fixed: ["Общий", "Инфернальный"] },
  aasimar: { fixed: ["Общий", "Небесный"] }, aarakocra: { fixed: ["Общий", "Первичный"] }, genasi: { fixed: ["Общий", "Первичный"] },
  bugbear: { fixed: ["Общий", "Гоблинский"] }, goblin: { fixed: ["Общий", "Гоблинский"] }, hobgoblin: { fixed: ["Общий", "Гоблинский"] },
  firbolg: { fixed: ["Общий", "Эльфийский", "Великаний"] }, goliath: { fixed: ["Общий", "Великаний"] },
  kobold: { fixed: ["Общий", "Драконий"] }, lizardfolk: { fixed: ["Общий", "Драконий"] },
  changeling: { fixed: ["Общий"], choices: 2 }, centaur: { fixed: ["Общий", "Сильван"] }, fairy: { fixed: ["Общий", "Сильван"] },
  minotaur: { fixed: ["Общий", "Великаний"] }, triton: { fixed: ["Общий", "Первичный"] },
  githyanki: { fixed: ["Общий", "Глубинная речь"] }, githzerai: { fixed: ["Общий", "Глубинная речь"] },
  yuanpure: { fixed: ["Общий", "Бездны", "Драконий"] }, satyr: { fixed: ["Общий", "Сильван"] },
};

const supplementBackgroundLanguageChoices: Record<string, number> = {
  citywatch: 2, clan: 1, courtier: 2, faction: 2, fartraveler: 1, inheritor: 1,
  uthgardt: 1, waterdhavian: 1, haunted: 1, investigator: 1, feylost: 1, strixstudent: 2, astraldrifter: 2,
};

export function languageRule(character: Pick<ExportCharacter, "race" | "raceVariant" | "background" | "className" | "subclass" | "level" | "useTasha">) {
  const racial = raceLanguages[character.race] || { fixed: ["Общий"], choices: 1 };
  const fixed = [...(racial.fixed || ["Общий"] )];
  let choices = (racial.choices || 0) + backgroundRule(character.background).languageChoices + (supplementBackgroundLanguageChoices[character.background] || 0);

  if (character.race === "elf" && character.raceVariant === "high") choices += 1;
  if (character.className === "druid") fixed.push("Друидический");
  if (character.className === "rogue") fixed.push("Воровской жаргон");
  if (character.className === "sorcerer" && character.subclass === "draconic") fixed.push("Драконий");
  if (character.className === "sorcerer" && character.subclass === "storm") fixed.push("Первичный");
  if (character.className === "rogue" && character.subclass === "mastermind" && character.level >= 3) choices += 2;
  return { fixed: [...new Set(fixed)], choices };
}

export function characterLanguages(character: ExportCharacter) {
  const rule = languageRule(character);
  const featLanguages = (character.advancements || []).flatMap(choice => choice.featChoices?.languages || []);
  return [...new Set([...rule.fixed, ...(character.languages || []).slice(0, rule.choices), ...featLanguages])];
}
