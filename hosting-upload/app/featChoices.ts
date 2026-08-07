import type { CatalogSpell } from "./catalog";
import type { AdvancementChoice, AbilityScores, ExportCharacter } from "./exportFormats";
import { abilityLabels } from "./rules";

export type FeatChoiceGroup = {
  key: string;
  title: string;
  description: string;
  count: number;
  options: Array<{ id: string; name: string; detail?: string }>;
};

const castingClasses = [
  ["bard", "Бард"], ["cleric", "Жрец"], ["druid", "Друид"], ["sorcerer", "Чародей"], ["warlock", "Колдун"], ["wizard", "Волшебник"],
] as const;
const mental = ["int", "wis", "cha"] as const;
const abilityOptions = (keys: readonly (keyof AbilityScores)[]) => keys.map(id => ({ id, name: abilityLabels[id] }));
const classOptions = castingClasses.map(([id, name]) => ({ id, name }));

function choice(choice: AdvancementChoice, key: string) {
  return choice.featChoices?.[key] || [];
}

function classSpellOptions(spells: CatalogSpell[], classId: string, level: number, ritualOnly = false) {
  return spells
    .filter(spell => spell.level === level && spell.classes.includes(classId) && (!ritualOnly || spell.ritual))
    .map(spell => ({ id: spell.id, name: spell.name, detail: spell.description }));
}

export function featChoiceGroups(choiceValue: AdvancementChoice, spells: CatalogSpell[]): FeatChoiceGroup[] {
  const feat = choiceValue.featId;
  const tradition = choice(choiceValue, "tradition")[0] || "";
  const groups: FeatChoiceGroup[] = [];
  const ability = (keys: readonly (keyof AbilityScores)[]) => groups.push({ key: "ability", title: "Бонус характеристики", description: "Выбранная характеристика увеличивается на 1, но не выше 20.", count: 1, options: abilityOptions(keys) });

  if (feat === "athlete") ability(["str", "dex"]);
  if (feat === "observant") ability(["int", "wis"]);
  if (["fey-touched", "shadow-touched", "telekinetic"].includes(feat)) ability(mental);
  if (feat === "resilient") ability(["str", "dex", "con", "int", "wis", "cha"]);
  if (feat === "elemental-adept") groups.push({ key: "element", title: "Тип урона", description: "Заклинания выбранной стихии игнорируют сопротивление, а 1 на кости урона считается 2.", count: 1, options: ["Кислота", "Холод", "Огонь", "Электричество", "Звук"].map(name => ({ id: name, name })) });

  if (feat === "magic-initiate") {
    groups.push({ key: "tradition", title: "Список заклинаний", description: "Он определяет доступные заклинания и базовую характеристику этой черты.", count: 1, options: classOptions });
    if (tradition) {
      groups.push({ key: "cantrips", title: "Два заговора", description: "Вы знаете их постоянно; они не расходуют выбор заклинаний вашего класса.", count: 2, options: classSpellOptions(spells, tradition, 0) });
      groups.push({ key: "spell", title: "Заклинание 1-го круга", description: "Его можно наложить один раз на минимальном круге без ячейки; применение восстанавливается после продолжительного отдыха.", count: 1, options: classSpellOptions(spells, tradition, 1) });
    }
  }
  if (feat === "ritual-caster") {
    groups.push({ key: "tradition", title: "Ритуальная традиция", description: "Выберите класс, из списка которого составлена ритуальная книга.", count: 1, options: classOptions });
    if (tradition) groups.push({ key: "rituals", title: "Начальные ритуалы", description: "Книга начинается с двух заклинаний 1-го круга с меткой «ритуал».", count: 2, options: classSpellOptions(spells, tradition, 1, true) });
  }
  if (feat === "spell-sniper") {
    groups.push({ key: "tradition", title: "Список заговора", description: "Выберите класс и один его заговор с броском атаки.", count: 1, options: classOptions });
    if (tradition) groups.push({ key: "cantrips", title: "Атакующий заговор", description: "Дальность атакующих заклинаний удваивается, а половина и три четверти укрытия игнорируются.", count: 1, options: classSpellOptions(spells, tradition, 0) });
  }
  if (feat === "fey-touched" || feat === "shadow-touched") {
    const allowedSchools = feat === "fey-touched" ? ["Прорицание", "Очарование"] : ["Иллюзия", "Некромантия"];
    groups.push({ key: "spell", title: "Дополнительное заклинание 1-го круга", description: `Выберите заклинание школы: ${allowedSchools.join(" или ")}. Оно и дарованное чертой заклинание накладываются раз в продолжительный отдых без ячейки.`, count: 1, options: spells.filter(spell => spell.level === 1 && allowedSchools.some(school => spell.school.toLowerCase().includes(school.toLowerCase()))).map(spell => ({ id: spell.id, name: spell.name, detail: spell.description })) });
  }
  return groups;
}

export function advancementChoiceComplete(choiceValue: AdvancementChoice, spells: CatalogSpell[]) {
  if (!choiceValue.featId) return false;
  if (choiceValue.featId === "asi") return choiceValue.asiChoices.length === 2;
  return featChoiceGroups(choiceValue, spells).every(group => (choiceValue.featChoices?.[group.key] || []).length === group.count);
}

export function featGrantedSpellIds(character: ExportCharacter) {
  const ids = (character.advancements || []).flatMap(choiceValue => {
    if (!choiceValue.featId) return [];
    const choices = choiceValue.featChoices || {};
    const fixed = choiceValue.featId === "fey-touched" ? ["mistystep"] : choiceValue.featId === "shadow-touched" ? ["invisibility"] : [];
    return [...fixed, ...(choices.cantrips || []), ...(choices.spell || []), ...(choices.rituals || [])];
  });
  return [...new Set(ids)];
}

export function resolvedFeatDescriptions(character: ExportCharacter, spells: CatalogSpell[]) {
  return (character.advancements || []).flatMap(choiceValue => {
    if (!choiceValue.featId || choiceValue.featId === "asi") return [];
    const groups = featChoiceGroups(choiceValue, spells);
    const selections = groups.map(group => {
      const names = (choiceValue.featChoices?.[group.key] || []).map(id => group.options.find(option => option.id === id)?.name || id);
      return names.length ? `${group.title}: ${names.join(", ")}` : "";
    }).filter(Boolean);
    return selections;
  });
}

export function featAbilityBonuses(character: ExportCharacter) {
  const result: Partial<Record<keyof AbilityScores, number>> = {};
  for (const choiceValue of character.advancements || []) {
    const fixed = choiceValue.featId === "actor" ? "cha" : choiceValue.featId === "durable" ? "con" : "";
    const selected = choiceValue.featChoices?.ability?.[0] || fixed;
    if (selected) result[selected as keyof AbilityScores] = (result[selected as keyof AbilityScores] || 0) + 1;
  }
  return result;
}
