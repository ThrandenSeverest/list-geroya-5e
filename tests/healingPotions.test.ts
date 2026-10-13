import test from 'node:test';
import assert from 'node:assert/strict';
import type { ExportCharacter } from '../app/exportFormats';
import { createAdventureCharacter, newPlayItem, updateInventory } from '../app/adventure';
import { healingPotions, healingFormulaForItem, potionPreset } from '../app/healingPotions';
import { useQuickItem } from '../app/playActions';
import { commitPlayChange, undoPlayChange } from '../app/playTransactions';
const hero=()=>createAdventureCharacter({name:'Герой',className:'fighter',level:10,race:'human',raceVariant:'standard',abilities:{str:14,dex:10,con:14,int:10,wis:10,cha:10},background:'',classSkills:[],backgroundSkills:[],spells:[],alignment:'',playerName:'',currency:{gp:0,sp:0,cp:0,pp:0},personality:{traits:'',ideals:'',bonds:'',flaws:''},currentHitPoints:1} as ExportCharacter,'source','date','Тест');
test('all four standard potions heal automatically even when an old inventory item lacks a formula',()=>{
 for(const [index,p] of healingPotions.entries()){
   const c=updateInventory(hero(),[{...newPlayItem(p.name),quantity:2}]);
   const action=useQuickItem(c,c.adventure!.inventory[0].id,()=>1);
   assert.equal(action.roll!.formula,p.formula);assert.equal(action.roll!.total,[4,8,16,30][index]);assert.equal(action.character.currentHitPoints,1+action.roll!.total);assert.equal(action.character.adventure!.inventory[0].quantity,1);
   const restored=undoPlayChange(commitPlayChange(c,action.character));assert.equal(restored.currentHitPoints,1);assert.equal(restored.adventure!.inventory[0].quantity,2);
 }
});
test('explicit homebrew formula takes precedence and ambiguous names are not guessed',()=>{
 const custom={...newPlayItem('Зелье лечения'),healingFormula:'1d8+3'};
 assert.equal(healingFormulaForItem(custom),'1d8+3');assert.equal(potionPreset(custom),undefined);
 assert.equal(healingFormulaForItem(newPlayItem('Зелье лечения (неизвестное)')),undefined);
 assert.equal(potionPreset({...newPlayItem('Кольцо'),healingFormula:'2d4+2'}),undefined);
});
