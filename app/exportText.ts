function cleanInlineMarkdown(value: string) {
  return value
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1");
}

function cleanPlainLine(value: string) {
  return cleanInlineMarkdown(value)
    .replace(/^\s{0,3}#{1,6}\s+/, "")
    .replace(/^\s*[-*+]\s+/, "• ")
    .trimEnd();
}

function isMarkdownTableSeparator(value: string) {
  return /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(value);
}

function tableCells(value: string) {
  let row = value.trim();
  if (row.startsWith("|")) row = row.slice(1);
  if (row.endsWith("|")) row = row.slice(0, -1);
  return row.split("|").map(cell => cleanInlineMarkdown(cell.trim()));
}

/**
 * Converts Markdown that external character-sheet importers do not understand
 * into conservative plain text. In particular Markdown tables become one
 * readable paragraph per row instead of a stream of pipes and separator dashes.
 */
export function normalizeExportText(value: string) {
  // Some rule descriptions arrive with Markdown table rows collapsed onto one
  // physical line ("| ... | | ... |"). Restore row boundaries before parsing
  // so LSS and Helpmate never receive raw pipes/separator dashes.
  const source = String(value || "")
    .replace(/\r\n?/g, "\n")
    .replace(/\|\s+\|/g, "|\n|");
  const lines = source.split("\n");
  const output: string[] = [];

  for (let index = 0; index < lines.length;) {
    const line = lines[index];
    const next = lines[index + 1];

    if (line.includes("|") && next !== undefined && isMarkdownTableSeparator(next)) {
      const firstPipe = line.indexOf("|");
      // A collapsed source can leave prose immediately before the table header.
      // Preserve that prose separately instead of mistaking it for column 1.
      if (firstPipe > 0) {
        const prefix = cleanPlainLine(line.slice(0, firstPipe).trim());
        if (prefix) output.push(prefix);
      }
      const headers = tableCells(firstPipe >= 0 ? line.slice(firstPipe) : line);
      index += 2;
      let rows = 0;

      while (index < lines.length && lines[index].includes("|") && !isMarkdownTableSeparator(lines[index])) {
        const cells = tableCells(lines[index]);
        if (cells.length < 2) break;
        const values = cells
          .map((cell, cellIndex) => {
            if (!cell) return "";
            const header = headers[cellIndex]?.trim();
            return header ? `${header}: ${cell}` : cell;
          })
          .filter(Boolean);
        if (values.length) output.push(`• ${values.join("; ")}`);
        rows += 1;
        index += 1;
      }

      if (!rows && headers.some(Boolean)) output.push(headers.filter(Boolean).join(" — "));
      continue;
    }

    if (isMarkdownTableSeparator(line)) {
      index += 1;
      continue;
    }

    output.push(cleanPlainLine(line));
    index += 1;
  }

  return output
    .join("\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
