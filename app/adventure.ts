import type { ExportCharacter } from './exportFormats';
import { abilityModifier, estimatedHitPoints } from './exportFormats';
import { finalAbilityScores } from './characterRules';
import { selectedEquipment } from './equipment';
import { characterLevel, hitDicePools, orderedCharacterClasses, resolvePactMagic, resolveSpellSlots, shortRestSpellSlots } from './multiclass';
import { characterResources, spentResourcesAfterLongRest } from './characterResources';
import { activeHomebrew, classRuleFor, homebrewExportClosure } from './homebrewEngine';
import { applySubclassLongRest } from './subclassRuntime';

export type ItemCategory = 'weapon' | 'focus' | 'armor' | 'consumable' | 'ammunition' | 'gear';
export type PlayItem = { category?: ItemCategory; weaponBase?: string; weaponAttackBonus?: number; weaponDamageBonus?: number; spellAttackBonus?: number; spellSaveDcBonus?: number; bonusClassId?: string; healingFormula?: string; id: string; name: string; quantity: number; weight: number; equipped: boolean; magical: boolean; requiresAttunement: boolean; attuned: boolean; attunementPending?: 'start' | 'end'; cursed?: boolean; charges: number; maxCharges: number; recharge: 'none' | 'short' | 'long' | 'dawn'; notes: string; container: string; acBonus: number; attackBonus: number; damageBonus: number; requirement?: string };
import type { PlayTransaction } from './playTransactions';
export type PlayLog = { id: string; at: string; text: string; formula?: string; rolls?: number[]; total?: number; natural?: number; critical?: boolean };
export type PlayEffect = { id: string; name: string; remaining?: number; concentration?: boolean };
export type AdventureState = {
  version: 1; undo?: PlayTransaction[]; favoriteActions?: string[]; name: string; sourceId: string; sourceUpdatedAt: string; startedAt: string; status: 'active' | 'archived';
  inventory: PlayItem[]; effects: PlayEffect[]; concentration?: { name: string; duration: string; remainingMinutes?: number };
  concentrationChecks: { id: string; dc: number; damage: number }[]; conditions: string[]; exhaustion: number;
  journal: PlayLog[]; notes: string; round: number; turn: { action: boolean; bonus: boolean; reaction: boolean };
  hpMaximum?: number; acOverride?: number; attunementLimit: number; elapsedMinutes: number;
};
export const playConditions = ['Ослеплён', 'Очарован', 'Оглох', 'Испуган', 'Схвачен', 'Недееспособен', 'Невидим', 'Парализован', 'Окаменел', 'Отравлен', 'Сбит с ног', 'Опутан', 'Ошеломлён', 'Бессознателен'];
export const incapacitating = ['Недееспособен', 'Парализован', 'Окаменел', 'Ошеломлён', 'Бессознателен'];
export const playId = () => crypto.randomUUID();
export const integer = (n: unknown, min = 0, max = 999999) => Math.min(max, Math.max(min, Math.trunc(Number(n) || 0)));
export function newPlayItem(name = ''): PlayItem { return { id: playId(), name, quantity: 1, weight: 0, equipped: false, magical: false, requiresAttunement: false, attuned: false, charges: 0, maxCharges: 0, recharge: 'none', notes: '', container: '', acBonus: 0, attackBonus: 0, damageBonus: 0 }; }
export function createAdventureCharacter(source: ExportCharacter, sourceId: string, sourceUpdatedAt: string, name: string): ExportCharacter {
  const c: ExportCharacter = structuredClone(source);
  delete c.adventure;
  if (c.homebrew) {
    const library = c.homebrew.entities || [];
    const ids = new Set([...activeHomebrew(c).map(e => e.id), ...(c.feats || []), ...(c.advancements || []).map(e => e.featId), ...c.spells]);
    const frozen = new Map<string, typeof library[number]>();
    for (const root of library.filter(e => ids.has(e.id))) for (const entry of homebrewExportClosure(root, library)) frozen.set(entry.id, entry);
    c.homebrew = { ...c.homebrew, entities: [...frozen.values()] };
  }
  const inventory = (c.inventoryOverride === undefined ? selectedEquipment(c) : c.inventoryOverride.split('\n')).filter(Boolean).map(line => {
    const match = line.match(/^(.*?)\s*[×x]\s*(\d+)\s*$/i);
    const item = newPlayItem(match?.[1] || line);
    item.category = itemCategory(item);
    item.quantity = match ? integer(match[2], 1) : 1;
    // Preserve legacy equipment calculations on the first opening; the player can put individual items away.
    item.equipped = true;
    return item;
  });
  c.adventure = { version: 1, name: name.trim() || 'Новое приключение', sourceId, sourceUpdatedAt, startedAt: new Date().toISOString(), status: 'active', inventory, effects: [], concentrationChecks: [], conditions: [], exhaustion: 0, journal: [], notes: '', round: 1, turn: { action: false, bonus: false, reaction: false }, attunementLimit: 3, elapsedMinutes: 0 };
  c.currentHitPoints ??= estimatedHitPoints({ ...c, abilities: finalAbilityScores(c) });
  return logPlay(c, `Начато приключение «${c.adventure.name}». Создана независимая копия героя.`);
}
export function logPlay(c: ExportCharacter, text: string, result?: DiceResult): ExportCharacter {
  if (!c.adventure) return c;
  const entry: PlayLog = { id: playId(), at: new Date().toISOString(), text, ...(result ? { formula: result.formula, rolls: result.rolls, total: result.total, natural: result.natural, critical: result.critical } : {}) };
  return { ...c, adventure: { ...c.adventure, journal: [entry, ...c.adventure.journal].slice(0, 150) } };
}
export function playMaximum(c: ExportCharacter) { return c.adventure?.hpMaximum ?? estimatedHitPoints({ ...c, abilities: finalAbilityScores(c) }); }
export function inventoryText(items: PlayItem[]) { return items.filter(i => i.quantity > 0).map(i => `${i.name}${i.quantity > 1 ? ` ×${i.quantity}` : ''}`).join('\n'); }
export function playDerived(c: ExportCharacter): ExportCharacter {
  const items = c.adventure?.inventory;
  return { ...c, abilities: finalAbilityScores(c), ...(items ? { inventoryOverride: inventoryText(items.filter(i => i.equipped && i.quantity > 0).map(i => ({ ...i, name: i.weaponBase || i.name.replace(/\s*\+[123]\s*$/, '') }))) } : {}) };
}
export function activeItem(i: PlayItem) { return i.quantity > 0 && i.equipped && (!i.requiresAttunement || i.attuned); }
export function itemBonus(c: ExportCharacter, key: 'acBonus' | 'attackBonus' | 'damageBonus') { return (c.adventure?.inventory || []).filter(activeItem).reduce((n, i) => n + (Number(i[key]) || 0), 0); }
export const itemCategoryLabels: Record<ItemCategory, string> = { weapon: 'Оружие', focus: 'Фокусировки', armor: 'Доспехи', consumable: 'Расходники', ammunition: 'Боеприпасы', gear: 'Снаряжение' };
export function itemCategory(i: PlayItem): ItemCategory {
  if (i.category) return i.category;
  if (/зелье|эликсир|свиток|рацион|порци|масло|(?:^|\s)яд(?:\s|$)/i.test(i.name)) return 'consumable';
  if (/^(стрелы?|болты?|снаряды?)(?:\s|$)/i.test(i.name)) return 'ammunition';
  if (/рапира|меч|кинжал|топор|посох|булава|молот|арбалет|лук|копь[ёе]|дубинка|пика|глефа|алебарда|дротик|праща|цеп|серп|кнут/i.test(i.name)) return 'weapon';
  if (/доспех|кольчуга|латы|нагрудник|щит|кожан/i.test(i.name)) return 'armor';
  return 'gear';
}
export function consumePlayItem(c: ExportCharacter, id: string): ExportCharacter {
  const i = c.adventure?.inventory.find(i => i.id === id);
  if (!i || !['consumable', 'ammunition'].includes(itemCategory(i))) throw new Error('Этот предмет не расходуется при использовании.');
  if (i.quantity <= 0) throw new Error('Предмет закончился.');
  return logPlay(updateInventory(c, c.adventure!.inventory.map(x => x.id === id ? { ...x, quantity: x.quantity - 1 } : x)), `Использован предмет: ${i.name}`);
}
export function spellItemBonus(c: ExportCharacter, key: 'spellAttackBonus' | 'spellSaveDcBonus', classId?: string) {
  return (c.adventure?.inventory || []).filter(i => activeItem(i) && (!i.bonusClassId || i.bonusClassId === classId)).reduce((n,i) => n + (Number(i[key]) || 0), 0);
}
export function weaponItemBonus(c: ExportCharacter, attackName: string, key: 'weaponAttackBonus' | 'weaponDamageBonus') {
  const normalize = (v: string) => v.toLowerCase().replace(/\([^)]*\)|\+[123]/g, '').trim();
  const values = (c.adventure?.inventory || []).filter(i => activeItem(i) && itemCategory(i) === 'weapon' && normalize(i.weaponBase || i.name) === normalize(attackName.split(' · ').at(-1) || attackName)).map(i => Number(i[key]) || 0);
  return values.length ? Math.max(...values) : 0;
}

export function updateInventory(c: ExportCharacter, items: PlayItem[]) { return { ...c, inventoryOverride: inventoryText(items), adventure: c.adventure ? { ...c.adventure, inventory: items } : undefined }; }

export function applyPlayDamage(c: ExportCharacter, amount: number, defense: 'normal' | 'resistance' | 'vulnerability' | 'immune' = 'normal'): ExportCharacter {
  if (!c.adventure) return c;
  const raw = integer(amount);
  const damage = defense === 'immune' ? 0 : defense === 'resistance' ? Math.floor(raw / 2) : defense === 'vulnerability' ? raw * 2 : raw;
  const hp = c.currentHitPoints ?? playMaximum(c);
  const temp = c.temporaryHitPoints || 0;
  const lost = Math.max(0, damage - temp);
  const nextHp = Math.max(0, hp - lost);
  const conditions = [...c.adventure.conditions];
  if (damage > 0 && nextHp === 0 && !conditions.includes('Бессознателен')) conditions.push('Бессознателен');
  const checks = [...c.adventure.concentrationChecks];
  if (damage > 0 && nextHp > 0 && c.adventure.concentration) {
    const dc = Math.max(10, Math.floor(damage / 2));
    checks.push({ id: playId(), dc: c.rulesetId === '5e-2024' ? Math.min(30, dc) : dc, damage });
  }
  let next: ExportCharacter = { ...c, currentHitPoints: nextHp, temporaryHitPoints: Math.max(0, temp - damage),
    deathSaveSuccesses: hp === 0 && damage > 0 ? 0 : c.deathSaveSuccesses,
    deathSaveFailures: hp === 0 && damage > 0 ? Math.min(3, (c.deathSaveFailures || 0) + 1) : c.deathSaveFailures,
    adventure: { ...c.adventure, conditions, concentrationChecks: nextHp === 0 ? [] : checks, concentration: nextHp === 0 ? undefined : c.adventure.concentration,
      effects: nextHp === 0 ? c.adventure.effects.filter(e => !e.concentration) : c.adventure.effects } };
  next = logPlay(next, `Урон ${damage}${damage !== raw ? ` (исходный ${raw})` : ''}: HP ${hp} → ${nextHp}, временные ${temp} → ${Math.max(0, temp - damage)}.${lost >= hp + playMaximum(c) && damage > 0 ? ' Массивный урон: проверьте мгновенную смерть с мастером.' : ''}`);
  return next;
}
export function healPlay(c: ExportCharacter, amount: number) {
  const hp = c.currentHitPoints ?? playMaximum(c);
  const nextHp = Math.min(playMaximum(c), hp + integer(amount));
  return logPlay({ ...c, currentHitPoints: nextHp, ...(nextHp > 0 ? { deathSaveSuccesses: 0, deathSaveFailures: 0, adventure: c.adventure ? { ...c.adventure, conditions: c.adventure.conditions.filter(s => s !== 'Бессознателен') } : undefined } : {}) }, `Лечение: HP ${hp} → ${nextHp}`);
}
export function endConcentration(c: ExportCharacter) {
  if (!c.adventure) return c;
  return { ...c, adventure: { ...c.adventure, concentration: undefined, concentrationChecks: [], effects: c.adventure.effects.filter(e => !e.concentration) } };
}
export function toggleCondition(c: ExportCharacter, name: string) {
  if (!c.adventure) return c;
  const removing = c.adventure.conditions.includes(name);
  let next: ExportCharacter = { ...c, adventure: { ...c.adventure, conditions: removing ? c.adventure.conditions.filter(s => s !== name) : [...c.adventure.conditions, name] } };
  if (!removing && incapacitating.includes(name)) next = endConcentration(next);
  return logPlay(next, `${removing ? 'Снято' : 'Добавлено'} состояние: ${name}`);
}
export function queueAttunement(c: ExportCharacter, id: string) {
  if (!c.adventure) return c;
  const item = c.adventure.inventory.find(i => i.id === id);
  if (!item?.requiresAttunement || item.quantity < 1) throw new Error('Этот предмет не требует настройки.');
  if (!item.attunementPending && c.adventure.inventory.some(i => i.id !== id && i.attunementPending)) throw new Error('Выберите только один предмет на один короткий отдых.');
  if (!item.attuned && c.adventure.inventory.some(i => i.id !== id && i.attuned && i.name.trim().toLowerCase() === item.name.trim().toLowerCase())) throw new Error('Нельзя настроиться на две копии одного магического предмета.');
  if (item.attuned && item.cursed) throw new Error('Сначала мастер должен снять проклятие.');
  if (!item.attuned && !item.attunementPending && c.adventure.inventory.filter(i => i.attuned || i.attunementPending === 'start').length >= c.adventure.attunementLimit) throw new Error('Лимит настройки занят. Сначала завершите прекращение другой настройки.');
  return updateInventory(c, c.adventure.inventory.map(i => i.id === id ? { ...i, attunementPending: i.attunementPending ? undefined : i.attuned ? 'end' : 'start' } : i));
}
export function finishAttunement(c: ExportCharacter) {
  if (!c.adventure) return c;
  const pending = c.adventure.inventory.filter(i => i.attunementPending);
  if (pending.length > 1) throw new Error('На один короткий отдых выберите только один предмет для настройки или её прекращения.');
  return updateInventory(c, c.adventure.inventory.map(i => i.attunementPending ? { ...i, attuned: i.attunementPending === 'start', attunementPending: undefined } : i));
}

export type DiceResult = { formula: string; rolls: number[]; total: number; natural?: number; critical?: boolean };
export type RollMode = 'normal' | 'advantage' | 'disadvantage';
export function randomDie(sides: number): number {
  const limit = Math.floor(0x100000000 / sides) * sides;
  const values = new Uint32Array(1); do { crypto.getRandomValues(values); } while (values[0] >= limit);
  return values[0] % sides + 1;
}
/** Strict arithmetic parser: bounded sums of dice and integers, no code execution. */
export function rollDice(formula: string, die: (sides: number) => number = randomDie, critical = false): DiceResult {
  const value = formula.toLowerCase().replace(/к/g, 'd').replace(/\s/g, '').replace(/\+\-/g, '-').replace(/--/g, '+');
  if (!value || value.length > 160 || !/^[+-]?(?:\d*d\d+|\d+)(?:[+-](?:\d*d\d+|\d+))*$/.test(value)) throw new Error('Формула: например 1d20+5 или 2d6+3. Допускаются только кости, числа, + и −.');
  const rolls: number[] = []; let total = 0;
  for (const term of value.match(/[+-]?[^+-]+/g) || []) {
    const sign = term.startsWith('-') ? -1 : 1; const part = term.replace(/^[+-]/, '');
    if (part.includes('d')) {
      const [count, sides] = part.split('d').map(Number); const n = (count || 1) * (critical ? 2 : 1);
      if ((count === 0 && part.startsWith('0')) || n < 1 || n > 200 || sides < 2 || sides > 1000 || rolls.length + n > 200) throw new Error('Слишком много костей или недопустимый размер кости.');
      for (let i = 0; i < n; i++) { const rolled = die(sides); rolls.push(rolled); total += sign * rolled; }
    } else { const n = Number(part); if (!Number.isSafeInteger(n) || n > 1000000) throw new Error('Слишком большой модификатор.'); total += sign * n; }
  }
  return { formula: critical ? `${formula} (крит: кости ×2)` : formula, rolls, total };
}
export function rollD20(bonus: number, mode: RollMode = 'normal', die: (sides: number) => number = randomDie): DiceResult {
  const rolls = [die(20)]; if (mode !== 'normal') rolls.push(die(20));
  const natural = mode === 'advantage' ? Math.max(...rolls) : mode === 'disadvantage' ? Math.min(...rolls) : rolls[0];
  return { formula: `${mode === 'normal' ? '1d20' : '2d20' + (mode === 'advantage' ? ' (лучший)' : ' (худший)')}${bonus >= 0 ? '+' : ''}${bonus}`, rolls, total: natural + bonus, natural, critical: natural === 20 };
}
export function applyDeathSave(c: ExportCharacter, natural: number) {
  if ((c.currentHitPoints ?? playMaximum(c)) > 0) throw new Error('Спасбросок смерти доступен при 0 HP.');
  if (natural === 20) return logPlay(healPlay(c, 1), 'Спасбросок смерти: натуральная 20');
  const succeeds = natural >= 10;
  return logPlay({ ...c, deathSaveSuccesses: integer((c.deathSaveSuccesses || 0) + (succeeds ? 1 : 0), 0, 3), deathSaveFailures: integer((c.deathSaveFailures || 0) + (succeeds ? 0 : natural === 1 ? 2 : 1), 0, 3) }, `Спасбросок смерти: ${natural}${succeeds ? ', успех' : ', провал'}`);
}

export function playHitDicePools(c: ExportCharacter) { return orderedCharacterClasses(c).map(entry => ({ classId: entry.classId, die: classRuleFor(c, entry.classId)?.hitDie || 8, max: entry.level, spent: integer(c.hitDiceSpentByClass?.[entry.classId], 0, entry.level) })); }

export function durationMinutes(text: string): number | undefined {
  const match = text.match(/(\d+)\s*(минут|minute|час|hour|дн|день|day|раунд|round)/i);
  if (!match) return undefined;
  return Number(match[1]) * (/час|hour/i.test(match[2]) ? 60 : /дн|день|day/i.test(match[2]) ? 1440 : /раунд|round/i.test(match[2]) ? 0.1 : 1);
}

export function restPlay(c: ExportCharacter, kind: 'short' | 'long', selectedDice: Record<string, number> = {}, die: (sides: number) => number = randomDie) {
  if (!c.adventure) return c;
  if ((c.currentHitPoints ?? playMaximum(c)) <= 0 && kind === 'long') throw new Error('Для начала длинного отдыха нужен хотя бы 1 HP.');
  if (c.adventure.concentrationChecks.length) throw new Error('Сначала разрешите проверки концентрации.');
  const remaining = c.adventure.concentration?.remainingMinutes ?? durationMinutes(c.adventure.concentration?.duration || '');
  const keepConcentration = kind === 'short' && c.adventure.concentration && (remaining === undefined || remaining > 60);
  const derived = playDerived(c); const pools = playHitDicePools(c); const spent = Object.fromEntries(pools.map(p => [p.classId, p.spent]));
  let healing = 0;
  if (kind === 'short') for (const pool of pools) {
    const count = integer(selectedDice[pool.classId], 0, pool.max - pool.spent);
    for (let i = 0; i < count; i++) healing += Math.max(0, die(pool.die) + abilityModifier(derived.abilities.con));
    spent[pool.classId] += count;
  }
  if (kind === 'long') {
    let recover = c.rulesetId === '5e-2024' ? characterLevel(c) : Math.max(1, Math.floor(characterLevel(c) / 2));
    for (const pool of pools) { const n = Math.min(recover, spent[pool.classId]); spent[pool.classId] -= n; recover -= n; }
  }
  const resources = kind === 'long' ? spentResourcesAfterLongRest(derived) : { ...c.resourceSpent };
  if (kind === 'short') characterResources(derived).filter(r => r.isShortRest).forEach(r => { resources[r.key] = 0; });
  let next: ExportCharacter = { ...c, currentHitPoints: kind === 'long' ? playMaximum(c) : Math.min(playMaximum(c), (c.currentHitPoints ?? playMaximum(c)) + healing),
    temporaryHitPoints: kind === 'long' ? 0 : c.temporaryHitPoints, hitDiceSpentByClass: spent, hitDiceSpent: Object.values(spent).reduce((a, b) => a + b, 0),
    resourceSpent: resources, spellSlotsUsed: kind === 'long' ? resolveSpellSlots(derived).map(() => 0) : shortRestSpellSlots(derived), pactSlotsUsed: 0,
    adventure: { ...c.adventure, elapsedMinutes: c.adventure.elapsedMinutes + (kind === 'long' ? 480 : 60), exhaustion: kind === 'long' ? Math.max(0, c.adventure.exhaustion - 1) : c.adventure.exhaustion,
      inventory: c.adventure.inventory.map(i => (i.recharge === kind || (kind === 'long' && i.recharge === 'short')) ? { ...i, charges: i.maxCharges } : i),
      concentration: keepConcentration ? { ...c.adventure.concentration!, remainingMinutes: remaining === undefined ? undefined : remaining - 60 } : undefined, concentrationChecks: [], effects: c.adventure.effects.filter(e => !e.concentration && (e.remaining === undefined || e.remaining > (kind === 'long' ? 4800 : 600))).map(e => e.remaining === undefined ? e : { ...e, remaining: e.remaining - (kind === 'long' ? 4800 : 600) }) } };
  if (kind === 'long') next = applySubclassLongRest(next);
  if (kind === 'short') next = finishAttunement(next);
  if ((next.currentHitPoints || 0) > 0) next = { ...next, deathSaveSuccesses: 0, deathSaveFailures: 0, adventure: { ...next.adventure!, conditions: next.adventure!.conditions.filter(s => s !== 'Бессознателен') } };
  return logPlay(next, `${kind === 'long' ? 'Длинный' : 'Короткий'} отдых завершён${kind === 'short' && healing ? `: лечение ${healing}` : ''}. Другие состояния сохранены.`);
}
export function advancePlayTurn(c: ExportCharacter) {
  if (!c.adventure) return c;
  const ended = c.adventure.effects.filter(e => e.remaining !== undefined && e.remaining <= 1);
  let next: ExportCharacter = { ...c, adventure: { ...c.adventure, round: c.adventure.round + 1, turn: { action: false, bonus: false, reaction: false }, effects: c.adventure.effects.filter(e => !ended.includes(e)).map(e => e.remaining === undefined ? e : { ...e, remaining: e.remaining - 1 }) } };
  if (c.adventure.concentration?.remainingMinutes !== undefined) {
    const remainingMinutes = c.adventure.concentration.remainingMinutes - 0.1;
    next.adventure!.concentration = { ...c.adventure.concentration, remainingMinutes };
    if (remainingMinutes < 0.00001) next = endConcentration(next);
  }
  if (ended.some(e => e.concentration)) next = endConcentration(next);
  return logPlay(next, `Начат собственный ход ${next.adventure!.round}${ended.length ? `. Завершены: ${ended.map(e => e.name).join(', ')}` : ''}`);
}
