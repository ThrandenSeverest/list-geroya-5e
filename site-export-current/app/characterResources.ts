import type { ExportCharacter } from "./exportFormats";

export type CharacterResource = {
  key: string;
  name: string;
  max: number;
  die?: string;
  isShortRest: boolean;
  isLongRest: boolean;
};

function rageMaximum(level: number) {
  if (level >= 17) return 6;
  if (level >= 12) return 5;
  if (level >= 6) return 4;
  if (level >= 3) return 3;
  return 2;
}

const add = (list: CharacterResource[], condition: boolean, resource: CharacterResource) => condition && list.push(resource);

export function characterResources(character: ExportCharacter) {
  const resources: CharacterResource[] = [];
  const level = character.level;
  const pb = 2 + Math.floor((Math.max(1, level) - 1) / 4);
  const ability = (key: keyof ExportCharacter["abilities"]) => Math.max(1, Math.floor((character.abilities[key] - 10) / 2));
  const subclass = character.subclass || "";

  add(resources, character.className === "barbarian", { key: "rage", name: "Ярость", max: rageMaximum(level), isShortRest: false, isLongRest: true });
  add(resources, character.className === "bard", { key: "bardic-inspiration", name: "Вдохновение барда", max: ability("cha"), die: level >= 15 ? "к12" : level >= 10 ? "к10" : level >= 5 ? "к8" : "к6", isShortRest: level >= 5, isLongRest: true });
  add(resources, character.className === "cleric" && level >= 2, { key: "channel-divinity", name: "Божественный канал", max: level >= 18 ? 3 : level >= 6 ? 2 : 1, isShortRest: true, isLongRest: true });
  add(resources, character.className === "druid" && level >= 2, { key: "wild-shape", name: "Дикий облик", max: 2, isShortRest: true, isLongRest: true });

  add(resources, character.className === "fighter", { key: "second-wind", name: "Второе дыхание", max: 1, isShortRest: true, isLongRest: true });
  add(resources, character.className === "fighter" && level >= 2, { key: "action-surge", name: "Всплеск действий", max: level >= 17 ? 2 : 1, isShortRest: true, isLongRest: true });
  add(resources, character.className === "fighter" && level >= 9, { key: "indomitable", name: "Упорный", max: level >= 17 ? 3 : level >= 13 ? 2 : 1, isShortRest: false, isLongRest: true });
  add(resources, character.className === "fighter" && subclass === "battlemaster" && level >= 3, { key: "superiority-dice", name: "Кости превосходства", max: level >= 15 ? 6 : level >= 7 ? 5 : 4, die: level >= 18 ? "к12" : level >= 10 ? "к10" : "к8", isShortRest: true, isLongRest: true });
  add(resources, character.className === "fighter" && subclass === "arcanearcher" && level >= 3, { key: "arcane-shot", name: "Магический выстрел", max: 2, isShortRest: true, isLongRest: true });
  add(resources, character.className === "fighter" && subclass === "runeknight" && level >= 3, { key: "giants-might", name: "Мощь великана", max: pb, isShortRest: false, isLongRest: true });
  add(resources, character.className === "fighter" && subclass === "samurai" && level >= 3, { key: "fighting-spirit", name: "Боевой дух", max: 3, isShortRest: false, isLongRest: true });

  add(resources, character.className === "monk" && level >= 2, { key: "ki", name: "Ци", max: level, isShortRest: true, isLongRest: true });
  add(resources, character.className === "paladin", { key: "lay-on-hands", name: "Наложение рук", max: level * 5, isShortRest: false, isLongRest: true });
  add(resources, character.className === "paladin" && level >= 3, { key: "channel-divinity", name: "Божественный канал", max: 1, isShortRest: true, isLongRest: true });
  add(resources, character.className === "ranger" && character.useTasha, { key: "favored-foe", name: "Избранный враг", max: pb, isShortRest: false, isLongRest: true });
  add(resources, character.className === "sorcerer" && level >= 2, { key: "sorcery-points", name: "Очки чародейства", max: level, isShortRest: false, isLongRest: true });
  add(resources, character.className === "wizard", { key: "arcane-recovery", name: "Восстановление магии", max: 1, isShortRest: false, isLongRest: true });
  add(resources, character.className === "artificer" && level >= 7, { key: "flash-of-genius", name: "Вспышка гениальности", max: ability("int"), isShortRest: false, isLongRest: true });

  return resources;
}

export function resourceSpent(character: ExportCharacter, resource: CharacterResource) {
  return Math.max(0, Math.min(resource.max, character.resourceSpent?.[resource.key] || 0));
}

export function resourceCurrent(character: ExportCharacter, resource: CharacterResource) {
  return resource.max - resourceSpent(character, resource);
}
