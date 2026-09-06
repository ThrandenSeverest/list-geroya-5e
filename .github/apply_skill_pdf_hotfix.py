from pathlib import Path
import re
import shutil

ROOT = Path("export-1.1.0-python-sqlite/app")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f"anchor not found: {label}")
    return text.replace(old, new, 1)


# --- featChoices.ts -------------------------------------------------------
feat_path = ROOT / "featChoices.ts"
feat = feat_path.read_text(encoding="utf-8")
feat = replace_once(
    feat,
    'import { generatedFeats } from "./generatedRulesCorpus";\n',
    'import { generatedFeats } from "./generatedRulesCorpus";\nimport { characterExpertiseSkills, characterProficiencies } from "./proficiencies";\n',
    "feat imports",
)
old_complete = '''export function advancementChoiceComplete(choiceValue: AdvancementChoice, spells: CatalogSpell[], characterLevel = choiceValue.level) {
  if (!choiceValue.featId) return false;
  if (choiceValue.featId === "asi") return choiceValue.asiChoices.length === 2;
  return featChoiceGroups(choiceValue, spells, characterLevel).every(group => (choiceValue.featChoices?.[group.key] || []).length === group.count);
}'''
new_complete = '''export function featChoiceAvailability(choiceValue: AdvancementChoice, group: FeatChoiceGroup, character?: ExportCharacter) {
  const proficiencyGroup = group.key === "skill" || group.key === "proficiencies" || group.key === "expertise";
  if (!character || !proficiencyGroup) return { options: group.options, count: group.count };

  const baseline: ExportCharacter = {
    ...character,
    advancements: (character.advancements || []).map(item => item.key === choiceValue.key
      ? { ...item, featChoices: { ...(item.featChoices || {}), [group.key]: [] } }
      : item),
  };
  const known = characterProficiencies(baseline);
  const ownedSkills = new Set(known.skills);
  const ownedTools = new Set(known.tools);
  const ownedExpertise = new Set(characterExpertiseSkills(baseline));
  let options = group.options;

  if (group.key === "skill") options = group.options.filter(option => !ownedSkills.has(option.id));
  if (group.key === "proficiencies") options = group.options.filter(option => !ownedSkills.has(option.id) && !ownedTools.has(option.id));
  if (group.key === "expertise") options = group.options.filter(option => ownedSkills.has(option.id) && !ownedExpertise.has(option.id));

  return { options, count: Math.min(group.count, options.length) };
}

export function advancementChoiceComplete(choiceValue: AdvancementChoice, spells: CatalogSpell[], characterLevel = choiceValue.level, character?: ExportCharacter) {
  if (!choiceValue.featId) return false;
  if (choiceValue.featId === "asi") return choiceValue.asiChoices.length === 2;
  return featChoiceGroups(choiceValue, spells, characterLevel).every(group => {
    const selected = choiceValue.featChoices?.[group.key] || [];
    const availability = featChoiceAvailability(choiceValue, group, character);
    const allowed = new Set(availability.options.map(option => option.id));
    return selected.length === availability.count
      && new Set(selected).size === selected.length
      && selected.every(id => allowed.has(id));
  });
}'''
feat = replace_once(feat, old_complete, new_complete, "advancementChoiceComplete")
feat_path.write_text(feat, encoding="utf-8")


# --- page.tsx -------------------------------------------------------------
page_path = ROOT / "page.tsx"
page = page_path.read_text(encoding="utf-8")
page = replace_once(
    page,
    'import { advancementChoiceComplete, featChoiceGroups, featGrantedSpellIds } from "./featChoices";',
    'import { advancementChoiceComplete, featChoiceAvailability, featChoiceGroups, featGrantedSpellIds } from "./featChoices";',
    "featChoices import",
)
page = replace_once(
    page,
    '''      const selected = target.featChoices?.[groupKey] || [];
      const ownedSkills = new Set(characterProficiencies(current).skills);
      if (!selected.includes(id) && groupKey === "skill" && ownedSkills.has(id)) return current;
      if (!selected.includes(id) && groupKey === "expertise" && !ownedSkills.has(id)) return current;''',
    '''      const selected = target.featChoices?.[groupKey] || [];
      const known = characterProficiencies(current);
      const ownedSkills = new Set(known.skills);
      const ownedTools = new Set(known.tools);
      const ownedExpertise = new Set(characterExpertiseSkills(current));
      if (!selected.includes(id) && groupKey === "skill" && ownedSkills.has(id)) return current;
      if (!selected.includes(id) && groupKey === "proficiencies" && (ownedSkills.has(id) || ownedTools.has(id))) return current;
      if (!selected.includes(id) && groupKey === "expertise" && (!ownedSkills.has(id) || ownedExpertise.has(id))) return current;''',
    "toggle feat choice",
)

old_options_re = re.compile(
    r'''(?P<indent>\s*)const selected = activeAdvancement\.featChoices\?\.\[group\.key\] \|\| \[\];\s*'''
    r'''const ownedSkills = new Set\(proficiencies\.skills\);\s*'''
    r'''const options = group\.key === "expertise"\s*'''
    r'''\? group\.options\.filter\(option => ownedSkills\.has\(option\.id\) \|\| selected\.includes\(option\.id\)\)\s*'''
    r''': \(group\.key === "skill" \|\| group\.key === "proficiencies"\)\s*'''
    r'''\? group\.options\.filter\(option => !ownedSkills\.has\(option\.id\) \|\| selected\.includes\(option\.id\)\)\s*'''
    r''': group\.options;''',
    re.S,
)
match = old_options_re.search(page)
if not match:
    raise RuntimeError("anchor not found: feat options block")
indent = match.group("indent")
new_options = (
    f"{indent}const selected = activeAdvancement.featChoices?.[group.key] || [];\n"
    f"{indent}const availability = featChoiceAvailability(activeAdvancement, group, character);\n"
    f"{indent}const allowedOptionIds = new Set(availability.options.map(option => option.id));\n"
    f"{indent}const options = group.options;\n"
    f"{indent}const requiredCount = availability.count;"
)
page = page[:match.start()] + new_options + page[match.end():]
page = replace_once(page, "{selected.length} / {group.count}", "{selected.length} / {requiredCount}", "choice counter")

button_re = re.compile(
    r'''\{options\.map\(option => <button key=\{option\.id\} className=\{selected\.includes\(option\.id\) \? "selected" : ""\} onClick=\{\(\) => toggleFeatChoice\(activeAdvancement\.key, group\.key, option\.id, group\.count\)\}>\s*'''
    r'''<span>\{selected\.includes\(option\.id\) \? "✓" : "\+"\}</span><strong>\{option\.name\}</strong>\{option\.detail && <small>\{option\.detail\}</small>\}\s*'''
    r'''</button>\)\}''',
    re.S,
)
button_match = button_re.search(page)
if not button_match:
    raise RuntimeError("anchor not found: feat option buttons")
button_new = '''{requiredCount === 0 && <p className="feat-choice-failsafe">Нет доступных новых вариантов — этот обязательный выбор пропущен автоматически.</p>}
                            {options.map(option => {
                              const isSelected = selected.includes(option.id);
                              const unavailable = !isSelected && !allowedOptionIds.has(option.id);
                              const unavailableReason = group.key === "expertise" ? "Уже есть компетентность или нет владения" : "Владение уже получено";
                              return <button key={option.id} disabled={unavailable} className={`${isSelected ? "selected " : ""}${unavailable ? "unavailable" : ""}`.trim()} onClick={() => toggleFeatChoice(activeAdvancement.key, group.key, option.id, requiredCount)}>
                                <span>{isSelected ? "✓" : unavailable ? "×" : "+"}</span><strong>{option.name}</strong>{unavailable && <small>{unavailableReason}</small>}{!unavailable && option.detail && <small>{option.detail}</small>}
                              </button>;
                            })}'''
page = page[:button_match.start()] + button_new + page[button_match.end():]

page, completion_updates = re.subn(
    r'advancementChoiceComplete\(([A-Za-z][A-Za-z0-9_]*), spells, character\.level\)',
    r'advancementChoiceComplete(\1, spells, character.level, character)',
    page,
)
if completion_updates < 5:
    raise RuntimeError(f"only {completion_updates} completion calls were updated")

changelog_anchor = '''const siteChangelog = [{
  version: "1.1.0",'''
changelog_insert = '''const siteChangelog = [{
  version: "1.1.1",
  publishedAt: "2026-09-06T17:30:00Z",
  changes: [
    "Повторный выбор уже имеющихся навыков и инструментов заблокирован для «Одарённого», «Эксперта в навыке» и других источников выбора владений.",
    "Компетентность нельзя назначить одному навыку повторно; недоступные варианты помечаются, а невозможный обязательный выбор больше не блокирует прогрессию.",
    "PDF-экспорт закреплён на строгом формате A4 и устойчивее к длинным названиям классов и мультиклассов.",
  ],
}, {
  version: "1.1.0",'''
page = replace_once(page, changelog_anchor, changelog_insert, "changelog")
page_path.write_text(page, encoding="utf-8")


# --- globals.css ----------------------------------------------------------
css_path = ROOT / "globals.css"
css = css_path.read_text(encoding="utf-8")
css += '''

/* 1.1.1 proficiency/PDF hotfix */
.feat-choice-options button.unavailable { opacity: .5; cursor: not-allowed; border-style: dashed; filter: saturate(.5); }
.feat-choice-options button.unavailable:hover { transform: none; }
.feat-choice-options button.unavailable small { color: var(--copper-light); }
.feat-choice-failsafe { grid-column: 1 / -1; margin: 0 0 8px; padding: 10px 12px; border: 1px dashed var(--teal); color: var(--teal); background: rgba(118,170,165,.06); font-size: 11px; }

@media print {
  html, body { width: 210mm !important; min-width: 210mm !important; margin: 0 !important; padding: 0 !important; overflow: visible !important; }
  .pdf-document { display: block !important; position: absolute !important; inset: 0 auto auto 0 !important; width: 210mm !important; margin: 0 !important; padding: 0 !important; gap: 0 !important; }
  .pdf-page { width: 210mm !important; height: 297mm !important; min-height: 297mm !important; max-height: 297mm !important; margin: 0 !important; padding: 11mm 12mm 10mm !important; overflow: hidden !important; box-shadow: none !important; break-after: page !important; page-break-after: always !important; break-inside: avoid !important; page-break-inside: avoid !important; }
  .pdf-page:last-child { break-after: auto !important; page-break-after: auto !important; }
  .pdf-hero-header { margin: 4mm 0 3mm !important; }
  .pdf-hero-header h1 { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 20pt !important; }
  .pdf-hero-header dl div { min-height: 12mm !important; max-height: 12mm !important; overflow: hidden; }
  .pdf-hero-header dd { margin-top: .7mm !important; font-size: 7.2pt !important; line-height: 1.08 !important; overflow-wrap: anywhere; }
  .pdf-ability-row { margin-bottom: 3mm !important; }
  .pdf-ability-row > div { min-height: 21mm !important; }
  .pdf-primary-grid { grid-template-rows: 122mm 74mm !important; height: 199mm !important; }
}
'''
css_path.write_text(css, encoding="utf-8")


# Keep both requested copies in lock-step with the canonical 1.1 source.
for target in (Path("hosting/app"), Path("hosting-test/app")):
    for filename in ("featChoices.ts", "page.tsx", "globals.css"):
        shutil.copy2(ROOT / filename, target / filename)

print("hotfix applied")
