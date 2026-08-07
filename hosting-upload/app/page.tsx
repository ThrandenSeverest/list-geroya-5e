"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { backgrounds, CatalogOption, classes, classSkillRules, isExoticRace, races, spells } from "./catalog";
import {
  abilityModifier,
  createHelpmateExport,
  createLongStoryShortExport,
  estimatedHitPoints,
  type AdvancementChoice,
  type ExportCharacter,
  proficiencyBonus,
} from "./exportFormats";
import { abilityLabels, classRules, personalityOptions, raceFeatures } from "./rules";
import {
  alwaysPreparedSpellEntries,
  asiLevelsForClass,
  feats,
  finalAbilityScores,
  isTashaAdditionalSpell,
  optimalSpellIds,
  optimalPreparedSpellIds,
  optionalClassFeatures,
  pointBuySpent,
  raceAbilityBonuses,
  raceProficiencies,
  raceSkillChoiceCount,
  selectedRaceVariant,
  selectedSubclass,
  spellAvailableToCharacter,
  spellSelectionRule,
  subclassRule,
  variantsFor,
} from "./characterRules";
import { CatalogIcon } from "./catalogIcons";
import { classChoiceGroups, classChoicesComplete, resolvedClassChoiceFeatures } from "./classChoices";
import { knownLanguageOptions, languageRule } from "./languages";
import { characterResources, resourceCurrent } from "./characterResources";
import { backgroundRule } from "./backgroundRules";
import { equipmentComplete, equipmentOptionAdvice, equipmentRule, optimalEquipmentSelections, selectedEquipment } from "./equipment";
import { characterAttacks } from "./combat";
import { knownLimitations } from "./knownLimitations";
import { characterProficiencies, proficiencyChoiceRequirements, proficiencyChoicesComplete, proficiencyChoiceUsedElsewhere } from "./proficiencies";
import { createNativeCharacterFile, parseCharacterFile, type CharacterFileSource } from "./characterFiles";
import { advancementChoiceComplete, featChoiceGroups, featGrantedSpellIds } from "./featChoices";
import { armorClassBreakdown } from "./armor";
import { detailedFeatures } from "./featureDetails";

type Category = "races" | "classes" | "backgrounds" | "spells";
type BanMode = "deny" | "allow";
type BanList = { version: 1; name: string; mode: BanMode; categories: Record<Category, string[]> };
type PersonalityKey = keyof ExportCharacter["personality"];
type CharacterSlot = { id: string; character: ExportCharacter; updatedAt: string };
type CharacterVault = { version: 1; capacity: number; activeId: string; slots: CharacterSlot[] };

const steps = ["Раса", "Класс", "Характеристики", "Предыстория", "Навыки", "Снаряжение", "Уровень", "Заклинания", "Языки и инструменты", "Характер", "Итог"];
const initial: ExportCharacter = {
  race: "",
  raceVariant: "",
  raceAbilityChoices: [],
  raceSkills: [],
  className: "",
  subclass: "",
  background: "",
  classSkills: [],
  backgroundSkills: [],
  level: 1,
  spells: [],
  preparedSpells: [],
  name: "",
  playerName: "",
  alignment: "",
  abilities: { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 },
  feats: [],
  asiChoices: [],
  advancements: [],
  classChoices: {},
  equipmentSelections: {},
  languages: [],
  proficiencyChoices: {},
  resourceSpent: {},
  spellSlotsUsed: [],
  pactSlotsUsed: 0,
  useTasha: false,
  personality: { traits: "", ideals: "", bonds: "", flaws: "" },
};
const emptyBan: BanList = { version: 1, name: "Правила кампании", mode: "deny", categories: { races: [], classes: [], backgrounds: [], spells: [] } };
const categoryNames: Record<Category, string> = { races: "Расы", classes: "Классы", backgrounds: "Предыстории", spells: "Заклинания" };
const catalogs: Record<Category, CatalogOption[]> = { races, classes, backgrounds, spells };
const personalityNames: Record<PersonalityKey, string> = {
  traits: "Черты характера",
  ideals: "Идеалы",
  bonds: "Привязанности",
  flaws: "Слабости",
};
const personalityHints: Record<PersonalityKey, string> = {
  traits: "Как герой ведёт себя, говорит и реагирует?",
  ideals: "Какой принцип определяет его решения?",
  bonds: "Кого, что или какое обещание он защищает?",
  flaws: "Какая слабость регулярно создаёт проблемы?",
};
const alignments = ["", "Законно-доброе", "Нейтрально-доброе", "Хаотично-доброе", "Законно-нейтральное", "Истинно нейтральное", "Хаотично-нейтральное", "Законно-злое", "Нейтрально-злое", "Хаотично-злое"];

function download(payload: unknown, name: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function safeName(value: string) {
  return (value || "герой").replace(/[\\/:*?"<>|]+/g, "-").trim();
}

function slotId() {
  return `hero-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createSlot(character: ExportCharacter = initial): CharacterSlot {
  return { id: slotId(), character, updatedAt: new Date().toISOString() };
}

function allowed(list: BanList | null, category: Category, id: string) {
  if (!list) return true;
  const hit = list.categories[category]?.includes(id);
  return list.mode === "deny" ? !hit : !!hit;
}

function levelLabel(value: number) {
  return value === 0 ? "Заговор" : `${value} круг`;
}

function hasOriginFeat(character: Pick<ExportCharacter, "race" | "raceVariant">) {
  return (character.race === "human" && character.raceVariant === "variant") || character.race === "customlineage";
}

function advancementSlotsFor(character: Pick<ExportCharacter, "race" | "raceVariant" | "className" | "level">) {
  return [
    ...(hasOriginFeat(character) ? [{ key: "origin-1", level: 1, origin: true }] : []),
    ...asiLevelsForClass(character.className)
      .filter(level => level <= character.level)
      .map(level => ({ key: `class-${level}`, level, origin: false })),
  ];
}

function deriveLegacyAdvancementFields(advancements: AdvancementChoice[]) {
  return {
    feats: advancements.map(choice => choice.featId).filter(Boolean),
    asiChoices: advancements.flatMap(choice => choice.featId === "asi" ? choice.asiChoices : []),
  };
}

function syncAdvancements(character: ExportCharacter, advancements: AdvancementChoice[]) {
      return { ...character, advancements, ...deriveLegacyAdvancementFields(advancements) };
}

function normalizeCharacter(value: Partial<ExportCharacter>): ExportCharacter {
  const normalized = {
    ...initial,
    ...value,
    abilities: { ...initial.abilities, ...(value.abilities || {}) },
    personality: { ...initial.personality, ...(value.personality || {}) },
    raceAbilityChoices: value.raceAbilityChoices || [],
    raceVariant: value.raceVariant || (value.race && !variantsFor(value.race).length ? "base" : ""),
    raceSkills: value.raceSkills || [],
    feats: value.feats || [],
    asiChoices: value.asiChoices || [],
    advancements: value.advancements || [],
    classChoices: value.classChoices || {},
    equipmentSelections: value.equipmentSelections || {},
    languages: value.languages || [],
    proficiencyChoices: value.proficiencyChoices || {},
    resourceSpent: value.resourceSpent || {},
    preparedSpells: value.preparedSpells || [],
    spellSlotsUsed: value.spellSlotsUsed || [],
    pactSlotsUsed: value.pactSlotsUsed || 0,
    subclass: value.subclass || "",
    useTasha: !!value.useTasha,
  };
  if (!normalized.advancements.length && (normalized.feats || []).length) {
    const slots = advancementSlotsFor(normalized);
    const legacyAsi = [...(normalized.asiChoices || [])];
    normalized.advancements = slots.slice(0, normalized.feats.length).map((slot, index) => {
      const featId = normalized.feats?.[index] || "";
      return { ...slot, featId, asiChoices: featId === "asi" ? legacyAsi.splice(0, 2) : [] };
    });
  }
  if (value.preparedSpells === undefined && normalized.spells.length) {
    normalized.preparedSpells = optimalPreparedSpellIds(normalized, spells, normalized.spells);
  }
  return syncAdvancements(normalized, normalized.advancements);
}

export default function Home() {
  const [view, setView] = useState<"builder" | "banlist" | "characters">("builder");
  const [step, setStep] = useState(0);
  const [character, setCharacter] = useState<ExportCharacter>(initial);
  const [banDraft, setBanDraft] = useState<BanList>(emptyBan);
  const [activeBan, setActiveBan] = useState<BanList | null>(null);
  const [ready, setReady] = useState(false);
  const [banCategory, setBanCategory] = useState<Category>("races");
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("Все");
  const [spellLevel, setSpellLevel] = useState<number | "all">("all");
  const [advancementKey, setAdvancementKey] = useState("");
  const [detailsId, setDetailsId] = useState("");
  const [showSupplementBackgrounds, setShowSupplementBackgrounds] = useState(false);
  const [showExoticRaces, setShowExoticRaces] = useState(false);
  const [vault, setVault] = useState<CharacterVault>({ version: 1, capacity: 5, activeId: "", slots: [] });
  const [importMessage, setImportMessage] = useState<{ source: CharacterFileSource; warnings: string[] } | null>(null);
  const banFileRef = useRef<HTMLInputElement>(null);
  const characterFileRef = useRef<HTMLInputElement>(null);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const storedVault = localStorage.getItem("list-geroya-character-vault-v1");
      const storedCharacter = localStorage.getItem("dark-codex-character");
      if (storedVault) {
        const parsed = JSON.parse(storedVault) as CharacterVault;
        const slots = (parsed.slots || []).map(slot => ({ ...slot, character: normalizeCharacter(slot.character) }));
        const activeId = slots.some(slot => slot.id === parsed.activeId) ? parsed.activeId : slots[0]?.id || "";
        const active = slots.find(slot => slot.id === activeId);
        setVault({ version: 1, capacity: Math.max(5, parsed.capacity || 5, slots.length), activeId, slots });
        if (active) setCharacter(active.character);
      } else {
        const migrated = storedCharacter ? normalizeCharacter(JSON.parse(storedCharacter)) : initial;
        const slot = createSlot(migrated);
        setVault({ version: 1, capacity: 5, activeId: slot.id, slots: [slot] });
        setCharacter(migrated);
      }
      const storedBan = localStorage.getItem("dark-codex-banlist");
      if (storedBan) setActiveBan(JSON.parse(storedBan));
    } catch {}
    setReady(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!ready || !vault.activeId) return;
    const updatedAt = new Date().toISOString();
    const next = {
      ...vault,
      slots: vault.slots.map(slot => slot.id === vault.activeId ? { ...slot, character, updatedAt } : slot),
    };
    localStorage.setItem("list-geroya-character-vault-v1", JSON.stringify(next));
    localStorage.setItem("dark-codex-character", JSON.stringify(character));
  }, [character, ready, vault]);

  const availableRaces = useMemo(
    () => races.filter(option => allowed(activeBan, "races", option.id) && (showExoticRaces || !isExoticRace(option.id))),
    [activeBan, showExoticRaces],
  );
  const availableClasses = useMemo(() => classes.filter(option => allowed(activeBan, "classes", option.id)), [activeBan]);
  const availableBackgrounds = useMemo(
    () => backgrounds.filter(option => allowed(activeBan, "backgrounds", option.id) && (showSupplementBackgrounds || option.source === "PHB")),
    [activeBan, showSupplementBackgrounds],
  );
  const selectedRace = races.find(option => option.id === character.race);
  const selectedClass = classes.find(option => option.id === character.className);
  const selectedBackground = backgrounds.find(option => option.id === character.background);
  const selectedBackgroundRule = backgroundRule(character.background, selectedBackground);
  const classRule = classSkillRules[character.className] || { count: 0, skills: [] };
  const fixedBackgroundSkills = selectedBackgroundRule.skills;
  const unavailableClassSkills = [...new Set([...fixedBackgroundSkills, ...(character.raceSkills || [])])];
  const allSkillNames = [...new Set(Object.values(classSkillRules).flatMap(rule => rule.skills))].sort((a, b) => a.localeCompare(b, "ru"));
  const currentOptions = step === 0 ? availableRaces : step === 1 ? availableClasses : availableBackgrounds;
  const advancementSlots = advancementSlotsFor(character);
  const advancements = advancementSlots.map(slot => character.advancements?.find(choice => choice.key === slot.key) || { ...slot, featId: "", asiChoices: [] });
  const advancementFields = deriveLegacyAdvancementFields(advancements);
  const rulesCharacter = { ...character, ...advancementFields, advancements };
  const choiceGroups = classChoiceGroups(rulesCharacter, spells);
  const spellRule = spellSelectionRule({ ...rulesCharacter, abilities: finalAbilityScores(rulesCharacter) });
  const alwaysPreparedEntries = alwaysPreparedSpellEntries(rulesCharacter, spells);
  const alwaysPrepared = alwaysPreparedEntries.map(entry => entry.id);
  const alwaysPreparedSet = new Set(alwaysPrepared);
  const sources = ["Все", ...new Set((step === 7 ? spells : currentOptions).map(option => option.source))];
  const filtered = currentOptions.filter(option => (source === "Все" || option.source === source) && `${option.name} ${option.description}`.toLowerCase().includes(search.toLowerCase()));
  const selectableSpells = spells.filter(spell => allowed(activeBan, "spells", spell.id) && spellAvailableToCharacter(rulesCharacter, spell) && spell.level <= spellRule.maxLevel && !alwaysPreparedSet.has(spell.id));
  const filteredSpells = selectableSpells.filter(spell => (spellLevel === "all" || spell.level === spellLevel) && (source === "Все" || spell.source === source) && `${spell.name} ${spell.description} ${spell.school}`.toLowerCase().includes(search.toLowerCase()));
  const hiddenCount = activeBan ? Object.keys(catalogs).reduce((count, key) => count + catalogs[key as Category].filter(option => !allowed(activeBan, key as Category, option.id)).length, 0) : 0;
  const chosenRaceVariant = selectedRaceVariant(character.race, character.raceVariant);
  const selectedRaceFeatures = [
    ...raceFeatures(character.race, character.raceVariant, selectedRace?.description, selectedRace?.tags),
    ...(chosenRaceVariant?.features || []),
  ];
  const chosenSubclass = selectedSubclass(character.className, character.subclass || "");
  const selectedClassFeatures = detailedFeatures(resolvedClassChoiceFeatures(rulesCharacter, [
    ...(classRules[character.className]?.features || []),
    ...(chosenSubclass?.features || []),
    ...(character.useTasha ? optionalClassFeatures[character.className] || [] : []),
  ].filter(feature => (feature.level || 1) <= character.level), spells));
  const personalityLists = personalityOptions(character.background);
  const proficiency = proficiencyBonus(character.level);
  const finalAbilities = finalAbilityScores(rulesCharacter);
  const exportCharacter = { ...rulesCharacter, abilities: finalAbilities };
  const classEquipment = equipmentRule(character.className);
  const equipmentItems = selectedEquipment(exportCharacter);
  const languageRequirements = languageRule(exportCharacter);
  const proficiencyRequirements = proficiencyChoiceRequirements(exportCharacter);
  const proficiencies = characterProficiencies(exportCharacter);
  const knownLanguages = proficiencies.languages;
  const resources = characterResources(exportCharacter);
  const spellAbilityKey = classRules[character.className]?.spellAbility as keyof ExportCharacter["abilities"] | undefined;
  const spellcastingModifier = spellAbilityKey ? abilityModifier(finalAbilities[spellAbilityKey]) : 0;
  const spellSaveDc = spellAbilityKey ? 8 + proficiency + spellcastingModifier : 0;
  const spellAttackBonus = spellAbilityKey ? proficiency + spellcastingModifier : 0;
  const hitPoints = estimatedHitPoints(exportCharacter);
  const passivePerception = 10 + abilityModifier(finalAbilities.wis) + (proficiencies.skills.includes("Внимательность") ? proficiency : 0);
  const pointSpent = pointBuySpent(character.abilities);
  const pointRemaining = 27 - pointSpent;
  const variantBonus = raceAbilityBonuses(character);
  const racialProficiencies = raceProficiencies(character);
  const subclassData = subclassRule(character.className);
  const ordinarySpellIds = character.spells.filter(id => !alwaysPreparedSet.has(id));
  const selectedCantrips = ordinarySpellIds.filter(id => spells.find(item => item.id === id)?.level === 0);
  const selectedLeveled = ordinarySpellIds.filter(id => (spells.find(item => item.id === id)?.level || 0) > 0);
  const selectedPrepared = (character.preparedSpells || []).filter(id => selectedLeveled.includes(id));
  const selectedByLevel = Array.from({ length: spellRule.maxLevel + 1 }, (_, level) => ordinarySpellIds.filter(id => spells.find(item => item.id === id)?.level === level).length);
  const selectedAtOrAbove = Array.from({ length: spellRule.maxLevel + 1 }, (_, level) => level === 0 ? selectedCantrips.length : selectedByLevel.slice(level).reduce((total, count) => total + count, 0));
  const featSlots = advancementSlots.length;
  const completedAdvancements = advancements.filter(choice => advancementChoiceComplete(choice, spells));
  const selectedFeatNames = advancementFields.feats.map(id => feats.find(item => item.id === id)?.name).filter(Boolean) as string[];
  const grantedFeatSpells = featGrantedSpellIds(exportCharacter);
  const selectedFeatFeatures = advancements.flatMap(choice => {
    const feat = feats.find(item => item.id === choice.featId);
    if (!feat || feat.id === "asi") return [];
    const details = featChoiceGroups(choice, spells).map(group => {
      const names = (choice.featChoices?.[group.key] || []).map(id => group.options.find(option => option.id === id)?.name || id);
      return names.length ? `${group.title}: ${names.join(", ")}` : "";
    }).filter(Boolean);
    return [{ name: feat.name, description: [feat.description, ...details].join(" ") }];
  });
  const attacks = characterAttacks({ ...exportCharacter, spells: [...new Set([...exportCharacter.spells, ...grantedFeatSpells])] }, spells);
  const ac = armorClassBreakdown(exportCharacter);
  const activeAdvancement = advancements.find(choice => choice.key === advancementKey) || advancements.find(choice => !choice.featId) || advancements[0];
  const exportContext = {
    character: exportCharacter,
    race: selectedRace,
    characterClass: selectedClass,
    background: selectedBackground,
    spells,
    raceFeatureList: selectedRaceFeatures,
    classFeatureList: selectedClassFeatures,
    raceProficiencies: racialProficiencies,
    subclassName: chosenSubclass?.name,
    raceVariantName: chosenRaceVariant?.name,
    featNames: selectedFeatNames,
    featFeatureList: selectedFeatFeatures,
    featSpellIds: grantedFeatSpells,
    alwaysPreparedSpellIds: alwaysPrepared,
  };

  function resetFilters(nextStep: number) {
    setStep(nextStep);
    setSearch("");
    setSource(nextStep === 3 ? "PHB" : "Все");
    setDetailsId("");
    setSpellLevel("all");
  }

  function pick(id: string) {
    if (step === 0) {
      const raceVariantOptions = variantsFor(id);
      setCharacter(current => ({
        ...current,
        race: id,
        raceVariant: raceVariantOptions.length ? "" : "base",
        raceAbilityChoices: [],
        raceSkills: [],
        feats: [],
        asiChoices: [],
        advancements: [],
        languages: [],
        proficiencyChoices: {},
      }));
      if (raceVariantOptions.length) setDetailsId(id);
    }
    if (step === 1) setCharacter(current => syncAdvancements({ ...current, className: id, subclass: "", classSkills: [], spells: [], preparedSpells: [], classChoices: {}, proficiencyChoices: {}, equipmentSelections: {}, spellSlotsUsed: [], pactSlotsUsed: 0, resourceSpent: {} }, []));
    if (step === 3) {
      const option = backgrounds.find(item => item.id === id);
      const backgroundSkills = backgroundRule(id, option).skills;
      setCharacter(current => ({ ...current, background: id, backgroundSkills, classSkills: [], languages: [], proficiencyChoices: {}, personality: initial.personality }));
    }
  }

  function canContinue() {
    if (step === 0) return !!character.race && (!variantsFor(character.race).length || !!character.raceVariant);
    if (step === 1) return !!character.className;
    if (step === 2) {
      const choiceCount = chosenRaceVariant?.chooseBonuses?.count || 0;
      const raceSkillCount = raceSkillChoiceCount(character);
      return pointRemaining === 0 && (character.raceAbilityChoices || []).length === choiceCount && (character.raceSkills || []).length === raceSkillCount;
    }
    if (step === 3) return !!character.background;
    if (step === 4) return character.classSkills.length === classRule.count;
    if (step === 5) return equipmentComplete(character);
    if (step === 6) {
      const needsSubclass = !!subclassData && character.level >= subclassData.level;
      const allComplete = advancements.every(choice => advancementChoiceComplete(choice, spells));
      return (!needsSubclass || !!character.subclass) && completedAdvancements.length === featSlots && allComplete && classChoicesComplete(rulesCharacter, spells);
    }
    if (step === 7 && spellRule.caster) {
      const legalLevels = !spellRule.levelLimits || spellRule.levelLimits.every((limit, level) => level === 0 || selectedAtOrAbove[level] <= limit);
      const preparedComplete = spellRule.mode !== "spellbook" || selectedPrepared.length === spellRule.prepared;
      return selectedCantrips.length === spellRule.cantrips && selectedLeveled.length === spellRule.leveled && legalLevels && preparedComplete;
    }
    if (step === 8) return (character.languages || []).length === languageRequirements.choices && proficiencyChoicesComplete(exportCharacter);
    if (step === 9) return Object.values(character.personality).every(Boolean);
    return true;
  }

  function toggleSkill(name: string) {
    setCharacter(current => {
      const has = current.classSkills.includes(name);
      if (!has && current.classSkills.length >= classRule.count) return current;
      return { ...current, classSkills: has ? current.classSkills.filter(skill => skill !== name) : [...current.classSkills, name] };
    });
  }

  function toggleLanguage(name: string) {
    setCharacter(current => {
      const selected = current.languages || [];
      const next = selected.includes(name)
        ? selected.filter(language => language !== name)
        : selected.length < languageRequirements.choices ? [...selected, name] : selected;
      return { ...current, languages: next };
    });
  }

  function toggleProficiencyChoice(key: string, value: string, limit: number) {
    setCharacter(current => {
      const choices = current.proficiencyChoices || {};
      const selected = choices[key] || [];
      if (!selected.includes(value) && proficiencyChoiceUsedElsewhere(current, key, value)) return current;
      const next = selected.includes(value)
        ? selected.filter(item => item !== value)
        : selected.length < limit ? [...selected, value] : limit === 1 ? [value] : selected;
      return { ...current, proficiencyChoices: { ...choices, [key]: next } };
    });
  }

  function toggleEquipment(groupKey: string, optionId: string, limit: number) {
    setCharacter(current => {
      const selections = current.equipmentSelections || {};
      const selected = selections[groupKey] || [];
      const next = selected.includes(optionId)
        ? selected.filter(id => id !== optionId)
        : selected.length < limit ? [...selected, optionId] : limit === 1 ? [optionId] : selected;
      return { ...current, equipmentSelections: { ...selections, [groupKey]: next } };
    });
  }

  function chooseOptimalEquipment() {
    setCharacter(current => ({
      ...current,
      equipmentSelections: optimalEquipmentSelections(current.className, finalAbilityScores(current), {
        classChoices: current.classChoices,
        subclass: current.subclass,
      }),
    }));
  }

  function toggleSpell(id: string) {
    const level = spells.find(spell => spell.id === id)?.level || 0;
    setCharacter(current => {
      if (alwaysPreparedSet.has(id)) return current;
      if (current.spells.includes(id)) return {
        ...current,
        spells: current.spells.filter(spell => spell !== id),
        preparedSpells: (current.preparedSpells || []).filter(spell => spell !== id),
      };
      const sameKind = current.spells.filter(spellId => (spells.find(item => item.id === spellId)?.level || 0) === 0 ? level === 0 : level > 0);
      const cap = level === 0 ? spellRule.cantrips : spellRule.leveled;
      if (sameKind.length >= cap) return current;
      if (level > 0 && spellRule.levelLimits) {
        const breaksCumulativeLimit = spellRule.levelLimits.some((limit, circle) =>
          circle > 0 && circle <= level && current.spells.filter(spellId => (spells.find(item => item.id === spellId)?.level || 0) >= circle).length >= limit,
        );
        if (breaksCumulativeLimit) return current;
      }
      return { ...current, spells: [...current.spells, id] };
    });
  }

  function togglePreparedSpell(id: string) {
    setCharacter(current => {
      if (!current.spells.includes(id) || (spells.find(spell => spell.id === id)?.level || 0) === 0) return current;
      const selected = current.preparedSpells || [];
      if (selected.includes(id)) return { ...current, preparedSpells: selected.filter(spell => spell !== id) };
      if (selected.length >= (spellRule.prepared || 0)) return current;
      return { ...current, preparedSpells: [...selected, id] };
    });
  }

  function toggleTasha(enabled: boolean) {
    setCharacter(current => {
      const next = { ...current, useTasha: enabled };
      const legalSpells = current.spells.filter(id => {
        const spell = spells.find(item => item.id === id);
        return Boolean(spell && spellAvailableToCharacter(next, spell));
      });
      return { ...next, spells: legalSpells, preparedSpells: (current.preparedSpells || []).filter(id => legalSpells.includes(id)) };
    });
  }

  function changePointBuy(key: keyof ExportCharacter["abilities"], delta: number) {
    setCharacter(current => {
      const next = current.abilities[key] + delta;
      if (next < 8 || next > 15) return current;
      const abilities = { ...current.abilities, [key]: next };
      if (pointBuySpent(abilities) > 27) return current;
      return { ...current, abilities };
    });
  }

  function toggleRaceAbility(key: keyof ExportCharacter["abilities"]) {
    const limit = chosenRaceVariant?.chooseBonuses?.count || 0;
    setCharacter(current => {
      const selected = current.raceAbilityChoices || [];
      const next = selected.includes(key) ? selected.filter(item => item !== key) : selected.length < limit ? [...selected, key] : selected;
      return { ...current, raceAbilityChoices: next };
    });
  }

  function chooseRaceSkill(skill: string) {
    setCharacter(current => {
      const limit = raceSkillChoiceCount(current);
      const selected = current.raceSkills || [];
      const next = selected.includes(skill) ? selected.filter(item => item !== skill) : selected.length < limit ? [...selected, skill] : selected;
      return { ...current, raceSkills: next };
    });
  }

  function chooseAdvancementFeat(slotKey: string, id: string) {
    setCharacter(current => {
      const slots = advancementSlotsFor(current);
      const slot = slots.find(item => item.key === slotKey);
      if (!slot || (slot.origin && id === "asi")) return current;
      const existing = current.advancements || [];
      const previous = existing.find(choice => choice.key === slotKey);
      const nextChoice: AdvancementChoice = {
        ...slot,
        featId: id,
        asiChoices: id === "asi" && previous?.featId === "asi" ? previous.asiChoices : [],
        featChoices: id && previous?.featId === id ? previous.featChoices || {} : {},
      };
      const next = [...existing.filter(choice => choice.key !== slotKey), ...(id ? [nextChoice] : [])]
        .filter(choice => slots.some(item => item.key === choice.key));
      return syncAdvancements(current, next);
    });
  }

  function toggleFeatChoice(slotKey: string, groupKey: string, id: string, limit: number) {
    setCharacter(current => {
      const existing = current.advancements || [];
      const target = existing.find(choice => choice.key === slotKey);
      if (!target) return current;
      const selected = target.featChoices?.[groupKey] || [];
      const nextSelected = selected.includes(id)
        ? selected.filter(value => value !== id)
        : selected.length < limit ? [...selected, id] : limit === 1 ? [id] : selected;
      const featChoices = { ...(target.featChoices || {}), [groupKey]: nextSelected };
      if (groupKey === "tradition") {
        delete featChoices.cantrips;
        delete featChoices.spell;
        delete featChoices.rituals;
      }
      return syncAdvancements(current, existing.map(choice => choice.key === slotKey ? { ...choice, featChoices } : choice));
    });
  }

  function changeLevel(level: number) {
    setCharacter(current => {
      const nextBase = {
        ...current,
        level,
        subclass: subclassRule(current.className) && level < (subclassRule(current.className)?.level || 99) ? "" : current.subclass,
        spells: [],
        preparedSpells: [],
        spellSlotsUsed: [],
        pactSlotsUsed: 0,
        resourceSpent: {},
      };
      const validKeys = new Set(advancementSlotsFor(nextBase).map(slot => slot.key));
      return syncAdvancements(nextBase, (current.advancements || []).filter(choice => validKeys.has(choice.key)));
    });
  }

  function toggleClassChoice(groupKey: string, id: string, limit: number) {
    setCharacter(current => {
      const choices = current.classChoices || {};
      const selected = choices[groupKey] || [];
      const next = selected.includes(id) ? selected.filter(value => value !== id) : selected.length < limit ? [...selected, id] : selected;
      return { ...current, classChoices: { ...choices, [groupKey]: next } };
    });
  }

  function setUsedSlots(circle: number, value: number, maximum: number) {
    setCharacter(current => {
      const used = [...(current.spellSlotsUsed || [])];
      used[circle] = Math.max(0, Math.min(maximum, value));
      return { ...current, spellSlotsUsed: used };
    });
  }

  function setResourceCurrent(key: string, value: number, maximum: number) {
    setCharacter(current => ({
      ...current,
      resourceSpent: {
        ...(current.resourceSpent || {}),
        [key]: maximum - Math.max(0, Math.min(maximum, value)),
      },
    }));
  }

  function changeAsiAbility(slotKey: string, key: keyof ExportCharacter["abilities"], delta: 1 | -1) {
    setCharacter(current => {
      const existing = current.advancements || [];
      const target = existing.find(choice => choice.key === slotKey);
      if (!target || target.featId !== "asi") return current;
      const choices = [...target.asiChoices];
      if (delta < 0) {
        const index = choices.lastIndexOf(key);
        if (index >= 0) choices.splice(index, 1);
      } else {
        const otherAsiBonus = existing
          .filter(choice => choice.key !== slotKey && choice.featId === "asi")
          .flatMap(choice => choice.asiChoices)
          .filter(item => item === key).length;
        const racialScore = current.abilities[key] + raceAbilityBonuses(current)[key] + otherAsiBonus;
        const currentBonus = choices.filter(item => item === key).length;
        if (choices.length >= 2 || currentBonus >= 2 || racialScore + currentBonus >= 20) return current;
        choices.push(key);
      }
      const next = existing.map(choice => choice.key === slotKey ? { ...choice, asiChoices: choices } : choice);
      return syncAdvancements(current, next);
    });
  }

  function chooseOptimalSpells() {
    const value = { ...rulesCharacter, abilities: finalAbilityScores(rulesCharacter) };
    const ids = optimalSpellIds(value, spells);
    const preparedSpells = optimalPreparedSpellIds(value, spells, ids);
    setCharacter(current => ({ ...current, spells: ids, preparedSpells }));
  }

  function setPersonality(key: PersonalityKey, value: string) {
    setCharacter(current => ({ ...current, personality: { ...current.personality, [key]: value } }));
  }

  function randomPersonality(key: PersonalityKey) {
    const list = personalityLists[key];
    const randomValue = crypto.getRandomValues(new Uint32Array(1))[0];
    setPersonality(key, list[randomValue % list.length]);
  }

  function randomizeAllPersonality() {
    const randomValues = crypto.getRandomValues(new Uint32Array(Object.keys(personalityNames).length));
    setCharacter(current => ({
      ...current,
      personality: Object.fromEntries(
        (Object.keys(personalityNames) as PersonalityKey[]).map((key, index) => {
          const list = personalityLists[key];
          return [key, list[randomValues[index] % list.length]];
        }),
      ) as ExportCharacter["personality"],
    }));
  }

  function applyBan(list: BanList) {
    setActiveBan(list);
    localStorage.setItem("dark-codex-banlist", JSON.stringify(list));
    setCharacter(current => ({
      ...current,
      race: allowed(list, "races", current.race) ? current.race : "",
      className: allowed(list, "classes", current.className) ? current.className : "",
      background: allowed(list, "backgrounds", current.background) ? current.background : "",
      spells: current.spells.filter(id => allowed(list, "spells", id)),
    }));
    setView("builder");
    resetFilters(0);
  }

  function importBan(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (parsed.version !== 1 || !parsed.categories || !["deny", "allow"].includes(parsed.mode)) throw new Error();
        for (const key of Object.keys(categoryNames) as Category[]) if (!Array.isArray(parsed.categories[key])) throw new Error();
        applyBan(parsed);
      } catch {
        alert("Файл не похож на бан-лист «Листа Героя 5e».");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  function toggleBan(id: string) {
    setBanDraft(current => ({
      ...current,
      categories: {
        ...current.categories,
        [banCategory]: current.categories[banCategory].includes(id)
          ? current.categories[banCategory].filter(value => value !== id)
          : [...current.categories[banCategory], id],
      },
    }));
  }

  function exportHelpmate() {
    download(createHelpmateExport(exportContext), `${safeName(character.name)} — Helpmate.json`);
  }

  function exportLongStoryShort() {
    download(createLongStoryShortExport(exportContext), `${safeName(character.name)} — Long Story Short.json`);
  }

  function exportNative() {
    download(createNativeCharacterFile(exportCharacter), `${safeName(character.name)} — Лист Героя 5e.json`);
  }

  function persistVault(next: CharacterVault) {
    setVault(next);
    localStorage.setItem("list-geroya-character-vault-v1", JSON.stringify(next));
  }

  function openCharacterManager() {
    const updatedAt = new Date().toISOString();
    const next = {
      ...vault,
      slots: vault.slots.map(slot => slot.id === vault.activeId ? { ...slot, character, updatedAt } : slot),
    };
    persistVault(next);
    setView("characters");
  }

  function selectSlot(id: string) {
    const slot = vault.slots.find(item => item.id === id);
    if (!slot) return;
    persistVault({ ...vault, activeId: id });
    setCharacter(normalizeCharacter(slot.character));
    setImportMessage(null);
    setView("builder");
    resetFilters(0);
  }

  function addCharacter() {
    if (vault.slots.length >= vault.capacity) {
      alert("Все доступные места заняты. Добавьте ещё 5 слотов.");
      return;
    }
    const slot = createSlot(initial);
    persistVault({ ...vault, activeId: slot.id, slots: [...vault.slots, slot] });
    setCharacter(initial);
    setImportMessage(null);
    setView("builder");
    resetFilters(0);
  }

  function addFiveSlots() {
    persistVault({ ...vault, capacity: vault.capacity + 5 });
  }

  function resetCurrentCharacter() {
    if (!confirm("Сбросить текущего персонажа? Остальные персонажи не изменятся.")) return;
    setCharacter(initial);
    setImportMessage(null);
    setView("builder");
    resetFilters(0);
  }

  function deleteSlot(id: string) {
    const target = vault.slots.find(slot => slot.id === id);
    if (!target || !confirm(`Удалить персонажа «${target.character.name || "Безымянный герой"}»?`)) return;
    let slots = vault.slots.filter(slot => slot.id !== id);
    if (!slots.length) slots = [createSlot(initial)];
    const activeId = id === vault.activeId ? slots[0].id : vault.activeId;
    const next = { ...vault, activeId, slots };
    persistVault(next);
    if (id === vault.activeId) setCharacter(normalizeCharacter(slots[0].character));
  }

  function importCharacterFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const result = parseCharacterFile(JSON.parse(String(reader.result)), initial);
        const imported = normalizeCharacter(result.character);
        setCharacter(imported);
        setImportMessage({ source: result.source, warnings: result.warnings });
        setView("builder");
        resetFilters(10);
      } catch (error) {
        alert(error instanceof Error ? error.message : "Не удалось импортировать персонажа.");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  if (view === "characters") {
    const free = vault.capacity - vault.slots.length;
    return (
      <main className="app-shell">
        <header className="topbar">
          <button className="brand" onClick={() => setView("builder")}><span className="brand-mark">✦</span>Лист Героя <small>5E · 2014</small></button>
          <button className="nav-button" onClick={() => setView("builder")}>← К персонажу</button>
        </header>
        <section className="character-library">
          <header className="library-head">
            <div><p className="eyebrow">Локальная коллекция</p><h1>Ваши персонажи</h1><p>До {vault.capacity} слотов на этом устройстве. Каждый лист сохраняется автоматически.</p></div>
            <div className="library-actions">
              <button onClick={() => characterFileRef.current?.click()}>Импорт JSON</button>
              <button className="primary-action" disabled={free <= 0} onClick={addCharacter}>Новый персонаж</button>
              <input ref={characterFileRef} hidden type="file" accept=".json,application/json" onChange={importCharacterFile} />
            </div>
          </header>
          <div className="import-guide">
            <div><strong>Long Story Short</strong><span>Основной импорт: характеристики, личные данные, навыки, текстовые заклинания и потраченные ячейки.</span></div>
            <div><strong>Лист Героя 5e</strong><span>Полный перенос всех решений между устройствами и резервные копии.</span></div>
            <div><strong>Helpmate · экспериментально</strong><span>Базовые параметры, класс, уровень, навыки, заклинания и ячейки; неполные поля нужно проверить.</span></div>
          </div>
          <div className="character-grid">
            {vault.slots.map(slot => {
              const itemClass = classes.find(item => item.id === slot.character.className);
              const itemRace = races.find(item => item.id === slot.character.race);
              return <article key={slot.id} className={slot.id === vault.activeId ? "active" : ""}>
                <CatalogIcon id={itemClass?.id || itemRace?.id} kind={itemClass ? "class" : "race"} fallback={itemClass?.name || itemRace?.name || "Новый герой"} />
                <div><small>{slot.id === vault.activeId ? "Текущий персонаж" : `Сохранён ${new Date(slot.updatedAt).toLocaleDateString("ru-RU")}`}</small><h2>{slot.character.name || "Безымянный герой"}</h2><p>{itemRace?.name || "Раса не выбрана"} · {itemClass?.name || "Класс не выбран"} · {slot.character.level} уровень</p></div>
                <div className="character-card-actions"><button onClick={() => selectSlot(slot.id)}>{slot.id === vault.activeId ? "Продолжить" : "Открыть"}</button><button onClick={() => deleteSlot(slot.id)}>Удалить</button></div>
              </article>;
            })}
          </div>
          <footer className="slot-footer"><span>Занято {vault.slots.length} из {vault.capacity} · свободно {free}</span><button onClick={addFiveSlots}>Добавить ещё 5 слотов</button></footer>
        </section>
      </main>
    );
  }

  if (view === "banlist") {
    const list = catalogs[banCategory].filter(option => `${option.name} ${option.description}`.toLowerCase().includes(search.toLowerCase()));
    return (
      <main className="app-shell">
        <header className="topbar">
          <button className="brand" onClick={() => setView("builder")}><span className="brand-mark">✦</span>Лист Героя <small>5E · 2014</small></button>
          <button className="nav-button" onClick={() => setView("builder")}>← К мастеру</button>
        </header>
        <div className="ban-page">
          <p className="eyebrow">Правила кампании</p>
          <h1>Конструктор бан-листа</h1>
          <p className="lead">Создайте переносимый файл ограничений. Он работает только с официальным каталогом приложения.</p>
          <div className="ban-controls">
            <label>Название<input value={banDraft.name} onChange={event => setBanDraft({ ...banDraft, name: event.target.value })} /></label>
            <fieldset>
              <legend>Режим</legend>
              <label><input type="radio" checked={banDraft.mode === "deny"} onChange={() => setBanDraft({ ...banDraft, mode: "deny" })} /> Запретить выбранное</label>
              <label><input type="radio" checked={banDraft.mode === "allow"} onChange={() => setBanDraft({ ...banDraft, mode: "allow" })} /> Разрешить только выбранное</label>
            </fieldset>
          </div>
          <div className="category-tabs">
            {(Object.keys(categoryNames) as Category[]).map(key => (
              <button key={key} className={banCategory === key ? "active" : ""} onClick={() => { setBanCategory(key); setSearch(""); }}>
                {categoryNames[key]} <span>{banDraft.categories[key].length}</span>
              </button>
            ))}
          </div>
          <div className="tools">
            <label className="search">⌕<input value={search} onChange={event => setSearch(event.target.value)} placeholder={`Найти: ${categoryNames[banCategory].toLowerCase()}`} /></label>
          </div>
          <div className="ban-grid">
            {list.map(option => (
              <button key={option.id} className={banDraft.categories[banCategory].includes(option.id) ? "selected" : ""} onClick={() => toggleBan(option.id)}>
                <span>{banDraft.categories[banCategory].includes(option.id) ? "✓" : "+"}</span>
                <div><strong>{option.name}</strong><small>{option.source}{banCategory === "spells" ? ` · ${levelLabel((option as typeof spells[number]).level)}` : ""}</small></div>
              </button>
            ))}
          </div>
          <div className="ban-actions">
            <button onClick={() => setBanDraft({ ...emptyBan, name: banDraft.name })}>Очистить</button>
            <button onClick={() => download(banDraft, `${banDraft.name || "ban-list"}.json`)}>Скачать JSON</button>
            <button className="primary-action" onClick={() => applyBan(banDraft)}>Применить к мастеру</button>
          </div>
        </div>
      </main>
    );
  }

  const headings = ["Выберите расу и подрасу", "Выберите класс", "Распределите характеристики", "Выберите предысторию", "Выберите владения навыками", "Выберите стартовое снаряжение", "Уровень, подкласс и черты", "Выберите заклинания", "Выберите языки и инструменты", "Опишите характер", "Лист персонажа"];
  const stepDescription = step < 2 || step === 3
    ? "Откройте «Подробнее», чтобы увидеть механические особенности и доступные варианты. Каталог исключает UA, Homebrew и неофициальные классы."
    : step === 2
      ? "Point Buy 2014: начните с шести восьмёрок и потратьте ровно 27 очков. Расовые бонусы показаны отдельно."
      : step === 4
      ? "Предыстория выдаёт свои навыки, а класс позволяет выбрать только из собственного списка."
      : step === 5
        ? "Выберите каждый вариант стартового снаряжения класса. Старт с золотом намеренно не используется."
        : step === 6
          ? "Выберите уровень, обязательный подкласс и каждый доступный выбор черты или повышения характеристик по прогрессии класса."
          : step === 7
            ? "Счётчики основаны на таблице выбранного класса. Заклинания подкласса показаны отдельно и не занимают лимит."
            : step === 8
              ? "Языки и все конкретные инструменты собраны здесь по источникам. Общие формулировки вроде «ремесленный инструмент» в итоговый лист не попадут."
              : step === 9
                ? "Каждый пункт можно написать самому, выбрать из списка предыстории или определить случайно."
                : "Лист повторяет структуру Long Story Short и готов к печати или экспорту.";

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => resetFilters(0)}><span className="brand-mark">✦</span>Лист Героя <small>5E · 2014</small></button>
        <div className="top-actions">
          <button className="nav-button character-nav" onClick={openCharacterManager}>Персонажи <b>{vault.slots.length}/{vault.capacity}</b></button>
          <button className="nav-button" onClick={() => { setView("banlist"); setSearch(""); }}>Создать бан-лист</button>
          <button className="nav-button" onClick={() => banFileRef.current?.click()}>Загрузить бан-лист</button>
          <input ref={banFileRef} hidden type="file" accept=".json,application/json" onChange={importBan} />
          <span className="save-state"><span>✓</span>Автосохранение</span>
        </div>
      </header>
      {activeBan && (
        <div className="ban-status">
          <span>Активен: <strong>{activeBan.name}</strong> · {activeBan.mode === "deny" ? "запрещены выбранные" : "разрешены только выбранные"} · скрыто {hiddenCount}</span>
          <button onClick={() => { setActiveBan(null); localStorage.removeItem("dark-codex-banlist"); }}>Отключить</button>
        </div>
      )}
      <div className="workspace">
        <nav className="steps">
          <p className="eyebrow">Создание</p>
          {steps.map((label, index) => (
            <button key={label} className={`step ${index === step ? "active" : ""} ${index < step ? "done" : ""}`} onClick={() => resetFilters(index)}>
              <span>{index < step ? "✓" : index + 1}</span><strong>{label}</strong>
            </button>
          ))}
          <div className="compass">✦<small>2014 EDITION</small></div>
        </nav>
        <section className="content">
          {importMessage && (
            <div className={`import-result ${importMessage.warnings.length ? "warning" : "success"}`}>
              <div>
                <strong>{importMessage.source === "native" ? "Персонаж полностью импортирован" : importMessage.source === "long-story-short" ? "Long Story Short импортирован" : "Helpmate импортирован экспериментально"}</strong>
                {importMessage.warnings.map(warning => <p key={warning}>{warning}</p>)}
              </div>
              <button onClick={() => setImportMessage(null)}>Скрыть</button>
            </div>
          )}
          <header className="content-head">
            <p className="eyebrow">Шаг {step + 1} · официальный каталог</p>
            <h1>{headings[step]}</h1>
            <p>{stepDescription}</p>
          </header>

          {(step < 2 || step === 3) && (
            <>
              <div className="tools">
                <label className="search">⌕<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Поиск по каталогу" /></label>
                <select value={source} onChange={event => setSource(event.target.value)}>{sources.map(value => <option key={value}>{value}</option>)}</select>
              </div>
              {step === 0 && (
                <label className="supplement-toggle exotic-toggle">
                  <input type="checkbox" checked={showExoticRaces} onChange={event => { setShowExoticRaces(event.target.checked); setSource("Все"); }} />
                  <span><strong>Показать экзотические расы</strong>Народы из дополнений и сеттингов обычно требуют согласования с Мастером.</span>
                </label>
              )}
              {step === 3 && (
                <label className="supplement-toggle">
                  <input
                    type="checkbox"
                    checked={showSupplementBackgrounds}
                    onChange={event => {
                      setShowSupplementBackgrounds(event.target.checked);
                      setSource(event.target.checked ? "Все" : "PHB");
                    }}
                  />
                  <span><strong>Показывать предыстории из дополнений</strong>По умолчанию видны только варианты PHB.</span>
                </label>
              )}
              <div className="catalog-meta">{filtered.length} вариантов · только официальные источники</div>
              <div className="card-grid">
                {filtered.map(option => {
                  const selected = (step === 0 ? character.race : step === 1 ? character.className : character.background) === option.id;
                  const detailFeatures = step === 0
                    ? raceFeatures(option.id, option.id === character.race ? character.raceVariant : "", option.description, option.tags)
                    : step === 1
                      ? classRules[option.id]?.features || []
                      : [{ ...backgroundRule(option.id, option).feature }];
                  return (
                    <article key={option.id} className={`choice-card ${selected ? "selected" : ""}`}>
                      <CatalogIcon id={option.id} kind={step === 0 ? "race" : step === 1 ? "class" : "background"} fallback={option.name} />
                      <div>
                        <div className="card-title"><h2>{option.name}</h2><em>{option.source}</em></div>
                        <p>{option.description}</p>
                        <div className="tags">{option.tags?.map(tag => <span key={tag}>{tag}</span>)}</div>
                        <div className="card-actions">
                          <button onClick={() => pick(option.id)}>{selected ? "Выбрано" : "Выбрать"}</button>
                          <button className="details-button" onClick={() => setDetailsId(detailsId === option.id ? "" : option.id)}>Подробнее</button>
                        </div>
                      </div>
                      {selected && <span className="check">✓</span>}
                      {detailsId === option.id && (
                        <div className="option-details">
                          <h3>Правила и особенности</h3>
                          {step === 0 && (() => {
                            const variantId = option.id === character.race ? character.raceVariant : "base";
                            const rule = selectedRaceVariant(option.id, variantId);
                            if (!rule) return null;
                            const bonuses = Object.entries(rule.bonuses || {}).map(([key, value]) => `${abilityLabels[key as keyof ExportCharacter["abilities"]]} +${value}`);
                            return <div className="background-mechanics race-mechanics">
                              <p><b>Вариант:</b> {rule.name} · {rule.source}</p>
                              <p><b>Характеристики:</b> {bonuses.join(", ") || (rule.chooseBonuses ? rule.description : "нет фиксированных бонусов")}</p>
                              <p><b>Владения:</b> {raceProficiencies({ ...character, race: option.id, raceVariant: rule.id }).join(", ") || "нет"}</p>
                            </div>;
                          })()}
                          {detailFeatures.length ? (
                            <div className="feature-preview">
                              {detailFeatures.map(feature => (
                                <div key={`${feature.level}-${feature.name}`}>
                                  <strong>{feature.level ? `${feature.level} ур. · ` : ""}{feature.name}</strong>
                                  <p>{feature.description}</p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <ul>
                              {(option.details?.length ? option.details : [`Источник: ${option.source}.`, option.description, ...(option.tags || []).map(tag => `Ключевая особенность: ${tag}.`)]).map(value => <li key={value}>{value}</li>)}
                            </ul>
                          )}
                          {step === 3 && (() => {
                            const rule = backgroundRule(option.id, option);
                            return <div className="background-mechanics">
                              <p><b>Навыки:</b> {rule.skills.join(", ") || "по описанию"}</p>
                              <p><b>Инструменты:</b> {rule.tools.join(", ") || "нет"}</p>
                              <p><b>Языки:</b> {rule.languageChoices ? `${rule.languageChoices} на выбор` : "не даёт"}</p>
                              <p><b>Снаряжение:</b> {rule.equipment.join(", ") || "согласуйте с Мастером"}</p>
                            </div>;
                          })()}
                          {step === 0 && variantsFor(option.id).length > 0 && (
                            <fieldset className="variant-picker">
                              <legend>Обязательный вариант / подраса</legend>
                              {variantsFor(option.id).map(variant => (
                                <label key={variant.id}>
                                  <input
                                    type="radio"
                                    checked={character.race === option.id && character.raceVariant === variant.id}
                                    onChange={() => setCharacter(current => ({
                                      ...current,
                                      race: option.id,
                                      raceVariant: variant.id,
                                      raceAbilityChoices: [],
                                      raceSkills: [],
                                      feats: [],
                                    }))}
                                  />
                                  <span>
                                    <strong>{variant.name} · {variant.source}</strong>{variant.description}
                                    <small className="variant-bonus-line">
                                      {Object.keys(variant.bonuses || {}).length
                                        ? `Характеристики: ${Object.entries(variant.bonuses).map(([key, value]) => `${abilityLabels[key as keyof ExportCharacter["abilities"]]} +${value}`).join(", ")}`
                                        : variant.chooseBonuses ? "Характеристики выбираются по правилам варианта" : "Без фиксированного бонуса"}
                                      {variant.proficiencies?.length ? ` · Владения: ${variant.proficiencies.join(", ")}` : ""}
                                    </small>
                                    {variant.features?.length ? <span className="variant-feature-list">{variant.features.map(feature => <small className="variant-feature-line" key={feature.name}><b>{feature.name}.</b> {feature.description}</small>)}</span> : null}
                                  </span>
                                </label>
                              ))}
                            </fieldset>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </>
          )}

          {step === 2 && (
            <div className="pointbuy-layout">
              <div className={`pointbuy-status ${pointRemaining === 0 ? "complete" : ""}`}>
                <span>Осталось очков</span>
                <strong>{pointRemaining}</strong>
                <small>Стоимость: 8→0 · 9→1 · 10→2 · 11→3 · 12→4 · 13→5 · 14→7 · 15→9</small>
              </div>
              <div className="pointbuy-grid">
                {(Object.keys(abilityLabels) as (keyof ExportCharacter["abilities"])[]).map(key => (
                  <section key={key}>
                    <small>{abilityLabels[key]}</small>
                    <div className="score-control">
                      <button onClick={() => changePointBuy(key, -1)} disabled={character.abilities[key] <= 8}>−</button>
                      <strong>{character.abilities[key]}</strong>
                      <button onClick={() => changePointBuy(key, 1)} disabled={character.abilities[key] >= 15 || pointRemaining <= 0}>+</button>
                    </div>
                    <p>Цена: {({ 8:0, 9:1, 10:2, 11:3, 12:4, 13:5, 14:7, 15:9 } as Record<number, number>)[character.abilities[key]]} · бонус расы: {variantBonus[key] ? `+${variantBonus[key]}` : "—"}</p>
                    <b>Итог {finalAbilities[key]} ({abilityModifier(finalAbilities[key]) >= 0 ? "+" : ""}{abilityModifier(finalAbilities[key])})</b>
                  </section>
                ))}
              </div>
              {chosenRaceVariant?.chooseBonuses && (
                <div className="racial-choice">
                  <div><small>{chosenRaceVariant.name}</small><h2>Выберите {chosenRaceVariant.chooseBonuses.count} бонуса характеристик</h2></div>
                  <div className="proficiency-grid">
                    {(Object.keys(abilityLabels) as (keyof ExportCharacter["abilities"])[])
                      .filter(key => !chosenRaceVariant.chooseBonuses?.exclude?.includes(key))
                      .map(key => (
                        <button key={key} className={(character.raceAbilityChoices || []).includes(key) ? "selected" : ""} onClick={() => toggleRaceAbility(key)}>
                          <span>{(character.raceAbilityChoices || []).includes(key) ? "✓" : "+"}</span>{abilityLabels[key]} {(character.raceAbilityChoices || []).includes(key)
                            ? `+${chosenRaceVariant.chooseBonuses?.amounts?.[(character.raceAbilityChoices || []).indexOf(key)] ?? chosenRaceVariant.chooseBonuses?.amount ?? 0}`
                            : chosenRaceVariant.chooseBonuses?.amounts ? `(+${chosenRaceVariant.chooseBonuses.amounts.join(" / +")})` : `+${chosenRaceVariant.chooseBonuses?.amount}`}
                        </button>
                      ))}
                  </div>
                </div>
              )}
              {raceSkillChoiceCount(character) > 0 && (
                <div className="racial-choice">
                  <div><small>{chosenRaceVariant?.name || selectedRace?.name}</small><h2>Выберите расовые владения навыками: {character.raceSkills.length} / {raceSkillChoiceCount(character)}</h2></div>
                  <div className="proficiency-grid">
                    {allSkillNames.map(skill => (
                      <button key={skill} className={(character.raceSkills || []).includes(skill) ? "selected" : ""} onClick={() => chooseRaceSkill(skill)}>
                        <span>{(character.raceSkills || []).includes(skill) ? "✓" : "+"}</span>{skill}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="skill-sections">
              <div className="skill-source">
                <div className="skill-source-head"><div><small>Предыстория</small><h2>{selectedBackground?.name}</h2></div><strong>{fixedBackgroundSkills.length}</strong></div>
                <p>Эти владения выдаются выбранной предысторией.</p>
                <div className="proficiency-grid">{fixedBackgroundSkills.map(skill => <button disabled className="selected" key={skill}><span>✓</span>{skill}</button>)}</div>
              </div>
              <div className="skill-source">
                <div className="skill-source-head"><div><small>Класс</small><h2>{selectedClass?.name}</h2></div><strong>{character.classSkills.length} / {classRule.count}</strong></div>
                <p>Выберите {classRule.count}; владения предыстории автоматически исключены.</p>
                <div className="proficiency-grid">
                  {classRule.skills.filter(skill => !unavailableClassSkills.includes(skill)).map(skill => (
                    <button key={skill} className={character.classSkills.includes(skill) ? "selected" : ""} onClick={() => toggleSkill(skill)}>
                      <span>{character.classSkills.includes(skill) ? "✓" : "+"}</span>{skill}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="equipment-builder">
              <div className="equipment-toolbar">
                <div><small>{selectedClass?.name}</small><h2>Стартовое снаряжение класса</h2><p>Рекомендация учитывает Силу {finalAbilities.str}, Ловкость {finalAbilities.dex}, владения и выбранный боевой стиль. Вариант старта с золотом не используется.</p></div>
                <button onClick={chooseOptimalEquipment}>✦ Выбрать оптимальный</button>
              </div>
              {classEquipment.groups.map(group => {
                const selected = character.equipmentSelections?.[group.key] || [];
                const recommended = optimalEquipmentSelections(character.className, finalAbilities, {
                  classChoices: character.classChoices,
                  subclass: character.subclass,
                })[group.key] || [];
                return <section className="equipment-group" key={group.key}>
                  <header><div><small>Обязательный выбор</small><h3>{group.label}</h3></div><strong className={selected.length === group.count ? "complete" : ""}>{selected.length} / {group.count}</strong></header>
                  <div className="equipment-options">
                    {group.options.map(option => {
                      const advice = equipmentOptionAdvice(option, finalAbilities);
                      return <button key={option.id} className={`${selected.includes(option.id) ? "selected" : ""} ${advice.startsWith("Не рекомендуется") ? "not-recommended" : ""}`} onClick={() => toggleEquipment(group.key, option.id, group.count)}>
                        <span>{selected.includes(option.id) ? "✓" : "+"}</span><strong>{option.label}</strong>
                        {(recommended.includes(option.id) || advice) && <small className={recommended.includes(option.id) ? "recommended-label" : "equipment-advice"}>{recommended.includes(option.id) ? "✦ рекомендуется для ваших характеристик" : advice}</small>}
                      </button>;
                    })}
                  </div>
                </section>;
              })}
              <section className="equipment-fixed"><h3>Также получаете автоматически</h3><p>{[...classEquipment.fixed, ...selectedBackgroundRule.equipment].join(" · ") || "Нет фиксированного снаряжения."}</p>{classEquipment.fixed.includes("Кольчуга") && finalAbilities.str < 13 && <small>Кольчуга предусмотрена стартовым набором класса, но при Силе ниже 13 снижает скорость на 10 футов. Она не считается оптимальной рекомендацией.</small>}</section>
            </div>
          )}

          {step === 6 && (
            <div className="level-layout">
              <div className="level-panel">
                <div className="level-number">{character.level}</div>
                <input aria-label="Уровень персонажа" type="range" min="1" max="20" value={character.level} onChange={event => changeLevel(+event.target.value)} />
                <div className="level-ticks"><span>1</span><span>5</span><span>10</span><span>15</span><span>20</span></div>
                <p>Бонус владения: <strong>+{proficiency}</strong> · кость хитов: <strong>к{classRules[character.className]?.hitDie || 8}</strong></p>
              </div>
              <div className="spell-progression">
                <div className="ability-editor-head"><div><small>Заклинательства на этом уровне</small><h2>{spellRule.caster ? spellRule.title : "Без базовой магии"}</h2></div><span>{spellRule.maxLevel ? `до ${spellRule.maxLevel} круга` : "—"}</span></div>
                {spellRule.caster ? (
                  <>
                    <div className="progression-facts">
                      <div><span>Заговоры</span><strong>{spellRule.cantrips}</strong></div>
                      <div><span>{spellRule.mode === "prepared" ? "Подготовить" : spellRule.mode === "spellbook" ? "В книге" : "Известно"}</span><strong>{spellRule.leveled}</strong></div>
                      {spellRule.prepared !== undefined && spellRule.mode === "spellbook" && <div><span>Подготовить</span><strong>{spellRule.prepared}</strong></div>}
                      <div><span>Макс. круг</span><strong>{spellRule.maxLevel}</strong></div>
                    </div>
                    {spellRule.pact ? (
                      <div className="slot-row"><span>Магия договора</span><b>{spellRule.pact.slots} яч. {spellRule.pact.level} круга</b><small>Восстанавливаются после короткого отдыха</small></div>
                    ) : (
                      <div className="slot-grid">
                        {spellRule.slots.map((count, index) => <div key={index}><small>{index + 1} круг</small><strong>{count}</strong><span>ячеек</span></div>)}
                      </div>
                    )}
                  </>
                ) : <p className="muted">У выбранного класса на этом уровне нет базового выбора заклинаний.</p>}
              </div>
              <div className="spell-progression resource-progression">
                <div className="ability-editor-head"><div><small>Счётчики на листе</small><h2>Классовые ресурсы</h2></div><span>{resources.length || "—"}</span></div>
                {resources.length ? <div className="resource-preview-grid">
                  {resources.map(resource => <div key={resource.key}><span>{resource.name}</span><strong>{resourceCurrent(exportCharacter, resource)} / {resource.max}</strong><small>{resource.die ? `${resource.die} · ` : ""}{resource.isShortRest ? "короткий отдых" : "продолжительный отдых"}</small></div>)}
                </div> : <p className="muted">На этом уровне нет ограниченного классового ресурса.</p>}
              </div>
              {subclassData && character.level >= subclassData.level && (
                <div className="subclass-picker">
                  <div className="ability-editor-head"><div><small>С {subclassData.level} уровня</small><h2>Выберите подкласс</h2></div><span>{subclassData.options.length} вариантов</span></div>
                  <div className="subclass-grid">
                    {subclassData.options.map(option => (
                      <button key={option.id} className={character.subclass === option.id ? "selected" : ""} onClick={() => setCharacter(current => ({ ...current, subclass: option.id, spells: [], preparedSpells: [], classChoices: {}, proficiencyChoices: {} }))}>
                        <span>{option.source}</span><strong>{option.name}</strong><p>{option.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {choiceGroups.length > 0 && (
                <div className="class-choice-section">
                  <div className="ability-editor-head"><div><small>Обязательные решения класса</small><h2>Настройка способностей</h2></div><span>{choiceGroups.filter(group => (character.classChoices?.[group.key] || []).length === group.count).length} / {choiceGroups.length}</span></div>
                  <p>Здесь собраны все постоянные выборы, которые открылись на выбранном уровне. Продолжить можно после заполнения каждой ветви.</p>
                  {choiceGroups.map(group => {
                    const selected = character.classChoices?.[group.key] || [];
                    return (
                      <section className="class-choice-group" key={group.key}>
                        <header><div><small>{group.level} уровень</small><h3>{group.title}</h3><p>{group.description}</p></div><strong className={selected.length === group.count ? "complete" : ""}>{selected.length} / {group.count}</strong></header>
                        <div className="class-choice-grid">
                          {group.options.map(option => (
                            <button key={option.id} className={selected.includes(option.id) ? "selected" : ""} onClick={() => toggleClassChoice(group.key, option.id, group.count)}>
                              <span>{option.source}</span><strong>{option.name}</strong><p>{option.description}</p>{option.minLevel && <small>Требование: {option.minLevel} уровень</small>}
                            </button>
                          ))}
                        </div>
                      </section>
                    );
                  })}
                </div>
              )}
              <div className="tasha-panel">
                <label><input type="checkbox" checked={!!character.useTasha} onChange={event => toggleTasha(event.target.checked)} /><span><strong>Опциональные способности Tasha’s Cauldron of Everything</strong>Включить официальные дополнения, замены классовых способностей и расширенные списки заклинаний. При отключении выборы, доступные только по TCE, будут удалены.</span></label>
                {character.useTasha && <div className="feature-preview">{(optionalClassFeatures[character.className] || []).filter(feature => (feature.level || 1) <= character.level).map(feature => <div key={feature.name}><strong>{feature.level} ур. · {feature.name}</strong><p>{feature.description}</p></div>)}</div>}
              </div>
              {featSlots > 0 && (
                <div className="feat-picker">
                  <div className="ability-editor-head"><div><small>Прогрессия {selectedClass?.name || "класса"}</small><h2>Черты и увеличение характеристик</h2></div><span>{completedAdvancements.length} / {featSlots}</span></div>
                  <p>Каждый достигнутый уровень повышения даёт отдельный выбор. Воин получает дополнительные выборы на 6-м и 14-м уровнях, плут — на 10-м.</p>
                  <div className="advancement-tabs">
                    {advancements.map(choice => (
                      <button
                        key={choice.key}
                        className={(activeAdvancement?.key === choice.key ? "active " : "") + (advancementChoiceComplete(choice, spells) ? "complete" : "")}
                        onClick={() => setAdvancementKey(choice.key)}
                      >
                        <span>{choice.origin ? "Происхождение" : `${choice.level} уровень`}</span>
                        <strong>{choice.featId ? feats.find(feat => feat.id === choice.featId)?.name : "Не выбрано"}</strong>
                      </button>
                    ))}
                  </div>
                  {activeAdvancement && <>
                    <div className="advancement-current">
                      <span>{activeAdvancement.origin ? "Черта происхождения" : `Выбор ${activeAdvancement.level}-го уровня`}</span>
                      {activeAdvancement.featId && <button onClick={() => chooseAdvancementFeat(activeAdvancement.key, "")}>Очистить выбор</button>}
                    </div>
                  <div className="feat-grid">
                    {feats.filter(feat => !activeAdvancement.origin || feat.id !== "asi").map(feat => (
                      <button key={feat.id} className={activeAdvancement.featId === feat.id ? "selected" : ""} onClick={() => chooseAdvancementFeat(activeAdvancement.key, feat.id)}>
                        <span>{feat.source}</span><strong>{feat.name}</strong><p>{feat.description}</p>{feat.requirement && <small>Требование: {feat.requirement}</small>}
                      </button>
                    ))}
                  </div>
                  {activeAdvancement.featId === "asi" && (
                    <div className="asi-picker">
                      <div className="ability-editor-head">
                        <div><small>Распределение бонуса</small><h2>Куда добавить +2</h2></div>
                        <span>{activeAdvancement.asiChoices.length} / 2</span>
                      </div>
                      <p>Добавьте +2 к одной характеристике или +1 к двум. Значение после повышения не может превышать 20.</p>
                      <div className="asi-grid">
                        {(Object.keys(abilityLabels) as (keyof ExportCharacter["abilities"])[]).map(key => {
                          const count = activeAdvancement.asiChoices.filter(item => item === key).length;
                          const previousBonus = advancements
                            .filter(choice => choice.key !== activeAdvancement.key && choice.featId === "asi")
                            .flatMap(choice => choice.asiChoices)
                            .filter(item => item === key).length;
                          const beforeAsi = character.abilities[key] + raceAbilityBonuses(character)[key] + previousBonus;
                          return (
                            <section key={key}>
                              <small>{abilityLabels[key]}</small>
                              <div className="score-control">
                                <button onClick={() => changeAsiAbility(activeAdvancement.key, key, -1)} disabled={count === 0}>−</button>
                                <strong>+{count}</strong>
                                <button onClick={() => changeAsiAbility(activeAdvancement.key, key, 1)} disabled={activeAdvancement.asiChoices.length >= 2 || count >= 2 || beforeAsi + count >= 20}>+</button>
                              </div>
                              <b>{beforeAsi} → {beforeAsi + count}</b>
                            </section>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {activeAdvancement.featId !== "asi" && featChoiceGroups(activeAdvancement, spells).length > 0 && (
                    <div className="feat-choice-builder">
                      <div className="ability-editor-head">
                        <div><small>Обязательные решения черты</small><h2>Настройте «{feats.find(feat => feat.id === activeAdvancement.featId)?.name}»</h2></div>
                        <span>{advancementChoiceComplete(activeAdvancement, spells) ? "Готово" : "Не завершено"}</span>
                      </div>
                      {featChoiceGroups(activeAdvancement, spells).map(group => {
                        const selected = activeAdvancement.featChoices?.[group.key] || [];
                        return <section className="feat-choice-group" key={group.key}>
                          <header><div><h3>{group.title}</h3><p>{group.description}</p></div><strong>{selected.length} / {group.count}</strong></header>
                          <div className="feat-choice-options">
                            {group.options.map(option => <button key={option.id} className={selected.includes(option.id) ? "selected" : ""} onClick={() => toggleFeatChoice(activeAdvancement.key, group.key, option.id, group.count)}>
                              <span>{selected.includes(option.id) ? "✓" : "+"}</span><strong>{option.name}</strong>{option.detail && <small>{option.detail}</small>}
                            </button>)}
                          </div>
                        </section>;
                      })}
                    </div>
                  )}
                  </>}
                </div>
              )}
            </div>
          )}

          {step === 7 && (
            <>
              {!spellRule.caster ? (
                <div className="empty-state"><span>◇</span><h2>У класса нет базового выбора заклинаний</h2><p>Перейдите к характеру или вернитесь к выбору класса.</p></div>
              ) : (
                <>
                  <div className="spell-requirements">
                    <div><span>Заговоры</span><strong className={selectedCantrips.length === spellRule.cantrips ? "complete" : ""}>{selectedCantrips.length} / {spellRule.cantrips}</strong></div>
                    <div><span>{spellRule.title}</span><strong className={selectedLeveled.length === spellRule.leveled ? "complete" : ""}>{selectedLeveled.length} / {spellRule.leveled}</strong></div>
                    {spellRule.mode === "spellbook" && <div><span>Подготовлено из книги</span><strong className={selectedPrepared.length === spellRule.prepared ? "complete" : ""}>{selectedPrepared.length} / {spellRule.prepared}</strong></div>}
                    <div><span>Доступный круг</span><strong>0–{spellRule.maxLevel}</strong></div>
                    <button onClick={chooseOptimalSpells}>✦ Выбрать оптимальный готовый список</button>
                  </div>
                  {spellRule.levelLimits ? (
                    <div className="spell-level-quotas">
                      {spellRule.levelLimits.slice(1).map((limit, index) => {
                        const level = index + 1;
                        const selected = selectedAtOrAbove[level] || 0;
                        return <div key={level} className={selected >= limit ? "at-limit" : ""}><span>{level} круг и выше</span><strong>{selected} / {limit}</strong><small>максимум</small></div>;
                      })}
                    </div>
                  ) : (
                    <p className="rule-note">Подготавливаемые заклинания можно распределять между доступными кругами в любой комбинации: ограничение задаёт общий размер подготовленного списка.</p>
                  )}
                  {!!alwaysPreparedEntries.length && (
                    <div className="always-prepared">
                      <div><small>Класс и подкласс</small><h2>Всегда подготовлены</h2><p>Добавляются автоматически, не занимают лимит и недоступны для повторного выбора.</p></div>
                      <div>{alwaysPreparedEntries.map(entry => {
                        const spell = spells.find(item => item.id === entry.id);
                        return spell ? <span className="always-prepared-spell" key={spell.id}><a href={spell.url || `https://dnd.su/spells/?search=${encodeURIComponent(spell.name)}`} target="_blank" rel="noreferrer">{spell.name} · {levelLabel(spell.level)} ↗</a><small>{entry.source}</small></span> : null;
                      })}</div>
                    </div>
                  )}
                  {spellRule.mode === "spellbook" && (
                    <div className="prepared-picker">
                      <div className="ability-editor-head"><div><small>Текущий список на день</small><h2>Подготовить из книги</h2></div><span>{selectedPrepared.length} / {spellRule.prepared}</span></div>
                      <p>Заговоры не подготавливаются. Выберите заклинания из книги; автоматически подготовленные заклинания находятся выше и не расходуют этот лимит.</p>
                      <div>
                        {selectedLeveled.map(id => {
                          const spell = spells.find(item => item.id === id);
                          return spell ? <button key={id} className={selectedPrepared.includes(id) ? "selected" : ""} onClick={() => togglePreparedSpell(id)}><span>{selectedPrepared.includes(id) ? "✓" : "+"}</span><strong>{spell.name}</strong><small>{levelLabel(spell.level)}</small></button> : null;
                        })}
                      </div>
                    </div>
                  )}
                  <div className="tools">
                    <label className="search">⌕<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Название, школа или эффект" /></label>
                    <select value={source} onChange={event => setSource(event.target.value)}>{sources.map(value => <option key={value}>{value}</option>)}</select>
                  </div>
                  <div className="spell-level-filter" aria-label="Фильтр заклинаний по кругу">
                    <button className={spellLevel === "all" ? "active" : ""} onClick={() => setSpellLevel("all")}>Все</button>
                    {Array.from({ length: spellRule.maxLevel + 1 }, (_, level) => (
                      <button key={level} className={spellLevel === level ? "active" : ""} onClick={() => setSpellLevel(level)}>{levelLabel(level)}</button>
                    ))}
                  </div>
                  <div className="spell-list">
                    {filteredSpells.map(spell => (
                      <article key={spell.id} className={character.spells.includes(spell.id) ? "selected" : ""}>
                        <span className="spell-level">{spell.level}</span>
                        <div><h3>{spell.name}</h3><small>{levelLabel(spell.level)} · {spell.school} · {spell.source}{spell.ritual ? " · ритуал" : ""}{isTashaAdditionalSpell(character, spell.id) && !spell.classes.includes(character.className) ? " · расширенный список TCE" : ""}{chosenSubclass?.expandedSpells?.includes(spell.id) && !spell.classes.includes(character.className) ? ` · список: ${chosenSubclass.name}` : ""}</small><p>{spell.description}</p></div>
                        <div className="spell-actions"><a href={spell.url || `https://dnd.su/spells/?search=${encodeURIComponent(spell.name)}`} target="_blank" rel="noreferrer" aria-label={`Открыть ${spell.name} на dnd.su`}>dnd.su ↗</a><button onClick={() => toggleSpell(spell.id)}>{character.spells.includes(spell.id) ? "✓" : "+"}</button></div>
                      </article>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {step === 8 && (
            <div className="skill-sections language-step proficiency-choice-step">
              <section className="skill-source">
                <div className="skill-source-head"><div><small>Раса, подраса, класс и предыстория</small><h2>Известные языки</h2></div><strong>{(character.languages || []).length} / {languageRequirements.choices}</strong></div>
                <p>Фиксированные языки отмечены галочкой. Выберите ещё {languageRequirements.choices}; этот выбор попадёт на итоговый лист и в оба экспорта.</p>
                <div className="proficiency-grid">
                  {languageRequirements.fixed.map(language => <button disabled className="selected" key={language}><span>✓</span>{language}</button>)}
                  {knownLanguageOptions.filter(language => !languageRequirements.fixed.includes(language)).map(language => (
                    <button key={language} className={(character.languages || []).includes(language) ? "selected" : ""} onClick={() => toggleLanguage(language)}>
                      <span>{(character.languages || []).includes(language) ? "✓" : "+"}</span>{language}
                    </button>
                  ))}
                </div>
              </section>
              {proficiencyRequirements.map(requirement => {
                const selected = character.proficiencyChoices?.[requirement.key] || [];
                return <section className="skill-source" key={requirement.key}>
                  <div className="skill-source-head"><div><small>{requirement.source}</small><h2>{requirement.title}</h2></div><strong>{selected.length} / {requirement.count}</strong></div>
                  <p>{requirement.description}</p>
                  <div className="proficiency-grid">
                    {requirement.options.map(option => {
                      const usedElsewhere = !selected.includes(option) && proficiencyChoiceUsedElsewhere(exportCharacter, requirement.key, option);
                      return <button key={option} disabled={usedElsewhere} title={usedElsewhere ? "Этот вариант уже выбран в другой таблице" : undefined} className={selected.includes(option) ? "selected" : ""} onClick={() => toggleProficiencyChoice(requirement.key, option, requirement.count)}>
                      <span>{selected.includes(option) ? "✓" : "+"}</span>{option}
                      {usedElsewhere && <small>Уже выбрано</small>}
                    </button>;})}
                  </div>
                </section>;
              })}
              {!proficiencyRequirements.length && <section className="skill-source"><div className="skill-source-head"><div><small>Инструменты</small><h2>Дополнительного выбора нет</h2></div><strong>✓</strong></div><p>Все владения инструментами, оружием и доспехами этого персонажа выдаются фиксированно и уже внесены в итоговый список.</p></section>}
            </div>
          )}

          {step === 9 && (
            <div className="personality-builder">
              <div className="personality-toolbar">
                <div><small>Основано на предыстории</small><strong>{selectedBackground?.name}</strong></div>
                <button onClick={randomizeAllPersonality}>Случайно заполнить всё</button>
              </div>
              {(Object.keys(personalityNames) as PersonalityKey[]).map(key => (
                <section key={key} className="personality-card">
                  <header><div><small>{personalityHints[key]}</small><h2>{personalityNames[key]}</h2></div><button onClick={() => randomPersonality(key)}>⚄ Случайно</button></header>
                  <textarea value={character.personality[key]} onChange={event => setPersonality(key, event.target.value)} placeholder="Напишите свой вариант…" />
                  <label>
                    <span>Или выберите готовый вариант</span>
                    <select value="" onChange={event => event.target.value && setPersonality(key, event.target.value)}>
                      <option value="">Выбрать из списка…</option>
                      {personalityLists[key].map(value => <option key={value} value={value}>{value}</option>)}
                    </select>
                  </label>
                </section>
              ))}
            </div>
          )}

          {step === 10 && (
            <div className="final-workspace">
              <div className="identity-editor">
                <label>Имя персонажа<input value={character.name} onChange={event => setCharacter(current => ({ ...current, name: event.target.value }))} placeholder="Введите имя" /></label>
                <label>Имя игрока<input value={character.playerName} onChange={event => setCharacter(current => ({ ...current, playerName: event.target.value }))} placeholder="Необязательно" /></label>
                <label>Мировоззрение<select value={character.alignment} onChange={event => setCharacter(current => ({ ...current, alignment: event.target.value }))}>{alignments.map(value => <option key={value} value={value}>{value || "Не выбрано"}</option>)}</select></label>
              </div>
              <div className="sheet-page">
                <header className="sheet-header">
                  <div className="sheet-name"><h2>{character.name || "Безымянный герой"}</h2><small>ИМЯ ПЕРСОНАЖА</small></div>
                  <div className="sheet-identity">
                    <div><strong>{selectedClass?.name} {character.level}{chosenSubclass ? ` · ${chosenSubclass.name}` : ""}</strong><small>КЛАСС, УРОВЕНЬ И ПОДКЛАСС</small></div>
                    <div><strong>{selectedBackground?.name}</strong><small>ПРЕДЫСТОРИЯ</small></div>
                    <div><strong>{character.playerName || "—"}</strong><small>ИМЯ ИГРОКА</small></div>
                    <div><strong>{selectedRace?.name}{chosenRaceVariant ? ` · ${chosenRaceVariant.name}` : ""}</strong><small>РАСА И ПОДРАСА</small></div>
                    <div><strong>{character.alignment || "—"}</strong><small>МИРОВОЗЗРЕНИЕ</small></div>
                    <div><strong>2014</strong><small>РЕДАКЦИЯ</small></div>
                  </div>
                </header>
                <div className="sheet-main">
                  <section className="sheet-stats">
                    {(Object.keys(abilityLabels) as (keyof ExportCharacter["abilities"])[]).map(key => (
                      <div className="stat-block" key={key}><small>{abilityLabels[key]}</small><strong>{abilityModifier(finalAbilities[key]) >= 0 ? "+" : ""}{abilityModifier(finalAbilities[key])}</strong><span>{finalAbilities[key]}</span></div>
                    ))}
                    <div className="sheet-box passive"><strong>{passivePerception}</strong><span>ПАССИВНАЯ МУДРОСТЬ</span></div>
                    <div className="sheet-box prof-list"><h3>ВЛАДЕНИЯ И ЯЗЫКИ</h3><p><b>Навыки:</b> {proficiencies.skills.join(", ") || "нет"}</p><p><b>Инструменты:</b> {proficiencies.tools.join(", ") || "нет"}</p><p><b>Языки:</b> {proficiencies.languages.join(", ") || "нет"}</p><p><b>Доспехи:</b> {proficiencies.armor.join(", ") || "нет"}</p><p><b>Оружие:</b> {proficiencies.weapons.join(", ") || "нет"}</p></div>
                  </section>
                  <section className="sheet-combat">
                    <div className="combat-row">
                      <div className="shield" title={`${ac.base}${ac.bonuses.length ? `; ${ac.bonuses.join(", ")}` : ""}`}><strong>{ac.value}</strong><span>КД</span></div>
                      <div className="combat-tile"><strong>{abilityModifier(finalAbilities.dex) >= 0 ? "+" : ""}{abilityModifier(finalAbilities.dex)}</strong><span>ИНИЦИАТИВА</span></div>
                      <div className="combat-tile"><strong>{character.race === "dwarf" ? 25 : chosenRaceVariant?.id === "wood" ? 35 : 30}</strong><span>СКОРОСТЬ</span></div>
                    </div>
                    <div className="sheet-box hp"><strong>{hitPoints}</strong><span>МАКСИМУМ ХИТОВ</span></div>
                    <div className="sheet-box hit-dice"><strong>{character.level}к{classRules[character.className]?.hitDie || 8}</strong><span>КОСТИ ХИТОВ</span></div>
                    {(resources.length > 0 || spellRule.slots.length > 0 || spellRule.pact) && <div className="sheet-box sheet-resources">
                      {spellRule.slots.map((maximum, circle) => <label key={`slot-${circle}`}><span>Ячейки {circle + 1} круга</span><input aria-label={`Оставшиеся ячейки ${circle + 1} круга`} type="number" min="0" max={maximum} value={maximum - (character.spellSlotsUsed?.[circle] || 0)} onChange={event => setUsedSlots(circle, maximum - +event.target.value, maximum)} /><b>/ {maximum}</b></label>)}
                      {spellRule.pact && <label><span>Ячейки договора ({spellRule.pact.level} круг)</span><input aria-label="Оставшиеся ячейки договора" type="number" min="0" max={spellRule.pact.slots} value={spellRule.pact.slots - (character.pactSlotsUsed || 0)} onChange={event => setCharacter(current => ({ ...current, pactSlotsUsed: Math.max(0, Math.min(spellRule.pact!.slots, spellRule.pact!.slots - +event.target.value)) }))} /><b>/ {spellRule.pact.slots}</b></label>}
                      {resources.map(resource => <label key={resource.key}><span>{resource.name}{resource.die ? ` (${resource.die})` : ""}</span><input aria-label={`Текущее значение: ${resource.name}`} type="number" min="0" max={resource.max} value={resourceCurrent(exportCharacter, resource)} onChange={event => setResourceCurrent(resource.key, +event.target.value, resource.max)} /><b>/ {resource.max}</b></label>)}
                      <h3>ЯЧЕЙКИ И РЕСУРСЫ</h3>
                    </div>}
                    <div className="sheet-box spell-summary">
                      <h3>АТАКИ И ЗАКЛИНАНИЯ</h3>
                      <div className="attack-table">
                        <div className="attack-head"><b>Атака</b><b>Попадание / Сл</b><b>Урон</b></div>
                        {attacks.length ? attacks.map(attack => (
                          <div className="attack-line" key={attack.id}>
                            <span>{attack.name}{attack.kind === "cantrip" ? " ✦" : ""}</span>
                            <b>{attack.attackBonus !== undefined ? `${attack.attackBonus >= 0 ? "+" : ""}${attack.attackBonus}` : `Сл ${attack.saveDc}`}</b>
                            <code>{attack.damageDisplay}</code>
                            {attack.note && <small>{attack.note}</small>}
                          </div>
                        )) : <p>Выберите стартовое оружие или боевой заговор.</p>}
                      </div>
                      {spellAbilityKey && <p><b>Сл заклинаний:</b> {spellSaveDc} · <b>атака:</b> {spellAttackBonus >= 0 ? "+" : ""}{spellAttackBonus}</p>}
                      {[...new Set([...character.spells, ...grantedFeatSpells, ...alwaysPrepared])].length ? [...new Set([...character.spells, ...grantedFeatSpells, ...alwaysPrepared])].map(id => {
                        const spell = spells.find(item => item.id === id);
                        if (!spell) return null;
                        const status = alwaysPrepared.includes(id)
                          ? "всегда подготовлено, вне лимита"
                          : spellRule.mode === "spellbook" && spell.level > 0
                            ? selectedPrepared.includes(id) ? "подготовлено" : "в книге"
                            : spellRule.mode === "prepared" && spell.level > 0 ? "подготовлено" : "";
                        return <p key={id}><a href={spell.url || `https://dnd.su/spells/?search=${encodeURIComponent(spell.name)}`} target="_blank" rel="noreferrer"><b>{spell.name}</b></a> — {levelLabel(spell.level)}, {spell.school}. {spell.description}{status ? ` (${status})` : ""}</p>;
                      }) : <p>Заклинания не выбраны.</p>}
                    </div>
                  </section>
                  <section className="sheet-story">
                    {(Object.keys(personalityNames) as PersonalityKey[]).map(key => (
                      <div className="sheet-box story-box" key={key}><p>{character.personality[key] || "—"}</p><h3>{personalityNames[key]}</h3></div>
                    ))}
                    <div className="sheet-box feature-box">
                      <h3>УМЕНИЯ И СПОСОБНОСТИ</h3>
                      <h4>{selectedRace?.name}: расовые особенности</h4>
                      {chosenRaceVariant && <p><b>{chosenRaceVariant.name}.</b> {chosenRaceVariant.description}</p>}
                      {selectedRaceFeatures.map(feature => <p key={feature.name}><b>{feature.name}.</b> {feature.description}</p>)}
                      <h4>{selectedClass?.name}: классовые особенности до {character.level} уровня</h4>
                      {selectedClassFeatures.map(feature => <p key={`${feature.level}-${feature.name}`}><b>{feature.level} ур. · {feature.name}.</b> {feature.description}</p>)}
                      {selectedFeatFeatures.length > 0 && <><h4>Черты</h4>{selectedFeatFeatures.map(feature => <p key={feature.name}><b>{feature.name}.</b> {feature.description}</p>)}</>}
                      <h4>{selectedBackground?.name}: предыстория</h4>
                      <p>{selectedBackground?.description}</p>
                      <p><b>{selectedBackgroundRule.feature.name}.</b> {selectedBackgroundRule.feature.description}</p>
                    </div>
                    <div className="sheet-box feature-box"><h3>СТАРТОВОЕ СНАРЯЖЕНИЕ</h3><p>{equipmentItems.join(" · ") || "Не выбрано"}</p><p><b>Расчёт КД:</b> {ac.base}{ac.bonuses.length ? `; ${ac.bonuses.join(", ")}` : ""} = <b>{ac.value}</b></p></div>
                  </section>
                </div>
              </div>
              <div className="export-panel">
                <div>
                  <small>Проверено по приложенным образцам</small>
                  <h2>Экспорт листа</h2>
                  <p>Укажите уже потраченные ячейки, если переносите персонажа из текущей игры. У нового героя оставьте нули.</p>
                  <p className="export-compatibility">Long Story Short получает заклинания текстовым списком по кругам со ссылками: карточки LSS используют закрытые внутренние ID. Helpmate получает числовые ID dnd.su.</p>
                  <details className="known-limitations">
                    <summary>Известные ограничения и временные решения</summary>
                    {knownLimitations.map(item => <p key={item.area}><b>{item.area} · {item.status}.</b> {item.text}</p>)}
                  </details>
                </div>
                {spellRule.slots.length > 0 && <div className="slot-usage-editor">
                  {spellRule.slots.map((maximum, circle) => <label key={circle}><span>{circle + 1} круг</span><input type="number" min="0" max={maximum} value={character.spellSlotsUsed?.[circle] || 0} onChange={event => setUsedSlots(circle, +event.target.value, maximum)} /><small>потрачено из {maximum}</small></label>)}
                </div>}
                {spellRule.pact && <div className="slot-usage-editor"><label><span>Ячейки договора</span><input type="number" min="0" max={spellRule.pact.slots} value={character.pactSlotsUsed || 0} onChange={event => setCharacter(current => ({ ...current, pactSlotsUsed: Math.max(0, Math.min(spellRule.pact!.slots, +event.target.value)) }))} /><small>потрачено из {spellRule.pact.slots}</small></label></div>}
                {resources.length > 0 && <div className="slot-usage-editor resource-usage-editor">
                  {resources.map(resource => <label key={resource.key}><span>{resource.name}</span><input type="number" min="0" max={resource.max} value={resourceCurrent(exportCharacter, resource)} onChange={event => setResourceCurrent(resource.key, +event.target.value, resource.max)} /><small>осталось из {resource.max}{resource.die ? ` · ${resource.die}` : ""}</small></label>)}
                </div>}
                <button onClick={resetCurrentCharacter}>Сбросить</button>
                <button onClick={exportNative}>Наш JSON</button>
                <button onClick={() => window.print()}>Печать / PDF</button>
                <button onClick={exportHelpmate}>Helpmate JSON</button>
                <button className="primary-action" onClick={exportLongStoryShort}>Long Story Short JSON</button>
              </div>
            </div>
          )}

          <div className="mobile-actions">
            {step > 0 && <button onClick={() => resetFilters(step - 1)}>← Назад</button>}
            {step < steps.length - 1 && <button disabled={!canContinue()} onClick={() => resetFilters(step + 1)}>Продолжить →</button>}
          </div>
        </section>
        <aside className="summary">
          <div className="summary-ornament">✦</div>
          <p className="eyebrow">Ваш герой</p>
          <CatalogIcon
            id={selectedClass?.id || selectedRace?.id}
            kind={selectedClass ? "class" : "race"}
            fallback={selectedClass?.name || selectedRace?.name || "Новый герой"}
            className="portrait"
          />
          <h2>{character.name || selectedRace?.name || "Новый герой"}</h2>
          <p className="summary-line">{selectedRace?.name || "Раса не выбрана"} · {selectedClass?.name || "Класс не выбран"}</p>
          <div className="summary-facts">
            <div><span>Уровень</span><strong>{character.level}</strong></div>
            <div><span>Предыстория</span><strong>{selectedBackground?.name || "—"}</strong></div>
            <div><span>Владения</span><strong>{proficiencies.skills.length || "—"}</strong></div>
            <div><span>Языки</span><strong>{knownLanguages.length || "—"}</strong></div>
            <div><span>Снаряжение</span><strong>{equipmentItems.length || "—"}</strong></div>
            <div><span>Заклинания</span><strong>{character.spells.length + alwaysPrepared.length || "—"}</strong></div>
          </div>
          <div className="progress-label"><span>Шаг {step + 1} из {steps.length}</span><span>{Math.round((step + 1) / steps.length * 100)}%</span></div>
          <div className="progress"><i style={{ width: `${(step + 1) / steps.length * 100}%` }} /></div>
          {step > 0 && <button className="back" onClick={() => resetFilters(step - 1)}>← Назад</button>}
          {step < steps.length - 1
            ? <button className="primary-action" disabled={!canContinue()} onClick={() => resetFilters(step + 1)}>Продолжить <span>→</span></button>
            : <button className="primary-action" onClick={exportLongStoryShort}>Long Story Short <span>↓</span></button>}
        </aside>
      </div>
      <footer>Неофициальный инструмент для личного некоммерческого использования. Dungeons &amp; Dragons и названия книг принадлежат правообладателям. Описания оригинально сформулированы для этого приложения.</footer>
    </main>
  );
}
