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
 * Some generated feature descriptions keep Markdown tables on one physical line,
 * using `| |` between logical rows. Expand only strings that contain a Markdown
 * separator row so ordinary prose containing pipes is left untouched.
 */
function expandFlattenedMarkdownTables(value: string) {
  const physicalLines = String(value || "").replace(/\r\n?/g, "\n").split("\n");
  const expanded: string[] = [];

  for (const physicalLine of physicalLines) {
    if (!/\|\s+\|\s*:?-{3,}/.test(physicalLine)) {
      expanded.push(physicalLine);
      continue;
    }

    const logicalLines = physicalLine.replace(/\|\s+\|/g, "|\n|").split("\n");
    for (const logicalLine of logicalLines) {
      const firstPipe = logicalLine.indexOf("|");
      if (firstPipe > 0) {
        const prefix = logicalLine.slice(0, firstPipe).trim();
        if (prefix) expanded.push(prefix);
        expanded.push(logicalLine.slice(firstPipe).trim());
        continue;
      }

      if (firstPipe === 0) {
        const lastPipe = logicalLine.lastIndexOf("|");
        if (lastPipe >= 0 && lastPipe < logicalLine.length - 1) {
          const row = logicalLine.slice(0, lastPipe + 1).trim();
          const suffix = logicalLine.slice(lastPipe + 1).trim();
          if (row) expanded.push(row);
          if (suffix) expanded.push(suffix);
          continue;
        }
      }

      expanded.push(logicalLine);
    }
  }

  return expanded;
}

/**
 * Converts Markdown that external character-sheet importers do not understand
 * into conservative plain text. In particular Markdown tables become one
 * readable paragraph per row instead of a stream of pipes and separator dashes.
 */
export function normalizeExportText(value: string) {
  const lines = expandFlattenedMarkdownTables(value);
  const output: string[] = [];

  for (let index = 0; index < lines.length;) {
    const line = lines[index];
    const next = lines[index + 1];

    if (line.includes("|") && next !== undefined && isMarkdownTableSeparator(next)) {
      const headers = tableCells(line);
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
