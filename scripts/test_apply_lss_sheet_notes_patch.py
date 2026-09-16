from pathlib import Path

path = Path("app/exportFormats.ts")
text = path.read_text(encoding="utf-8")

old = '''function conciseLssFeature(feature: Feature, required = false): Feature | null {
  if (!required && /^использование заклинаний$/i.test(feature.name)) return null;
  let description = normalizeExportText(feature.description)
    .split(/\\n(?:источники|источник|официальные книги|правовой статус|исключено|приложение:)/i)[0]
    .replace(/•\\s*-{5,}[\\s\\S]*/g, "")
    .replace(/[^\\S\\n]+/g, " ")
    .replace(/\\n{3,}/g, "\\n\\n")
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
'''

new = '''function conciseLssFeature(feature: Feature, required = false): Feature | null {
  if (!required && /^использование заклинаний$/i.test(feature.name)) return null;
  const sourceHasTable = /\\|\\s*:?-{3,}:?/.test(feature.description);
  let description = normalizeExportText(feature.description)
    .split(/\\n(?:источники|источник|официальные книги|правовой статус|исключено|приложение:)/i)[0]
    .replace(/•\\s*-{5,}[\\s\\S]*/g, "")
    .replace(/[^\\S\\n]+/g, " ")
    .replace(/\\n{3,}/g, "\\n\\n")
    .trim();

  // LSS has a narrow main-sheet feature block. Full rule tables belong in
  // notes; keeping their rows here makes the main sheet unreadable.
  if (sourceHasTable) {
    description = description
      .split("\\n")
      .filter(line => !/^•\\s+[^;:]+:\\s*.*;\\s*[^;:]+:\\s*/.test(line.trim()))
      .join("\\n")
      .replace(/\\n{3,}/g, "\\n\\n")
      .trim();
    if (!description) description = "Подробная таблица — в заметках.";
  }

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

function distributeLssNotes(groups: Array<{ label: string; features: Feature[]; required?: boolean; full?: boolean }>, count = 5, budget = 2200) {
  const entries = groups.flatMap(group => group.features.map(feature => {
    const concise = conciseLssFeature(feature, group.required);
    if (!concise) return null;
    const noteFeature = group.full
      ? { ...feature, description: normalizeExportText(feature.description) }
      : concise;
    return { ...noteFeature, name: `${group.label} · ${noteFeature.name}` };
  })).filter(Boolean) as Feature[];
'''

if old not in text:
    raise SystemExit("Expected LSS concise/notes block not found; aborting")
text = text.replace(old, new, 1)

old_groups = '''  const noteColumns = distributeLssNotes([\n    { label: "Класс", features: exportClassFeatures },\n    { label: "Черта", features: overflowFeatFeatures, required: true },\n  ]);'''
new_groups = '''  const noteColumns = distributeLssNotes([\n    { label: "Класс", features: exportClassFeatures, full: true },\n    { label: "Черта", features: overflowFeatFeatures, required: true, full: true },\n  ]);'''
if old_groups not in text:
    raise SystemExit("Expected LSS note group block not found; aborting")
text = text.replace(old_groups, new_groups, 1)

path.write_text(text, encoding="utf-8")
print("Applied LSS main-sheet summary / full-notes split.")
