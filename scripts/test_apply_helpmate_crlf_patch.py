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

new = '''function helpmateNote(context: ExportContext) {
  return summaryText(context).split(/\\n\\n+/).map(block => {
    const [title, ...body] = block.split("\\n");
    const labeled = title.match(/^([^:]+):\\s*(.*)$/);
    if (!labeled) return block.replace(/\\n/g, "\\r\\n");
    return `<zag s=1>${labeled[1]}</zag>${labeled[2] ? ` ${labeled[2]}` : ""}${body.length ? `\\r\\n${body.join("\\r\\n")}` : ""}`;
  }).join("\\r\\n");
}
'''

if old not in text:
    raise SystemExit("Expected Helpmate note formatter not found; aborting")
text = text.replace(old, new, 1)

start = text.index("function helpmateNote")
end = text.index("\n}\n\nfunction summaryText", start) + 2
block = text[start:end]
for required in ('replace(/\\n/g, "\\r\\n")', 'body.join("\\r\\n")', '}).join("\\r\\n");'):
    if required not in block:
        raise SystemExit(f"Helpmate CRLF formatter is incomplete: missing {required}")
if '\\r\\n\\r\\n' in block:
    raise SystemExit("Helpmate formatter still inserts blank lines between fields")

path.write_text(text, encoding="utf-8")
print("Applied compact CRLF-only Helpmate note formatting.")
