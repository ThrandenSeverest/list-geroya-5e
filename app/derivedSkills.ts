import { hbSum } from "./homebrewEngine";
import type { ExportCharacter } from "./exportFormats";
import { characterExpertiseSkills, characterProficiencies } from "./proficiencies";
import { characterLevel } from "./multiclass";
import { skillKeys } from "./rules";

const modifier = (score: number) => Math.floor((score - 10) / 2);
const proficiencyBonus = (level: number) => Math.floor((Math.max(1, level) - 1) / 4) + 2;

export function skillBonusBreakdown(character: ExportCharacter, skill: string) {
  const rule = skillKeys[skill];
  if (!rule) throw new Error(`Unknown skill: ${skill}`);
  const ability = modifier(character.abilities[rule.stat as keyof ExportCharacter["abilities"]]);
  const proficient = characterProficiencies(character).skills.includes(skill);
  const expertise = proficient && characterExpertiseSkills(character).includes(skill);
  const training = proficient ? proficiencyBonus(characterLevel(character)) * (expertise ? 2 : 1) : 0;
  return { value: ability + training + hbSum(character, "skill_bonus", e => e.skill === rule.key || e.skill === skill), ability, training, proficient, expertise };
}

export function passivePerceptionBreakdown(character: ExportCharacter) {
  const skill = skillBonusBreakdown(character, "Внимательность");
  const feats = new Set([...(character.feats || []), ...(character.advancements || []).map(choice => choice.featId)]);
  const observant = feats.has("observant") ? 5 : 0;
  return { value: 10 + skill.value + observant + hbSum(character, "passive_bonus", e => e.skill === "perception" || e.skill === "Внимательность"), skill, observant };
}

