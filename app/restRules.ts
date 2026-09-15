export function hitDiceAfterLongRest(spent: number, level: number) {
  const recovered = Math.max(1, Math.floor(Math.max(1, level) / 2));
  return Math.max(0, Math.min(level, spent) - recovered);
}

export function hitDieHealing(roll: number, constitutionModifier: number) {
  return Math.max(0, roll + constitutionModifier);
}

export function shortRestHitDieHealing(rolls: number[], constitutionModifier: number) {
  return rolls.reduce((total, roll) => total + hitDieHealing(roll, constitutionModifier), 0);
}
