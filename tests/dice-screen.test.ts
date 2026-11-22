import assert from 'node:assert/strict';
import test from 'node:test';
import { diceFromResult, diceMesh } from '../app/diceScreenMath';

test('each rolled term produces precisely the original dice type and value', () => {
  assert.deepEqual(diceFromResult({formula:'2d6+1d4+3',rolls:[2,5,3]}), [
    {sides:6,value:2},{sides:6,value:5},{sides:4,value:3}
  ]);
  assert.deepEqual(diceFromResult({formula:'1d20+5',rolls:[19]}),[{sides:20,value:19}]);
  assert.deepEqual(diceFromResult({formula:'2d20 (лучший)+3',rolls:[11,18]}),[{sides:20,value:11},{sides:20,value:18}]);
  assert.deepEqual(diceFromResult({formula:'1d8+3 (крит: кости ×2)',rolls:[7,4]}),[{sides:8,value:7},{sides:8,value:4}]);
  assert.deepEqual(diceFromResult({formula:'1d100',rolls:[93]}),[{sides:100,value:93}]);
  assert.deepEqual(diceFromResult({formula:'1d7',rolls:[4]}),[{sides:7,value:4}]);
});
test('no fake d20 for unsupported dice or flat modifiers', () => {
  assert.deepEqual(diceFromResult({formula:'7',rolls:[]}),[]);
  assert.deepEqual(diceFromResult({formula:'1d1000',rolls:[413]}),[{sides:1000,value:413}]);
  assert.deepEqual(diceFromResult({formula:'1d6+3',rolls:[3]}),[{sides:6,value:3}]);
});
test('canonical mesh face counts for tabletop dice', () => {
  for (const [sides,faces] of [[4,4],[6,6],[8,8],[10,10],[12,12],[20,20]]) {
    const mesh=diceMesh(sides);
    assert.equal(mesh.faces.length,faces,'d'+sides+' faces');
    assert.ok(mesh.faces.every(face=>face.vertices.length>=3 && face.vertices.every(index=>index>=0 && index<mesh.vertices.length)));
  }
});
