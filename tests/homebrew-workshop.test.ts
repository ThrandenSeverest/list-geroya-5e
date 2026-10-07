import test from 'node:test';
import assert from 'node:assert/strict';
import { newHomebrew, normalizeHomebrewLibrary, type HomebrewElement } from '../app/homebrew';
import { hbResources, hbValue, activeHomebrew } from '../app/homebrewEngine';
import { validateHomebrew } from '../app/homebrewValidation';
import { alwaysPreparedSpellEntries, spellSelectionRuleForClass } from '../app/characterRules';
import { resourceAtLevel } from '../app/homebrewResources';
import { readSimpleValue, simpleValueFormula } from '../app/HomebrewValueInput';
import { spells } from '../app/catalog';
import type { ExportCharacter } from '../app/exportFormats';
const root:HomebrewElement={...newHomebrew('class','Проверочный бард'),id:'hb:test:class:bard',features:[{id:'hb:test:ability:inspiration',name:'Вдохновение',level:1,description:'',resources:[{id:'hb:test:resource:inspiration',name:'Вдохновение',max:'@mod.cha',restore:['long_rest'],progression:[{level:5,restore:['short_rest','long_rest']},{level:10,max:'@classLevel'}]}]},{id:'hb:test:ability:use',name:'Слова',level:3,description:'',actions:[{id:'hb:test:ability:spend',name:'Применить',actionType:'reaction',cost:{resource:'hb:test:resource:inspiration',amount:2}}],spellGrants:[{spellId:spells.find(s=>s.level===1)!.id,level:3,mode:'always-prepared',uses:1,recovery:'long'}]}]};
const character=(level:number)=>({className:root.id,startingClassId:root.id,level:level+2,classes:[{classId:root.id,level,acquiredAtCharacterLevel:1},{classId:'fighter',level:2,acquiredAtCharacterLevel:level+1}],abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:16},classSkills:[],spells:[],feats:[],advancements:[],race:'human',background:'',homebrew:{entities:[root],activeIds:[root.id]},resourceSpent:{'hb:test:resource:inspiration':1}} as unknown as ExportCharacter);
test('resource milestones use class level and change recovery without losing spent uses',()=>{
 assert.equal(hbResources(character(4))[0].isShortRest,false);
 assert.equal(hbResources(character(5))[0].isShortRest,true);
 assert.equal(hbResources(character(9))[0].max,3);
 assert.equal(hbResources(character(10))[0].max,10);
 assert.equal(hbValue(character(10),'@resource("hb:test:resource:inspiration").current','hb:test:ability:use'),9);
 assert.equal(hbResources(character(4))[0].max,3);
 const legacy={id:'old',name:'Old',max:2,restore:['long_rest']};
 assert.deepEqual(resourceAtLevel(legacy,20),{max:2,restore:['long_rest']});
});
test('inline spell grants unlock, export and normalize with the containing ability',()=>{
 assert.equal(alwaysPreparedSpellEntries(character(2),spells).length,0);
 assert.equal(alwaysPreparedSpellEntries(character(3),spells)[0].source,'Слова');
 assert.equal(hbResources(character(3)).length,2);
 const normalized=normalizeHomebrewLibrary(JSON.parse(JSON.stringify({elements:[root]})));
 assert.deepEqual(normalized.elements[0].features,root.features);
 assert.deepEqual(validateHomebrew(normalized.elements,spells.map(s=>'official:spell:'+s.id)),[]);
 assert.ok(activeHomebrew(character(3)).find(e=>e.id==='hb:test:ability:use')?.actions?.[0].cost);
});
test('invalid milestone and missing shared resource are rejected before saving',()=>{
 const invalid=structuredClone(root);
 invalid.features![0].resources![0].progression=[{level:5,max:'globalThis.alert(1)'},{level:5,max:1}];
 invalid.features![1].actions![0].cost!.resource='missing';
 invalid.features![1].spellGrants![0].spellId='missing-spell';
 const messages=validateHomebrew([invalid]).map(p=>p.message).join('\n');
 assert.match(messages,/Формула/);assert.match(messages,/уникальные уровни/);assert.match(messages,/Расход/);assert.match(messages,/Заклинание способности/);
});
test('guided number controls preserve formulas and prepared limits support class level and mastery',()=>{
 for(const value of ['3','-2','@pb','@classLevel + 2','@mod.cha - 1','2d8 + 3','floor(@classLevel / 2)']){
  const parsed=readSimpleValue(value);assert.notEqual(parsed.source,'custom');
  assert.equal(simpleValueFormula(parsed.source,parsed.amount,parsed.bonus,parsed.dice),value);
 }
 assert.equal(readSimpleValue('max(1, @classLevel + @mod.cha)').source,'custom');
 const c=character(5);c.homebrew!.entities=[{...root,spellcasting:{mode:'full',ability:'cha',selection:'prepared',preparedFormula:'@classLevel + @pb + @mod.cha'}}];
 assert.equal(spellSelectionRuleForClass(c,root.id,5).prepared,11);
});
