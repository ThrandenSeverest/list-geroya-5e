import type { ExportCharacter } from './exportFormats';
import { logPlay, playId } from './adventure';

export type PlayPatch = { values: Record<string, unknown>; absent: string[] };
export type PlayTransaction = { id: string; at: string; label: string; character: PlayPatch; adventure: PlayPatch };
const limit = 20;
const byteLimit = 512_000;
function patch(before: object, after: object, omit: string[] = []): PlayPatch {
  const a = before as Record<string, unknown>, b = after as Record<string, unknown>;
  const result: PlayPatch = { values: {}, absent: [] };
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (omit.includes(key) || JSON.stringify(a[key]) === JSON.stringify(b[key])) continue;
    if (a[key] === undefined) result.absent.push(key);
    else result.values[key] = structuredClone(a[key]);
  }
  return result;
}
function restore<T extends object>(state: T, delta: PlayPatch): T {
  const result = { ...state } as Record<string, unknown>;
  for (const key of delta.absent) delete result[key];
  return { ...result, ...structuredClone(delta.values) } as T;
}
/** Persist only changed fields; never embed another undo history in a snapshot. */
export function commitPlayChange(before: ExportCharacter, after: ExportCharacter): ExportCharacter {
  if (!before.adventure || !after.adventure) return after;
  const character = patch(before, after, ['adventure']);
  const adventure = patch(before.adventure, after.adventure, ['undo']);
  if (!Object.keys(character.values).length && !character.absent.length && !Object.keys(adventure.values).length && !adventure.absent.length) return before;
  const label = after.adventure.journal[0]?.id !== before.adventure.journal[0]?.id ? after.adventure.journal[0]?.text || 'Изменение героя' : 'Изменение героя';
  const entry: PlayTransaction = { id: playId(), at: new Date().toISOString(), label, character, adventure };
  const undo = [...(before.adventure.undo || []), entry].slice(-limit);
  while (undo.length && new TextEncoder().encode(JSON.stringify(undo)).length > byteLimit) undo.shift();
  return { ...after, adventure: { ...after.adventure, undo } };
}
export function undoPlayChange(c: ExportCharacter): ExportCharacter {
  const entry = c.adventure?.undo?.at(-1);
  if (!entry || !c.adventure) return c;
  const previous = restore(c, entry.character);
  previous.adventure = { ...restore(c.adventure, entry.adventure), undo: c.adventure.undo!.slice(0, -1) };
  return logPlay(previous, `Отменено: ${entry.label}`);
}
