import { backgrounds, classes, races, spells } from "./catalog";
import { backgroundRule } from "./backgroundRules";
import { helpmateClassIds, helpmateSubclassClassIds, type AbilityScores, type AdvancementChoice, type ExportCharacter } from "./exportFormats";
import { helpmateSpellIds, spellIdFromDndUrl, spellIdFromLssCardId } from "./exportIds";
import { asiLevelsForClass, feats, pointBuySpent, selectedRaceVariant, variantsFor } from "./characterRules";
import { normalizeImportedSkills, skillNameFromExternalId } from "./skillIds";

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
  const values = Object.entries(textBlocks)
    .filter(([key]) => key.startsWith("spells-level-"))
    .flatMap(([, block]) => collectText(block));
  const names = values.map(normalized);
  const linked = values.map(spellIdFromDndUrl).filter(Boolean) as string[];
  return [...new Set([...spells.filter(spell => names.includes(normalized(spell.name))).map(spell => spell.id), ...linked])];
}

type LssCard = { id: string; name: string; url: string };

function lssCards(value: unknown): LssCard[] {
  if (!Array.isArray(value)) return [];
  return value.map(item => {
    if (typeof item === "string") return { id: text(item), name: "", url: spellIdFromDndUrl(item) ? item : "" };
    if (!item || typeof item !== "object") return { id: "", name: "", url: "" };
    const card = item as Record<string, unknown>;
    const nestedSpell = card.spell && typeof card.spell === "object" ? card.spell as Record<string, unknown> : {};
    const url = collectText(item).find(value => Boolean(spellIdFromDndUrl(value))) || "";
    return {
      id: text(card._id) || text(card.id) || text(nestedSpell._id) || text(nestedSpell.id),
      name: text(card.name) || text(card.title) || text(nestedSpell.name) || text(nestedSpell.title),
      url,
    };
  }).filter(card => /^[0-9a-f]{24}$/i.test(card.id) || Boolean(card.name) || Boolean(card.url));
}

function resolveLssCard(card: LssCard) {
  return spellIdFromDndUrl(card.url) || matchCatalog(card.name, spells) || spellIdFromLssCardId(card.id) || "";
}

function resolveLssCards(cards: LssCard[]) {
  return Object.fromEntries(cards.flatMap(card => {
    const spellId = resolveLssCard(card);
    return spellId && /^[0-9a-f]{24}$/i.test(card.id) ? [[card.id, spellId]] : [];
  }));
}

const abilityKeys = ["str", "dex", "con", "int", "wis", "cha"] as const;
type AbilityKey = typeof abilityKeys[number];

function classExpertiseLimit(className: string, level: number) {
  if (className === "bard") return level >= 10 ? 4 : level >= 3 ? 2 : 0;
  if (className === "rogue") return level >= 6 ? 4 : level >= 1 ? 2 : 0;
  return 0;
}

function advancementSlots(race: string, raceVariant: string, className: string, level: number) {
  return [
    ...((race === "human" && raceVariant === "variant") || race === "customlineage" ? [{ key: "origin-1", level: 1, origin: true }] : []),
    ...asiLevelsForClass(className).filter(value => value <= level).map(value => ({ key: `class-${value}`, level: value, origin: false })),
  ];
}

function distinctAbilityChoices(count: number, excluded: AbilityKey[] = []) {
  const available = abilityKeys.filter(key => !excluded.includes(key));
  const result: AbilityKey[][] = [];
  const visit = (chosen: AbilityKey[]) => {
    if (chosen.length === count) return void result.push(chosen);
    for (const key of available) if (!chosen.includes(key)) visit([...chosen, key]);
  };
  visit([]);
  return result.length ? result : [[]];
}

function halfFeatOptions(featId: string): AbilityKey[] | null {
  if (featId === "actor") return ["cha"];
  if (featId === "durable") return ["con"];
  if (["athlete"].includes(featId)) return ["str", "dex"];
  if (featId === "observant") return ["int", "wis"];
  if (["fey-touched", "shadow-touched", "telekinetic"].includes(featId)) return ["int", "wis", "cha"];
  if (["resilient", "skill-expert"].includes(featId)) return [...abilityKeys];
  return null;
}

function halfFeatAssignments(featIds: string[]) {
  const indexed = featIds.map((featId, index) => ({ index, options: halfFeatOptions(featId) })).filter(item => item.options) as Array<{ index: number; options: AbilityKey[] }>;
  const results: Array<Record<number, AbilityKey>> = [];
  const visit = (at: number, value: Record<number, AbilityKey>) => {
    if (at === indexed.length) return void results.push(value);
    const item = indexed[at];
    for (const key of item.options) visit(at + 1, { ...value, [item.index]: key });
  };
  visit(0, {});
  return results.length ? results : [{}];
}

type InferredBuild = {
  abilities: AbilityScores;
  raceVariant: string;
  raceAbilityChoices: AbilityKey[];
  advancements: AdvancementChoice[];
  asiCount: number;
  exact: boolean;
};

function inferBuild(finalScores: AbilityScores, race: string, rawRaceLabel: string, className: string, level: number, featIds: string[], skillExpertSkill = ""): InferredBuild {
  const normalizedRace = normalized(rawRaceLabel);
  const raceOptions = variantsFor(race);
  const explicitVariant = raceOptions.find(variant => normalizedRace.includes(normalized(variant.name)));
  const variantIds = explicitVariant ? [explicitVariant.id] : raceOptions.length ? raceOptions.map(variant => variant.id) : [race ? "base" : ""];
  let best: (InferredBuild & { score: number }) | null = null;

  for (const raceVariant of variantIds) {
    const variant = selectedRaceVariant(race, raceVariant);
    const raceChoices = variant?.chooseBonuses
      ? distinctAbilityChoices(variant.chooseBonuses.count, variant.chooseBonuses.exclude || [])
      : [[]];
    const slots = advancementSlots(race, raceVariant, className, level);
    if (featIds.length > slots.length) continue;

    for (const choices of raceChoices) {
      const raceBonus = Object.fromEntries(abilityKeys.map(key => [key, variant?.bonuses?.[key] || 0])) as AbilityScores;
      choices.forEach((key, index) => { raceBonus[key] += variant?.chooseBonuses?.amounts?.[index] ?? variant?.chooseBonuses?.amount ?? 0; });
      const afterRace = Object.fromEntries(abilityKeys.map(key => [key, finalScores[key] - raceBonus[key]])) as AbilityScores;

      for (const halfAssignments of halfFeatAssignments(featIds)) {
        const halfBonus = Object.fromEntries(abilityKeys.map(key => [key, 0])) as AbilityScores;
        for (const key of Object.values(halfAssignments)) halfBonus[key] += 1;
        if (abilityKeys.some(key => afterRace[key] - halfBonus[key] < 8)) continue;

        let states = new Map<string, { abilities: Partial<AbilityScores>; cost: number; diff: number }>();
        states.set("0:0", { abilities: {}, cost: 0, diff: 0 });
        for (const key of abilityKeys) {
          const next = new Map<string, { abilities: Partial<AbilityScores>; cost: number; diff: number }>();
          const maximum = Math.min(15, afterRace[key] - halfBonus[key]);
          for (const state of states.values()) for (let base = 8; base <= maximum; base += 1) {
            const cost = state.cost + (base <= 15 ? ({ 8:0, 9:1, 10:2, 11:3, 12:4, 13:5, 14:7, 15:9 } as Record<number, number>)[base] : 0);
            if (cost > 27) continue;
            const diff = state.diff + afterRace[key] - halfBonus[key] - base;
            const stateKey = `${cost}:${diff}`;
            if (!next.has(stateKey)) next.set(stateKey, { abilities: { ...state.abilities, [key]: base }, cost, diff });
          }
          states = next;
        }

        for (const state of states.values()) {
          if (state.diff % 2) continue;
          const asiCount = state.diff / 2;
          if (featIds.length + asiCount > slots.length) continue;
          const abilities = state.abilities as AbilityScores;
          if (pointBuySpent(abilities) > 27) continue;
          const asiChoices = abilityKeys.flatMap(key => Array.from({ length: afterRace[key] - halfBonus[key] - abilities[key] }, () => key));
          const advancements: AdvancementChoice[] = [];
          featIds.forEach((featId, index) => {
            const ability = halfAssignments[index];
            const featChoices: Record<string, string[]> = {};
            if (ability && !["actor", "durable"].includes(featId)) featChoices.ability = [ability];
            if (featId === "skill-expert" && skillExpertSkill) {
              featChoices.skill = [skillExpertSkill];
              featChoices.expertise = [skillExpertSkill];
            }
            advancements.push({ ...slots[advancements.length], featId, asiChoices: [], featChoices });
          });
          for (let index = 0; index < asiChoices.length; index += 2) {
            advancements.push({ ...slots[advancements.length], featId: "asi", asiChoices: asiChoices.slice(index, index + 2) });
          }
          const score = (explicitVariant ? 1_000_000 : 0) + state.cost * 1_000 - asiCount * 10 - advancements.length;
          if (!best || score > best.score) best = { abilities, raceVariant, raceAbilityChoices: choices, advancements, asiCount, exact: true, score };
        }
      }
    }
  }

  if (best) return best;
  return { abilities: { ...finalScores }, raceVariant: explicitVariant?.id || (variantIds[0] || ""), raceAbilityChoices: [], advancements: [], asiCount: 0, exact: false };
}

function importLss(payload: Record<string, unknown>, empty: ExportCharacter): CharacterImportResult {
  const raw = typeof payload.data === "string" ? JSON.parse(payload.data) : payload.data;
  if (!raw || typeof raw !== "object") throw new Error("В файле Long Story Short отсутствует блок data.");
  const inner = raw as Record<string, unknown>;
  const info = (inner.info || {}) as Record<string, unknown>;
  const stats = (inner.stats || {}) as Record<string, unknown>;
  const skillData = (inner.skills || {}) as Record<string, { isProf?: boolean | number }>;
  const selectedSkills = Object.entries(skillData)
    .filter(([, data]) => Number(data?.isProf || 0) >= 1)
    .map(([key]) => skillNameFromExternalId(key))
    .filter(Boolean);
  const expertiseSkills = Object.entries(skillData)
    .filter(([, data]) => Number(data?.isProf || 0) >= 2)
    .map(([key]) => skillNameFromExternalId(key))
    .filter(Boolean);
  const className = matchCatalog(valueOf(info.charClass), classes);
  const rawRaceLabel = text(valueOf(info.race));
  const raceName = rawRaceLabel.split(/[·—]/)[0];
  const race = matchCatalog(raceName, races);
  const background = matchCatalog(valueOf(info.background), backgrounds);
  const fixedBackgroundSkills = backgroundRule(background, backgrounds.find(item => item.id === background)).skills;
  const level = Math.max(1, Math.min(20, Number(valueOf(info.level)) || 1));
  const spellSlotsUsed = Array.from({ length: 9 }, (_, circle) => {
    const prefix = `level-${circle + 1}-slot-`;
    return Object.entries((inner.spells || {}) as Record<string, { isChecked?: boolean }>)
      .filter(([key, slot]) => key.startsWith(prefix) && slot?.isChecked).length;
  });
  const finalAbilities = { ...empty.abilities };
  for (const key of Object.keys(finalAbilities) as Array<keyof typeof finalAbilities>) {
    const score = Number((stats[key] as { score?: number } | undefined)?.score);
    if (Number.isFinite(score)) finalAbilities[key] = score;
  }
  const allLssText = normalized(collectText(inner.text || {}).join(" "));
  const importedFeatIds = feats
    .filter(feat => feat.id !== "asi" && ` ${allLssText} `.includes(` ${normalized(feat.name)} `))
    .map(feat => feat.id);
  const nativeExpertiseCount = classExpertiseLimit(className, level);
  const classExpertise = expertiseSkills.slice(0, nativeExpertiseCount);
  const featExpertise = expertiseSkills.slice(nativeExpertiseCount);
  if (featExpertise.length && !importedFeatIds.includes("skill-expert")) importedFeatIds.push("skill-expert");
  const inferredBuild = inferBuild(finalAbilities, race, rawRaceLabel, className, level, [...new Set(importedFeatIds)], featExpertise[0] || "");
  const textSpells = spellIdsFromLss(inner);
  const outerSpells = payload.spells && typeof payload.spells === "object"
    ? payload.spells as Record<string, unknown>
    : {};
  const preparedCardEntries = lssCards(outerSpells.prepared);
  const bookCardEntries = lssCards(outerSpells.book);
  const preparedCards = preparedCardEntries.map(card => card.id).filter(id => /^[0-9a-f]{24}$/i.test(id));
  const bookCards = bookCardEntries.map(card => card.id).filter(id => /^[0-9a-f]{24}$/i.test(id));
  const resolvedCards = resolveLssCards([...preparedCardEntries, ...bookCardEntries]);
  const resolvedSpellIds = [...preparedCardEntries, ...bookCardEntries].map(resolveLssCard).filter(Boolean);
  const importedSpells = [...new Set([...textSpells, ...resolvedSpellIds])];
  const resolvedPreparedSpellIds = preparedCardEntries.map(resolveLssCard).filter(Boolean);
  const hasCardSpells = preparedCards.length > 0 || bookCards.length > 0;
  const unresolvedCount = [...new Set([...preparedCards, ...bookCards])].filter(id => !resolvedCards[id]).length;
  const warnings = [
    hasCardSpells
      ? unresolvedCount
        ? `Автоматически восстановлено ${new Set(resolvedSpellIds).size} заклинаний по ссылкам dnd.su, названиям и проверенному кэшу LSS. ${unresolvedCount} закрытых ID не содержат ссылки в экспортном файле; они сохранены без ручного сопоставления и не потеряются при обратном экспорте.`
        : `Все ${preparedCards.length + bookCards.length} карточек Long Story Short автоматически сопоставлены по dnd.su и восстановлены в выбранные заклинания; исходные ID сохранены для обратного экспорта.`
      : "Восстановлены заклинания, найденные в переносимых текстовых блоках Long Story Short.",
    expertiseSkills.length ? `Восстановлена компетентность: ${expertiseSkills.join(", ")}. Уровень ${level} учтён при распределении классовых выборов${featExpertise.length ? " и черты «Эксперт в навыке»" : ""}.` : "",
    inferredBuild.asiCount ? `Итоговые характеристики разложены на допустимый Point Buy и ${inferredBuild.asiCount} повыш. характеристик по уровню персонажа.` : "",
    !inferredBuild.exact ? "Не удалось однозначно разложить итоговые характеристики на расовые бонусы и доступные повышения — значения сохранены как есть." : "",
    "Выборы снаряжения, черт и вложенных классовых вариантов восстановить однозначно нельзя — проверьте соответствующие шаги мастера.",
  ].filter(Boolean);
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
      raceVariant: inferredBuild.raceVariant,
      raceAbilityChoices: inferredBuild.raceAbilityChoices,
      background,
      backgroundSkills: fixedBackgroundSkills,
      classSkills: selectedSkills.filter(skill => !fixedBackgroundSkills.includes(skill)),
      expertiseSkills,
      classChoices: classExpertise.length ? { expertise: classExpertise.map(skill => `skill-${skill}`) } : {},
      level,
      abilities: inferredBuild.abilities,
      advancements: inferredBuild.advancements,
      feats: inferredBuild.advancements.map(choice => choice.featId).filter(Boolean),
      asiChoices: inferredBuild.advancements.flatMap(choice => choice.featId === "asi" ? choice.asiChoices : []),
      spells: importedSpells,
      preparedSpells: [...new Set([
        ...textSpells.filter(id => (spells.find(spell => spell.id === id)?.level || 0) > 0),
        ...resolvedPreparedSpellIds.filter(id => (spells.find(spell => spell.id === id)?.level || 0) > 0),
      ])],
      lssSpellCards: hasCardSpells ? {
        mode: "cards",
        prepared: preparedCards,
        book: bookCards,
        edition: text(outerSpells.edition) || text(payload.edition) || "2014",
        resolved: resolvedCards,
      } : undefined,
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
    const imported = value.character as ExportCharacter;
    return {
      source: "native",
      warnings: [],
      character: {
        ...empty,
        ...imported,
        raceSkills: normalizeImportedSkills(imported.raceSkills),
        classSkills: normalizeImportedSkills(imported.classSkills),
        backgroundSkills: normalizeImportedSkills(imported.backgroundSkills),
        expertiseSkills: normalizeImportedSkills(imported.expertiseSkills),
      },
    };
  }
  if (value.jsonType === "character" && (typeof value.data === "string" || typeof value.data === "object")) return importLss(value, empty);
  if (Array.isArray(value.Classes) && Array.isArray(value.Parameters)) return importHelpmate(value, empty);
  throw new Error("Формат не распознан. Поддерживаются файлы «Листа Героя 5e», Long Story Short и Helpmate.");
}
