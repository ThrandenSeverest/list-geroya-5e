import type { ExportCharacter } from "./exportFormats";
import type { CharacterAttack } from "./combat";
import { selectedRaceVariant } from "./characterRules";
import { characterLevel, getClassLevel } from "./multiclass";

type NaturalWeapon = { name: string; die: number; legacyDie?: number; damage: string; ability?: "con"; condition?: string };
// Explicit race/edition data; never infer damage from translated feature prose.
const naturalWeapons: Record<string, NaturalWeapon> = {
  aarakocra: { name: "Когти", die: 6, legacyDie: 4, damage: "рубящий" },
  centaur: { name: "Копыта", die: 6, legacyDie: 4, damage: "дробящий" },
  lizardfolk: { name: "Укус", die: 6, damage: "рубящий" },
  minotaur: { name: "Рога", die: 6, damage: "колющий" },
  satyr: { name: "Бараньи рога", die: 6, legacyDie: 4, damage: "дробящий" },
  tabaxi: { name: "Кошачьи когти", die: 6, legacyDie: 4, damage: "рубящий" },
  tortle: { name: "Когти", die: 6, legacyDie: 4, damage: "рубящий" },
  leonin: { name: "Когти", die: 4, damage: "рубящий" },
  dhampir: { name: "Вампирский укус", die: 4, damage: "колющий", ability: "con",
    condition: "При половине хитов или меньше — преимущество. Усиление укуса применяется отдельно; число усилений равно БМ за продолжительный отдых." },
};

export function naturalAttacks(character: ExportCharacter): CharacterAttack[] {
  const weapon: NaturalWeapon | undefined = character.race === "shifter" && ["longtooth", "motm-longtooth"].includes(character.raceVariant)
    ? { name: "Клыки длиннозуба", die: 6, damage: "колющий", condition: "Только во время Смены; атака клыками доступна бонусным действием." }
    : naturalWeapons[character.race];
  if (!weapon) return [];
  const legacy = selectedRaceVariant(character.race, character.raceVariant)?.source !== "MPMM";
  const die = legacy ? weapon.legacyDie || weapon.die : weapon.die;
  const proficiency = 2 + Math.floor((characterLevel(character) - 1) / 4);
  const make = (ability: "str" | "dex" | "con", damageDie: number, martial = false): CharacterAttack => {
    const modifier = Math.floor((character.abilities[ability] - 10) / 2);
    return { id: `natural-${character.race}${martial ? "-martial-arts" : ""}`,
      name: `${weapon.name}${martial ? " · Боевые искусства" : ""}`, kind: "feature", ability,
      proficient: true, attackBonus: proficiency + modifier, attackBonusExtra: 0,
      damageFormula: `1d${damageDie}+[${ability.toUpperCase()}]`,
      damageDisplay: `1d${damageDie}${modifier >= 0 ? "+" : ""}${modifier}`,
      note: [`${weapon.damage} урон.`, weapon.condition,
        martial ? "Условный режим: только без доспехов и щита, когда соблюдены требования Боевых искусств." : "",
      ].filter(Boolean).join(" ") };
  };
  const result = [make(weapon.ability || "str", die)];
  const monk = getClassLevel(character, "monk");
  // Dhampir uses a simple weapon and CON; do not silently replace its explicit ability rule.
  if (monk && !weapon.ability) {
    const martialDie = monk >= 17 ? 10 : monk >= 11 ? 8 : monk >= 5 ? 6 : 4;
    result.push(make(character.abilities.dex > character.abilities.str ? "dex" : "str", Math.max(die, martialDie), true));
  }
  return result;
}
