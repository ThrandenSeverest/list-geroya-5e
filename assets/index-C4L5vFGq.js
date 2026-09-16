export * from "./index-C4L5vFGq-original.js";
import "./index-C4L5vFGq-original.js";

// GitHub Pages test-only hotfix: convert flattened Markdown tables embedded in
// feature descriptions into real tables. This also handles the PDF/print sheet.
// Production source in main stays untouched until the test is approved.
(() => {
  const STYLE_ID = "herolist-feature-table-test-fix";
  const FEATURE_SELECTOR = ".feature-preview p, .feature-box p, .pdf-feature-list article > p";

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

      /* PDF must be self-contained: no scroll area can survive printing. */
      .pdf-document .feature-rich-description { margin: 0; color: inherit; line-height: 1.3; }
      .pdf-document .feature-rich-description > p { margin: 0 0 1.2mm !important; font-size: 7pt; line-height: 1.35; color: inherit !important; }
      .pdf-document .feature-table-wrap { width: 100%; max-width: 100%; overflow: visible; margin: 1.2mm 0 0; }
      .pdf-document .feature-table { width: 100%; min-width: 0; table-layout: fixed; border-collapse: collapse; font-size: 5.9pt; line-height: 1.18; }
      .pdf-document .feature-table th,
      .pdf-document .feature-table td { padding: .65mm .75mm; border: .22mm solid rgba(23,61,67,.35); color: #263b3d; background: rgba(255,255,255,.28); white-space: normal; overflow-wrap: anywhere; word-break: normal; }
      .pdf-document .feature-table th { color: #173d43; background: rgba(23,61,67,.08); font-weight: 700; }
      .pdf-document .feature-table tbody tr:nth-child(even) td { background: rgba(164,99,62,.035); }

      @media (max-width: 620px) {
        .feature-table { font-size: 10px; }
        .feature-table th, .feature-table td { padding: 4px; }
        .pdf-document .feature-table { font-size: 5.9pt; }
        .pdf-document .feature-table th, .pdf-document .feature-table td { padding: .65mm .75mm; }
      }
      @media print {
        .feature-table-wrap { overflow: visible !important; }
        .pdf-document .feature-table { width: 100% !important; min-width: 0 !important; table-layout: fixed; font-size: 5.9pt; }
        .pdf-document .feature-table th, .pdf-document .feature-table td { padding: .65mm .75mm; }
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
      // generatedSheetRules stores Markdown row boundaries inline as `| |`.
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
      p.dataset.featureTableChecked = "1";
      rich.appendChild(p);
    }
    node.replaceWith(rich);
  }

  function scan(root = document) {
    if (root instanceof HTMLParagraphElement && root.matches(FEATURE_SELECTOR)) enhanceParagraph(root);
    if (root.querySelectorAll) root.querySelectorAll(FEATURE_SELECTOR).forEach(enhanceParagraph);
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
    window.addEventListener("beforeprint", () => scan());
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
