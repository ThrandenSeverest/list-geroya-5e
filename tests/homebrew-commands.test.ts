import test from 'node:test';
import assert from 'node:assert/strict';
import { commandQuery, descriptionCommands, filterCommands, formulaCommands, insertCommand } from '../app/homebrewCommands';
import { evaluateFormula } from '../app/homebrewFormula';

test('command completion replaces only the token at the caret, retaining text and selection suffix', () => {
  const value = '2 + @mo + 7';
  const range = commandQuery(value, 7)!;
  assert.deepEqual(range, { start: 4, end: 7, query: 'mo' });
  const command = formulaCommands.find(row => row.command === '@mod.wis')!;
  assert.deepEqual(insertCommand(value, range.start, range.end, command), { value: '2 + @mod.wis + 7', caret: 12 });
  assert.equal(commandQuery('2 + ', 4), null);
  assert.ok(filterCommands(formulaCommands, 'модификатор').length === 6);
  assert.equal(commandQuery('@урон', 5)?.query, 'урон');
  assert.equal(filterCommands(descriptionCommands, 'урон')[0].command, '@damage');
});

test('all advertised formula templates run through the existing interpreter without new syntax', () => {
  const values = Object.fromEntries(formulaCommands.filter(row => row.insert === row.command).map(row => [row.command, 4]));
  for (const command of formulaCommands) {
    assert.ok(Number.isFinite(evaluateFormula(command.insert, { values, classLevel: () => 3, resource: () => 2, predicate: () => true })), command.command);
  }
  for (const command of descriptionCommands) {
    const formula = /formula="([^"]*)"/.exec(command.insert)?.[1];
    if (formula) assert.ok(Number.isFinite(evaluateFormula(formula, { values, resource: () => 2 })), command.command);
    else assert.match(command.insert, /resource="ID" amount="1"/);
    assert.match(command.insert, /^\[\[(roll|damage|heal|dc|value|consume|restore) /);
  }
});
