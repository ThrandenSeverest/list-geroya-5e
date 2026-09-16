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

  // The main LSS feature box is narrow. Full rule tables belong in the six
  // notes blocks; their individual rows are intentionally omitted here.
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

// LSS 2014 has six ruled note boxes: three wide boxes on the left and three
// narrower boxes on the right. Estimate wrapped line usage per actual column
// instead of using a raw character budget, and allow one long feature/table to
// continue in the next box instead of overflowing the first one.
const lssNoteWidths = [76, 36, 76, 36, 76, 36];
const lssNoteLineLimit = 19;

function lssWrappedLines(value: string, width: number) {
  return Math.max(1, Math.ceil(Math.max(1, value.trim().length) / width));
}

function splitLssLine(value: string, maxChars: number) {
  if (value.length <= maxChars) return [value, ""] as const;
  let cut = value.lastIndexOf(" ", maxChars);
  if (cut < Math.floor(maxChars * 0.55)) cut = maxChars;
  return [value.slice(0, cut).trim(), value.slice(cut).trim()] as const;
}

function distributeLssNotes(groups: Array<{ label: string; features: Feature[]; required?: boolean; full?: boolean }>, count = 6) {
  const entries = groups.flatMap(group => group.features.map(feature => {
    const concise = conciseLssFeature(feature, group.required);
    if (!concise) return null;
    const noteFeature = group.full
      ? { ...feature, description: normalizeExportText(feature.description) }
      : concise;
    return { ...noteFeature, name: `${group.label} · ${noteFeature.name}` };
  })).filter(Boolean) as Feature[];

  const notes: Feature[][] = Array.from({ length: count }, () => []);
  const usedLines = Array.from({ length: count }, () => 0);
  let note = 0;

  for (const feature of entries) {
    const pending = normalizeExportText(feature.description)
      .split(/\\n+/)
      .map(line => line.trim())
      .filter(Boolean);
    if (!pending.length) pending.push("—");
    let continuation = false;

    while (pending.length && note < count) {
      const width = lssNoteWidths[note] || 60;
      const heading = continuation ? `${feature.name} (продолжение)` : feature.name;
      const headingLines = lssWrappedLines(heading, width);

      if (usedLines[note] > 0 && usedLines[note] + headingLines + 1 >= lssNoteLineLimit) {
        note += 1;
        continue;
      }

      let remaining = Math.max(1, lssNoteLineLimit - usedLines[note] - headingLines);
      const chunk: string[] = [];
      while (pending.length && remaining > 0) {
        const line = pending[0];
        const lineLines = lssWrappedLines(line, width);
        if (lineLines <= remaining) {
          chunk.push(line);
          pending.shift();
          remaining -= lineLines;
          continue;
        }
        if (chunk.length) break;
        const [part, rest] = splitLssLine(line, Math.max(width, width * remaining));
        chunk.push(part);
        if (rest) pending[0] = rest;
        else pending.shift();
        remaining = 0;
      }

      const bodyLines = chunk.reduce((sum, line) => sum + lssWrappedLines(line, width), 0);
      notes[note].push({ ...feature, name: heading, description: chunk.join("\\n") });
      usedLines[note] += headingLines + bodyLines;
      continuation = true;
      if (pending.length) note += 1;
    }

    // Six boxes are the complete LSS 2014 notes page. Preserve any extreme
    // overflow rather than silently losing rules, even if it has to continue
    // in the final box.
    if (pending.length) {
      notes[count - 1].push({
        ...feature,
        name: `${feature.name} (продолжение)`,
        description: pending.join("\\n"),
      });
    }
  }
  return notes;
}
'''

if old not in text:
    raise SystemExit("Expected LSS concise/notes block not found; aborting")
text = text.replace(old, new, 1)

old_groups = '''  const noteColumns = distributeLssNotes([\n    { label: "Класс", features: exportClassFeatures },\n    { label: "Черта", features: overflowFeatFeatures, required: true },\n  ]);'''
new_groups = '''  const noteColumns = distributeLssNotes([\n    { label: "Класс", features: exportClassFeatures, full: true },\n    { label: "Черта", features: overflowFeatFeatures, required: true, full: true },\n  ]);'''
if old_groups not in text:
    raise SystemExit("Expected LSS note group block not found; aborting")
text = text.replace(old_groups, new_groups, 1)

old_notes = '''      "notes-5": { ...richFeatureText(noteColumns[4], "notes-5"), size: 7 },\n      features: richFeatureText(primaryFeatFeatures, "features"),'''
new_notes = '''      "notes-5": { ...richFeatureText(noteColumns[4], "notes-5"), size: 7 },\n      "notes-6": { ...richFeatureText(noteColumns[5], "notes-6"), size: 7 },\n      features: richFeatureText(primaryFeatFeatures, "features"),'''
if old_notes not in text:
    raise SystemExit("Expected LSS notes-5 block not found; aborting")
text = text.replace(old_notes, new_notes, 1)

if '"notes-6"' not in text or 'count = 6' not in text or 'lssNoteWidths = [76, 36, 76, 36, 76, 36]' not in text:
    raise SystemExit("Six-note LSS distribution was not applied completely")

path.write_text(text, encoding="utf-8")
print("Applied LSS compact main sheet and six-block full-note distribution.")
