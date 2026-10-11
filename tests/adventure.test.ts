import test from 'node:test';
import assert from 'node:assert/strict';
import type { ExportCharacter } from '../app/exportFormats';
import { applyDeathSave, applyPlayDamage, createAdventureCharacter, healPlay, itemBonus, newPlayItem, playMaximum, queueAttunement, restPlay, rollD20, rollDice, toggleCondition, updateInventory } from '../app/adventure';
import { bindHomebrewLibrary, homebrewReferencesOnly } from '../app/homebrewEngine';
import { createNativeCharacterFile, parseCharacterFile } from '../app/characterFiles';
const hero = (): ExportCharacter => ({ name:'Эльрин', playerName:'', className:'wizard', level:4, race:'human', raceVariant:'standard', background:'sage', classSkills:[], backgroundSkills:[], spells:['shield'], abilities:{str:10,dex:14,con:14,int:16,wis:10,cha:10}, alignment:'', personality:{traits:'',ideals:'',bonds:'',flaws:''}, currency:{gp:10,sp:0,cp:0,pp:0}, inventoryOverride:'Кинжал ×2\nПосох', spellSlotsUsed:[2,1], resourceSpent:{}, currentHitPoints:20, rulesetId:'5e-2014' } as ExportCharacter);
const play = () => createAdventureCharacter(hero(),'original','2026-10-10','Поход');
test('adventure deep copy and native round trip preserve separate play state',()=>{
 const original=hero();const c=createAdventureCharacter(original,'original','date','Поход');
 c.currency.gp=0;c.adventure!.inventory[0].quantity=0;c.adventure!.notes='Записка';
 assert.equal(original.currency.gp,10);assert.equal(original.inventoryOverride,'Кинжал ×2\nПосох');assert.equal(original.adventure,undefined);
 const parsed=parseCharacterFile(createNativeCharacterFile(c),hero()).character;
 assert.equal(parsed.adventure!.sourceId,'original');assert.equal(parsed.adventure!.notes,'Записка');assert.equal(parsed.adventure!.inventory[0].quantity,0);
 assert.deepEqual(parsed.abilities,c.abilities);
});
test('frozen homebrew survives save/export and ignores subsequent shared library changes',()=>{
 const c=play();c.homebrew={entities:[],activeIds:[]};
 assert.equal(bindHomebrewLibrary(c,{elements:[{id:'future'} as never]}),c);
 assert.equal(homebrewReferencesOnly(c),c);
});
test('damage applies resistance before temporary HP and concentration check uses full damage',()=>{
 const c=play();c.temporaryHitPoints=5;c.adventure!.concentration={name:'Тест',duration:'1 минута'};
 const next=applyPlayDamage(c,25,'resistance');
 assert.equal(next.currentHitPoints,13);assert.equal(next.temporaryHitPoints,0);assert.equal(next.adventure!.concentrationChecks[0].damage,12);assert.equal(next.adventure!.concentrationChecks[0].dc,10);assert.equal(c.currentHitPoints,20);
 const stopped=applyPlayDamage(next,100);assert.equal(stopped.currentHitPoints,0);assert.equal(stopped.adventure!.concentration,undefined);assert.deepEqual(stopped.adventure!.concentrationChecks,[]);
 assert.equal(healPlay(stopped,100).currentHitPoints,playMaximum(c));
});
test('immune damage creates no concentration check; separate hits queue separate checks',()=>{
 const c=play();c.adventure!.concentration={name:'Тест',duration:''};
 assert.equal(applyPlayDamage(c,200,'immune').adventure!.concentrationChecks.length,0);
 const next=applyPlayDamage(applyPlayDamage(c,1),2);assert.equal(next.adventure!.concentrationChecks.length,2);
 assert.equal(toggleCondition(next,'Парализован').adventure!.concentration,undefined);
});
test('dice parser doubles only dice on crit and rejects expressions and excessive dice',()=>{
 assert.deepEqual(rollDice('2d6+3',()=>4,true),{formula:'2d6+3 (крит: кости ×2)',rolls:[4,4,4,4],total:19});
 assert.equal(rollDice('1к8-2',()=>5).total,3);assert.equal(rollDice('1d6 + -1',()=>4).total,3);
 for(const formula of ['1d20;alert(1)','9999d6','1d1','0d6','2**4','1d6+1000001'])assert.throws(()=>rollDice(formula));
 const values=[2,19];assert.equal(rollD20(3,'advantage',()=>values.shift()!).total,22);
});
test('attunement completes only after short rest, enforces one item and active bonus',()=>{
 let c=play();const i={...newPlayItem('Кольцо защиты'),requiresAttunement:true,magical:true,equipped:true,acBonus:1};const other={...newPlayItem('Амулет'),requiresAttunement:true};
 c=updateInventory(c,[i,other]);assert.equal(itemBonus(c,'acBonus'),0);
 c=queueAttunement(c,i.id);assert.equal(c.adventure!.inventory[0].attuned,false);assert.throws(()=>queueAttunement(c,other.id));
 c=restPlay(c,'short');assert.equal(c.adventure!.inventory[0].attuned,true);assert.equal(itemBonus(c,'acBonus'),1);
 c=updateInventory(c,[...c.adventure!.inventory,{...newPlayItem(i.name),requiresAttunement:true}]);assert.throws(()=>queueAttunement(c,c.adventure!.inventory[2].id));
 c.adventure!.inventory[0].cursed=true;assert.throws(()=>queueAttunement(c,i.id));
});
test('multiclass short rest spends selected class dice, preserves normal slots and restores pact',()=>{
 const c=play();c.classes=[{classId:'wizard',level:2,acquiredAtCharacterLevel:1},{classId:'warlock',level:2,acquiredAtCharacterLevel:3}];c.currentHitPoints=1;c.pactSlotsUsed=2;
 const n=restPlay(c,'short',{wizard:1,warlock:1},sides=>sides);
 assert.deepEqual(n.hitDiceSpentByClass,{wizard:1,warlock:1});assert.equal(n.currentHitPoints,19);assert.deepEqual(n.spellSlotsUsed,[2,1]);assert.equal(n.pactSlotsUsed,0);
 assert.equal(restPlay(n,'long').currentHitPoints,playMaximum(n));assert.deepEqual(restPlay(n,'long').spellSlotsUsed,[0]);
});
test('long rest recovers half the hit dice in 2014, all in 2024; dawn charges remain manual',()=>{
 const c=play();c.hitDiceSpentByClass={wizard:4};c.adventure!.inventory=[{...newPlayItem('Жезл'),charges:0,maxCharges:7,recharge:'dawn'}];
 const n=restPlay(c,'long');assert.equal(n.hitDiceSpentByClass!.wizard,2);assert.equal(n.adventure!.inventory[0].charges,0);
 c.rulesetId='5e-2024';assert.equal(restPlay(c,'long').hitDiceSpentByClass!.wizard,0);
});
test('death saves handle natural 1 and 20 and damage ends stability',()=>{
 const c=play();c.currentHitPoints=0;c.deathSaveSuccesses=3;
 const n=applyPlayDamage(c,1);assert.equal(n.deathSaveSuccesses,0);assert.equal(n.deathSaveFailures,1);
 assert.equal(applyDeathSave(n,1).deathSaveFailures,3);const healed=applyDeathSave(n,20);assert.equal(healed.currentHitPoints,1);assert.equal(healed.deathSaveFailures,0);
});

test('short rest preserves long concentration and expires short concentration',()=>{
 const c=play();c.adventure!.concentration={name:'Сглаз',duration:'Концентрация, до 24 часов'};
 assert.equal(restPlay(c,'short').adventure!.concentration!.remainingMinutes,1380);
 c.adventure!.concentration={name:'Благословение',duration:'Концентрация, до 1 минуты'};
 assert.equal(restPlay(c,'short').adventure!.concentration,undefined);
});
