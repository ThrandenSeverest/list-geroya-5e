from pathlib import Path

path = Path("app/exportFormats.ts")
text = path.read_text(encoding="utf-8")

old = '''function helpmateNote(context: ExportContext) {
  return summaryText(context).split(/\\n\\n+/).map(block => {
    const [title, ...body] = block.split("\\n");
    const labeled = title.match(/^([^:]+):\\s*(.*)$/);
    if (!labeled) return block.replace(/\\n/g, "\\r\\n");
    return `<zag s=1>${labeled[1]}</zag>${labeled[2] ? ` ${labeled[2]}` : ""}${body.length ? `\\r\\n${body.join("\\r\\n")}` : ""}`;
  }).join("\\r\\n\\r\\n");
}
'''

previous_candidate = '''function helpmateNote(context: ExportContext) {
  return summaryText(context).split(/\\n\\n+/).map(block => {
    const [title, ...body] = block.split("\\n");
    const labeled = title.match(/^([^:]+):\\s*(.*)$/);
    if (!labeled) return block.replace(/\\n/g, "\\r\\n");
    return `<zag s=1>${labeled[1]}</zag>${labeled[2] ? ` ${labeled[2]}` : ""}${body.length ? `\\r\\n${body.join("\\r\\n")}` : ""}`;
  }).join("\\r\\n");
}
'''

new = '''function helpmateNote(context: ExportContext) {
  const formatted = summaryText(context).split(/\\n\\n+/).map(block => {
    const [title, ...body] = block.split("\\n");
    const labeled = title.match(/^([^:]+):\\s*(.*)$/);
    if (!labeled) return block;
    return `<zag s=1>${labeled[1]}</zag>${labeled[2] ? ` ${labeled[2]}` : ""}${body.length ? `\\n${body.join("\\n")}` : ""}`;
  }).join("\\n");

  // Helpmate distinguishes Windows CRLF from a lone LF. Normalize every
  // source newline first, collapse accidental blank lines, then emit only CRLF.
  return formatted
    .replace(/\\r\\n?/g, "\\n")
    .replace(/\\n{2,}/g, "\\n")
    .replace(/\\n/g, "\\r\\n");
}
'''

if new in text:
    print("Helpmate CRLF formatter is already applied.")
elif old in text:
    text = text.replace(old, new, 1)
elif previous_candidate in text:
    text = text.replace(previous_candidate, new, 1)
else:
    raise SystemExit("Expected Helpmate note formatter not found; aborting")

start = text.index("function helpmateNote")
end = text.index("\n}\n\nfunction summaryText", start) + 2
block = text[start:end]
for required in (
    '.replace(/\\r\\n?/g, "\\n")',
    '.replace(/\\n{2,}/g, "\\n")',
    '.replace(/\\n/g, "\\r\\n")',
):
    if required not in block:
        raise SystemExit(f"Helpmate CRLF formatter is incomplete: missing {required}")
if '\\r\\n\\r\\n' in block:
    raise SystemExit("Helpmate formatter still inserts blank lines between fields")

path.write_text(text, encoding="utf-8")
print("Applied strict compact CRLF-only Helpmate note formatting.")
