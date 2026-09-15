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
function replaceFunction(text, signature, replacement, label) {
  const start = text.indexOf(signature);
  if (start < 0) throw new Error(`Cannot patch ${label}: function not found`);
  const open = text.indexOf("{", start);
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let i = open; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") { quote = ch; continue; }
    if (ch === "{") depth += 1;
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(0, start) + replacement + text.slice(i + 1);
    }
  }
  throw new Error(`Cannot patch ${label}: function end not found`);
}

// Repair literal escaping produced by the first generator version.
rules = rules.replace('const key = \\`\\${classId}:\\${option.id}\\`;', 'const key = `${classId}:${option.id}`;');

if (rules.includes("function selectedSubclassSpellChoiceIds")) {
  rules = replaceFunction(rules, "function selectedSubclassSpellChoiceIds", `function selectedSubclassSpellChoiceEntries(character: ExportCharacter) {
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
}`, "foreign-list subclass spell choices");
}

rules = rules.replace(
  'export type AlwaysPreparedSpell = { id: string; source: string };',
  'export type AlwaysPreparedSpell = { id: string; source: string; mode: "always-prepared" | "known" };',
);
rules = rules.replace(
  'const entries: AlwaysPreparedSpell[] = (subclass?.alwaysPrepared || []).map(id => ({ id, source: subclass?.name || "Подкласс" }));',
  'const entries: AlwaysPreparedSpell[] = (subclass?.alwaysPrepared || []).map(id => ({ id, source: subclass?.name || "Подкласс", mode: "always-prepared" }));',
);
rules = rules.replace(
  /if \(spell\) entries\.push\(\{ id: spell\.id, source: grant\.mode === "known" \? .*? : subclass\?\.name \|\| "Подкласс" \}\);/,
  'if (spell) entries.push({ id: spell.id, source: subclass?.name || "Подкласс", mode: grant.mode });',
);
rules = rules.replace(
  'for (const id of selectedSubclassSpellChoiceIds(character)) entries.push({ id, source: subclass?.name || "Подкласс" });',
  'for (const choice of selectedSubclassSpellChoiceEntries(character)) entries.push({ id: choice.id, source: subclass?.name || "Подкласс", mode: choice.mode });',
);
rules = rules.replace(
  'entries.push({ id: "speak-with-animals", source: "Первозданная осведомлённость (TCE)" });',
  'entries.push({ id: "speak-with-animals", source: "Первозданная осведомлённость (TCE)", mode: "known" });',
);

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
if (page.includes(oldToggleProf)) page = replaceOnce(page, oldToggleProf, newToggleProf, "subclass proficiency persistence");

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
if (page.includes(autoAnchor) && !page.includes("allAutomaticSubclassSpellIds")) page = replaceOnce(page, autoAnchor, autoReplacement, "multiclass automatic spell export");
page = page.replace('    alwaysPreparedSpellIds: alwaysPrepared,', '    alwaysPreparedSpellIds: allAutomaticSubclassSpellIds.length ? allAutomaticSubclassSpellIds : alwaysPrepared,');
page = page.replace('<div><small>Класс и подкласс</small><h2>Всегда подготовлены</h2><p>Добавляются автоматически, не занимают лимит и недоступны для повторного выбора.</p></div>', '<div><small>Класс и подкласс</small><h2>Автоматические заклинания</h2><p>Выданы классом или подклассом сверх обычного лимита. Под каждым заклинанием указан режим.</p></div>');
page = page.replace('<small>{entry.source}</small></span>', '<small>{entry.source} · {entry.mode === "known" ? "автоматически известно" : "всегда подготовлено"}</small></span>');

const oldSubclassCard = `<button key={option.id} className={entry.subclassId === option.id ? "selected" : ""} onClick={() => selectMulticlassSubclass(entry.classId, option.id)}>
                          <span>{option.source}</span><strong>{option.name}</strong><p>{option.description}</p>
                        </button>`;
const newSubclassCard = `<button key={option.id} className={entry.subclassId === option.id ? "selected" : ""} onClick={() => selectMulticlassSubclass(entry.classId, option.id)}>
                          <span>{option.source}{option.flags?.dmApproval ? " · разрешение Мастера" : ""}</span><strong>{option.name}</strong><p>{option.description}</p>
                          {option.flags?.settingRestriction && <small>Ограничение сеттинга: {option.flags.settingRestriction}</small>}
                          {option.flags?.dmApproval && <small>Вариант DMG: не скрыт, но обычно требует разрешения Мастера.</small>}
                        </button>`;
if (page.includes(oldSubclassCard)) page = replaceOnce(page, oldSubclassCard, newSubclassCard, "subclass warnings");

fs.writeFileSync(rulesPath, rules);
fs.writeFileSync(pagePath, page);
console.log("Subclass spell mode, UI, export and class-local persistence repairs applied.");
