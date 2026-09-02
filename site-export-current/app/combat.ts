import type { CatalogSpell } from "./catalog";
import { selectedEquipment } from "./equipment";
import type { AbilityScores, ExportCharacter } from "./exportFormats";
import { classRules } from "./rules";

type AbilityKey = keyof AbilityScores;

const abilityModifier = (score: number) => Math.floor((score - 10) / 2);
const proficiencyBonus = (level: number) => 2 + Math.floor((Math.max(1, level) - 1) / 4);

export type CharacterAttack = {
  id: string;
  name: string;
  kind: "weapon" | "cantrip";
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
  "боевой посох": { name: "Боевой посох", dice: "1d6" },
  "серп": { name: "Серп", dice: "1d4" },
  "копьё": { name: "Копьё", dice: "1d6", thrown: true },
  "лёгкий арбалет": { name: "Лёгкий арбалет", dice: "1d8", ranged: true, twoHanded: true },
  "дротик": { name: "Дротик", dice: "1d4", ranged: true, finesse: true, thrown: true },
  "короткий лук": { name: "Короткий лук", dice: "1d6", ranged: true, twoHanded: true },
  "длинный лук": { name: "Длинный лук", dice: "1d8", ranged: true, twoHanded: true },
  "праща": { name: "Праща", dice: "1d4", ranged: true },
  "боевой топор": { name: "Боевой топор", dice: "1d8" },
  "цеп": { name: "Цеп", dice: "1d8" },
  "глефа": { name: "Глефа", dice: "1d10", twoHanded: true },
  "секира": { name: "Секира", dice: "1d12", twoHanded: true },
  "двуручный меч": { name: "Двуручный меч", dice: "2d6", twoHanded: true },
  "алебарда": { name: "Алебарда", dice: "1d10", twoHanded: true },
  "длинное копьё": { name: "Длинное копьё", dice: "1d12" },
  "длинный меч": { name: "Длинный меч", dice: "1d8" },
  "молот": { name: "Молот", dice: "2d6", twoHanded: true },
  "моргенштерн": { name: "Моргенштерн", dice: "1d8" },
  "пика": { name: "Пика", dice: "1d10", twoHanded: true },
  "рапира": { name: "Рапира", dice: "1d8", finesse: true },
  "скимитар": { name: "Скимитар", dice: "1d6", finesse: true },
  "короткий меч": { name: "Короткий меч", dice: "1d6", finesse: true },
  "трезубец": { name: "Трезубец", dice: "1d6", thrown: true },
  "боевая кирка": { name: "Боевая кирка", dice: "1d8" },
  "боевой молот": { name: "Боевой молот", dice: "1d8" },
  "кнут": { name: "Кнут", dice: "1d4", finesse: true },
};

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
  eldritch: { dice: "d10", mode: "attack", note: "На 5, 11 и 17 уровнях создаёт соответственно 2, 3 и 4 отдельных луча." },
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

function weaponAbility(definition: WeaponDefinition, character: ExportCharacter): AbilityKey {
  if (definition.ranged) return "dex";
  if (definition.finesse && character.abilities.dex > character.abilities.str) return "dex";
  return "str";
}

export function characterAttacks(character: ExportCharacter, spells: CatalogSpell[]): CharacterAttack[] {
  const prof = proficiencyBonus(character.level);
  const styles = new Set(character.classChoices?.["fighting-style"] || []);
  const equipment = selectedEquipment(character);
  const seenWeapons = new Set<string>();
  const weaponAttacks = equipment.flatMap((item): CharacterAttack[] => {
    const key = normalizeEquipmentName(item);
    const definition = weaponDefinitions[key];
    if (!definition || seenWeapons.has(key)) return [];
    seenWeapons.add(key);
    const ability = weaponAbility(definition, character);
    const abilityMod = abilityModifier(character.abilities[ability]);
    const attackBonusExtra = styles.has("archery") && definition.ranged ? 2 : 0;
    const damageExtra = (styles.has("dueling") && !definition.ranged && !definition.twoHanded ? 2 : 0)
      + (styles.has("thrown-weapon") && definition.thrown ? 2 : 0);
    const abilityVariable = `[${ability.toUpperCase()}]`;
    return [{
      id: `weapon-${key}`,
      name: definition.name,
      kind: "weapon",
      ability,
      proficient: true,
      attackBonus: prof + abilityMod + attackBonusExtra,
      attackBonusExtra,
      damageFormula: `${definition.dice}+${abilityVariable}${damageExtra ? `+${damageExtra}` : ""}`,
      damageDisplay: `${definition.dice}${signed(abilityMod + damageExtra)}`,
    }];
  });

  const spellAbility = classRules[character.className]?.spellAbility as AbilityKey | undefined;
  if (!spellAbility) return weaponAttacks;
  const spellMod = abilityModifier(character.abilities[spellAbility]);
  const saveDc = 8 + prof + spellMod;
  const diceCount = cantripDiceCount(character.level);
  const elementalAdeptTypes = new Set(
    (character.advancements || [])
      .filter(choice => choice.featId === "elemental-adept")
      .flatMap(choice => choice.featChoices?.element || []),
  );
  const chosenCantrips = character.spells
    .map(id => spells.find(spell => spell.id === id && spell.level === 0))
    .filter(Boolean) as CatalogSpell[];
  const cantripAttacks = chosenCantrips.flatMap((spell): CharacterAttack[] => {
    const definition = damagingCantrips[spell.id];
    if (!definition) return [];
    const agonizing = spell.id === "eldritch" && (character.classChoices?.invocations || []).includes("agonizing-blast");
    const damageBonus = agonizing ? spellMod * diceCount : 0;
    const elementalAdept = definition.damageType && elementalAdeptTypes.has(definition.damageType)
      ? `Стихийный адепт (${definition.damageType.toLowerCase()}): сопротивление этому урону игнорируется, а каждая 1 на кости урона считается 2.`
      : "";
    return [{
      id: `cantrip-${spell.id}`,
      name: spell.name,
      kind: "cantrip",
      ability: spellAbility,
      proficient: true,
      attackBonus: definition.mode === "attack" ? prof + spellMod : undefined,
      saveDc: definition.mode === "save" ? saveDc : undefined,
      attackBonusExtra: 0,
      damageFormula: `${diceCount}${definition.dice}${agonizing ? `+[CHA]*${diceCount}` : ""}`,
      damageDisplay: `${diceCount}${definition.dice}${damageBonus ? signed(damageBonus) : ""}`,
      note: [definition.note, elementalAdept].filter(Boolean).join(" ") || undefined,
    }];
  });

  return [...weaponAttacks, ...cantripAttacks];
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
