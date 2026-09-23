import type { ExportCharacter } from "./exportFormats";
import { selectedEquipment } from "./equipment";
import { getClassLevel } from "./multiclass";

export type SpeedBreakdown = {
  walk: number;
  swim?: number;
  climb?: number;
  fly?: number;
  sources: string[];
  conditions: string[];
};

const baseSpeeds: Record<string, number> = {
  dwarf: 25, duergar: 25, halfling: 25, gnome: 25, deepgnome: 25,
  grung: 25, locathah: 30, centaur: 40, satyr: 35, leonin: 35,
  dhampir: 35,
};

function equipment(character: ExportCharacter) {
  return character.inventoryOverride === undefined
    ? selectedEquipment(character)
    : character.inventoryOverride.split(/\n|\s*·\s*/).map(item => item.trim()).filter(Boolean);
}

/** Permanent walking speed and separately available movement modes (feet). */
export function speedBreakdown(character: ExportCharacter): SpeedBreakdown {
  const race = character.race;
  const variant = character.raceVariant;
  const items = equipment(character);
  const armored = items.some(item => /полулаты|латы|наборн(?:ый|ая) доспех|кольчуга|кольчат(?:ый|ая) доспех|нагрудник|чешуйчат|кольчужн(?:ая|ый) рубах|шкурн(?:ый|ая) доспех|прокл[её]панн(?:ая|ый) кож|кожан(?:ый|ая) доспех/i.test(item));
  const heavy = items.find(item => /(?:^|\s)латы(?:$|\s|\()|наборн(?:ый|ая) доспех|кольчуга|кольчат(?:ый|ая) доспех/i.test(item));
  const medium = items.some(item => /полулаты|нагрудник|чешуйчат|кольчужн(?:ая|ый) рубах|шкурн(?:ый|ая) доспех/i.test(item));
  const shield = items.some(item => /(?:^|\s)(?:деревянный\s+)?щит(?:$|\s|\()/i.test(item));
  const base = race === "elf" && variant === "wood" || race === "genasi" && variant === "motm-air" ? 35
    : race === "aarakocra" && variant === "legacy-ee" ? 25
    : race === "duergar" && !variant.startsWith("legacy") || race === "deepgnome" && !variant.startsWith("legacy") ? 30
    : baseSpeeds[race] ?? 30;
  const sources = [`${race}${variant ? ` (${variant})` : ""}: ${base}`];
  const conditions: string[] = [];
  let walk = base;
  const feats = new Set([...(character.feats || []), ...(character.advancements || []).map(choice => choice.featId)]);
  if (feats.has("mobile")) { walk += 10; sources.push("Подвижный +10"); }
  if (getClassLevel(character, "barbarian") >= 5) {
    if (!heavy) { walk += 10; sources.push("Быстрое передвижение варвара +10"); }
    else conditions.push("Быстрое передвижение варвара не действует в тяжёлом доспехе");
  }
  const monk = getClassLevel(character, "monk");
  if (monk >= 2) {
    const bonus = monk >= 18 ? 30 : monk >= 14 ? 25 : monk >= 10 ? 20 : monk >= 6 ? 15 : 10;
    if (!armored && !shield) { walk += bonus; sources.push(`Движение без доспехов монаха +${bonus}`); }
    else conditions.push("Движение монаха не действует с доспехом или щитом");
  }
  // Dwarves retain their speed regardless of the Strength requirement.
  const requiredStrength = heavy && /(?:^|\s)латы(?:$|\s|\()|наборн(?:ый|ая) доспех/i.test(heavy) ? 15
    : heavy && /кольчуга/i.test(heavy) ? 13 : 0;
  if (requiredStrength && race !== "dwarf" && race !== "duergar" && character.abilities.str < requiredStrength) {
    walk -= 10;
    sources.push(`Тяжёлый доспех (Сила ${requiredStrength}) −10`);
  }
  const result: SpeedBreakdown = { walk: Math.max(0, walk), sources, conditions };
  const followsWalk = (kind: "swim" | "climb" | "fly") => { result[kind] = result.walk; };
  if (race === "genasi" && (variant === "water" || variant === "motm-water") ||
      ["triton", "seafelf"].includes(race) || race === "locathah") {
    result.swim = variant === "motm-water" || variant === "base" && race === "triton" || race === "seafelf" && !variant.startsWith("legacy") ? walk : 30;
  }
  if (race === "tabaxi") variant.startsWith("legacy") ? result.climb = 20 : followsWalk("climb");
  if (race === "dhampir") result.climb = walk;
  if (race === "hadozee") result.climb = walk;
  if (race === "grung") result.climb = 25;
  if (race === "aarakocra" || race === "fairy" || race === "owlin") {
    if (heavy || medium) conditions.push("Полёт недоступен в среднем или тяжёлом доспехе");
    else result.fly = race === "aarakocra" && variant === "legacy-ee" ? 50 : walk;
  }
  if (race === "aasimar" && ["protector", "multiverse", "motm-111"].includes(variant))
    conditions.push("Сияющая душа: полёт доступен только при активации преображения");
  if (race === "shifter" && ["swiftstride", "motm-swiftstride"].includes(variant))
    conditions.push("Смена быстронога: +10 к скорости только во время Смены");
  if (race === "tabaxi") conditions.push("Кошачья ловкость: удвоение скорости только при активации");
  return result;
}
