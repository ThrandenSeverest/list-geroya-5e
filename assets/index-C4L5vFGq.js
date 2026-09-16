export * from "./index-C4L5vFGq-original.js";
import "./index-C4L5vFGq-original.js";

// GitHub Pages test-only hotfix: render flattened Markdown tables inside
// feature descriptions as real responsive tables. Production source in main
// stays untouched until this behaviour is verified on the test site.
(() => {
  const STYLE_ID = "herolist-feature-table-test-fix";

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .feature-rich-description { min-width: 0; margin: 5px 0 0; color: #aeb8b8; line-height: 1.55; }
      .feature-rich-description > p { margin: 0 0 8px !important; color: inherit !important; }
      .feature-table-wrap { width: 100%; max-width: 100%; overflow-x: auto; margin: 8px 0 2px; }
      .feature-table { width: 100%; min-width: min(480px, 100%); border-collapse: collapse; font-size: 11px; line-height: 1.35; }
      .feature-table th, .feature-table td { padding: 5px 6px; border: 1px solid rgba(105,170,162,.38); text-align: left; vertical-align: top; white-space: normal; overflow-wrap: anywhere; }
      .feature-table th { color: var(--ivory, #eee1cf); background: rgba(105,170,162,.12); font-weight: 700; }
      .feature-table tbody tr:nth-child(even) td { background: rgba(105,170,162,.045); }
      .modern-design .feature-rich-description { color: #554b40; }
      .modern-design .feature-table th, .modern-design .feature-table td { border-color: rgba(83,105,111,.42); color: #342d25; }
      .modern-design .feature-table th { color: #213f47; background: rgba(86,111,118,.12); }
      .modern-design .feature-table tbody tr:nth-child(even) td { background: rgba(86,111,118,.055); }
      @media (max-width: 620px) {
        .feature-table { font-size: 10px; }
        .feature-table th, .feature-table td { padding: 4px; }
      }
      @media print {
        .feature-table-wrap { overflow: visible; }
        .feature-table { width: 100%; min-width: 0; font-size: 8px; }
        .feature-table th, .feature-table td { padding: 2px 3px; }
      }
    `;
    document.head.appendChild(style);
  }

  function cleanCell(value) {
    return value
      .trim()
      .replace(/^\*\*(.*?)\*\*$/s, "$1")
      .replace(/^__(.*?)__$/s, "$1")
      .replace(/^`(.*?)`$/s, "$1")
      .trim();
  }

  function parseTable(text) {
    const start = text.indexOf("|");
    if (start < 0) return null;
    const end = text.lastIndexOf("|");
    if (end <= start) return null;

    const prefix = text.slice(0, start).trim();
    const suffix = text.slice(end + 1).trim();
    const tableText = text.slice(start, end + 1)
      // generatedSheetRules stores row boundaries as `| |` on one line.
      .replace(/\|\s+\|/g, "|\n|");

    const rows = tableText
      .split(/\r?\n+/)
      .map(line => line.trim())
      .filter(line => line.startsWith("|") && line.endsWith("|"))
      .map(line => line.slice(1, -1).split("|").map(cleanCell));

    const separatorIndex = rows.findIndex(row =>
      row.length >= 2 && row.every(cell => /^:?-{3,}:?$/.test(cell)),
    );
    if (separatorIndex < 1) return null;

    const header = rows[separatorIndex - 1];
    const body = rows.slice(separatorIndex + 1).filter(row =>
      row.length === header.length && row.some(Boolean),
    );
    if (header.length < 2 || body.length < 1) return null;

    return { prefix, suffix, header, body };
  }

  function makeTable(parsed) {
    const wrap = document.createElement("div");
    wrap.className = "feature-table-wrap";
    const table = document.createElement("table");
    table.className = "feature-table";

    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    parsed.header.forEach(value => {
      const th = document.createElement("th");
      th.textContent = value;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    parsed.body.forEach(row => {
      const tr = document.createElement("tr");
      row.forEach(value => {
        const td = document.createElement("td");
        td.textContent = value;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    return wrap;
  }

  function enhanceParagraph(node) {
    if (!(node instanceof HTMLParagraphElement) || node.dataset.featureTableChecked === "1") return;
    node.dataset.featureTableChecked = "1";
    const parsed = parseTable(node.textContent || "");
    if (!parsed) return;

    const rich = document.createElement("div");
    rich.className = "feature-rich-description";
    if (parsed.prefix) {
      const p = document.createElement("p");
      p.textContent = parsed.prefix;
      p.dataset.featureTableChecked = "1";
      rich.appendChild(p);
    }
    rich.appendChild(makeTable(parsed));
    if (parsed.suffix) {
      const p = document.createElement("p");
      p.textContent = parsed.suffix;
      rich.appendChild(p);
    }
    node.replaceWith(rich);
  }

  function scan(root = document) {
    if (root instanceof HTMLParagraphElement && root.matches(".feature-preview p, .feature-box p")) {
      enhanceParagraph(root);
    }
    if (root.querySelectorAll) {
      root.querySelectorAll(".feature-preview p, .feature-box p").forEach(enhanceParagraph);
    }
  }

  function start() {
    installStyles();
    scan();
    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof Element) scan(node);
        }
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
