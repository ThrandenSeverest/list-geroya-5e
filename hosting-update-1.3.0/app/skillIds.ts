import { skillKeys } from "./rules";

function normalizeSkillId(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("ru")
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9]+/gi, "");
}

const skillAliases: Record<string, string> = {
  perception: "Внимательность",
  attention: "Внимательность",
  awareness: "Внимательность",
  внимательность: "Внимательность",
  восприятие: "Внимательность",
  medicine: "Медицина",
  medical: "Медицина",
  медицина: "Медицина",
};

for (const [russianName, { key }] of Object.entries(skillKeys)) {
  skillAliases[normalizeSkillId(russianName)] = russianName;
  skillAliases[normalizeSkillId(key)] = russianName;
}

/** Converts external or legacy skill identifiers to HeroList's canonical Russian name. */
export function skillNameFromExternalId(value: string) {
  return skillAliases[normalizeSkillId(value)] || "";
}

/** Converts a HeroList/legacy skill name to the canonical Long Story Short identifier. */
export function externalSkillId(value: string) {
  const russianName = skillNameFromExternalId(value);
  return russianName ? skillKeys[russianName]?.key || "" : "";
}

export function normalizeImportedSkills(values: string[] | undefined) {
  return [...new Set((values || []).map(skillNameFromExternalId).filter(Boolean))];
}
