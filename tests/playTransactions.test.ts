import test from 'node:test';
import assert from 'node:assert/strict';
import type { ExportCharacter } from '../app/exportFormats';
import { applyPlayDamage, createAdventureCharacter, logPlay, rollD20, updateInventory, newPlayItem } from '../app/adventure';
import { commitPlayChange, undoPlayChange } from '../app/playTransactions';
import { composeD20 } from '../app/rollComposer';
import { createNativeCharacterFile, parseCharacterFile } from '../app/characterFiles';
const hero = (): ExportCharacter => ({name:'Герой',playerName:'',className:'wizard',level:4,race:'human',raceVariant:'standard',background:'sage',classSkills:[],backgroundSkills:[],spells:[],abilities:{str:10,dex:14,con:14,int:16,wis:10,cha:10},alignment:'',personality:{traits:'',ideals:'',bonds:'',flaws:''},currency:{gp:10,sp:0,cp:0,pp:0},inventoryOverride:'Кинжал',currentHitPoints:20} as ExportCharacter);
const play = (): ExportCharacter => ({...createAdventureCharacter(hero(),'original','date','Поход'),currentHitPoints:20});
test('persistent undo round trips native JSON, restores HP and concentration without changing original',()=>{
 const original=play();original.adventure!.concentration={name:'Щит',duration:'1 минута'};
 const damaged=commitPlayChange(original,applyPlayDamage(original,100));
 const imported=parseCharacterFile(createNativeCharacterFile(damaged),hero()).character;
 const restored=undoPlayChange(imported);
 assert.equal(restored.currentHitPoints,20);assert.equal(restored.adventure!.concentration!.name,'Щит');assert.equal(restored.adventure!.undo!.length,0);
 assert.equal(original.adventure!.undo,undefined);assert.equal(original.currentHitPoints,20);
});
test('sequential changes undo independently, preserve notes edited outside a transaction and remove introduced fields',()=>{
 const c=play();const first=commitPlayChange(c,{...c,pactSlotsUsed:1});
 const second=commitPlayChange(first,updateInventory(first,[newPlayItem('Зелье')]));
 second.adventure!.notes='Важная записка';
 const one=undoPlayChange(second);assert.equal(one.pactSlotsUsed,1);assert.equal(one.adventure!.inventory[0].name,'Кинжал');assert.equal(one.adventure!.notes,'Важная записка');
 const two=undoPlayChange(one);assert.equal('pactSlotsUsed' in two,false);assert.equal(two.adventure!.notes,'Важная записка');
});
test('history is bounded and has no recursive snapshots; no-op changes create no entries',()=>{
 let c=play();assert.equal(commitPlayChange(c,c),c);
 for(let i=0;i<40;i++) c=commitPlayChange(c,{...c,currentHitPoints:i});
 assert.equal(c.adventure!.undo!.length,20);
 for(const entry of c.adventure!.undo!) assert.equal('undo' in entry.adventure.values,false);
 assert.ok(new TextEncoder().encode(JSON.stringify(c.adventure!.undo)).length<=512000);
});
test('undo removes the rolled event and never rerolls',()=>{
 const c=play();const r=rollD20(3,'normal',()=>20);
 const next=commitPlayChange(c,logPlay(c,'Атака',r));
 assert.equal(next.adventure!.journal[0].natural,20);
 const restored=undoPlayChange(next);assert.equal(restored.adventure!.journal.some(e=>e.formula),false);
});
test('composed roll keeps natural d20 separate from signed extra dice and temporary adjustment',()=>{
 const values=[20,3,4];const r=composeD20({bonus:5,adjustment:2,mode:'advantage',extraDice:'-1d4'},()=>values.shift()!);
 assert.equal(r.natural,20);assert.equal(r.critical,true);assert.equal(r.total,23);assert.deepEqual(r.rolls,[20,3,4]);assert.equal(values.length,0);
});
test('invalid extra formula is rejected before consuming randomness',()=>{
 let calls=0;assert.throws(()=>composeD20({bonus:0,mode:'normal',extraDice:'300d6'},()=>{calls++;return 1;}));assert.equal(calls,0);
 assert.throws(()=>composeD20({bonus:0,mode:'normal',adjustment:1.5}));
});
