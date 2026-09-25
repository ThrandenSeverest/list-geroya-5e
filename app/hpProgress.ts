import type { ExportCharacter } from "./exportFormats";
import { estimatedHitPoints } from "./exportFormats";
import { normalizedLevelHistory } from "./multiclass";
import { classRules } from "./rules";

/** A conscious edit to one level; legacy totals are never inferred as raw rolls. */
export function setHitPointRoll(character: ExportCharacter, characterLevel: number, roll: number | null, resolvedAbilities: ExportCharacter["abilities"] = character.abilities): ExportCharacter {
  const history = normalizedLevelHistory(character);
  const index = history.findIndex(entry => entry.characterLevel === characterLevel && characterLevel > 1);
  if (index < 0) return character;
  const die = classRules[history[index].classId]?.hitDie || 8;
  if (roll !== null && (!Number.isInteger(roll) || roll < 1 || roll > die)) return character;
  const updated = [...history];
  updated[index] = roll === null
    ? { ...updated[index], hpMode: "average", hpGain: undefined, hpGainFormat: undefined }
    : { ...updated[index], hpMode: "roll", hpGain: roll, hpGainFormat: "raw-roll-plus-con-v1" };
  const next = { ...character, levelHistory: updated };
  return character.currentHitPoints === undefined ? next
    : { ...next, currentHitPoints: Math.min(character.currentHitPoints, estimatedHitPoints({ ...next, abilities: resolvedAbilities })) };
}
