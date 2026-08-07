import { backgrounds, classes, races, spells } from "./catalog";
import { backgroundRule } from "./backgroundRules";
import { helpmateClassIds, helpmateSubclassClassIds, type ExportCharacter } from "./exportFormats";
import { helpmateSpellIds } from "./exportIds";
import { skillKeys } from "./rules";

export type CharacterFileSource = "native" | "long-story-short" | "helpmate";

export type CharacterImportResult = {
  character: ExportCharacter;
  source: CharacterFileSource;
  warnings: string[];
};

export function createNativeCharacterFile(character: ExportCharacter) {
  return {
    format: "list-geroya-5e",
    version: 1,
    exportedAt: new Date().toISOString(),
    character,
  };
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalized(value: unknown) {
  return text(value).toLocaleLowerCase("ru").replace(/ё/g, "е").replace(/[^a-zа-я0-9]+/gi, " ").trim();
}

function valueOf(value: unknown): unknown {
  if (value && typeof value === "object" && "value" in value) return (value as { value: unknown }).value;
  return value;
}

function matchCatalog(value: unknown, options: Array<{ id: string; name: string }>) {
  const target = normalized(value).split(/\s+(?:и|and)\s+/)[0];
  return options.find(option => {
    const name = normalized(option.name);
    return target === name || target.startsWith(`${name} `) || name.startsWith(`${target} `);
  })?.id || "";
}

function collectText(node: unknown): string[] {
  if (typeof node === "string") return [node];
  if (Array.isArray(node)) return node.flatMap(collectText);
  if (!node || typeof node !== "object") return [];
  return Object.values(node as Record<string, unknown>).flatMap(collectText);
}

function spellIdsFromLss(inner: Record<string, unknown>) {
  const textBlocks = (inner.text || {}) as Record<string, unknown>;
  const names = Object.entries(textBlocks)
    .filter(([key]) => key.startsWith("spells-level-"))
    .flatMap(([, block]) => collectText(block).map(normalized));
  return spells.filter(spell => names.includes(normalized(spell.name))).map(spell => spell.id);
}

function importLss(payload: Record<string, unknown>, empty: ExportCharacter): CharacterImportResult {
  const raw = typeof payload.data === "string" ? JSON.parse(payload.data) : payload.data;
  if (!raw || typeof raw !== "object") throw new Error("В файле Long Story Short отсутствует блок data.");
  const inner = raw as Record<string, unknown>;
  const info = (inner.info || {}) as Record<string, unknown>;
  const stats = (inner.stats || {}) as Record<string, unknown>;
  const skillData = (inner.skills || {}) as Record<string, { isProf?: boolean | number }>;
  const lssToRussian = Object.fromEntries(Object.entries(skillKeys).map(([ru, data]) => [data.key, ru]));
  const selectedSkills = Object.entries(skillData).filter(([, data]) => Boolean(data?.isProf)).map(([key]) => lssToRussian[key]).filter(Boolean);
  const className = matchCatalog(valueOf(info.charClass), classes);
  const raceName = text(valueOf(info.race)).split(/[·—]/)[0];
  const race = matchCatalog(raceName, races);
  const background = matchCatalog(valueOf(info.background), backgrounds);
  const fixedBackgroundSkills = backgroundRule(background, backgrounds.find(item => item.id === background)).skills;
  const level = Math.max(1, Math.min(20, Number(valueOf(info.level)) || 1));
  const spellSlotsUsed = Array.from({ length: 9 }, (_, circle) => {
    const prefix = `level-${circle + 1}-slot-`;
    return Object.entries((inner.spells || {}) as Record<string, { isChecked?: boolean }>)
      .filter(([key, slot]) => key.startsWith(prefix) && slot?.isChecked).length;
  });
  const abilities = { ...empty.abilities };
  for (const key of Object.keys(abilities) as Array<keyof typeof abilities>) {
    const score = Number((stats[key] as { score?: number } | undefined)?.score);
    if (Number.isFinite(score)) abilities[key] = score;
  }
  const importedSpells = spellIdsFromLss(inner);
  const warnings = [
    "Long Story Short не хранит переносимые публичные ID карточек заклинаний; восстановлены только заклинания, найденные в текстовых блоках.",
    "Выборы снаряжения, черт и вложенных классовых вариантов восстановить однозначно нельзя — проверьте соответствующие шаги мастера.",
  ];
  return {
    source: "long-story-short",
    warnings,
    character: {
      ...empty,
      name: text(valueOf(inner.name)) || text(inner.hiddenName),
      playerName: text(valueOf(info.playerName)),
      alignment: text(valueOf(info.alignment)),
      className,
      race,
      raceVariant: race ? "base" : "",
      background,
      backgroundSkills: fixedBackgroundSkills,
      classSkills: selectedSkills.filter(skill => !fixedBackgroundSkills.includes(skill)),
      level,
      abilities,
      spells: importedSpells,
      preparedSpells: importedSpells.filter(id => (spells.find(spell => spell.id === id)?.level || 0) > 0),
      spellSlotsUsed,
      personality: {
        traits: collectText((inner.text as Record<string, unknown> | undefined)?.personality).join(" ").trim(),
        ideals: collectText((inner.text as Record<string, unknown> | undefined)?.ideals).join(" ").trim(),
        bonds: collectText((inner.text as Record<string, unknown> | undefined)?.bonds).join(" ").trim(),
        flaws: collectText((inner.text as Record<string, unknown> | undefined)?.flaws).join(" ").trim(),
      },
    },
  };
}

const helpmateSkills: Record<string, string[]> = {
  STR: ["Атлетика"],
  DEX: ["Акробатика", "Ловкость рук", "Скрытность"],
  CON: [],
  INT: ["Магия", "История", "Расследование", "Природа", "Религия"],
  WIS: ["Уход за животными", "Проницательность", "Медицина", "Внимательность", "Выживание"],
  CHA: ["Обман", "Запугивание", "Выступление", "Убеждение"],
};

function importHelpmate(payload: Record<string, unknown>, empty: ExportCharacter): CharacterImportResult {
  const classEntry = Array.isArray(payload.Classes) ? payload.Classes[0] as Record<string, unknown> | undefined : undefined;
  if (!classEntry) throw new Error("В файле Helpmate не найден класс персонажа.");
  const classId = text(classEntry.Id);
  let className = Object.entries(helpmateClassIds).find(([, id]) => id === classId)?.[0] || "";
  let subclass = "";
  for (const [candidateClass, subclasses] of Object.entries(helpmateSubclassClassIds)) {
    const found = Object.entries(subclasses).find(([, id]) => id === classId);
    if (found) [className, subclass] = [candidateClass, found[0]];
  }
  const raceLabel = text(payload.UserRace).split(/[·—]/)[0];
  const race = matchCatalog(raceLabel, races);
  const parameters = Array.isArray(payload.Parameters) ? payload.Parameters as Array<Record<string, unknown>> : [];
  const abilityKey: Record<string, keyof ExportCharacter["abilities"]> = { STR: "str", DEX: "dex", CON: "con", INT: "int", WIS: "wis", CHA: "cha" };
  const abilities = { ...empty.abilities };
  const importedSkills: string[] = [];
  for (const parameter of parameters) {
    const name = text(parameter.Name).toUpperCase();
    const key = abilityKey[name];
    if (key) abilities[key] = Number(parameter.Value) || abilities[key];
    const abilitySkills = helpmateSkills[name] || [];
    const entries = Array.isArray(parameter.Abilities) ? parameter.Abilities as Array<{ Proficiency?: boolean }> : [];
    entries.forEach((entry, index) => { if (entry?.Proficiency && abilitySkills[index]) importedSkills.push(abilitySkills[index]); });
  }
  const reverseSpellIds = Object.fromEntries(Object.entries(helpmateSpellIds).map(([id, external]) => [external, id]));
  const importedSpells = (Array.isArray(payload.Spells) ? payload.Spells : []).map(value => reverseSpellIds[String(value)]).filter(Boolean);
  const level = Math.max(1, Math.min(20, Number(classEntry.Level) || 1));
  const cells = Array.isArray(classEntry.SpellCells) ? classEntry.SpellCells as Array<Record<string, unknown>> : [];
  const spellSlotsUsed = Array.from({ length: 9 }, (_, index) => {
    const cell = cells.find(item => Number(item.Level) === index + 1);
    return cell ? Math.max(0, Number(cell.Max) - Number(cell.Left)) : 0;
  });
  return {
    source: "helpmate",
    warnings: [
      "Экспериментальный импорт Helpmate восстанавливает базовые характеристики, класс, уровень, владения навыками, заклинания и ячейки.",
      "Предыстория, конкретные классовые выборы, снаряжение и характер в формате Helpmate не имеют достаточной структуры — проверьте их вручную.",
    ],
    character: {
      ...empty,
      name: text(payload.SecondName),
      race,
      raceVariant: race ? "base" : "",
      className,
      subclass,
      level,
      abilities,
      classSkills: importedSkills,
      spells: importedSpells,
      preparedSpells: importedSpells.filter(id => (spells.find(spell => spell.id === id)?.level || 0) > 0),
      spellSlotsUsed,
    },
  };
}

export function parseCharacterFile(payload: unknown, empty: ExportCharacter): CharacterImportResult {
  if (!payload || typeof payload !== "object") throw new Error("JSON не содержит объект персонажа.");
  const value = payload as Record<string, unknown>;
  if (value.format === "list-geroya-5e" && value.version === 1 && value.character && typeof value.character === "object") {
    return { source: "native", warnings: [], character: { ...empty, ...(value.character as ExportCharacter) } };
  }
  if (value.jsonType === "character" && (typeof value.data === "string" || typeof value.data === "object")) return importLss(value, empty);
  if (Array.isArray(value.Classes) && Array.isArray(value.Parameters)) return importHelpmate(value, empty);
  throw new Error("Формат не распознан. Поддерживаются файлы «Листа Героя 5e», Long Story Short и Helpmate.");
}
