(() => {
  const processedSelects = new WeakSet();
  let applying = false;
  let sourcesExpanded = true;

  function ensureStyles() {
    if (document.getElementById("spell-catalog-ui-styles")) return;
    const style = document.createElement("style");
    style.id = "spell-catalog-ui-styles";
    style.textContent = `
      .spell-source-toggle {
        min-height: 50px;
        padding: 0 14px;
        border: 1px solid var(--line);
        background: var(--panel);
        color: var(--teal);
        cursor: pointer;
        white-space: nowrap;
      }
      .spell-source-toggle:hover { border-color: var(--teal); color: var(--ivory); }
      .spell-source-picker {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin: -10px 0 22px;
        padding: 14px;
        border: 1px solid rgba(118,170,165,.22);
        background: rgba(8,17,22,.5);
      }
      .spell-source-picker[hidden] { display: none !important; }
      .spell-source-chip {
        min-height: 34px;
        padding: 6px 11px;
        border: 1px solid var(--line);
        background: rgba(9,23,29,.85);
        color: var(--muted);
        cursor: pointer;
      }
      .spell-source-chip:hover { border-color: var(--teal); color: var(--ivory); }
      .spell-source-chip.active {
        border-color: var(--copper-light);
        color: var(--gold-bright);
        background: rgba(184,117,75,.12);
      }
      .spell-level-group-heading {
        grid-column: 1 / -1;
        width: 100%;
        display: flex;
        align-items: end;
        justify-content: space-between;
        gap: 16px;
        margin: 24px 0 4px;
        padding: 0 0 10px;
        border-bottom: 1px solid rgba(225,160,113,.38);
      }
      .spell-level-group-heading:first-child { margin-top: 2px; }
      .spell-level-group-heading strong {
        font: 600 25px \"Palatino Linotype\", Georgia, serif;
        color: var(--ivory);
      }
      .spell-level-group-heading small {
        color: var(--teal);
        font-size: 11px;
        letter-spacing: .06em;
      }
      @media (max-width: 760px) {
        .spell-source-toggle { width: 100%; }
        .spell-source-picker { margin-top: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  function setReactSelect(select, value) {
    if (select.value === value) return;
    const descriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
    descriptor?.set?.call(select, value);
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function sourceToolbar(select) {
    const tools = select.closest(".tools");
    if (!tools || !document.querySelector(".spell-list")) return;

    if (!processedSelects.has(select)) {
      processedSelects.add(select);
      const hasAll = Array.from(select.options).some(option => option.value === "Все" || option.textContent?.trim() === "Все");
      if (hasAll && select.value !== "Все") setReactSelect(select, "Все");
    }

    select.style.display = "none";

    let toggle = tools.querySelector("[data-spell-source-toggle]");
    if (!toggle) {
      toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "spell-source-toggle";
      toggle.dataset.spellSourceToggle = "true";
      toggle.addEventListener("click", () => {
        sourcesExpanded = !sourcesExpanded;
        refreshSourcePicker(select);
      });
      tools.appendChild(toggle);
    }

    refreshSourcePicker(select);
  }

  function refreshSourcePicker(select) {
    const tools = select.closest(".tools");
    if (!tools) return;
    const toggle = tools.querySelector("[data-spell-source-toggle]");
    if (toggle) toggle.textContent = sourcesExpanded ? "Скрыть источники" : "Показать источники";

    let picker = tools.nextElementSibling;
    if (!(picker instanceof HTMLElement) || !picker.matches("[data-spell-source-picker]")) {
      picker = document.createElement("div");
      picker.className = "spell-source-picker";
      picker.dataset.spellSourcePicker = "true";
      tools.insertAdjacentElement("afterend", picker);
    }

    picker.hidden = !sourcesExpanded;
    const options = Array.from(select.options).map(option => ({ value: option.value, label: option.textContent?.trim() || option.value }));
    const signature = options.map(option => `${option.value}:${option.label}`).join("|");
    if (picker.dataset.signature !== signature) {
      picker.dataset.signature = signature;
      picker.replaceChildren(...options.map(option => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "spell-source-chip";
        button.dataset.sourceValue = option.value;
        button.textContent = option.label;
        button.addEventListener("click", () => setReactSelect(select, option.value));
        return button;
      }));
    }

    picker.querySelectorAll("[data-source-value]").forEach(node => {
      if (!(node instanceof HTMLElement)) return;
      node.classList.toggle("active", node.dataset.sourceValue === select.value);
    });
  }

  function groupSpellsByLevel() {
    const list = document.querySelector(".spell-list");
    if (!(list instanceof HTMLElement)) return;

    list.querySelectorAll("[data-spell-level-heading]").forEach(node => node.remove());
    const cards = Array.from(list.children).filter(node => node instanceof HTMLElement && node.matches("article"));
    if (!cards.length) return;

    cards.sort((a, b) => {
      const aLevel = Number(a.querySelector(".spell-level")?.textContent?.trim() || 0);
      const bLevel = Number(b.querySelector(".spell-level")?.textContent?.trim() || 0);
      if (aLevel !== bLevel) return aLevel - bLevel;
      const aName = a.querySelector("h3")?.textContent?.trim() || "";
      const bName = b.querySelector("h3")?.textContent?.trim() || "";
      return aName.localeCompare(bName, "ru");
    });

    let currentLevel = null;
    for (const card of cards) {
      const level = Number(card.querySelector(".spell-level")?.textContent?.trim() || 0);
      if (level !== currentLevel) {
        currentLevel = level;
        const count = cards.filter(item => Number(item.querySelector(".spell-level")?.textContent?.trim() || 0) === level).length;
        const heading = document.createElement("div");
        heading.className = "spell-level-group-heading";
        heading.dataset.spellLevelHeading = String(level);
        const title = level === 0 ? "Заговоры" : `${level} круг`;
        heading.innerHTML = `<strong>${title}</strong><small>${count} ${count === 1 ? "заклинание" : count >= 2 && count <= 4 ? "заклинания" : "заклинаний"}</small>`;
        list.appendChild(heading);
      }
      list.appendChild(card);
    }
  }

  function apply() {
    if (applying) return;
    applying = true;
    try {
      ensureStyles();
      const list = document.querySelector(".spell-list");
      if (!list) return;
      const tools = list.parentElement?.querySelector(".tools");
      const select = tools?.querySelector("select");
      if (select instanceof HTMLSelectElement) sourceToolbar(select);
      groupSpellsByLevel();
    } finally {
      applying = false;
    }
  }

  const observer = new MutationObserver(() => queueMicrotask(apply));
  observer.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("change", event => {
    const target = event.target;
    if (target instanceof HTMLSelectElement && target.closest(".tools") && document.querySelector(".spell-list")) queueMicrotask(apply);
  });
  document.addEventListener("click", event => {
    const target = event.target;
    if (target instanceof Element && (target.closest(".spell-level-filter") || target.closest(".spell-actions"))) queueMicrotask(apply);
  });
  apply();
})();
