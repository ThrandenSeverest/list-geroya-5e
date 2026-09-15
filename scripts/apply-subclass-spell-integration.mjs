import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const target = path.resolve(here, "../app/characterRules.ts");
let text = fs.readFileSync(target, "utf8");
const marker = "SUBCLASS_SPELL_GRANTS_5E14";
if (text.includes(marker)) {
  console.log("Subclass spell integration already applied.");
  process.exit(0);
}

function replaceOnce(search, replacement, label) {
  const index = text.indexOf(search);
  if (index < 0) throw new Error(`Cannot apply ${label}: anchor not found`);
  if (text.indexOf(search, index + search.length) >= 0) throw new Error(`Cannot apply ${label}: anchor is ambiguous`);
  text = text.slice(0, index) + replacement + text.slice(index + search.length);
}

replaceOnce(`export type SubclassOption = {
  id: string;
  name: string;
  source: string;
  description: string;
  features: Feature[];
  alwaysPrepared?: string[];
  expandedSpells?: string[];
};`, `export type SubclassSpellGrant = {
  level: number;
  mode: "always-prepared" | "known" | "expanded";
  refs: string[];
};

export type SubclassOption = {
  id: string;
  name: string;
  source: string;
  description: string;
  features: Feature[];
  alwaysPrepared?: string[];
  expandedSpells?: string[];
  spellGrants?: SubclassSpellGrant[];
  flags?: { dmApproval?: boolean; settingRestriction?: string };
};`, "SubclassOption spell metadata");

const insertionAnchor = `for (const option of missingOfficialSubclassOptions) {
  const group = subclasses[option.classId];
  if (!group || group.options.some(existing => existing.id === option.id)) continue;
  group.options.push({ ...option, features: subclassFeatureCorpus[option.classId]?.[option.name] || [] });
}
`;

const metadata = String.raw`
// SUBCLASS_SPELL_GRANTS_5E14
// Spell references intentionally use human-readable names. The resolver below
// matches both catalogue ids and normalised display names, which keeps this
// table stable when imported spell ids differ between DND.su/LSS/Helpmate.
const G = (level: number, mode: SubclassSpellGrant["mode"], ...refs: string[]): SubclassSpellGrant => ({ level, mode, refs });
const subclassSpellGrantTable: Record<string, SubclassSpellGrant[]> = {
  "cleric:tempest": [G(1,"always-prepared","Туманное облако","Волна грома"),G(3,"always-prepared","Порыв ветра","Дребезги"),G(5,"always-prepared","Призыв молнии","Метель"),G(7,"always-prepared","Власть над водами","Ледяная буря"),G(9,"always-prepared","Разрушительная волна","Нашествие насекомых")],
  "cleric:knowledge": [G(1,"always-prepared","Приказ","Опознание"),G(3,"always-prepared","Гадание","Внушение"),G(5,"always-prepared","Необнаружимость","Разговор с мёртвыми"),G(7,"always-prepared","Магический глаз","Замешательство"),G(9,"always-prepared","Знание легенд","Наблюдение")],
  "cleric:trickery": [G(1,"always-prepared","Очарование личности","Маскировка"),G(3,"always-prepared","Отражения","Бесследное передвижение"),G(5,"always-prepared","Мерцание","Рассеивание магии"),G(7,"always-prepared","Переносящая дверь","Превращение"),G(9,"always-prepared","Подчинение личности","Изменение памяти")],
  "cleric:nature": [G(1,"always-prepared","Дружба с животными","Разговор с животными"),G(3,"always-prepared","Дубовая кора","Шипы"),G(5,"always-prepared","Рост растений","Стена ветров"),G(7,"always-prepared","Подчинение зверя","Цепкая лоза"),G(9,"always-prepared","Нашествие насекомых","Древесный путь")],
  "cleric:death": [G(1,"always-prepared","Ложная жизнь","Луч болезни"),G(3,"always-prepared","Слепота/глухота","Луч слабости"),G(5,"always-prepared","Оживление мертвецов","Прикосновение вампира"),G(7,"always-prepared","Усыхание","Защита от смерти"),G(9,"always-prepared","Оболочка против жизни","Облако смерти")],
  "cleric:arcana": [G(1,"always-prepared","Обнаружение магии","Волшебная стрела"),G(3,"always-prepared","Магическое оружие","Магическая аура Нистула"),G(5,"always-prepared","Рассеивание магии","Магический круг"),G(7,"always-prepared","Магический глаз","Тайный сундук Леомунда"),G(9,"always-prepared","Планарные узы","Круг телепортации")],
  "cleric:peace": [G(1,"always-prepared","Героизм","Убежище"),G(3,"always-prepared","Подмога","Защитная связь"),G(5,"always-prepared","Маяк надежды","Послание"),G(7,"always-prepared","Аура чистоты","Упругая сфера Отилюка"),G(9,"always-prepared","Высшее восстановление","Телепатическая связь Рэри")],
  "cleric:order": [G(1,"always-prepared","Приказ","Героизм"),G(3,"always-prepared","Удержание личности","Область истины"),G(5,"always-prepared","Массовое лечение ран","Замедление"),G(7,"always-prepared","Принуждение","Поиск существа"),G(9,"always-prepared","Общение","Подчинение личности")],
  "druid:spores": [G(2,"known","Леденящее прикосновение"),G(3,"always-prepared","Слепота/глухота","Нетленные останки"),G(5,"always-prepared","Оживление мертвецов","Газообразная форма"),G(7,"always-prepared","Усыхание","Замешательство"),G(9,"always-prepared","Облако смерти","Заражение")],
  "paladin:oathbreaker": [G(3,"always-prepared","Адское возмездие","Нанесение ран"),G(5,"always-prepared","Корона безумия","Тьма"),G(9,"always-prepared","Оживление мертвецов","Проклятие"),G(13,"always-prepared","Усыхание","Замешательство"),G(17,"always-prepared","Заражение","Подчинение личности")],
  "paladin:crown": [G(3,"always-prepared","Приказ","Вызов на дуэль"),G(5,"always-prepared","Оберегающая связь","Область истины"),G(9,"always-prepared","Аура живучести","Духовные стражи"),G(13,"always-prepared","Изгнание","Страж веры"),G(17,"always-prepared","Круг силы","Обет/Гейс","Обет","Гейс")],
  "paladin:glory": [G(3,"always-prepared","Направляющий снаряд","Героизм"),G(5,"always-prepared","Улучшение характеристики","Магическое оружие"),G(9,"always-prepared","Ускорение","Защита от энергии"),G(13,"always-prepared","Принуждение","Свобода перемещения"),G(17,"always-prepared","Общение","Огненный столп")],
  "ranger:swarmkeeper": [G(3,"known","Волшебная рука","Огонь фей"),G(5,"known","Паутина"),G(9,"known","Газообразная форма"),G(13,"known","Магический глаз"),G(17,"known","Нашествие насекомых")],
  "ranger:drakewarden": [G(3,"known","Чудотворство")],
  "sorcerer:clockwork": [G(1,"known","Тревога","Защита от добра и зла"),G(3,"known","Подмога","Малое восстановление"),G(5,"known","Рассеивание магии","Защита от энергии"),G(7,"known","Свобода перемещения","Призыв конструкта"),G(9,"known","Высшее восстановление","Стена силы")],
  "bard:spirits": [G(3,"known","Указание")],
  "warlock:undying": [G(1,"known","Уход за умирающим"),G(1,"expanded","Ложная жизнь","Луч болезни"),G(3,"expanded","Слепота/глухота","Тишина"),G(5,"expanded","Мнимая смерть","Разговор с мёртвыми"),G(7,"expanded","Аура жизни","Защита от смерти"),G(9,"expanded","Заражение","Знание легенд")],
  "warlock:fathomless": [G(1,"expanded","Создание/уничтожение воды","Волна грома"),G(3,"expanded","Порыв ветра","Тишина"),G(5,"expanded","Молния","Метель"),G(7,"expanded","Власть над водами","Призыв элементаля"),G(9,"expanded","Рука Бигби","Конус холода"),G(10,"known","Чёрные щупальца Эварда")],
  "warlock:undead": [G(1,"expanded","Порча","Ложная жизнь"),G(3,"expanded","Слепота/глухота","Воображаемая сила"),G(5,"expanded","Призрачный скакун","Разговор с мёртвыми"),G(7,"expanded","Защита от смерти","Высшая невидимость"),G(9,"expanded","Оболочка против жизни","Облако смерти")],
};
const subclassFlagTable: Record<string, NonNullable<SubclassOption["flags"]>> = {
  "cleric:death": { dmApproval: true },
  "paladin:oathbreaker": { dmApproval: true },
  "barbarian:battlerager": { settingRestriction: "Forgotten Realms: dwarf" },
};
for (const [classId, group] of Object.entries(subclasses)) for (const option of group.options) {
  const key = \`\${classId}:\${option.id}\`;
  option.spellGrants = subclassSpellGrantTable[key] || option.spellGrants;
  option.flags = subclassFlagTable[key] || option.flags;
}

function normalSpellRef(value: string) {
  return value.toLocaleLowerCase("ru").replace(/[ё]/g,"е").replace(/[^a-zа-я0-9]+/gi,"");
}
function spellMatchesRef(spell: CatalogSpell, ref: string) {
  const needle = normalSpellRef(ref);
  return normalSpellRef(spell.id) === needle || normalSpellRef(spell.name) === needle;
}
function subclassSpellGrants(character: Pick<ExportCharacter,"className"|"subclass"|"level">) {
  return selectedSubclass(character.className, character.subclass || "")?.spellGrants?.filter(grant => character.level >= grant.level) || [];
}
function selectedSubclassSpellChoiceIds(character: ExportCharacter) {
  const subclass = character.subclass || "";
  const selected = character.classChoices || {};
  if (character.className === "barbarian" && subclass === "giant") return selected["giant-cantrip"] || [];
  if (character.className === "cleric" && subclass === "nature") return selected["nature-druid-cantrip"] || [];
  if (character.className === "cleric" && subclass === "death") return selected["death-necromancy-cantrip"] || [];
  if (character.className === "cleric" && subclass === "arcana") return [
    ...(selected["arcana-wizard-cantrips"] || []),
    ...(selected["arcana-mastery-6"] || []), ...(selected["arcana-mastery-7"] || []),
    ...(selected["arcana-mastery-8"] || []), ...(selected["arcana-mastery-9"] || []),
  ];
  return [];
}
`;
replaceOnce(insertionAnchor, insertionAnchor + metadata, "subclass spell grant table");

replaceOnce(`export function spellAvailableToCharacter(character: Pick<ExportCharacter, "className" | "subclass" | "useTasha" | "tceFullBanned">, spell: CatalogSpell) {
  if (spell.classes.includes(character.className)) return true;
  if (isTashaAdditionalSpell(character, spell.id)) return true;
  const subclass = selectedSubclass(character.className, character.subclass || "");
  if (subclass?.expandedSpells?.includes(spell.id)) return true;
  if (character.className === "sorcerer" && character.subclass === "divinesoul" && spell.classes.includes("cleric")) return true;
  return false;
}`, `export function spellAvailableToCharacter(character: Pick<ExportCharacter, "className" | "subclass" | "level" | "useTasha" | "tceFullBanned">, spell: CatalogSpell) {
  if (spell.classes.includes(character.className)) return true;
  if (isTashaAdditionalSpell(character, spell.id)) return true;
  const subclass = selectedSubclass(character.className, character.subclass || "");
  if (subclass?.expandedSpells?.includes(spell.id)) return true;
  if (subclassSpellGrants(character).some(grant => grant.mode === "expanded" && grant.refs.some(ref => spellMatchesRef(spell, ref)))) return true;
  if (character.className === "sorcerer" && character.subclass === "divinesoul" && spell.classes.includes("cleric")) return true;
  return false;
}`, "expanded patron spell availability");

replaceOnce(`export function alwaysPreparedSpellEntries(character: ExportCharacter, catalog: CatalogSpell[]): AlwaysPreparedSpell[] {
  const maximum = spellSelectionRule(character).maxLevel;
  const subclass = selectedSubclass(character.className, character.subclass || "");
  const entries: AlwaysPreparedSpell[] = (subclass?.alwaysPrepared || [])
    .map(id => ({ id, source: subclass?.name || "Подкласс" }));
  if (character.useTasha && !character.tceFullBanned && character.className === "ranger" && character.level >= 3) {
    entries.push({ id: "speak-with-animals", source: "Первозданная осведомлённость (TCE)" });
  }
  return entries
    .filter(entry => {
      const id = entry.id;
      const spell = catalog.find(item => item.id === id);
      return Boolean(spell) && spell!.level <= maximum;
    })
    .filter((entry, index, all) => all.findIndex(item => item.id === entry.id) === index);
}`, `export function alwaysPreparedSpellEntries(character: ExportCharacter, catalog: CatalogSpell[]): AlwaysPreparedSpell[] {
  const maximum = spellSelectionRule(character).maxLevel;
  const subclass = selectedSubclass(character.className, character.subclass || "");
  const entries: AlwaysPreparedSpell[] = (subclass?.alwaysPrepared || []).map(id => ({ id, source: subclass?.name || "Подкласс" }));
  for (const grant of subclassSpellGrants(character)) {
    if (grant.mode === "expanded") continue;
    for (const ref of grant.refs) {
      const spell = catalog.find(item => spellMatchesRef(item, ref));
      if (spell) entries.push({ id: spell.id, source: grant.mode === "known" ? \`\${subclass?.name || "Подкласс"} · автоматически известно\` : subclass?.name || "Подкласс" });
    }
  }
  for (const id of selectedSubclassSpellChoiceIds(character)) entries.push({ id, source: subclass?.name || "Подкласс" });
  if (character.useTasha && !character.tceFullBanned && character.className === "ranger" && character.level >= 3) entries.push({ id: "speak-with-animals", source: "Первозданная осведомлённость (TCE)" });
  return entries
    .filter(entry => {
      const spell = catalog.find(item => item.id === entry.id);
      return Boolean(spell) && spell!.level <= maximum;
    })
    .filter((entry, index, all) => all.findIndex(item => item.id === entry.id) === index);
}`, "automatic subclass spell grants");

fs.writeFileSync(target, text);
console.log("Applied full 5e14 subclass spell grant/expanded-list metadata to characterRules.ts");
