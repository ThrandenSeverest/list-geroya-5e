import test from 'node:test';
import assert from 'node:assert/strict';
import { magicLevel, magicFeatureIds, magicSpellList } from '../app/homebrewMagic';
import { homebrewRelations } from '../app/homebrewRelations';
import { normalizeHomebrewLibrary, type HomebrewElement } from '../app/homebrew';
import example from '../app/shamanExample.json';
const root=example.entities.find(e=>e.type==='class') as HomebrewElement;
test('Shaman magic preview agrees with its slot progression and known limits',()=>{
 assert.deepEqual(magicLevel(root,1).slots,[]);
 assert.deepEqual(magicLevel(root,2),{level:2,cantrips:2,known:3,prepared:undefined,slots:[2]});
 assert.deepEqual(magicLevel(root,5).slots,[0,0,2]);
 assert.equal(magicSpellList(root,example.entities as HomebrewElement[]).length,126);
});
test('Legacy Shaman links casting without losing description or changing schema',()=>{
 const legacy={...root,references:undefined};
 const upgraded=normalizeHomebrewLibrary({elements:[legacy]}).elements[0];
 assert.deepEqual(magicFeatureIds(upgraded),['hb:shaman:ability:primal-magic']);
 assert.equal(upgraded.features?.[0].description,root.features?.[0].description);
 assert.deepEqual(magicFeatureIds(normalizeHomebrewLibrary({elements:[{...root,references:[]}]}).elements[0]),['hb:shaman:ability:primal-magic']);
 assert.equal(upgraded.references,undefined);
 const graph=homebrewRelations([upgraded]);
 assert.ok(graph.edges.some(e=>e.from==='hb:shaman:ability:primal-magic'&&e.to===`magic:${root.id}`));
 assert.ok(graph.nodes.some(n=>n.id===`magic:${root.id}:slots`));
});
test('Prepared formula and pact preview use class level and chosen modifier',()=>{
 assert.equal(magicLevel({...root,spellcasting:{mode:'full',ability:'wis',selection:'prepared',preparedFormula:'@classLevel + @mod.wis'}},5,4).prepared,9);
 assert.deepEqual(magicLevel({...root,spellcasting:{mode:'pact',ability:'cha'}},5).slots,[0,0,2]);
});

test('casting associations work for custom classes and subclasses without references or Shaman IDs',()=>{
 for(const type of ['class','subclass'] as const){
  const custom={...root,id:'hb:test:'+type+':custom',type,references:[],features:[{id:'hb:test:ability:casting',name:'Использование заклинаний',level:1,description:''},{id:'hb:test:ability:defense',name:'Защита от магии',level:1,description:''}]} as HomebrewElement;
  const before=JSON.stringify(custom);
  assert.deepEqual(magicFeatureIds(custom),['hb:test:ability:casting']);
  assert.ok(homebrewRelations([custom]).edges.some(edge=>edge.from==='hb:test:ability:casting'&&edge.to==='magic:'+custom.id));
  assert.equal(JSON.stringify(custom),before);
 }
});
