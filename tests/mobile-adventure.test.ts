import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdventureCharacter, playMaximum, restPlay, upgradeLegacyInventory, newPlayItem, consumePlayItem } from '../app/adventure';
import { armorClassBreakdown } from '../app/armor';
import { equipmentPacks } from '../app/equipmentPacks';
import type { ExportCharacter } from '../app/exportFormats';
const hero=():ExportCharacter=>({name:'Проверка',playerName:'',className:'monk',level:4,race:'human',raceVariant:'standard',background:'',abilities:{str:10,dex:14,con:14,int:10,wis:16,cha:10},classSkills:[],backgroundSkills:[],spells:[],currency:{gp:0,sp:0,cp:0,pp:0},personality:{traits:'',ideals:'',bonds:'',flaws:''},alignment:'',inventoryOverride:'Набор путешественника',currentHitPoints:0,temporaryHitPoints:5,deathSaveFailures:2} as ExportCharacter);
test('new adventure starts with full HP and cleared death saves without mutating the source',()=>{
 const original=hero(),c=createAdventureCharacter(original,'source','date','Тест');
 assert.equal(c.currentHitPoints,playMaximum(c));assert.equal(c.deathSaveFailures,0);assert.equal(c.temporaryHitPoints,0);assert.equal(original.currentHitPoints,0);
});
test('zero-HP long rest requires explicit consciousness confirmation and then heals',()=>{
 const c=createAdventureCharacter(hero(),'s','d','Тест');c.currentHitPoints=0;
 assert.throws(()=>restPlay(c,'long'),/в сознании/);
 const healed=restPlay(c,'long',{},undefined,true);assert.equal(healed.currentHitPoints,playMaximum(c));
 assert.equal(c.currentHitPoints,0);
});
test('every starting pack expands once; rations consume one at a time and migration keeps HP',()=>{
 for (const name of Object.keys(equipmentPacks)) {
  let c=createAdventureCharacter(hero(),'s','d','Тест');c.currentHitPoints=0;
  c.adventure!.inventory=[{...newPlayItem(name),quantity:2}];c.adventure!.inventoryCatalogVersion=2;
  c=upgradeLegacyInventory(c);assert.equal(c.currentHitPoints,0);assert.equal(c.adventure!.inventory.length,equipmentPacks[name].length);
  assert.deepEqual(upgradeLegacyInventory(c),c);
  const ration=c.adventure!.inventory.find(i=>i.name==='Рацион');
  if(ration){assert.ok(ration.quantity>=4);const consumed=consumePlayItem(c,ration.id);assert.equal(consumed.adventure!.inventory.find(i=>i.id===ration.id)!.quantity,ration.quantity-1);}
 }
});
test('AC explains why worn armor and shield disable monk unarmored defense',()=>{
 const c=createAdventureCharacter({...hero(),inventoryOverride:'Кольчуга\nЩит',classChoices:{'fighting-style':['defense']}},'s','d','Тест');
 const ac=armorClassBreakdown(c);assert.equal(ac.value,19);assert.match(ac.bonuses.join(' '),/щит.*Оборона/);assert.match(ac.conditions.join(' '),/монаха недоступна.*доспех.*щит/);
});
