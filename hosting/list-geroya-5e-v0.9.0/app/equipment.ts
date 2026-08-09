import type { AbilityScores, ExportCharacter } from "./exportFormats";
import { backgroundRule } from "./backgroundRules";

export type EquipmentOption = { id: string; label: string; items: string[]; recommended?: boolean };
export type EquipmentGroup = { key: string; label: string; count: number; options: EquipmentOption[] };
export type ClassEquipment = { groups: EquipmentGroup[]; fixed: string[] };

type RecommendationContext = {
  classChoices?: Record<string, string[]>;
  subclass?: string;
};

const O = (id: string, label: string, items: string[] = [label], recommended = false): EquipmentOption => ({ id, label, items, recommended });
const G = (key: string, label: string, options: EquipmentOption[], count = 1): EquipmentGroup => ({ key, label, count, options });

const packContents: Record<string, string> = {
  burglar: "рюкзак, 1 000 шариков, 10 футов нити, колокольчик, 5 свечей, ломик, молоток, 10 шлямбуров, закрытый фонарь, 2 фляги масла, 5 рационов, трутница, бурдюк и 50 футов пеньковой верёвки",
  diplomat: "сундук, 2 футляра для карт и свитков, комплект отличной одежды, чернила, перо, лампа, 2 фляги масла, 5 листов бумаги, духи, сургуч и мыло",
  dungeoneer: "рюкзак, ломик, молоток, 10 шлямбуров, 10 факелов, трутница, 10 рационов, бурдюк и 50 футов пеньковой верёвки",
  entertainer: "рюкзак, спальник, 2 костюма, 5 свечей, 5 рационов, бурдюк и набор для грима",
  explorer: "рюкзак, спальник, столовый набор, трутница, 10 факелов, 10 рационов, бурдюк и 50 футов пеньковой верёвки",
  priest: "рюкзак, одеяло, 10 свечей, трутница, коробка для пожертвований, 2 блока благовоний, кадило, облачение, 2 рациона и бурдюк",
  scholar: "рюкзак, научная книга, чернила, перо, 10 листов пергамента, мешочек песка и небольшой нож",
};
const packText = (id: string, name: string) => `${name} (${packContents[id]})`;
const P = (id: string, name: string, recommended = false) => O(id, packText(id, name), [packText(id, name)], recommended);

const armorText = {
  leather: "Кожаный доспех (КД 11 + Лов.)",
  studded: "Проклёпанная кожа (КД 12 + Лов.)",
  scale: "Чешуйчатый доспех (КД 14 + Лов., максимум +2)",
  chain: "Кольчуга (КД 16; Сила 13)",
  shield: "Щит (+2 к КД)",
  woodShield: "Деревянный щит (+2 к КД)",
};

const simpleWeapons = [
  O("club", "Дубинка"), O("dagger", "Кинжал"), O("greatclub", "Палица"), O("handaxe", "Ручной топор"),
  O("javelin", "Метательное копьё"), O("light-hammer", "Лёгкий молот"), O("mace", "Булава"),
  O("quarterstaff", "Боевой посох"), O("sickle", "Серп"), O("spear", "Копьё"),
  O("light-crossbow", "Лёгкий арбалет"), O("dart", "Дротик"), O("shortbow", "Короткий лук"), O("sling", "Праща"),
];

const martialMelee = [
  O("battleaxe", "Боевой топор"), O("flail", "Цеп"), O("glaive", "Глефа"), O("greataxe", "Секира"),
  O("greatsword", "Двуручный меч"), O("halberd", "Алебарда"), O("lance", "Длинное копьё"),
  O("longsword", "Длинный меч"), O("maul", "Молот"), O("morningstar", "Моргенштерн"),
  O("pike", "Пика"), O("rapier", "Рапира"), O("scimitar", "Скимитар"), O("shortsword", "Короткий меч"),
  O("trident", "Трезубец"), O("war-pick", "Боевая кирка"), O("warhammer", "Боевой молот"), O("whip", "Кнут"),
];

const instruments = ["Лютня", "Флейта", "Лира", "Рожок", "Барабан", "Виола", "Свирель", "Шалмей"].map((name, index) => O(`instrument-${index}`, name));

const classEquipment: Record<string, ClassEquipment> = {
  barbarian: {
    groups: [
      G("primary", "Основное оружие", [O("greataxe", "Секира", ["Секира"], true), ...martialMelee.filter(option => option.id !== "greataxe")]),
      G("secondary", "Запасное оружие", [O("two-handaxes", "Два ручных топора", ["Ручной топор ×2"], true), ...simpleWeapons]),
    ], fixed: [packText("explorer", "Набор путешественника"), "Метательное копьё ×4"],
  },
  bard: {
    groups: [
      G("weapon", "Оружие", [O("rapier", "Рапира", ["Рапира"], true), O("longsword", "Длинный меч"), ...simpleWeapons]),
      G("pack", "Дорожный набор", [P("diplomat", "Набор дипломата", true), P("entertainer", "Набор артиста")]),
      G("instrument", "Музыкальный инструмент", instruments.map(option => option.id === "instrument-0" ? { ...option, recommended: true } : option)),
    ], fixed: [armorText.leather, "Кинжал"],
  },
  cleric: {
    groups: [
      G("weapon", "Основное оружие", [O("mace", "Булава", ["Булава"], true), O("warhammer", "Боевой молот (если есть владение)")]),
      G("armor", "Доспех", [O("scale", armorText.scale, [armorText.scale], true), O("leather", armorText.leather), O("chain", `${armorText.chain} (если есть владение)`, [armorText.chain])]),
      G("ranged", "Дополнительное оружие", [O("crossbow", "Лёгкий арбалет и 20 болтов", ["Лёгкий арбалет", "Болт ×20"], true), ...simpleWeapons]),
      G("pack", "Дорожный набор", [P("priest", "Набор священника", true), P("explorer", "Набор путешественника")]),
    ], fixed: [armorText.shield, "Священный символ"],
  },
  druid: {
    groups: [
      G("shield", "Защита или простое оружие", [O("wood-shield", armorText.woodShield, [armorText.woodShield], true), ...simpleWeapons]),
      G("weapon", "Рукопашное оружие", [
        O("scimitar", "Скимитар"),
        ...simpleWeapons
          .filter(option => !["light-crossbow", "dart", "shortbow", "sling"].includes(option.id))
          .map(option => option.id === "dagger" ? { ...option, recommended: true } : option),
      ]),
    ], fixed: [armorText.leather, packText("explorer", "Набор путешественника"), "Фокусировка друидов"],
  },
  fighter: {
    groups: [
      G("armor", "Доспех и дальнее оружие", [O("chain", armorText.chain, [armorText.chain], true), O("leather-bow", `${armorText.leather}, длинный лук и 20 стрел`, [armorText.leather, "Длинный лук", "Стрела ×20"])]),
      G("primary", "Воинское оружие и/или щит — выберите 2 предмета", [
        O("shield", armorText.shield, [armorText.shield], true),
        ...martialMelee.map(option => option.id === "longsword" ? { ...option, recommended: true } : option),
      ], 2),
      G("secondary", "Дополнительное оружие", [O("crossbow", "Лёгкий арбалет и 20 болтов", ["Лёгкий арбалет", "Болт ×20"], true), O("two-handaxes", "Два ручных топора", ["Ручной топор ×2"])]),
      G("pack", "Дорожный набор", [P("dungeoneer", "Набор исследователя подземелий", true), P("explorer", "Набор путешественника")]),
    ], fixed: [],
  },
  monk: {
    groups: [
      G("weapon", "Оружие", [O("shortsword", "Короткий меч", ["Короткий меч"], true), ...simpleWeapons]),
      G("pack", "Дорожный набор", [P("dungeoneer", "Набор исследователя подземелий", true), P("explorer", "Набор путешественника")]),
    ], fixed: ["Дротик ×10"],
  },
  paladin: {
    groups: [
      G("primary", "Воинское оружие и/или щит — выберите 2 предмета", [
        O("shield", armorText.shield, [armorText.shield], true),
        ...martialMelee.map(option => option.id === "longsword" ? { ...option, recommended: true } : option),
      ], 2),
      G("secondary", "Дополнительное оружие", [O("javelins", "Пять метательных копий", ["Метательное копьё ×5"], true), ...simpleWeapons.filter(option => !["light-crossbow", "dart", "shortbow", "sling"].includes(option.id))]),
      G("pack", "Дорожный набор", [P("priest", "Набор священника", true), P("explorer", "Набор путешественника")]),
    ], fixed: [armorText.chain, "Священный символ"],
  },
  ranger: {
    groups: [
      G("armor", "Доспех", [O("scale", armorText.scale, [armorText.scale], true), O("leather", armorText.leather)]),
      G("melee", "Рукопашное оружие", [O("two-shortswords", "Два коротких меча", ["Короткий меч ×2"], true), O("two-clubs", "Две дубинки", ["Дубинка ×2"]), O("two-handaxes", "Два ручных топора", ["Ручной топор ×2"]), O("two-spears", "Два копья", ["Копьё ×2"])]),
      G("pack", "Дорожный набор", [P("dungeoneer", "Набор исследователя подземелий", true), P("explorer", "Набор путешественника")]),
    ], fixed: ["Длинный лук", "Стрела ×20"],
  },
  rogue: {
    groups: [
      G("primary", "Основное оружие", [O("rapier", "Рапира", ["Рапира"], true), O("shortsword", "Короткий меч")]),
      G("secondary", "Дополнительное оружие", [O("shortbow", "Короткий лук и 20 стрел", ["Короткий лук", "Стрела ×20"], true), O("shortsword", "Короткий меч")]),
      G("pack", "Дорожный набор", [P("burglar", "Набор взломщика", true), P("dungeoneer", "Набор исследователя подземелий"), P("explorer", "Набор путешественника")]),
    ], fixed: [armorText.leather, "Кинжал ×2", "Воровские инструменты"],
  },
  sorcerer: {
    groups: [
      G("weapon", "Оружие", [O("crossbow", "Лёгкий арбалет и 20 болтов", ["Лёгкий арбалет", "Болт ×20"], true), ...simpleWeapons]),
      G("focus", "Способ работы с материальными компонентами", [O("components", "Мешочек с компонентами"), O("arcane", "Магическая фокусировка", ["Магическая фокусировка"], true)]),
      G("pack", "Дорожный набор", [P("dungeoneer", "Набор исследователя подземелий", true), P("explorer", "Набор путешественника")]),
    ], fixed: ["Кинжал ×2"],
  },
  warlock: {
    groups: [
      G("weapon", "Дальнее или простое оружие", [O("crossbow", "Лёгкий арбалет и 20 болтов", ["Лёгкий арбалет", "Болт ×20"], true), ...simpleWeapons]),
      G("focus", "Способ работы с материальными компонентами", [O("components", "Мешочек с компонентами"), O("arcane", "Магическая фокусировка", ["Магическая фокусировка"], true)]),
      G("pack", "Дорожный набор", [P("scholar", "Набор учёного", true), P("dungeoneer", "Набор исследователя подземелий")]),
      G("simple", "Дополнительное простое оружие", simpleWeapons),
    ], fixed: [armorText.leather, "Кинжал ×2"],
  },
  wizard: {
    groups: [
      G("weapon", "Оружие", [O("quarterstaff", "Боевой посох", ["Боевой посох"], true), O("dagger", "Кинжал")]),
      G("focus", "Способ работы с материальными компонентами", [O("components", "Мешочек с компонентами"), O("arcane", "Магическая фокусировка", ["Магическая фокусировка"], true)]),
      G("pack", "Дорожный набор", [P("scholar", "Набор учёного", true), P("explorer", "Набор путешественника")]),
    ], fixed: ["Книга заклинаний"],
  },
  artificer: {
    groups: [
      G("weapons", "Два простых оружия", simpleWeapons, 2),
      G("armor", "Доспех", [O("studded", armorText.studded, [armorText.studded], true), O("scale", armorText.scale)]),
    ], fixed: ["Лёгкий арбалет", "Болт ×20", "Воровские инструменты", packText("dungeoneer", "Набор исследователя подземелий")],
  },
};

export function equipmentRule(classId: string): ClassEquipment {
  return classEquipment[classId] || { groups: [], fixed: [] };
}

export function defaultEquipmentSelections(classId: string): Record<string, string[]> {
  const focus = equipmentRule(classId).groups.find(group => group.key === "focus");
  return focus?.options.some(option => option.id === "arcane") ? { focus: ["arcane"] } : {};
}

export function equipmentComplete(character: Pick<ExportCharacter, "className" | "equipmentSelections">) {
  return equipmentRule(character.className).groups.every(group => (character.equipmentSelections?.[group.key] || []).length === group.count);
}

const finesseWeapons = new Set(["dagger", "rapier", "scimitar", "shortsword", "whip"]);
const rangedWeapons = new Set(["crossbow", "light-crossbow", "dart", "shortbow", "sling", "leather-bow"]);
const heavyWeapons = new Set(["glaive", "greataxe", "greatsword", "halberd", "maul", "pike"]);
const twoHandedWeapons = new Set([...heavyWeapons, "light-crossbow", "shortbow", "crossbow", "leather-bow"]);
const strengthWeapons = new Set([
  "club", "greatclub", "handaxe", "javelin", "javelins", "light-hammer", "mace", "quarterstaff", "sickle", "spear",
  "battleaxe", "flail", "lance", "longsword", "morningstar", "trident", "war-pick", "warhammer", "two-handaxes",
  "two-clubs", "two-spears",
]);
const armorOptions = new Set(["chain", "scale", "leather", "leather-bow", "studded"]);

function modifier(score: number) {
  return Math.floor((score - 10) / 2);
}

function isOneHandedWeapon(option: EquipmentOption) {
  return (finesseWeapons.has(option.id) || strengthWeapons.has(option.id)) && !twoHandedWeapons.has(option.id);
}

function armorScore(option: EquipmentOption, abilities: AbilityScores) {
  const dexterity = modifier(abilities.dex);
  if (option.id === "chain") return abilities.str >= 13 ? 160 : -1000;
  if (option.id === "scale") return (14 + Math.min(2, dexterity)) * 10 - (dexterity >= 3 ? 2 : 0);
  if (option.id === "studded") return (12 + dexterity) * 10;
  if (option.id === "leather-bow") return (11 + dexterity) * 10 + 8;
  if (option.id === "leather") return (11 + dexterity) * 10;
  return 0;
}

function conditionalProficiencyPenalty(classId: string, subclass: string, option: EquipmentOption) {
  if (classId !== "cleric") return 0;
  const martialDomains = new Set(["war", "twilight"]);
  const heavyDomains = new Set(["life", "war", "forge", "twilight"]);
  if (option.id === "warhammer" && !martialDomains.has(subclass)) return -1000;
  if (option.id === "chain" && !heavyDomains.has(subclass)) return -1000;
  return 0;
}

function optionScore(classId: string, option: EquipmentOption, abilities: AbilityScores, context: RecommendationContext) {
  const styles = new Set(context.classChoices?.["fighting-style"] || []);
  const strength = modifier(abilities.str);
  const dexterity = modifier(abilities.dex);
  const proficiencyPenalty = conditionalProficiencyPenalty(classId, context.subclass || "", option);
  if (proficiencyPenalty) return proficiencyPenalty;
  if (armorOptions.has(option.id)) return armorScore(option, abilities);
  if (option.id === "shield" || option.id === "wood-shield") {
    if (styles.has("two-weapon") || styles.has("great-weapon")) return -100;
    return 90 + (styles.has("protection") || styles.has("dueling") ? 18 : 0);
  }
  if (heavyWeapons.has(option.id)) {
    if (abilities.str < 13) return -500;
    return 55 + strength * 12 + (styles.has("great-weapon") ? 24 : 0) + (option.recommended ? 1 : 0);
  }
  if (rangedWeapons.has(option.id)) return 50 + dexterity * 12 + (styles.has("archery") ? 24 : 0) + (option.recommended ? 1 : 0);
  if (finesseWeapons.has(option.id)) return 46 + Math.max(strength, dexterity) * 12 + (styles.has("dueling") ? 12 : 0) + (styles.has("two-weapon") ? 10 : 0) + (option.recommended ? 1 : 0);
  if (strengthWeapons.has(option.id)) return 46 + strength * 12 + (styles.has("dueling") ? 10 : 0) + (styles.has("two-weapon") ? 6 : 0) + (option.recommended ? 1 : 0);
  return option.recommended ? 20 : 10;
}

function recommendedForGroup(classId: string, group: EquipmentGroup, abilities: AbilityScores, context: RecommendationContext) {
  const ranked = [...group.options].sort((left, right) => optionScore(classId, right, abilities, context) - optionScore(classId, left, abilities, context));
  if (group.count !== 2 || !group.options.some(option => option.id === "shield")) return ranked.slice(0, group.count);

  const styles = new Set(context.classChoices?.["fighting-style"] || []);
  if (styles.has("great-weapon") && abilities.str >= 13) return ranked.filter(option => option.id !== "shield").slice(0, 2);
  if (styles.has("two-weapon")) return ranked.filter(option => option.id !== "shield" && isOneHandedWeapon(option)).slice(0, 2);

  const shield = group.options.find(option => option.id === "shield")!;
  const oneHanded = ranked.find(option => option.id !== "shield" && isOneHandedWeapon(option));
  return [shield, oneHanded || ranked.find(option => option.id !== "shield")!].filter(Boolean);
}

export function optimalEquipmentSelections(classId: string, abilities: AbilityScores, context: RecommendationContext = {}) {
  return Object.fromEntries(equipmentRule(classId).groups.map(group => [
    group.key,
    recommendedForGroup(classId, group, abilities, context).map(option => option.id),
  ]));
}

export function equipmentOptionAdvice(option: EquipmentOption, abilities: AbilityScores) {
  if (option.id === "components") return "Содержит обычные материальные компоненты без указанной стоимости; нужный компонент достаётся свободной рукой.";
  if (option.id === "arcane") return "Заменяет обычные материальные компоненты без указанной стоимости. Расходуемые и имеющие цену компоненты всё равно нужны отдельно.";
  if (option.id === "chain") {
    return abilities.str < 13
      ? `Не рекомендуется: Сила ${abilities.str}; без Силы 13 скорость снижается на 10 футов.`
      : "Требование кольчуги выполнено: Сила 13+.";
  }
  if (heavyWeapons.has(option.id) && abilities.str < 13) return `Не рекомендуется: тяжёлое оружие использует Силу, сейчас ${abilities.str}.`;
  if ((finesseWeapons.has(option.id) || rangedWeapons.has(option.id)) && abilities.dex > abilities.str) return "Подходит текущему герою: опирается на более высокую Ловкость.";
  return "";
}

export function selectedEquipment(character: Pick<ExportCharacter, "className" | "background" | "equipmentSelections">) {
  const rule = equipmentRule(character.className);
  const chosen = rule.groups.flatMap(group => (character.equipmentSelections?.[group.key] || []).flatMap(id => group.options.find(option => option.id === id)?.items || []));
  return [...rule.fixed, ...chosen, ...backgroundRule(character.background).equipment];
}
