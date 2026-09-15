import type { ExportCharacter } from "./exportFormats";
import { finalAbilityScores, spellSelectionRule } from "./characterRules";

const martialClasses = new Set(["barbarian", "fighter", "paladin", "ranger"]);
const lightArmorClasses = new Set(["artificer", "bard", "cleric", "druid", "fighter", "paladin", "ranger", "rogue", "warlock"]);
const mediumArmorClasses = new Set(["artificer", "barbarian", "cleric", "druid", "fighter", "paladin", "ranger"]);
const heavyArmorClasses = new Set(["cleric", "fighter", "paladin"]);

const raceNames: Record<string, string[]> = {
  human: ["человек"], halfelf: ["полуэльф", "эльф"], halforc: ["полуорк"], elf: ["эльф"], dwarf: ["дварф"],
  halfling: ["полурослик"], dragonborn: ["драконорождённый"], tiefling: ["тифлинг"], gnome: ["гном"], deepgnome: ["глубинный гном", "свирфнеблин", "гном"],
};

export function featRequirementMet(character: ExportCharacter, requirement?: string) {
  if (!requirement) return true;
  const text = requirement.toLowerCase();
  const scores = finalAbilityScores(character);
  const hasMagic = spellSelectionRule(character).caster || character.className === "warlock" || (character.spells || []).length > 0;
  const background = character.background.toLowerCase();
  const race = new Set(raceNames[character.race] || []);
  const selectedFeats = (character.advancements || []).map(choice => choice.featId);
  const smallRaces = ["halfling", "gnome", "deepgnome", "goblin", "kobold", "fairy", "grung", "kender"];
  const idHints: Record<string, string> = {
    "наследник внешних планов": "scion-of-the-outer-planes", "поступивший в стриксхейвен": "strixhaven-initiate",
    "удар великанов": "strike-of-the-giants", "посвящённый в высшее волшебство": "initiate-of-high-sorcery",
  };

  const atomMet = (atom: string) => {
    const part = atom.trim();
    const abilityChecks: Array<[RegExp, keyof typeof scores]> = [
      [/сила\s*13/, "str"], [/ловкость\s*13/, "dex"], [/телосложение\s*13/, "con"], [/интеллект\s*13/, "int"], [/мудрость\s*13/, "wis"], [/харизма\s*13/, "cha"],
    ];
    const mentionedAbilities = abilityChecks.filter(([pattern]) => pattern.test(part));
    if (mentionedAbilities.length && mentionedAbilities.some(([, key]) => scores[key] < 13)) return false;
    if (/накладывать.*заклин|умение накладывать|магия договора/.test(part)) return hasMagic;
    if (part.includes("владение воинским оружием")) return martialClasses.has(character.className);
    if (part.includes("владение лёгкими доспехами")) return lightArmorClasses.has(character.className);
    if (part.includes("владение средними доспехами")) return mediumArmorClasses.has(character.className);
    if (part.includes("владение тяжёлыми доспехами")) return heavyArmorClasses.has(character.className);
    if (/4 уровень/.test(part) && character.level < 4) return false;
    if (part.includes("кампания ") || part.includes("допуск ведущего")) return false;
    if (part.includes("предыстория")) {
      if (part.includes("соламнийский рыцарь")) return background.includes("solam");
      if (part.includes("потомок великанов")) return background.includes("giant");
      if (part.includes("резчик рун")) return background.includes("rune");
      if (part.includes("маг высшего волшебства")) return background.includes("highmagic") || background.includes("mage");
    }
    const quoted = part.match(/«([^»]+)»/);
    if (quoted && idHints[quoted[1]]) return selectedFeats.includes(idHints[quoted[1]]);
    if (part.includes("высший эльф")) return character.race === "elf" && character.raceVariant === "high";
    if (part.includes("лесной эльф")) return character.race === "elf" && character.raceVariant === "wood";
    if (part.includes("дроу")) return character.race === "elf" && character.raceVariant === "drow";
    if (part.includes("маленького размера")) return smallRaces.includes(character.race);
    const namedRaces = Object.values(raceNames).flat().filter(name => part.includes(name));
    if (namedRaces.length) return namedRaces.some(name => race.has(name));
    if (/\bвоин\b/.test(part) || /паладин/.test(part)) return (part.includes("воин") && character.className === "fighter") || (part.includes("паладин") && character.className === "paladin");
    if (/чародей|волшебник/.test(part)) return (part.includes("чародей") && character.className === "sorcerer") || (part.includes("волшебник") && character.className === "wizard");
    return true;
  };

  // Semicolons join mandatory clauses. «Или» / «либо» create alternatives
  // inside a clause; a single successful branch unlocks that clause.
  return text.split(/\s*;\s*/).every(clause =>
    clause.split(/\s+(?:или|либо)\s+/).some(alternative => alternative.split(/\s+и\s+/).every(atomMet)),
  );
}
