import { rollD20, rollDice, type DiceResult, type RollMode } from './adventure';
export type ComposedRoll = { bonus: number; mode: RollMode; adjustment?: number; extraDice?: string };
/** One-shot extras never alter the underlying character. Natural d20 is preserved. */
export function composeD20(options: ComposedRoll, die?: (sides: number) => number): DiceResult {
  const adjustment = options.adjustment ?? 0;
  if (![options.bonus, adjustment].every(Number.isSafeInteger) || Math.abs(adjustment) > 1000) throw new Error('Поправка должна быть целым числом от −1000 до 1000.');
  // Validate the extra formula before rolling the d20.
  const formula = options.extraDice?.trim();
  if (formula) rollDice(formula, () => 1);
  const base = rollD20(options.bonus + adjustment, options.mode, die);
  if (!formula) return base;
  const extra = rollDice(formula, die);
  return { ...base, formula: `${base.formula} + (${formula})`, rolls: [...base.rolls, ...extra.rolls], total: base.total + extra.total };
}
