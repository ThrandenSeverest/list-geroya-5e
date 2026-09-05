import type { ExportCharacter } from "./exportFormats";
import { backgroundRule } from "./backgroundRules";
import { orderedCharacterClasses } from "./multiclass";

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

function grantOrAlternative(fixed: string[], language: string) {
  if (fixed.includes(language)) return 1;
  fixed.push(language);
  return 0;
}

export function languageRule(character: ExportCharacter) {
  const racial = raceLanguages[character.race] || { fixed: ["Общий"], choices: 1 };
  const fixed = [...(racial.fixed || ["Общий"] )];
  let choices = (racial.choices || 0) + backgroundRule(character.background).languageChoices + (supplementBackgroundLanguageChoices[character.background] || 0);

  if (character.race === "elf" && character.raceVariant === "high") choices += 1;

  const classes = orderedCharacterClasses(character);
  for (const entry of classes) {
    const subclass = entry.subclassId || "";
    if (entry.classId === "druid") fixed.push("Друидический");
    if (entry.classId === "rogue") fixed.push("Воровской жаргон");
    if (entry.classId === "sorcerer" && subclass === "draconic") choices += grantOrAlternative(fixed, "Драконий");
    if (entry.classId === "sorcerer" && subclass === "storm") choices += grantOrAlternative(fixed, "Первичный");
    if (entry.classId === "rogue" && subclass === "mastermind" && entry.level >= 3) choices += 2;

    // Missing-subclass reference: permanent language grants/choices.
    if (entry.classId === "cleric" && subclass === "knowledge" && entry.level >= 1) choices += 2;
    if (entry.classId === "barbarian" && subclass === "giant" && entry.level >= 3) choices += grantOrAlternative(fixed, "Великаний");
    if (entry.classId === "monk" && subclass === "ascendant-dragon" && entry.level >= 3) choices += grantOrAlternative(fixed, "Драконий");
    if (entry.classId === "ranger" && subclass === "drakewarden" && entry.level >= 3) choices += grantOrAlternative(fixed, "Драконий");

    const selected = entry.choiceValues || {};
    if (character.useTasha && entry.classId === "ranger" && (selected["tce-deft-explorer"] || []).includes("deft-explorer")) choices += 2;
  }

  // Legacy single-class saves keep pre-V4 choices here until migration.
  if (character.useTasha && character.className === "ranger" && (character.classChoices?.["tce-deft-explorer"] || []).includes("deft-explorer") && !classes.some(entry => (entry.choiceValues?.["tce-deft-explorer"] || []).includes("deft-explorer"))) choices += 2;

  return { fixed: [...new Set(fixed)], choices };
}

export function characterLanguages(character: ExportCharacter) {
  const rule = languageRule(character);
  const featLanguages = (character.advancements || []).flatMap(choice => choice.featChoices?.languages || []);
  return [...new Set([...rule.fixed, ...(character.languages || []).slice(0, rule.choices), ...featLanguages])];
}
