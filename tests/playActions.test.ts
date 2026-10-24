import test from 'node:test';
import assert from 'node:assert/strict';
import type { ExportCharacter } from '../app/exportFormats';
import { createAdventureCharacter, newPlayItem, restPlay, updateInventory } from '../app/adventure';
import { useQuickItem, resolvePlayAttack } from '../app/playActions';
import { commitPlayChange, undoPlayChange } from '../app/playTransactions';
import { createNativeCharacterFile, parseCharacterFile } from '../app/characterFiles';
const hero=():ExportCharacter=>({...createAdventureCharacter({name:'Сессия',className:'fighter',level:3,startingClassId:'fighter',classes:[{classId:'fighter',level:3,acquiredAtCharacterLevel:1}],race:'human',raceVariant:'standard',abilities:{str:16,dex:12,con:14,int:10,wis:10,cha:10},background:'',classSkills:[],backgroundSkills:[],spells:[],alignment:'',playerName:'',currency:{gp:0,sp:0,cp:0,pp:0},personality:{traits:'',ideals:'',bonds:'',flaws:''},currentHitPoints:1} as ExportCharacter,'source','date','Тест'),currentHitPoints:1});
test('quick potion and inventory use share one quantity/healing operation and one undo',()=>{
 const c=updateInventory(hero(),[{...newPlayItem('Зелье'),category:'consumable',quantity:2,healingFormula:'2d4+2'}]);
 const action=useQuickItem(c,c.adventure!.inventory[0].id,()=>3);
 assert.equal(action.roll!.total,8);assert.equal(action.character.currentHitPoints,9);assert.equal(action.character.adventure!.inventory[0].quantity,1);assert.equal(c.currentHitPoints,1);
 const restored=undoPlayChange(commitPlayChange(c,action.character));assert.equal(restored.currentHitPoints,1);assert.equal(restored.adventure!.inventory[0].quantity,2);
 assert.throws(()=>useQuickItem(updateInventory(c,[{...c.adventure!.inventory[0],quantity:0}]),c.adventure!.inventory[0].id));
});
test('integrated attack preserves advantage, doubles only damage dice and restores both logs on undo',()=>{
 const c=hero(),values=[4,20];const action=resolvePlayAttack(c,'Рапира',5,'1d8+3','advantage',s=>s===20?values.shift()!:4);
 assert.equal(action.attack!.natural,20);assert.equal(action.damage!.total,11);assert.equal(action.character.adventure!.journal.filter(e=>e.formula).length,2);
 const restored=undoPlayChange(commitPlayChange(c,action.character));assert.equal(restored.adventure!.journal.filter(e=>e.formula).length,0);
 const miss=resolvePlayAttack(c,'Рапира',5,'1d8+3','normal',()=>1);assert.equal(miss.damage,undefined);
});
test('session pins, density and custom resources survive native import and restore by selected rest',()=>{
 const c=hero();c.adventure!.favoriteActions=['spell:wizard:shield','item:1'];c.adventure!.interfaceDensity='compact';c.adventure!.customResources=[{id:'s',name:'Короткий',current:0,max:2,recharge:'short'},{id:'l',name:'Длинный',current:1,max:3,recharge:'long'},{id:'m',name:'Вручную',current:0,max:5,recharge:'none'}];
 const restored=parseCharacterFile(createNativeCharacterFile(c),hero()).character;
 assert.deepEqual(restored.adventure!.favoriteActions,c.adventure!.favoriteActions);assert.equal(restored.adventure!.interfaceDensity,'compact');
 assert.deepEqual(restPlay(restored,'short').adventure!.customResources!.map(r=>r.current),[2,1,0]);
 const rested=commitPlayChange(restored,restPlay(restored,'long'));assert.deepEqual(rested.adventure!.customResources!.map(r=>r.current),[2,3,0]);assert.deepEqual(undoPlayChange(rested).adventure!.customResources!.map(r=>r.current),[0,1,0]);
});
