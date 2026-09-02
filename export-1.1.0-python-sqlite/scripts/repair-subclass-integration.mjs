import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const rulesPath = path.resolve(here, "../app/characterRules.ts");
const pagePath = path.resolve(here, "../app/page.tsx");
let rules = fs.readFileSync(rulesPath, "utf8");
let page = fs.readFileSync(pagePath, "utf8");

function replaceOnce(text, search, replacement, label) {
  const index = text.indexOf(search);
  if (index < 0) throw new Error(`Cannot patch ${label}: anchor not found`);
  if (text.indexOf(search, index + search.length) >= 0) throw new Error(`Cannot patch ${label}: anchor ambiguous`);
  return text.slice(0, index) + replacement + text.slice(index + search.length);
}

// Repair a literal escaping artefact from the source-generating workflow.
rules = rules.replace('const key = \\`\\${classId}:\\${option.id}\\`;', 'const key = `${classId}:${option.id}`;');

const oldChoiceHelper = `function selectedSubclassSpellChoiceIds(character: ExportCharacter) {
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
}`;
const newChoiceHelper = `function selectedSubclassSpellChoiceEntries(character: ExportCharacter) {
  const subclass = character.subclass || "";
  const selected = character.classChoices || {};
  const known = (ids: string[]) => ids.map(id => ({ id, mode: "known" as const }));
  const prepared = (ids: string[]) => ids.map(id => ({ id, mode: "always-prepared" as const }));
  if (character.className === "barbarian" && subclass === "giant") return known(selected["giant-cantrip"] || []);
  if (character.className === "cleric" && subclass === "nature") return known(selected["nature-druid-cantrip"] || []);
  if (character.className === "cleric" && subclass === "death") return known(selected["death-necromancy-cantrip"] || []);
  if (character.className === "cleric" && subclass === "arcana") return [
    ...known(selected["arcana-wizard-cantrips"] || []),
    ...prepared(selected["arcana-mastery-6"] || []), ...prepared(selected["arcana-mastery-7"] || []),
    ...prepared(selected["arcana-mastery-8"] || []), ...prepared(selected["arcana-mastery-9"] || []),
  ];
  return [];
}`;
if (rules.includes(oldChoiceHelper)) rules = replaceOnce(rules, oldChoiceHelper, newChoiceHelper, "subclass foreign-list choice modes");

const oldAutomatic = `export type AlwaysPreparedSpell = { id: string; source: string };

export function alwaysPreparedSpellEntries(character: ExportCharacter, catalog: CatalogSpell[]): AlwaysPreparedSpell[] {
  const maximum = spellSelectionRule(character).maxLevel;
  const subclass = selectedSubclass(character.className, character.subclass || "");
  const entries: AlwaysPreparedSpell[] = (subclass?.alwaysPrepared || []).map(id => ({ id, source: subclass?.name || "Подкласс" }));
  for (const grant of subclassSpellGrants(character)) {
    if (grant.mode === "expanded") continue;
    for (const ref of grant.refs) {
      const spell = catalog.find(item => spellMatchesRef(item, ref));
      if (spell) entries.push({ id: spell.id, source: grant.mode === "known" ? \`${subclass?.name || "Подкласс"} · автоматически известно\` : subclass?.name || "Подкласс" });
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
}`;
const newAutomatic = `export type AlwaysPreparedSpell = { id: string; source: string; mode: "always-prepared" | "known" };

export function alwaysPreparedSpellEntries(character: ExportCharacter, catalog: CatalogSpell[]): AlwaysPreparedSpell[] {
  const maximum = spellSelectionRule(character).maxLevel;
  const subclass = selectedSubclass(character.className, character.subclass || "");
  const entries: AlwaysPreparedSpell[] = (subclass?.alwaysPrepared || []).map(id => ({ id, source: subclass?.name || "Подкласс", mode: "always-prepared" }));
  for (const grant of subclassSpellGrants(character)) {
    if (grant.mode === "expanded") continue;
    for (const ref of grant.refs) {
      const spell = catalog.find(item => spellMatchesRef(item, ref));
      if (spell) entries.push({ id: spell.id, source: subclass?.name || "Подкласс", mode: grant.mode });
    }
  }
  for (const choice of selectedSubclassSpellChoiceEntries(character)) entries.push({ id: choice.id, source: subclass?.name || "Подкласс", mode: choice.mode });
  if (character.useTasha && !character.tceFullBanned && character.className === "ranger" && character.level >= 3) entries.push({ id: "speak-with-animals", source: "Первозданная осведомлённость (TCE)", mode: "known" });
  return entries
    .filter(entry => {
      const spell = catalog.find(item => item.id === entry.id);
      return Boolean(spell) && spell!.level <= maximum;
    })
    .filter((entry, index, all) => all.findIndex(item => item.id === entry.id) === index);
}`;
if (rules.includes(oldAutomatic)) rules = replaceOnce(rules, oldAutomatic, newAutomatic, "automatic spell modes");

// Keep every class choice in CharacterClassProgress.choiceValues immediately,
// while retaining the legacy global mirror until old exports are removed.
const oldToggleClassChoice = `  function toggleClassChoice(groupKey: string, id: string, limit: number) {
    setCharacter(current => {
      const choices = current.classChoices || {};
      const selected = choices[groupKey] || [];
      const next = selected.includes(id) ? selected.filter(value => value !== id) : selected.length < limit ? [...selected, id] : selected;
      return { ...current, classChoices: { ...choices, [groupKey]: next } };
    });
  }`;
const newToggleClassChoice = `  function toggleClassChoice(groupKey: string, id: string, limit: number) {
    setCharacter(current => {
      const safe = migrateMulticlassCharacter(current);
      const separator = groupKey.indexOf(":");
      const classId = separator > 0 ? groupKey.slice(0, separator) : (safe.startingClassId || safe.className);
      const localKey = separator > 0 ? groupKey.slice(separator + 1) : groupKey;
      const entry = orderedCharacterClasses(safe).find(item => item.classId === classId);
      const choices = safe.classChoices || {};
      const selected = choices[groupKey] || entry?.choiceValues?.[localKey] || [];
      const next = selected.includes(id) ? selected.filter(value => value !== id) : selected.length < limit ? [...selected, id] : selected;
      const classes = orderedCharacterClasses(safe).map(item => item.classId === classId
        ? { ...item, choiceValues: { ...(item.choiceValues || {}), [localKey]: next } }
        : item);
      return migrateMulticlassCharacter({ ...safe, classes, classChoices: { ...choices, [groupKey]: next } });
    });
  }`;
if (page.includes(oldToggleClassChoice)) page = replaceOnce(page, oldToggleClassChoice, newToggleClassChoice, "class-local choice persistence");

const oldToggleProf = `  function toggleProficiencyChoice(key: string, value: string, limit: number) {
    setCharacter(current => {
      const choices = current.proficiencyChoices || {};
      const selected = choices[key] || [];
      if (!selected.includes(value) && proficiencyChoiceUsedElsewhere(current, key, value)) return current;
      const next = selected.includes(value)
        ? selected.filter(item => item !== value)
        : selected.length < limit ? [...selected, value] : limit === 1 ? [value] : selected;
      return { ...current, proficiencyChoices: { ...choices, [key]: next } };
    });
  }`;
const newToggleProf = `  function toggleProficiencyChoice(key: string, value: string, limit: number) {
    setCharacter(current => {
      const safe = migrateMulticlassCharacter(current);
      const choices = safe.proficiencyChoices || {};
      const selected = choices[key] || [];
      if (!selected.includes(value) && proficiencyChoiceUsedElsewhere(safe, key, value)) return safe;
      const next = selected.includes(value)
        ? selected.filter(item => item !== value)
        : selected.length < limit ? [...selected, value] : limit === 1 ? [value] : selected;
      const subclassMatch = key.match(/^subclass-([a-z-]+)-/);
      const classes = subclassMatch
        ? orderedCharacterClasses(safe).map(item => item.classId === subclassMatch[1] ? { ...item, choiceValues: { ...(item.choiceValues || {}), [key]: next } } : item)
        : safe.classes;
      return migrateMulticlassCharacter({ ...safe, classes, proficiencyChoices: { ...choices, [key]: next } });
    });
  }`;
if (page.includes(oldToggleProf)) page = replaceOnce(page, oldToggleProf, newToggleProf, "subclass proficiency choice persistence");

const autoAnchor = `  const alwaysPreparedEntries = alwaysPreparedSpellEntries(spellCharacter, availableSpellCatalog);
  const alwaysPrepared = alwaysPreparedEntries.map(entry => entry.id);
  const alwaysPreparedSet = new Set(alwaysPrepared);`;
const autoReplacement = `  const alwaysPreparedEntries = alwaysPreparedSpellEntries(spellCharacter, availableSpellCatalog);
  const alwaysPrepared = alwaysPreparedEntries.map(entry => entry.id);
  const alwaysPreparedSet = new Set(alwaysPrepared);
  const allAutomaticSubclassSpellIds = [...new Set(spellClassCandidates.flatMap(candidate => alwaysPreparedSpellEntries({
    ...rulesCharacter,
    className: candidate.entry.classId,
    subclass: candidate.entry.subclassId || "",
    level: candidate.entry.level,
    abilities: finalAbilities,
  }, availableSpellCatalog).map(entry => entry.id)))];`;
if (page.includes(autoAnchor) && !page.includes("allAutomaticSubclassSpellIds")) page = replaceOnce(page, autoAnchor, autoReplacement, "multiclass automatic spell export aggregation");

page = page.replace('    alwaysPreparedSpellIds: alwaysPrepared,', '    alwaysPreparedSpellIds: allAutomaticSubclassSpellIds.length ? allAutomaticSubclassSpellIds : alwaysPrepared,');
page = page.replace('<div><small>Класс и подкласс</small><h2>Всегда подготовлены</h2><p>Добавляются автоматически, не занимают лимит и недоступны для повторного выбора.</p></div>', '<div><small>Класс и подкласс</small><h2>Автоматические заклинания</h2><p>Выданы классом или подклассом сверх обычного лимита. Под каждым заклинанием указан режим: всегда подготовлено или автоматически известно.</p></div>');
page = page.replace('<small>{entry.source}</small></span>', '<small>{entry.source} · {entry.mode === "known" ? "автоматически известно" : "всегда подготовлено"}</small></span>');

const oldSubclassCard = `<button key={option.id} className={entry.subclassId === option.id ? "selected" : ""} onClick={() => selectMulticlassSubclass(entry.classId, option.id)}>
                          <span>{option.source}</span><strong>{option.name}</strong><p>{option.description}</p>
                        </button>`;
const newSubclassCard = `<button key={option.id} className={entry.subclassId === option.id ? "selected" : ""} onClick={() => selectMulticlassSubclass(entry.classId, option.id)}>
                          <span>{option.source}{option.flags?.dmApproval ? " · разрешение Мастера" : ""}</span><strong>{option.name}</strong><p>{option.description}</p>
                          {option.flags?.settingRestriction && <small>Ограничение сеттинга: {option.flags.settingRestriction}</small>}
                          {option.flags?.dmApproval && <small>Вариант DMG: не скрыт, но обычно требует разрешения Мастера.</small>}
                        </button>`;
if (page.includes(oldSubclassCard)) page = replaceOnce(page, oldSubclassCard, newSubclassCard, "subclass campaign warnings");

fs.writeFileSync(rulesPath, rules);
fs.writeFileSync(pagePath, page);
console.log("Repaired subclass spell modes and applied multiclass-safe subclass UI persistence/export warnings.");
