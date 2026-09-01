import type { CatalogOption, CatalogSpell } from "./catalog";
import { dndSpellUrl, helpmateSpellId } from "./exportIds";
import { abilityLabels, classRules, skillKeys, type Feature } from "./rules";
import { spellSelectionRule } from "./characterRules";
import { characterResources, resourceCurrent } from "./characterResources";
import { backgroundRule } from "./backgroundRules";
import { selectedEquipment } from "./equipment";
import { characterAttacks, lssWeaponAttacks } from "./combat";
import { characterExpertiseSkills, characterProficiencies } from "./proficiencies";
import { armorClass } from "./armor";
import { externalSkillId } from "./skillIds";

export type AbilityScores = Record<"str" | "dex" | "con" | "int" | "wis" | "cha", number>;
export type Currency = { gp: number; sp: number; cp: number; pp: number };

export type AdvancementChoice = {
  key: string;
  level: number;
  origin?: boolean;
  bonus?: boolean;
  featId: string;
  asiChoices: (keyof AbilityScores)[];
  featChoices?: Record<string, string[]>;
};

export type ExportCharacter = {
  name: string;
  playerName: string;
  experience?: number;
  inspiration?: boolean;
  race: string;
  raceVariant: string;
  raceAbilityChoices?: (keyof AbilityScores)[];
  raceSkills?: string[];
  className: string;
  subclass?: string;
  background: string;
  classSkills: string[];
  backgroundSkills: string[];
  backgroundChoices?: Record<string, string[]>;
  /** Skills whose proficiency bonus is doubled (LSS isProf = 2). */
  expertiseSkills?: string[];
  level: number;
  spells: string[];
  preparedSpells?: string[];
  mobilePreparedConfigured?: boolean;
  /** Opaque LSS card ids retained for a lossless LSS -> app -> LSS round trip. */
  lssSpellCards?: {
    mode: "cards";
    prepared: string[];
    book: string[];
    edition?: string;
    /** LSS ObjectId -> our catalog id. Unknown cards stay in the arrays above. */
    resolved?: Record<string, string>;
  };
  feats?: string[];
  asiChoices?: (keyof AbilityScores)[];
  advancements?: AdvancementChoice[];
  classChoices?: Record<string, string[]>;
  equipmentSelections?: Record<string, string[]>;
  /** Редактируемое содержимое рюкзака; если его нет, показывается стартовое снаряжение. */
  inventoryOverride?: string;
  /** Монеты хранятся отдельно от списка снаряжения, чтобы их можно было быстро менять на листе. */
  currency?: Currency;
  languages?: string[];
  proficiencyChoices?: Record<string, string[]>;
  resourceSpent?: Record<string, number>;
  spellSlotsUsed?: number[];
  pactSlotsUsed?: number;
  currentHitPoints?: number;
  temporaryHitPoints?: number;
  hitDiceSpent?: number;
  deathSaveSuccesses?: number;
  deathSaveFailures?: number;
  useTasha?: boolean;
  /** Campaign ban-list switch: removes all TCE catalogue additions. */
  tceFullBanned?: boolean;
  alignment: string;
  abilities: AbilityScores;
  personality: {
    traits: string;
    ideals: string;
    bonds: string;
    flaws: string;
  };
};

type ExportContext = {
  character: ExportCharacter;
  race?: CatalogOption;
  characterClass?: CatalogOption;
  background?: CatalogOption;
  spells: CatalogSpell[];
  raceFeatureList: Feature[];
  classFeatureList: Feature[];
  raceProficiencies?: string[];
  subclassName?: string;
  raceVariantName?: string;
  featNames?: string[];
  featFeatureList?: Feature[];
  featSpellIds?: string[];
  alwaysPreparedSpellIds?: string[];
};

export function abilityModifier(score: number) {
  return Math.floor((score - 10) / 2);
}

export function proficiencyBonus(level: number) {
  return 2 + Math.floor((Math.max(1, level) - 1) / 4);
}

const helpmateAbilityKey: Record<keyof AbilityScores, number> = {
  str: 1,
  dex: 2,
  con: 3,
  int: 4,
  wis: 5,
  cha: 6,
};

export function darkvisionDistance(features: Feature[]) {
  return features.reduce((distance, feature) => {
    if (!/т[её]мное зрение/i.test(feature.name)) return distance;
    const featureDistance = /превосходное/i.test(feature.name) || /120\s*фут/i.test(feature.description) || /больш(ой|ую) дистанц/i.test(feature.description) ? 120 : 60;
    return Math.max(distance, featureDistance);
  }, 0);
}

export function estimatedHitPoints(character: ExportCharacter) {
  const hitDie = classRules[character.className]?.hitDie || 8;
  const constitution = abilityModifier(character.abilities.con);
  return Math.max(1, hitDie + constitution + (character.level - 1) * Math.max(1, Math.floor(hitDie / 2) + 1 + constitution));
}

function makeId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const value = [...bytes].map(byte => byte.toString(16).padStart(2, "0")).join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function featureText(features: Feature[]) {
  return features.map(feature => `${feature.name}. ${feature.description}`).join("\n");
}

const helpmateLanguageIds: Readonly<Record<string, string>> = Object.freeze({
  "Общий": "12", "Гномий": "13", "Дварфский": "14", "Полуросликов": "15", "Эльфийский": "16", "Орочий": "17", "Великаний": "18", "Гоблинский": "19", "Драконий": "20", "Бездны": "21", "Глубинная речь": "22", "Инфернальный": "23", "Небесный": "24", "Первичный": "25", "Подземный": "26", "Сильван": "27", "Ауран": "28", "Телепатия": "29", "Гитский": "31", "Язык Жаболюдов": "32", "Акван": "33", "Терран": "34", "Игнан": "35", "Гноллий": "36", "Язык Греллов": "37", "Язык Крюкастых ужасов": "38", "Модронский": "39", "Отиджский": "40", "Сахуагинский": "41", "Слаадский": "42", "Язык Сфинксов": "43", "Три-кринский": "44", "Друидический": "45", "Троглодитский": "46", "Язык Бурых увальней": "47", "Язык Йети": "48", "Язык Воргов": "49", "Язык Гигантских сов": "50", "Язык Гигантских лосей": "51", "Язык Гигантских орлов": "52", "Язык Мерцающих псов": "53", "Язык Полярных волков": "54", "Воровской жаргон": "55", "Общий (Жесты)": "56", "Тэйский": "57",
});

function helpmateNote(context: ExportContext) {
  return summaryText(context).split(/\n\n+/).map(block => {
    const [title, ...body] = block.split("\n");
    const labeled = title.match(/^([^:]+):\s*(.*)$/);
    if (!labeled) return block.replace(/\n/g, "\r\n");
    return `<zag s=1>${labeled[1]}</zag>${labeled[2] ? ` ${labeled[2]}` : ""}${body.length ? `\r\n${body.join("\r\n")}` : ""}`;
  }).join("\r\n\r\n");
}

function summaryText(context: ExportContext) {
  const { character, race, characterClass, background, spells, raceFeatureList, classFeatureList } = context;
  const spellIds = [...new Set([...character.spells, ...(context.featSpellIds || []), ...(context.alwaysPreparedSpellIds || [])])];
  const selectedSpells = spellIds.map(id => spells.find(spell => spell.id === id)?.name).filter(Boolean);
  const alwaysPrepared = new Set(context.alwaysPreparedSpellIds || []);
  const preparedSpellIds = new Set([
    ...(character.preparedSpells || []),
    ...(context.alwaysPreparedSpellIds || []),
    ...(spellSelectionRule(character).mode === "prepared" ? character.spells.filter(id => (spells.find(spell => spell.id === id)?.level || 0) > 0) : []),
  ]);
  const preparedSpellNames = [...preparedSpellIds].map(id => spells.find(spell => spell.id === id)?.name).filter(Boolean);
  const alwaysPreparedNames = [...alwaysPrepared].map(id => spells.find(spell => spell.id === id)?.name).filter(Boolean);
  const spellAbility = classRules[character.className]?.spellAbility as keyof AbilityScores | undefined;
  const spellMod = spellAbility ? abilityModifier(character.abilities[spellAbility]) : 0;
  const spellDc = spellAbility ? 8 + proficiencyBonus(character.level) + spellMod : 0;
  const resources = characterResources(character).map(resource => `${resource.name}: ${resourceCurrent(character, resource)} / ${resource.max}${resource.die ? ` (${resource.die})` : ""}`);
  const backgroundData = backgroundRule(character.background, background);
  const equipment = selectedEquipment(character);
  const attacks = characterAttacks(character, spells);
  const proficiencies = characterProficiencies(character);
  return [
    `Имя: ${character.name || "Безымянный герой"}`,
    `Игрок: ${character.playerName || ""}`,
    `Класс: ${characterClass?.name || ""}, уровень ${character.level}${context.subclassName ? ` — ${context.subclassName}` : ""}`,
    `Раса: ${race?.name || ""}${context.raceVariantName ? ` — ${context.raceVariantName}` : ""}`,
    `Предыстория: ${background?.name || ""}`,
    `Особенность предыстории: ${backgroundData.feature.name}. ${backgroundData.feature.description}`,
    `Навыки: ${proficiencies.skills.join(", ") || "нет"}`,
    `Доспехи: ${proficiencies.armor.join(", ") || "нет"}`,
    `Оружие: ${proficiencies.weapons.join(", ") || "нет"}`,
    `Инструменты: ${proficiencies.tools.join(", ") || "нет"}`,
    `Языки: ${proficiencies.languages.join(", ") || "нет"}`,
    `Черты: ${(context.featNames || []).join(", ") || "нет"}`,
    `Черты характера: ${character.personality.traits}`,
    `Идеалы: ${character.personality.ideals}`,
    `Привязанности: ${character.personality.bonds}`,
    `Слабости: ${character.personality.flaws}`,
    `Расовые особенности:\n${featureText(raceFeatureList)}`,
    `Классовые особенности:\n${featureText(classFeatureList)}`,
    ...(spellAbility ? [`Сл спасброска заклинаний: ${spellDc}`, `Бонус атаки заклинанием: ${spellMod >= 0 ? "+" : ""}${proficiencyBonus(character.level) + spellMod}`] : []),
    `Ресурсы: ${resources.join("; ") || "нет"}`,
    `Снаряжение: ${equipment.join(", ") || "нет"}`,
    `Атаки: ${attacks.map(attack => `${attack.name} — ${attack.attackBonus !== undefined ? `атака ${attack.attackBonus >= 0 ? "+" : ""}${attack.attackBonus}` : `Сл ${attack.saveDc}`}, урон ${attack.damageDisplay}`).join("; ") || "нет"}`,
    `Заклинания: ${selectedSpells.join(", ") || "нет"}`,
    ...(preparedSpellNames.length ? [`Подготовлено: ${preparedSpellNames.join(", ")}`] : []),
    ...(alwaysPreparedNames.length ? [`Всегда подготовлено (не занимает лимит): ${alwaysPreparedNames.join(", ")}`] : []),
  ].join("\n\n");
}

const helpmateAbilityOrder: Record<keyof AbilityScores, string[]> = {
  str: ["Атлетика"],
  dex: ["Акробатика", "Ловкость рук", "Скрытность"],
  con: [],
  int: ["Магия", "История", "Расследование", "Природа", "Религия"],
  wis: ["Уход за животными", "Проницательность", "Медицина", "Внимательность", "Выживание"],
  cha: ["Обман", "Запугивание", "Выступление", "Убеждение"],
};

const helpmateAbilityNames: Record<keyof AbilityScores, string> = {
  str: "STR",
  dex: "DEX",
  con: "CON",
  int: "INT",
  wis: "WIS",
  cha: "CHA",
};

// Helpmate uses its own numeric class identifiers. These values are taken from
// the supplied clean class examples and named character sheets. Never send our
// readable ids: the desktop importer tries to deserialize them as its internal
// identifiers and crashes the whole load. Every value below is confirmed by a
// supplied Helpmate example; do not infer new ids from ordering.
export const helpmateClassIds: Readonly<Record<string, string>> = Object.freeze({
  barbarian: "11",
  bard: "12",
  cleric: "13",
  fighter: "14",
  monk: "15",
  paladin: "16",
  ranger: "17",
  rogue: "18",
  sorcerer: "19",
  warlock: "20",
  wizard: "21",
  druid: "22",
  artificer: "23",
});
export const helpmateSubclassClassIds: Readonly<Record<string, Readonly<Record<string, string>>>> = Object.freeze({
  fighter: Object.freeze({ eldritchknight: "25" }),
  rogue: Object.freeze({ arcanetrickster: "26" }),
});

function helpmateSelectedSpellIds(context: ExportContext) {
  return [...new Set([
    ...context.character.spells,
    ...(context.featSpellIds || []),
    ...(context.alwaysPreparedSpellIds || []),
  ])];
}

export function helpmateSkippedSpells(context: ExportContext) {
  return helpmateSelectedSpellIds(context)
    .filter(id => !helpmateSpellId(id))
    .map(id => context.spells.find(spell => spell.id === id))
    .filter((spell): spell is CatalogSpell => Boolean(spell));
}

export function createHelpmateExport(context: ExportContext) {
  const { character, race, raceFeatureList } = context;
  const selectedSkills = new Set(characterProficiencies(character).skills);
  const saves = new Set(classRules[character.className]?.saves || []);
  const hitPoints = estimatedHitPoints(character);
  const darkvision = darkvisionDistance(raceFeatureList);
  const fly = raceFeatureList.some(feature => feature.name.toLowerCase() === "полёт");
  const parameters = (Object.keys(helpmateAbilityOrder) as (keyof AbilityScores)[]).map(key => ({
    Name: helpmateAbilityNames[key],
    Value: character.abilities[key],
    UserSpasValue: 0,
    Proficiency: saves.has(key),
    Abilities: helpmateAbilityOrder[key].map(skill => ({
      UserValue: 0,
      MinValue: 0,
      Proficiency: selectedSkills.has(skill),
    })),
  }));
  const selectedHelpmateSpellIds = helpmateSelectedSpellIds(context)
    .map(helpmateSpellId)
    .filter((id): id is string => Boolean(id));
  const slotMaximums = standardSlotMaximums(character.className, character.level);
  const selectionRule = spellSelectionRule(character);
  const cantripCount = selectionRule.cantrips;
  const spellAbility = classRules[character.className]?.spellAbility as keyof AbilityScores | undefined;
  const spellModifier = spellAbility ? abilityModifier(character.abilities[spellAbility]) : 0;
  const spellAttack = proficiencyBonus(character.level) + spellModifier;
  const spellSaveDc = spellAbility ? 8 + spellAttack : null;
  const spellCells = [
    ...(cantripCount ? [{ Level: 0, Left: cantripCount, Max: cantripCount }] : []),
    ...slotMaximums.map((max, index) => ({ Level: index + 1, Left: Math.max(0, max - (character.spellSlotsUsed?.[index] || 0)), Max: max })),
    ...(selectionRule.pact ? [{
      Level: selectionRule.pact.level,
      Left: Math.max(0, selectionRule.pact.slots - (character.pactSlotsUsed || 0)),
      Max: selectionRule.pact.slots,
    }] : []),
  ];
  const helpmateClassId = helpmateSubclassClassIds[character.className]?.[character.subclass || ""] || helpmateClassIds[character.className];

  return {
    Id: makeId(),
    MyRaceId: null,
    UserRace: [race?.name, context.raceVariantName].filter(Boolean).join(" — "),
    TokenColor: "196|196|9|255",
    SecondName: null,
    Speed: race?.id === "dwarf" ? 25 : 30,
    IHaveLight: false,
    TorchValue: 0,
    TorchValueSecond: 0,
    CellEyeValue: darkvision,
    EyeEnabled: darkvision > 0,
    SoundFolder: null,
    ImDoubleHeal: false,
    SeeInTheDark: darkvision > 0,
    Gold: 0,
    Silver: 0,
    Copper: 0,
    HitPoints: hitPoints,
    CurrentHitPoints: hitPoints,
    TempHitPoints: 0,
    TempCurrentHitPoints: 0,
    HasInspiration: false,
    Alignment: 0,
    HitDice: classRules[character.className]?.hitDie || 8,
    HitDiceCount: character.level,
    IsArmorTakeOf: false,
    TwoHanded: false,
    FlyValue: fly ? 30 : 0,
    IsFly: fly,
    FamiliarId: null,
    // Helpmate stores this selector as a one-based ability index. Leaving 0
    // makes the app fall back to Strength even for Wisdom/Intelligence/Charisma casters.
    SelectedSaveThrowKey: spellAbility ? helpmateAbilityKey[spellAbility] : 0,
    SizeIndex: 2,
    TagString: null,
    Skills: [],
    Languages: characterProficiencies(character).languages.map(language => helpmateLanguageIds[language]).filter(Boolean).join(",") || "12",
    Multiplier: 1,
    TrueMultiplier: 0,
    Inspiration: 0,
    Armor: armorClass(character),
    Bditelnost: 10 + abilityModifier(character.abilities.wis) + (selectedSkills.has("Внимательность") ? proficiencyBonus(character.level) : 0),
    IniBonus: abilityModifier(character.abilities.dex),
    IsPlaying: true,
    Note: helpmateNote(context),
    FirstSpellText: spellSaveDc === null ? null : `Сл спасброска заклинаний: ${spellSaveDc}`,
    SecondSpellText: spellSaveDc === null ? null : `Бонус атаки заклинанием: ${spellAttack >= 0 ? "+" : ""}${spellAttack}`,
    Spells: selectedHelpmateSpellIds,
    HandsCapacity: 1,
    HandsItems: [],
    MainHandsItems: [],
    ArrowItems: [],
    InventoryItems: [],
    Parameters: parameters,
    Classes: helpmateClassId ? [{
      Id: helpmateClassId,
      Level: character.level,
      SpellCells: spellCells,
    }] : [],
    DamageResist: "",
    DamageImmun: "",
    DamageVulner: "",
    HasAura: false,
    AuraSize: 15,
    AuraAngle: 100,
    AuraAngleSize: 360,
    AuraOpacity: 1,
    AuraType: "",
    AuraColorEnable: true,
    ShowAuraCells: false,
    IsRotationEnable: false,
    IsWallBlock: false,
    ShowAuraToPlayers: true,
    CustomAuraImage: null,
    CustomStatuses: [],
  };
}

function richText(value: string, id: string) {
  const content = value
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(text => ({ type: "paragraph", content: [{ type: "text", text }] }));
  return {
    value: {
      id: `hover-toolbar-${id}-${Date.now()}`,
      data: {
        type: "doc",
        content: content.length ? content : [{ type: "paragraph" }],
      },
    },
  };
}

function richLabeledText(lines: Array<[string, string]>, id: string) {
  const content = lines.map(([label, value]) => ({
    type: "paragraph",
    content: [
      { type: "text", marks: [{ type: "bold" }], text: `${label}: ` },
      { type: "text", text: value || "нет" },
    ],
  }));
  return { value: { id: `hover-toolbar-${id}-${Date.now()}`, data: { type: "doc", content } } };
}

function richFeatureText(features: Feature[], id: string) {
  const content = features.flatMap(feature => {
    const heading = `${feature.name}.`;
    return [{
      type: "paragraph",
      content: [
        { type: "text", marks: [{ type: "bold" }], text: heading },
        { type: "text", text: ` ${feature.description}` },
      ],
    }];
  });
  return {
    value: {
      id: `hover-toolbar-${id}-${Date.now()}`,
      data: { type: "doc", content: content.length ? content : [{ type: "paragraph" }] },
    },
  };
}

const mechanicalVerbs = /бонусным действием|действием|реакци|спасброс|провер(?:к|ок)|атак|урон|трат|использ|соверш|накладыва|восстанавлив|до конца|в течение|раз за|после короткого|после продолжительного|помех|преимуществ|сопротивлен|иммунитет|игнорир|кость|считается|сл\s|кд/i;
const briefGrant = /получаете владение|получаете компетентность|увеличивается на|повышается на|изучаете язык|изучаете .*заговор|получаете .*язык/i;

/** Removes source appendices and prose that duplicates other LSS blocks while retaining play instructions. */
function conciseLssFeature(feature: Feature, required = false): Feature | null {
  if (!required && /^использование заклинаний$/i.test(feature.name)) return null;
  let description = feature.description
    .split(/\n(?:источники|источник|официальные книги|правовой статус|исключено|приложение:)/i)[0]
    .replace(/•\s*-{5,}[\s\S]*/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!description) return required ? { ...feature, description: "Выбранная черта персонажа." } : null;
  if (feature.name === "Всплеск действий") return { ...feature, description };
  const sentences = description.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map(value => value.trim()) || [description];
  if (briefGrant.test(description) && !mechanicalVerbs.test(description.replace(briefGrant, ""))) {
    description = sentences.slice(0, 2).join(" ");
  } else if (description.length > 900) {
    const important = sentences.filter(sentence => mechanicalVerbs.test(sentence));
    description = [...new Set([sentences[0], ...important])].join(" ").slice(0, 1400).trim();
  }
  return { ...feature, description };
}

function distributeLssNotes(groups: Array<{ label: string; features: Feature[]; required?: boolean }>, count = 5, budget = 2200) {
  const entries = groups.flatMap(group => group.features.map(feature => {
    const concise = conciseLssFeature(feature, group.required);
    return concise ? { ...concise, name: `${group.label} · ${concise.name}` } : null;
  })).filter(Boolean) as Feature[];
  const notes: Feature[][] = Array.from({ length: count }, () => []);
  let note = 0;
  for (const feature of entries) {
    const length = feature.name.length + feature.description.length;
    const used = notes[note].reduce((total, item) => total + item.name.length + item.description.length, 0);
    if (note < count - 1 && notes[note].length && used + length > budget) note += 1;
    notes[note].push(feature);
  }
  return notes;
}

function lssFeatureOrder(feature: Feature) {
  if (/дополнительн.*атак|мультиатак|четыре атаки/i.test(feature.name)) return -200;
  if (/ув[её]ртливость|уворот/i.test(feature.name)) return -190;
  return feature.level || 1;
}

function orderedLssFeatures(features: Feature[]) {
  return features.map((feature, index) => ({ feature, index }))
    .sort((a, b) => lssFeatureOrder(a.feature) - lssFeatureOrder(b.feature) || a.index - b.index)
    .map(item => item.feature);
}

function richSpellText(spells: CatalogSpell[], level: number) {
  const content = spells
    .filter(spell => spell.level === level)
    .map(spell => ({
      type: "paragraph",
      content: [{
        type: "text",
        marks: [{
          type: "link",
          attrs: {
            href: dndSpellUrl(spell.id) || spell.url || `https://dnd.su/spells/?search=${encodeURIComponent(spell.name)}`,
            target: "_blank",
            rel: "noopener noreferrer nofollow",
            class: null,
          },
        }],
        text: spell.name,
      }],
    }));
  return {
    value: {
      id: `hover-toolbar-spells-level-${level}-${Date.now()}`,
      data: { type: "doc", content: content.length ? content : null },
    },
  };
}

const skillEnglish: Record<string, { baseStat: string; name: string }> = Object.fromEntries(
  Object.values(skillKeys).map(({ key, stat }) => [key, { baseStat: stat, name: key }]),
);

const fullCasterSlots = [
  [],
  [2],
  [3],
  [4, 2],
  [4, 3],
  [4, 3, 2],
  [4, 3, 3],
  [4, 3, 3, 1],
  [4, 3, 3, 2],
  [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1],
];

function standardSlotMaximums(classId: string, level: number) {
  const full = ["bard", "cleric", "druid", "sorcerer", "wizard"].includes(classId);
  const half = ["paladin", "ranger"].includes(classId);
  const artificer = classId === "artificer";
  if (!full && !half && !artificer) return [];
  const casterLevel = full ? level : artificer ? Math.ceil(level / 2) : Math.floor(level / 2);
  return fullCasterSlots[casterLevel] || [];
}

function lssSlots(classId: string, level: number) {
  const slots = standardSlotMaximums(classId, level);
  return Object.fromEntries(slots.map((value, index) => [`slots-${index + 1}`, { value }]));
}

function lssSlotState(classId: string, level: number, used: number[] = []) {
  const slots = standardSlotMaximums(classId, level);
  return Object.fromEntries(slots.flatMap((maximum, circle) =>
    Array.from({ length: maximum }, (_, index) => [`level-${circle + 1}-slot-${index}`, { isChecked: index < (used[circle] || 0) }]),
  ));
}

function lssPact(classId: string, level: number, used = 0) {
  if (classId !== "warlock" || level < 1) return {};
  const slotLevel = Math.min(5, Math.ceil(level / 2));
  const slotCount = level === 1 ? 1 : level < 11 ? 2 : level < 17 ? 3 : 4;
  return {
    level: { value: slotLevel },
    slots: { value: slotCount },
    used: { value: Math.max(0, Math.min(slotCount, used)) },
  };
}

function lssSkills(selectedSkills: Set<string>, expertiseSkills: Set<string>) {
  const ordered = [
    "acrobatics", "investigation", "athletics", "perception", "survival", "performance",
    "intimidation", "history", "sleight of hand", "arcana", "medicine", "deception",
    "nature", "insight", "religion", "stealth", "persuasion", "animal handling",
  ];
  const selectedEnglish = new Set(
    [...selectedSkills].map(externalSkillId).filter(Boolean),
  );
  const expertiseEnglish = new Set(
    [...expertiseSkills].map(externalSkillId).filter(Boolean),
  );
  return Object.fromEntries(
    ordered.map(key => [key, { ...skillEnglish[key], isProf: expertiseEnglish.has(key) ? 2 : selectedEnglish.has(key) ? 1 : 0 }]),
  );
}

export function createLongStoryShortExport(context: ExportContext) {
  const { character, race, characterClass, background, spells, raceFeatureList, classFeatureList } = context;
  const proficiencies = characterProficiencies(character);
  const selectedSkills = new Set(proficiencies.skills);
  const expertiseSkills = new Set(characterExpertiseSkills(character));
  const saves = new Set(classRules[character.className]?.saves || []);
  const spellAbility = classRules[character.className]?.spellAbility;
  const spellMod = spellAbility ? abilityModifier(character.abilities[spellAbility as keyof AbilityScores]) : 0;
  const prof = proficiencyBonus(character.level);
  const chosenIds = [...new Set([...character.spells, ...(context.featSpellIds || []), ...(context.alwaysPreparedSpellIds || [])])];
  const chosenSpells = chosenIds.map(id => spells.find(spell => spell.id === id)).filter(Boolean) as CatalogSpell[];
  const retainedCardIds = (values: string[] | undefined) => (values || []).filter(value => /^[0-9a-f]{24}$/i.test(value));
  const retainedPreparedCards = retainedCardIds(character.lssSpellCards?.prepared);
  const retainedBookCards = retainedCardIds(character.lssSpellCards?.book);
  const hasRetainedCards = retainedPreparedCards.length > 0 || retainedBookCards.length > 0;
  const preparedSpellNames = [...new Set([
    ...(character.preparedSpells || []),
    ...(spellSelectionRule(character).mode === "prepared" ? character.spells.filter(id => (spells.find(spell => spell.id === id)?.level || 0) > 0) : []),
    ...(context.alwaysPreparedSpellIds || []),
  ])].map(id => spells.find(spell => spell.id === id)?.name).filter(Boolean) as string[];
  const alwaysPreparedNames = (context.alwaysPreparedSpellIds || [])
    .map(id => spells.find(spell => spell.id === id)?.name).filter(Boolean) as string[];
  const profLines: Array<[string, string]> = [
    ["Доспехи", proficiencies.armor.join(", ") || "нет"],
    ["Оружие", proficiencies.weapons.join(", ") || "нет"],
    ["Навыки", proficiencies.skills.join(", ") || "нет"],
    ["Инструменты", proficiencies.tools.join(", ") || "нет"],
    ["Языки", proficiencies.languages.join(", ") || "нет"],
    ...raceFeatureList.map(feature => [`Раса · ${feature.name}`, feature.description] as [string, string]),
  ];
  const backgroundData = backgroundRule(character.background, background);
  const equipment = selectedEquipment(character);
  const attacks = characterAttacks(character, spells);
  const spellMasteryNames = ["spell-mastery-1", "spell-mastery-2"]
    .flatMap(key => character.classChoices?.[key] || [])
    .map(id => spells.find(spell => spell.id === id)?.name)
    .filter(Boolean) as string[];
  const exportClassFeatures = orderedLssFeatures(classFeatureList.map(feature => feature.name === "Мастерство заклинателя" && spellMasteryNames.length
    ? { ...feature, description: `${spellMasteryNames.join(" и ")}: пока выбранные заклинания подготовлены, вы можете накладывать их на минимальном круге без траты ячеек.` }
    : feature));
  const conciseClassFeatures = exportClassFeatures
    .map(feature => conciseLssFeature(feature))
    .filter(Boolean) as Feature[];
  const allFeatFeatures = orderedLssFeatures(context.featFeatureList || []);
  const primaryFeatFeatures = allFeatFeatures.slice(0, 2)
    .map(feature => conciseLssFeature(feature, true))
    .filter(Boolean) as Feature[];
  const overflowFeatFeatures = allFeatFeatures.slice(2);
  const noteColumns = distributeLssNotes([
    { label: "Класс", features: exportClassFeatures },
    { label: "Черта", features: overflowFeatFeatures, required: true },
  ]);
  const inner = {
    jsonType: "character",
    template: "default",
    name: { value: character.name || "Безымянный герой" },
    info: {
      charClass: { name: "charClass", value: characterClass?.name || "" },
      charSubclass: { name: "charSubclass", value: context.subclassName || "" },
      level: { name: "level", value: character.level },
      background: { name: "background", value: background?.name || "" },
      playerName: { name: "playerName", value: character.playerName },
      race: { name: "race", value: [race?.name, context.raceVariantName].filter(Boolean).join(" · ") },
      alignment: { name: "alignment", value: character.alignment },
      experience: { name: "experience", value: "" },
    },
    subInfo: {
      age: { name: "age", value: "" },
      height: { name: "height", value: "" },
      weight: { name: "weight", value: "" },
      eyes: { name: "eyes", value: "" },
      skin: { name: "skin", value: "" },
      hair: { name: "hair", value: "" },
    },
    spellsInfo: {
      base: {
        name: "base",
        value: "",
        ...(spellAbility ? { label: "Базовая характеристика заклинаний", code: spellAbility } : {}),
      },
      save: {
        name: "save",
        value: "",
        label: "Сложность спасброска",
        customModifier: null,
      },
      mod: {
        name: "mod",
        value: "",
        label: "Бонус атаки заклинанием",
        customModifier: spellAbility ? spellMod : null,
      },
      available: { classes: character.className ? [character.className] : [] },
    },
    spells: { ...lssSlots(character.className, character.level), ...lssSlotState(character.className, character.level, character.spellSlotsUsed) },
    spellsPact: lssPact(character.className, character.level, character.pactSlotsUsed),
    bonuses: [],
    proficiency: prof,
    stats: Object.fromEntries(
      (Object.keys(abilityLabels) as (keyof AbilityScores)[]).map(key => [
        key,
        // In LSS, modifier is a user override, not the calculated D&D modifier.
        { name: key, score: character.abilities[key], label: abilityLabels[key], modifier: 0 },
      ]),
    ),
    saves: Object.fromEntries(
      (Object.keys(abilityLabels) as (keyof AbilityScores)[]).map(key => [
        key,
        { name: key, isProf: saves.has(key), bonus: 0 },
      ]),
    ),
    skills: lssSkills(selectedSkills, expertiseSkills),
    vitality: {
      "hp-dice-current": { value: character.level },
      "hp-dice-multi": {},
      "hp-max-con-bonus": { value: 0 },
      darkvision: { value: darkvisionDistance(raceFeatureList) },
      "hp-max": { value: estimatedHitPoints(character) },
      "hp-current": { value: estimatedHitPoints(character) },
      "hp-temp": { value: 0 },
      isDying: false,
      deathFails: 0,
      deathSuccesses: 0,
      ac: { value: armorClass(character) },
      speed: { value: race?.id === "dwarf" ? 25 : 30 },
      "hit-die": { value: `D${classRules[character.className]?.hitDie || 8}` },
      "hp-max-bonus": { value: 0 },
    },
    attunementsList: [{ id: `attunement-${Date.now()}`, checked: false, value: "" }],
    weaponsList: lssWeaponAttacks(attacks),
    text: {
      traits: richFeatureText(conciseClassFeatures, "traits"),
      attacks: richText(attacks.map(attack => `${attack.name}: ${attack.attackBonus !== undefined ? `атака ${attack.attackBonus >= 0 ? "+" : ""}${attack.attackBonus}` : `Сл ${attack.saveDc}`}; урон ${attack.damageDisplay}${attack.note ? `. ${attack.note}` : ""}`).join("\n"), "attacks"),
      "spells-level-0": richSpellText(chosenSpells, 0),
      "spells-level-1": richSpellText(chosenSpells, 1),
      "spells-level-2": richSpellText(chosenSpells, 2),
      "spells-level-3": richSpellText(chosenSpells, 3),
      "spells-level-4": richSpellText(chosenSpells, 4),
      "spells-level-5": richSpellText(chosenSpells, 5),
      ...(chosenSpells.some(spell => spell.level >= 6) ? { "spells-level-6": richSpellText(chosenSpells, 6) } : {}),
      ...(chosenSpells.some(spell => spell.level >= 7) ? { "spells-level-7": richSpellText(chosenSpells, 7) } : {}),
      ...(chosenSpells.some(spell => spell.level >= 8) ? { "spells-level-8": richSpellText(chosenSpells, 8) } : {}),
      ...(chosenSpells.some(spell => spell.level >= 9) ? { "spells-level-9": richSpellText(chosenSpells, 9) } : {}),
      equipment: richText(equipment.join("\n"), "equipment"),
      background: richLabeledText([
        [background?.name || "Предыстория", background?.description || ""],
        [backgroundData.feature.name, backgroundData.feature.description],
      ], "background"),
      ideals: richText(character.personality.ideals, "ideals"),
      personality: { ...richText(character.personality.traits, "personality"), size: 0 },
      flaws: { ...richText(character.personality.flaws, "flaws"), size: 0 },
      bonds: richText(character.personality.bonds, "bonds"),
      allies: richText(backgroundData.feature.description, "allies"),
      quests: richLabeledText([
        ["Подготовленные заклинания", preparedSpellNames.join(", ") || "Нет"],
        ["Всегда подготовлены — вне лимита", alwaysPreparedNames.join(", ") || "Нет"],
      ], "quests"),
      prof: richLabeledText(profLines, "prof"),
      "notes-1": { ...richFeatureText(noteColumns[0], "notes-1"), size: 7 },
      "notes-2": { ...richFeatureText(noteColumns[1], "notes-2"), size: 7 },
      "notes-3": { ...richFeatureText(noteColumns[2], "notes-3"), size: 7 },
      "notes-4": { ...richFeatureText(noteColumns[3], "notes-4"), size: 7 },
      "notes-5": { ...richFeatureText(noteColumns[4], "notes-5"), size: 7 },
      features: richFeatureText(primaryFeatFeatures, "features"),
      items: { value: { data: "" } },
    },
    coins: {},
    resources: Object.fromEntries(characterResources(character).map(resource => [resource.key, {
      name: resource.die ? `${resource.name} (${resource.die})` : resource.name,
      current: resourceCurrent(character, resource),
      max: resource.max,
      isShortRest: resource.isShortRest,
      isLongRest: resource.isLongRest,
    }])),
    bonusesSkills: {},
    bonusesStats: {},
    conditions: null,
    wizardStep: "initial",
    isDefault: true,
    weapons: {},
    hiddenName: character.name || "Безымянный герой",
    casterClass: { value: characterClass?.name || "" },
    avatar: { jpeg: "", webp: "" },
    inspiration: false,
    exhaustion: "",
    createdAt: new Date().toISOString(),
    proficiencyCustom: 0,
  };

  return {
    tags: [],
    disabledBlocks: {
      "info-left": [],
      "info-right": [],
      "subinfo-left": [],
      "subinfo-right": [],
      "notes-left": [],
      "notes-right": [],
      _id: "6966767ee00af79ebacfb426",
    },
    edition: "2014",
    spells: {
      mode: hasRetainedCards ? "cards" : "text",
      // LSS accepts only its own private ObjectIds in card lists. Preserve ids
      // imported from LSS verbatim; locally selected spells remain available
      // in the portable data.text.spells-level-* blocks below.
      prepared: retainedPreparedCards,
      book: retainedBookCards,
      edition: character.lssSpellCards?.edition || "2014",
    },
    data: JSON.stringify(inner),
    lastWriterSessionId: `${Date.now()}-list-geroya5e`,
    linkAccess: "none",
    rooms: [],
    sheetEdition: "2014",
    jsonType: "character",
    version: "2",
    wizard: {},
  };
}
