import { abilityLabels } from './rules';

export type HBCommand = { command: string; insert: string; description: string; group: string };
export const formulaCommands: HBCommand[] = [
  ['@level', 'Общий уровень персонажа'],
  ['@classLevel', 'Уровень этого класса; учитывает мультикласс'],
  ['@pb', 'Бонус мастерства персонажа'],
  ['@currentHp', 'Текущие хиты'],
  ['@tempHp', 'Временные хиты'],
].map(([command, description]) => ({ command, insert: command, description, group: 'Персонаж' }));
for (const [id, name] of Object.entries(abilityLabels)) {
  formulaCommands.push(
    { command: '@mod.' + id, insert: '@mod.' + id, description: 'Модификатор: ' + name, group: 'Характеристики' },
    { command: '@ability.' + id, insert: '@ability.' + id, description: 'Значение: ' + name, group: 'Характеристики' },
  );
}
formulaCommands.push(...[
  ['@min', 'min(@pb, 3)', 'Меньшее из значений'],
  ['@max', 'max(1, @mod.wis)', 'Большее из значений; например минимум 1 применение'],
  ['@floor', 'floor(@classLevel / 2)', 'Округлить вниз'],
  ['@ceil', 'ceil(@classLevel / 2)', 'Округлить вверх'],
  ['@round', 'round(@classLevel / 2)', 'Округлить до ближайшего целого'],
  ['@abs', 'abs(@mod.str)', 'Модуль числа'],
  ['@clamp', 'clamp(@classLevel, 1, 5)', 'Ограничить значение нижней и верхней границей'],
  ['@classLevelById', '@classLevel("ID")', 'Уровень конкретного класса: замените ID'],
  ['@resource.current', '@resource("ID").current', 'Оставшиеся применения ресурса: замените ID'],
  ['@resource.max', '@resource("ID").max', 'Максимум ресурса: замените ID'],
  ['@equipped', 'equipped(@source)', 'Условие: этот предмет экипирован'],
  ['@hasFeature', 'hasFeature("ID")', 'Условие: отдельный объект активен у персонажа; замените ID'],
  ['@hasArmor', 'hasArmor("armor")', 'Условие: надеты доспехи; для щита используйте shield'],
].map(([command, insert, description]) => ({ command, insert, description, group: 'Функции и условия' })));

export const descriptionCommands: HBCommand[] = [
  ['@roll', '[[roll formula="1d20 + @pb" label="Бросок"]]', 'Кнопка броска кости с бонусом мастерства'],
  ['@damage', '[[damage formula="1d8 + @mod.str" label="Урон"]]', 'Кнопка броска урона'],
  ['@heal', '[[heal formula="1d8 + @mod.wis" label="Лечение"]]', 'Кнопка броска лечения'],
  ['@dc', '[[dc formula="8 + @pb + @mod.int" label="Сложность"]]', 'Показать сложность без броска'],
  ['@value', '[[value formula="@classLevel" label="Значение"]]', 'Показать рассчитанное значение без броска'],
  ['@resource', '[[value formula="@resource(\'ID\').current" label="Осталось применений"]]', 'Показать остаток ресурса; замените ID на его идентификатор'],
  ['@consume', '[[consume resource="ID" amount="1" label="Потратить применение"]]', 'Потратить применение на игровом листе; замените ID ресурса'],
  ['@restore', '[[restore resource="ID" amount="1" label="Восстановить применение"]]', 'Восстановить применение на игровом листе; замените ID ресурса'],
].map(([command, insert, description]) => ({ command, insert, description, group: 'Кнопки в описании' }));

export function commandQuery(value: string, caret: number) {
  const match = /@([\p{L}\p{N}_.]*)$/u.exec(value.slice(0, caret));
  return match ? { start: caret - match[0].length, end: caret, query: match[1].toLowerCase() } : null;
}
export function filterCommands(commands: HBCommand[], query: string) {
  const needle = query.toLowerCase();
  return commands.filter(row => (row.command + ' ' + row.description + ' ' + row.group).toLowerCase().includes(needle));
}
export function insertCommand(value: string, start: number, end: number, command: HBCommand) {
  return { value: value.slice(0, start) + command.insert + value.slice(end), caret: start + command.insert.length };
}
