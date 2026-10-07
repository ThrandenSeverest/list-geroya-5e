import type { CatalogSpell } from "./catalog";
import type { AbilityScores, ExportCharacter } from "./exportFormats";
import { characterLevel } from "./multiclass";

export type RacialSpellAbility = keyof AbilityScores | "choice";
export type RacialSpellDefinition = {
  spellId?: string;
  choiceKey?: string;
  unlockLevel: number;
  freeUses?: number;
  recharge?: "short" | "long";
  castWithSlots?: boolean;
  freeCastLevel?: number;
  resourceGroup?: string;
  notes?: string;
};
export type RacialSpellcastingDefinition = {
  race: string;
  variants?: string[];
  source: string;
  ability: RacialSpellAbility;
  spells: RacialSpellDefinition[];
};
export type ResolvedRacialSpell = {
  spell: CatalogSpell;
  source: string;
  ability: keyof AbilityScores;
  saveDc: number;
  attackBonus: number;
  freeUses: number;
  remainingUses: number;
  recharge?: "short" | "long";
  castWithSlots: boolean;
  freeCastLevel?: number;
  resourceKey?: string;
  notes?: string;
};

const S = (spellId: string, unlockLevel = 1, extra: Partial<RacialSpellDefinition> = {}): RacialSpellDefinition => ({ spellId, unlockLevel, ...extra });
const once = (spellId: string, unlockLevel: number, castWithSlots: boolean, extra: Partial<RacialSpellDefinition> = {}) =>
  S(spellId, unlockLevel, { freeUses: 1, recharge: "long", castWithSlots, ...extra });
const choice = (choiceKey: string): RacialSpellDefinition => ({ choiceKey, unlockLevel: 1 });

/** One rules registry for every official race in the current race catalogue that grants spells. */
export const racialSpellcastingRegistry: RacialSpellcastingDefinition[] = [
  { race: "tiefling", source: "Инфернальное наследие", ability: "cha", spells: [S("thaumaturgy"), once("spell-doc-hellish_rebuke", 3, false, { freeCastLevel: 2 }), once("darkness", 5, false)] },
  { race: "elf", variants: ["high"], source: "Заговор высшего эльфа", ability: "int", spells: [choice("high-elf-cantrip")] },
  { race: "elf", variants: ["drow"], source: "Магия дроу", ability: "cha", spells: [S("spell-doc-dancing_lights"), once("faerie-fire", 3, false), once("darkness", 5, false)] },
  { race: "gnome", variants: ["forest"], source: "Природный иллюзионист", ability: "int", spells: [S("minorillusion")] },
  { race: "aasimar", variants: ["protector", "scourge", "fallen"], source: "Несущий свет", ability: "cha", spells: [S("light")] },
  { race: "aasimar", variants: ["multiverse", "motm-111", "base"], source: "Несущий свет", ability: "choice", spells: [S("light")] },
  { race: "aarakocra", variants: ["base", "motm-111"], source: "Зов ветра", ability: "choice", spells: [once("spell-doc-gust_of_wind", 3, true)] },
  { race: "deepgnome", variants: ["base", "motm-111"], source: "Дар свирфнеблина", ability: "choice", spells: [once("disguise-self", 3, true), once("nondetection", 5, true, { notes: "Накладывается на себя без материального компонента." })] },
  { race: "duergar", variants: ["base", "motm-111"], source: "Дуэргарская магия", ability: "choice", spells: [once("spell-doc-enlarge_reduce", 3, true, { notes: "Увеличение/уменьшение — только на себя." }), once("invisibility", 5, true, { notes: "Невидимость — только на себя." })] },
  { race: "duergar", variants: ["legacy-scag"], source: "Дуэргарская магия", ability: "int", spells: [once("spell-doc-enlarge_reduce", 3, false, { notes: "Только увеличение себя." }), once("invisibility", 5, false, { notes: "Только на себя." })] },
  { race: "fairy", source: "Фейская магия", ability: "choice", spells: [S("spell-doc-druidcraft"), once("faerie-fire", 3, true), once("spell-doc-enlarge_reduce", 5, true)] },
  { race: "firbolg", variants: ["base", "motm-111"], source: "Фирболгская магия", ability: "choice", spells: [once("detectmagic", 1, true), once("disguise-self", 1, true, { notes: "Можно казаться на три фута ниже." })] },
  { race: "firbolg", variants: ["legacy-vgm"], source: "Фирболгская магия", ability: "wis", spells: [once("detectmagic", 1, false, { recharge: "short", resourceGroup: "firbolg-magic" }), once("disguise-self", 1, false, { recharge: "short", resourceGroup: "firbolg-magic", notes: "Общий бесплатный заряд; можно казаться на три фута ниже." })] },
  { race: "genasi", variants: ["air"], source: "Слияние с ветром", ability: "con", spells: [once("levitate", 1, false)] },
  { race: "genasi", variants: ["earth"], source: "Слияние с камнем", ability: "con", spells: [once("pass", 1, false)] },
  { race: "genasi", variants: ["fire"], source: "Достичь пламени", ability: "con", spells: [S("produce-flame"), once("burning-hands", 3, false)] },
  { race: "genasi", variants: ["water"], source: "Зов волны", ability: "con", spells: [S("shape-water"), once("spell-doc-create_or_destroy_water", 3, false)] },
  { race: "genasi", variants: ["motm-air"], source: "Слияние с ветром", ability: "choice", spells: [S("shocking-grasp"), once("feather-fall", 3, true), once("levitate", 5, true)] },
  { race: "genasi", variants: ["motm-earth"], source: "Слияние с камнем", ability: "choice", spells: [S("spell-doc-blade_ward"), once("pass", 5, true)] },
  { race: "genasi", variants: ["motm-fire"], source: "Достичь пламени", ability: "choice", spells: [S("produce-flame"), once("burning-hands", 3, true), once("spell-doc-flame_blade", 5, true)] },
  { race: "genasi", variants: ["motm-water"], source: "Зов волны", ability: "choice", spells: [S("acid-splash"), once("spell-doc-create_or_destroy_water", 3, true), once("spell-doc-water_walk", 5, true, { notes: "Без материального компонента." })] },
  { race: "githyanki", variants: ["base", "motm-111"], source: "Псионика гитьянки", ability: "choice", spells: [S("mage-hand"), once("spell-doc-jump", 3, true), once("mistystep", 5, true)] },
  { race: "githyanki", variants: ["legacy-mtf"], source: "Псионика", ability: "int", spells: [S("mage-hand"), once("spell-doc-jump", 3, false), once("mistystep", 5, false)] },
  { race: "githzerai", variants: ["base", "motm-111"], source: "Псионика гитцерая", ability: "choice", spells: [S("mage-hand"), once("shield", 3, true), once("detect-thoughts", 5, true)] },
  { race: "githzerai", variants: ["legacy-mtf"], source: "Псионика", ability: "wis", spells: [S("mage-hand"), once("shield", 3, false), once("detect-thoughts", 5, false)] },
  { race: "kobold", variants: ["base", "motm-111"], source: "Драконий заговор", ability: "choice", spells: [choice("kobold-cantrip")] },
  { race: "triton", variants: ["base", "motm-111"], source: "Управление воздухом и водой", ability: "choice", spells: [once("fog-cloud", 1, true), once("spell-doc-gust_of_wind", 3, true), once("spell-doc-water_walk", 5, true)] },
  { race: "triton", variants: ["legacy-vgm"], source: "Управление воздухом и водой", ability: "cha", spells: [once("fog-cloud", 1, false, { resourceGroup: "triton-magic" }), once("spell-doc-gust_of_wind", 3, false, { resourceGroup: "triton-magic" }), once("spell-doc-water_walk", 5, false, { resourceGroup: "triton-magic" })] },
  { race: "yuanpure", variants: ["base", "motm-111"], source: "Змеиное колдовство", ability: "choice", spells: [S("spell-doc-poison_spray"), S("spell-doc-animal_friendship", 1, { notes: "Неограниченно, но только на змей." }), once("suggestion", 3, true)] },
  { race: "yuanpure", variants: ["legacy-vgm"], source: "Врождённое колдовство", ability: "cha", spells: [S("spell-doc-poison_spray"), S("spell-doc-animal_friendship", 1, { notes: "Неограниченно, но только на змей." }), once("suggestion", 3, false)] },
  { race: "hexblood", source: "Ведьмовская магия", ability: "choice", spells: [once("disguise-self", 1, true), once("hex", 1, true)] },
  { race: "astralelf", source: "Врождённый свет", ability: "choice", spells: [S("light")] },
];

const abilityKeys: (keyof AbilityScores)[] = ["int", "wis", "cha"];
export function racialSpellAbility(character: ExportCharacter, definition: RacialSpellcastingDefinition): keyof AbilityScores {
  if (definition.ability !== "choice") return definition.ability;
  const saved = character.raceChoices?.["spellcasting-ability"]?.[0] as keyof AbilityScores | undefined;
  if (saved && abilityKeys.includes(saved)) return saved;
  return abilityKeys.reduce((best, key) => character.abilities[key] > character.abilities[best] ? key : best, "int");
}

export function racialSpellDefinitions(character: ExportCharacter) {
  const variant = character.raceVariant || "base";
  return racialSpellcastingRegistry.filter(entry => entry.race === character.race && (!entry.variants || entry.variants.includes(variant)));
}

export function resolvedRacialSpells(character: ExportCharacter, catalog: CatalogSpell[]): ResolvedRacialSpell[] {
  const byId = new Map(catalog.map(spell => [spell.id, spell]));
  const level = characterLevel(character);
  const proficiency = 2 + Math.floor((Math.max(1, level) - 1) / 4);
  return racialSpellDefinitions(character).flatMap(definition => {
    const ability = racialSpellAbility(character, definition);
    const modifier = Math.floor((character.abilities[ability] - 10) / 2);
    return definition.spells.flatMap(entry => {
      if (entry.unlockLevel > level) return [];
      const spellId = entry.spellId || character.raceChoices?.[entry.choiceKey || ""]?.[0];
      const spell = spellId ? byId.get(spellId) : undefined;
      if (!spell) return [];
      const resourceKey = entry.freeUses ? `racial-spell:${character.race}:${entry.resourceGroup || spell.id}` : undefined;
      const freeUses = entry.freeUses || 0;
      return [{ spell, source: definition.source, ability, saveDc: 8 + proficiency + modifier,
        attackBonus: proficiency + modifier, freeUses,
        remainingUses: Math.max(0, freeUses - (resourceKey ? character.resourceSpent?.[resourceKey] || 0 : 0)),
        recharge: entry.recharge, castWithSlots: !!entry.castWithSlots, freeCastLevel: entry.freeCastLevel,
        resourceKey, notes: entry.notes }];
    });
  });
}

export function racialSpellChoiceOptions(character: ExportCharacter, catalog: CatalogSpell[]) {
  return racialSpellDefinitions(character).flatMap(definition => definition.spells.flatMap(entry => {
    if (!entry.choiceKey) return [];
    const classId = entry.choiceKey === "high-elf-cantrip" ? "wizard" : undefined;
    const options = catalog.filter(spell => spell.level === 0 && (!classId || spell.classes.includes(classId)));
    return [{ key: entry.choiceKey, title: entry.choiceKey === "high-elf-cantrip" ? "Заговор высшего эльфа" : "Драконий заговор", options }];
  }));
}
