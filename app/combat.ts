import type { CatalogSpell } from "./catalog";
import { selectedEquipment } from "./equipment";
import type { AbilityScores, ExportCharacter } from "./exportFormats";
import { classRules } from "./rules";
import { characterLevel, orderedCharacterClasses } from "./multiclass";
import { characterProficiencies } from "./proficiencies";

type AbilityKey = keyof AbilityScores;

const abilityModifier = (score: number) => Math.floor((score - 10) / 2);
const proficiencyBonus = (level: number) => 2 + Math.floor((Math.max(1, level) - 1) / 4);

export type CharacterAttack = {
  id: string;
  name: string;
  kind: "weapon" | "cantrip" | "feature";
  ability: AbilityKey;
  proficient: boolean;
  attackBonus?: number;
  saveDc?: number;
  attackBonusExtra: number;
  damageFormula: string;
  damageDisplay: string;
  note?: string;
};

type WeaponDefinition = {
  name: string;
  dice: string;
  versatileDice?: string;
  ranged?: boolean;
  finesse?: boolean;
  thrown?: boolean;
  twoHanded?: boolean;
};

const weaponDefinitions: Record<string, WeaponDefinition> = {
  "дубинка": { name: "Дубинка", dice: "1d4" },
  "кинжал": { name: "Кинжал", dice: "1d4", finesse: true, thrown: true },
  "палица": { name: "Палица", dice: "1d8", twoHanded: true },
  "ручной топор": { name: "Ручной топор", dice: "1d6", thrown: true },
  "метательное копьё": { name: "Метательное копьё", dice: "1d6", thrown: true },
  "лёгкий молот": { name: "Лёгкий молот", dice: "1d4", thrown: true },
  "булава": { name: "Булава", dice: "1d6" },
  "боевой посох": { name: "Боевой посох", dice: "1d6", versatileDice: "1d8" },
  "серп": { name: "Серп", dice: "1d4" },
  "копьё": { name: "Копьё", dice: "1d6", versatileDice: "1d8", thrown: true },
  "лёгкий арбалет": { name: "Лёгкий арбалет", dice: "1d8", ranged: true, twoHanded: true },
  "дротик": { name: "Дротик", dice: "1d4", ranged: true, finesse: true, thrown: true },
  "короткий лук": { name: "Короткий лук", dice: "1d6", ranged: true, twoHanded: true },
  "длинный лук": { name: "Длинный лук", dice: "1d8", ranged: true, twoHanded: true },
  "праща": { name: "Праща", dice: "1d4", ranged: true },
  "боевой топор": { name: "Боевой топор", dice: "1d8", versatileDice: "1d10" },
  "цеп": { name: "Цеп", dice: "1d8" },
  "глефа": { name: "Глефа", dice: "1d10", twoHanded: true },
  "секира": { name: "Секира", dice: "1d12", twoHanded: true },
  "двуручный меч": { name: "Двуручный меч", dice: "2d6", twoHanded: true },
  "алебарда": { name: "Алебарда", dice: "1d10", twoHanded: true },
  "длинное копьё": { name: "Длинное копьё", dice: "1d12" },
  "длинный меч": { name: "Длинный меч", dice: "1d8", versatileDice: "1d10" },
  "молот": { name: "Молот", dice: "2d6", twoHanded: true },
  "моргенштерн": { name: "Моргенштерн", dice: "1d8" },
  "пика": { name: "Пика", dice: "1d10", twoHanded: true },
  "рапира": { name: "Рапира", dice: "1d8", finesse: true },
  "скимитар": { name: "Скимитар", dice: "1d6", finesse: true },
  "короткий меч": { name: "Короткий меч", dice: "1d6", finesse: true },
  "трезубец": { name: "Трезубец", dice: "1d6", versatileDice: "1d8", thrown: true },
  "боевая кирка": { name: "Боевая кирка", dice: "1d8" },
  "боевой молот": { name: "Боевой молот", dice: "1d8", versatileDice: "1d10" },
  "кнут": { name: "Кнут", dice: "1d4", finesse: true },
};

const simpleWeapons = new Set([
  "дубинка", "кинжал", "палица", "ручной топор", "метательное копьё", "лёгкий молот",
  "булава", "боевой посох", "серп", "копьё", "лёгкий арбалет", "дротик", "короткий лук", "праща",
]);

const weaponPlurals: Record<string, string[]> = {
  "дубинка": ["дубинки"], "кинжал": ["кинжалы"], "палица": ["палицы"],
  "ручной топор": ["ручные топоры"], "метательное копьё": ["метательные копья"],
  "лёгкий молот": ["легкие молоты"], "булава": ["булавы"],
  "боевой посох": ["боевые посохи"], "серп": ["серпы"], "копьё": ["копья"],
  "лёгкий арбалет": ["легкие арбалеты"], "дротик": ["дротики"],
  "короткий лук": ["короткие луки"], "праща": ["пращи"],
  "длинный меч": ["длинные мечи", "длинные и короткие мечи"],
  "короткий меч": ["короткие мечи", "длинные и короткие мечи"],
  "ручной арбалет": ["ручные арбалеты"], "рапира": ["рапиры"],
  "скимитар": ["скимитары"],
};

function weaponProficient(character: ExportCharacter, key: string) {
  const permissions = characterProficiencies(character).weapons
    .flatMap(value => value.toLowerCase().replace(/ё/g, "е").split(/\s*,\s*/));
  if (permissions.some(value => /прост(?:ое|ые) (?:и воинское )?оружие/.test(value)) && simpleWeapons.has(key)) return true;
  if (permissions.some(value => /воинск(?:ое|ие) оружие/.test(value)) && !simpleWeapons.has(key)) return true;
  if (key === "короткий меч" && permissions.some(value => /короткие мечи/.test(value))) return true;
  if (key === "длинный меч" && permissions.some(value => /длинные (?:и короткие )?мечи/.test(value))) return true;
  const normalized = key.replace(/ё/g, "е");
  return permissions.some(value => value === normalized || (weaponPlurals[key] || []).some(alias => alias === value));
}

type CantripDefinition = {
  dice: string;
  mode: "attack" | "save";
  save?: AbilityKey;
  damageType?: "Кислота" | "Холод" | "Огонь" | "Электричество" | "Звук";
  note?: string;
};

const damagingCantrips: Record<string, CantripDefinition> = {
  "acid-splash": { dice: "d6", mode: "save", save: "dex", damageType: "Кислота" },
  firebolt: { dice: "d10", mode: "attack", damageType: "Огонь" },
  vicious: { dice: "d4", mode: "save", save: "wis", note: "При провале цель получает помеху на следующую атаку." },
  eldritch: { dice: "d10", mode: "attack", note: "Для каждого луча отдельный бросок атаки; цели можно выбирать отдельно." },
  "ray-of-frost": { dice: "d8", mode: "attack", damageType: "Холод", note: "Скорость цели уменьшается на 10 футов до начала вашего следующего хода." },
  "sacred-flame": { dice: "d8", mode: "save", save: "dex", note: "Цель не получает бонус от укрытия к спасброску." },
  "shocking-grasp": { dice: "d8", mode: "attack", damageType: "Электричество", note: "При попадании цель не может совершать реакции до начала своего следующего хода." },
  "thorn-whip": { dice: "d6", mode: "attack", note: "Большую или меньшую цель можно подтянуть на 10 футов." },
  "produce-flame": { dice: "d8", mode: "attack", damageType: "Огонь" },
  "toll-the-dead": { dice: "d8", mode: "save", save: "wis", note: "Если у цели не все хиты, используется d12 вместо d8." },
  "mind-sliver": { dice: "d6", mode: "save", save: "int", note: "Цель вычитает 1d4 из следующего спасброска до конца вашего следующего хода." },
  "word-radiance": { dice: "d6", mode: "save", save: "con" },
};

function normalizeEquipmentName(value: string) {
  return value
    .toLowerCase()
    .replace(/\s*\([^)]*\)\s*/g, "")
    .replace(/\s*[×x]\s*\d+\s*$/i, "")
    .replace(/\s+и\s+\d+\s+(болтов|стрел|снарядов)\s*$/i, "")
    .trim();
}

function signed(value: number) {
  return value >= 0 ? `+${value}` : `${value}`;
}

function cantripDiceCount(level: number) {
  return level >= 17 ? 4 : level >= 11 ? 3 : level >= 5 ? 2 : 1;
}

function monkMartialDie(level: number) {
  if (level >= 17) return "1d10";
  if (level >= 11) return "1d8";
  if (level >= 5) return "1d6";
  return "1d4";
}

function weaponAbility(definition: WeaponDefinition, character: ExportCharacter): AbilityKey {
  if (definition.ranged) return "dex";
  if (definition.finesse && character.abilities.dex > character.abilities.str) return "dex";
  return "str";
}

function subclassAttacks(character: ExportCharacter, prof: number): CharacterAttack[] {
  const result: CharacterAttack[] = [];
  const add = (attack: CharacterAttack) => result.push(attack);
  const attack = (id: string, name: string, ability: AbilityKey, dice: string, note: string, damageBonus: number | string = abilityModifier(character.abilities[ability])) => {
    const abilityMod = abilityModifier(character.abilities[ability]);
    const bonus = typeof damageBonus === "number" ? damageBonus : 0;
    add({
      id,
      name,
      kind: "feature",
      ability,
      proficient: true,
      attackBonus: prof + abilityMod,
      attackBonusExtra: 0,
      damageFormula: `${dice}+${typeof damageBonus === "string" ? damageBonus : `[${ability.toUpperCase()}]`}`,
      damageDisplay: `${dice}${typeof damageBonus === "number" && bonus ? signed(bonus) : ""}`,
      note,
    });
  };

  for (const entry of orderedCharacterClasses(character)) {
    const subclass = entry.subclassId || "";
    if (entry.classId === "barbarian" && subclass === "battlerager" && entry.level >= 3) {
      attack("subclass-battlerager-spikes", "Шипы доспеха", "str", "1d4", "Доступно только в шипованном доспехе и во время ярости; атака выполняется бонусным действием.");
    }
    if (entry.classId === "barbarian" && subclass === "beast" && entry.level >= 3) {
      attack("subclass-beast-bite", "Форма зверя: Укус", "str", "1d8", "Временное природное оружие только во время ярости; раз за ход при хп ниже половины попадание может восстановить хиты в размере БМ.");
      attack("subclass-beast-claws", "Форма зверя: Когти", "str", "1d6", "Временное природное оружие только во время ярости; раз за ход после атаки когтем можно сделать ещё одну атаку когтем.");
      attack("subclass-beast-tail", "Форма зверя: Хвост", "str", "1d8", "Временное природное оружие только во время ярости; досягаемость 10 футов, реакцией может повысить КД против одной атаки.");
    }
    if (entry.classId === "monk" && subclass === "astral-self" && entry.level >= 3) {
      const die = monkMartialDie(entry.level);
      attack("subclass-astral-arms", "Руки астрального тела", "wis", die, "Только пока проявлены астральные руки: силовой урон, +5 футов досягаемости в свой ход, для атаки и урона используется Мудрость.");
    }
    if (entry.classId === "bard" && subclass === "creation" && entry.level >= 6) {
      const abilityMod = abilityModifier(character.abilities.cha);
      add({
        id: "subclass-creation-dancing-item",
        name: "Оживлённый предмет: Силовой удар",
        kind: "feature",
        ability: "cha",
        proficient: true,
        attackBonus: prof + abilityMod,
        attackBonusExtra: 0,
        damageFormula: "1d10+[PB]",
        damageDisplay: `1d10${signed(prof)}`,
        note: `Временный спутник Dancing Item. КД 16; хиты ${10 + 5 * entry.level}; атака использует модификатор атаки заклинанием барда.`,
      });
    }
    if (entry.classId === "ranger" && subclass === "drakewarden" && entry.level >= 3) {
      const abilityMod = abilityModifier(character.abilities.wis);
      const extra = entry.level >= 15 ? "2d6" : entry.level >= 7 ? "1d6" : "";
      add({
        id: "subclass-drakewarden-bite",
        name: "Дрейк: Укус",
        kind: "feature",
        ability: "wis",
        proficient: true,
        attackBonus: prof + abilityMod,
        attackBonusExtra: 0,
        damageFormula: `1d6+[PB]${extra ? `+${extra}` : ""}`,
        damageDisplay: `1d6${signed(prof)}${extra ? ` + ${extra} стихией` : ""}`,
        note: `Атака временного дрейка; КД ${14 + prof}, хиты ${5 + 5 * entry.level}. Стихийный тип выбирается при каждом призыве.`,
      });
    }
  }
  return result;
}

export function characterAttacks(character: ExportCharacter, spells: CatalogSpell[]): CharacterAttack[] {
  const totalLevel = characterLevel(character);
  const prof = proficiencyBonus(totalLevel);
  const styles = new Set([
    ...(character.classChoices?.["fighting-style"] || []),
    ...orderedCharacterClasses(character).flatMap(entry => entry.choiceValues?.["fighting-style"] || []),
  ]);
  const equipment = character.inventoryOverride === undefined ? selectedEquipment(character)
    : character.inventoryOverride.split(/\n|\s*·\s*/).map(item => item.trim()).filter(Boolean);
  const seenWeapons = new Set<string>();
  const weaponAttacks = equipment.flatMap((item): CharacterAttack[] => {
    const key = normalizeEquipmentName(item);
    const definition = weaponDefinitions[key];
    if (!definition || seenWeapons.has(key)) return [];
    seenWeapons.add(key);
    const ability = weaponAbility(definition, character);
    const abilityMod = abilityModifier(character.abilities[ability]);
    const proficient = weaponProficient(character, key);
    const attackBonusExtra = styles.has("archery") && definition.ranged ? 2 : 0;
    const abilityVariable = `[${ability.toUpperCase()}]`;
    const makeAttack = (dice: string, twoHands: boolean): CharacterAttack => {
      const damageExtra = (styles.has("dueling") && !twoHands && !definition.ranged && !definition.twoHanded ? 2 : 0)
        + (styles.has("thrown-weapon") && definition.thrown && !twoHands ? 2 : 0);
      return {
        id: `weapon-${key}${definition.versatileDice ? twoHands ? "-two-hands" : "-one-hand" : ""}`,
        name: `${definition.name}${definition.versatileDice ? twoHands ? " (2 руки)" : " (1 рука)" : ""}`,
        kind: "weapon",
        ability,
        proficient,
        attackBonus: (proficient ? prof : 0) + abilityMod + attackBonusExtra,
        attackBonusExtra,
        damageFormula: `${dice}+${abilityVariable}${damageExtra ? `+${damageExtra}` : ""}`,
        damageDisplay: `${dice}${signed(abilityMod + damageExtra)}`,
        note: proficient ? undefined : "Нет владения оружием: бонус мастерства не прибавлен к атаке.",
      };
    };
    return definition.versatileDice
      ? [makeAttack(definition.dice, false), makeAttack(definition.versatileDice, true)]
      : [makeAttack(definition.dice, false)];
  });

  const featureAttacks = subclassAttacks(character, prof);
  const spellAbility = (classRules[character.className]?.spellAbility
    || orderedCharacterClasses(character).map(entry => classRules[entry.classId]?.spellAbility).find(Boolean)) as AbilityKey | undefined;
  if (!spellAbility) return [...weaponAttacks, ...featureAttacks];
  const diceCount = cantripDiceCount(totalLevel);
  const elementalAdeptTypes = new Set(
    (character.advancements || [])
      .filter(choice => choice.featId === "elemental-adept")
      .flatMap(choice => choice.featChoices?.element || []),
  );
  const invocations = new Set([
    ...(character.classChoices?.invocations || []),
    ...orderedCharacterClasses(character).flatMap(entry => entry.choiceValues?.invocations || []),
  ]);
  const chosenCantrips = character.spells
    .map(id => spells.find(spell => spell.id === id && spell.level === 0))
    .filter(Boolean) as CatalogSpell[];
  const cantripAttacks = chosenCantrips.flatMap((spell): CharacterAttack[] => {
    const definition = damagingCantrips[spell.id];
    if (!definition) return [];
    const agonizing = spell.id === "eldritch" && invocations.has("agonizing-blast");
    const sourceClassId = character.spellGrants?.find(grant => grant.spellId === spell.id && grant.classId)?.classId
      || (spell.id === "eldritch" && orderedCharacterClasses(character).some(entry => entry.classId === "warlock") ? "warlock" : character.className);
    const castingAbility = (classRules[sourceClassId]?.spellAbility || spellAbility) as AbilityKey;
    const castingMod = abilityModifier(character.abilities[castingAbility]);
    const damageBonus = agonizing ? abilityModifier(character.abilities.cha) : 0;
    const elementalAdept = definition.damageType && elementalAdeptTypes.has(definition.damageType)
      ? `Стихийный адепт (${definition.damageType.toLowerCase()}): сопротивление этому урону игнорируется, а каждая 1 на кости урона считается 2.`
      : "";
    const rays = spell.id === "eldritch" ? diceCount : 1;
    return Array.from({ length: rays }, (_, index): CharacterAttack => ({
      id: `cantrip-${spell.id}${rays > 1 ? `-beam-${index + 1}` : ""}`,
      name: `${spell.name}${rays > 1 ? ` · луч ${index + 1}/${rays}` : ""}`,
      kind: "cantrip",
      ability: castingAbility,
      proficient: true,
      attackBonus: definition.mode === "attack" ? prof + castingMod : undefined,
      saveDc: definition.mode === "save" ? 8 + prof + castingMod : undefined,
      attackBonusExtra: 0,
      damageFormula: `${spell.id === "eldritch" ? 1 : diceCount}${definition.dice}${agonizing ? "+[CHA]" : ""}`,
      damageDisplay: `${spell.id === "eldritch" ? 1 : diceCount}${definition.dice}${agonizing && damageBonus ? signed(damageBonus) : ""}`,
      note: [definition.note, elementalAdept].filter(Boolean).join(" ") || undefined,
    }));
  });

  return [...weaponAttacks, ...featureAttacks, ...cantripAttacks];
}

export function lssWeaponAttacks(attacks: CharacterAttack[]) {
  return attacks
    .filter(attack => attack.kind === "weapon" || attack.attackBonus !== undefined)
    .map((attack, index) => ({
      id: `weapon-${Date.now()}-${index}`,
      name: { value: attack.name },
      dmg: { value: attack.damageFormula },
      ability: attack.ability,
      isProf: attack.proficient,
      modBonus: { value: attack.attackBonusExtra },
    }));
}
