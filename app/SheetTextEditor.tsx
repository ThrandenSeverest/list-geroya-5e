"use client";

import { useEffect, useLayoutEffect, useState, type RefObject } from "react";

export type SheetTextEdit = { scale: number; bold: boolean; hidden: boolean };

export type SheetIdentity = { playerName: string; experience: number };

export function sheetIdentityFields(identity: SheetIdentity, editMode: boolean, onChange?: (patch: Partial<SheetIdentity>) => void, blankExperience = false) {
  const { playerName, experience } = identity;
  const printedExperience = blankExperience && experience === 0 ? "" : experience;
  if (!editMode || !onChange) return { playerName, experience: printedExperience };

  return {
    playerName: <>
      <input className="sheet-identity-input" aria-label="Имя игрока" value={playerName ?? ""}
        onChange={event => onChange({ playerName: event.currentTarget.value })} />
      <span className="sheet-identity-print">{playerName}</span>
    </>,
    experience: <>
      <input className="sheet-identity-input" aria-label="Опыт" type="number" min="0" step="1"
        value={experience || ""} placeholder="0"
        onChange={event => onChange({ experience: Math.max(0, Math.trunc(event.currentTarget.valueAsNumber || 0)) })} />
      <span className="sheet-identity-print">{printedExperience}</span>
    </>,
  };
}

export function SheetTextEditor({ label, editMode, hideChangeable, selected, selectedEdit, toggleEdit, toggleChangeable, updateSelected, restoreSelected, reset }: {
  label: string;
  editMode: boolean;
  hideChangeable: boolean;
  selected: string | null;
  selectedEdit?: SheetTextEdit;
  toggleEdit: () => void;
  toggleChangeable: () => void;
  updateSelected: (patch: Partial<SheetTextEdit>) => void;
  restoreSelected: () => void;
  reset: () => void;
}) {
  const scale = selectedEdit?.scale ?? 100;
  return <div className="classic-sheet-editor" role="group" aria-label={label}>
    <button type="button" aria-pressed={editMode} onClick={toggleEdit}>{editMode ? "Завершить редактирование" : "Редактировать лист"}</button>
    <button type="button" aria-pressed={hideChangeable} onClick={toggleChangeable}>{hideChangeable ? "Показать изменяемую информацию" : "Скрыть изменяемую информацию"}</button>
    {editMode && <>
      <span>{selected ? "Выбран текст на листе" : "Выберите текст на листе"}</span>
      <button type="button" disabled={!selected} onClick={() => updateSelected({ scale: Math.max(60, scale - 10) })} aria-label="Уменьшить текст">А−</button>
      <output>{scale}%</output>
      <button type="button" disabled={!selected} onClick={() => updateSelected({ scale: Math.min(180, scale + 10) })} aria-label="Увеличить текст">А+</button>
      <button type="button" disabled={!selected} aria-pressed={!!selectedEdit?.bold} onClick={() => updateSelected({ bold: !selectedEdit?.bold })}><b>Жирный</b></button>
      <button type="button" disabled={!selected} onClick={() => updateSelected({ hidden: true })}>Удалить с листа</button>
      <button type="button" disabled={!selected} onClick={restoreSelected}>Вернуть текст</button>
      <button type="button" onClick={reset}>Сбросить правки</button>
    </>}
  </div>;
}

type TextEdits = Partial<Record<string, SheetTextEdit>>;
const emptyEdits: TextEdits = {};
const field = "[data-sheet-editor-field]";
const autoFit = ".hs24-identity strong, .hs24-stats strong, [data-hs24-fit]";

function fieldKey(node: HTMLElement, document: HTMLElement) {
  const parts: string[] = [];
  for (let element: HTMLElement | null = node; element && element !== document; element = element.parentElement) {
    const key = element.dataset.sheetTextKey ?? element.dataset.sheetPanel ?? element.dataset.hs24Fit;
    const name = [element.tagName, ...element.classList].join(".");
    const siblings = Array.from(element.parentElement?.children ?? []);
    const identity = key ?? element.dataset.sheetTextRow ?? (element.matches("p, article, tr, .pdf-resource")
      ? element.querySelector("h3, b, td:nth-child(2), strong")?.textContent || element.textContent?.trim().slice(0, 100) : "");
    const position = siblings.filter(sibling => sibling.tagName === element?.tagName && sibling.className === element.className).indexOf(element);
    parts.unshift(identity ? [name, identity].join(":") : [name, position].join(":"));
    if (key) break;
  }
  return JSON.stringify(parts);
}

export function useSheetTextEditor(root: RefObject<HTMLDivElement | null>, storageKey: string, selector: string) {
  const [stored, setStored] = useState<{ key: string; edits: TextEdits }>();
  const [editMode, setEditMode] = useState(false);
  const [hideChangeable, setHideChangeable] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const edits = stored?.key === storageKey ? stored.edits : emptyEdits;

  useEffect(() => {
    let saved = emptyEdits;
    try {
      const value = JSON.parse(localStorage.getItem(storageKey) ?? "{}");
      if (value && !Array.isArray(value) && typeof value === "object") saved = value;
    } catch { /* The editor can still be used for this session. */ }
    setStored({ key: storageKey, edits: saved });
    setSelected(null);
  }, [storageKey]);

  useEffect(() => {
    if (stored?.key !== storageKey) return;
    try { localStorage.setItem(storageKey, JSON.stringify(stored.edits)); } catch { /* Keep the session edits. */ }
  }, [stored, storageKey]);

  useLayoutEffect(() => {
    const document = root.current;
    if (!document) return;
    for (const node of document.querySelectorAll<HTMLElement>(field)) {
      delete node.dataset.sheetEditorField;
      delete node.dataset.sheetEditorSelected;
      delete node.dataset.sheetEditorBold;
      delete node.dataset.sheetEditorHidden;
      node.removeAttribute("tabindex");
      node.style.removeProperty("--sheet-editor-size");
      node.style.removeProperty("--sheet-editor-fitted-size");
    }
    if (!editMode && !Object.keys(edits).length) return;
    const keys = new Map<string, number>();
    for (const node of document.querySelectorAll<HTMLElement>(selector)) {
      if (!node.textContent?.trim()) continue;
      const keyBase = fieldKey(node, document);
      const occurrence = keys.get(keyBase) ?? 0;
      keys.set(keyBase, occurrence + 1);
      const key = JSON.stringify([keyBase, occurrence]);
      const edit = edits[key];
      if (!editMode && !edit) continue;
      node.dataset.sheetEditorField = key;
      if (edit?.bold) node.dataset.sheetEditorBold = "";
      if (edit?.hidden) node.dataset.sheetEditorHidden = "";
      if (editMode && !edit?.hidden) node.tabIndex = 0;
      if (editMode && key === selected) node.dataset.sheetEditorSelected = "";
      if (edit?.scale && edit.scale !== 100) {
        if (node.matches(autoFit)) node.style.removeProperty("font-size");
        const size = Number.parseFloat(getComputedStyle(node).fontSize) * edit.scale / 100;
        node.style.setProperty("--sheet-editor-size", `${size}px`);
      }
    }
  });

  function select(target: EventTarget) {
    if (!editMode || !(target instanceof Element)) return;
    const node = target.closest<HTMLElement>(field);
    if (node && root.current?.contains(node)) setSelected(node.dataset.sheetEditorField ?? null);
  }

  function update(updateEdits: (current: TextEdits) => TextEdits) {
    setStored(current => ({ key: storageKey, edits: updateEdits(current?.key === storageKey ? current.edits : emptyEdits) }));
  }

  return {
    edits, editMode, hideChangeable, selected, selectedEdit: selected ? edits[selected] : undefined, select,
    toggleEdit: () => { setEditMode(value => !value); setSelected(null); },
    toggleChangeable: () => setHideChangeable(value => !value),
    updateSelected: (patch: Partial<SheetTextEdit>) => {
      if (!selected) return;
      update(current => ({ ...current, [selected]: { scale: 100, bold: false, hidden: false, ...current[selected], ...patch } }));
    },
    restoreSelected: () => {
      if (!selected) return;
      update(current => {
        const next = { ...current };
        delete next[selected];
        return next;
      });
    },
    reset: () => { update(() => emptyEdits); setSelected(null); },
  };
}
