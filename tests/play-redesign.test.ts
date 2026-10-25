import test from 'node:test';
import assert from 'node:assert/strict';
import type {ExportCharacter} from '../app/exportFormats';
import {characterAttacks} from '../app/combat';
import {createAdventureCharacter,applyPlayDamage,healPlay,playDerived} from '../app/adventure';
import {commitPlayChange,undoPlayChange} from '../app/playTransactions';
import {createNativeCharacterFile,parseCharacterFile} from '../app/characterFiles';
import {healthAmount} from '../app/QuickHealth';
import {normalizePlayView} from '../app/playViewPreferences';
const hero=():ExportCharacter=>({name:'Проверка',playerName:'',alignment:'',className:'fighter',level:4,race:'human',raceVariant:'standard',background:'sage',classSkills:[],backgroundSkills:[],spells:[],abilities:{str:16,dex:12,con:14,int:10,wis:10,cha:8},personality:{traits:'',ideals:'',bonds:'',flaws:''},currency:{gp:0,sp:0,cp:0,pp:0},inventoryOverride:'Длинный меч'});
test('quick health damage, concentration, cap and undo use existing transactions',()=>{
 const c={...createAdventureCharacter(hero(),'source','date','Тест'),currentHitPoints:27,temporaryHitPoints:5};c.adventure!.hpMaximum=38;c.adventure!.concentration={name:'Тест',duration:'1 минута'};
 const damaged=commitPlayChange(c,applyPlayDamage(c,healthAmount('8')));
 assert.equal(damaged.currentHitPoints,24);assert.equal(damaged.temporaryHitPoints,0);assert.equal(damaged.adventure!.concentrationChecks.length,1);
 const restored=undoPlayChange(damaged);assert.equal(restored.currentHitPoints,27);assert.equal(restored.temporaryHitPoints,5);assert.equal(restored.adventure!.concentrationChecks.length,0);
 assert.equal(healPlay(damaged,healthAmount('100')).currentHitPoints,38);
 for(const value of ['','-1','1.1','abc','Infinity','1e2','9999999'])assert.throws(()=>healthAmount(value));
});
test('attack customizations recompute with ability and proficiency and survive native export',()=>{
 const c=hero();const base=characterAttacks(c,[]).find(x=>x.id.endsWith('-one-hand'))!;assert.ok(base);
 c.attackCustomizations={[base.id]:{name:'Мой клинок',ability:'dex',proficient:false,bonus:-1,damageFormula:'1d8+[DEX]',note:'Особое правило',damageType:'рубящий'}};
 let attack=characterAttacks(c,[]).find(x=>x.id===base.id)!;assert.equal(attack.attackBonus,0);assert.equal(attack.sourceName,base.name);assert.equal(attack.note,'Особое правило');
 c.abilities.dex=18;c.level=9;c.attackCustomizations[base.id].proficient=true;
 attack=characterAttacks(c,[]).find(x=>x.id===base.id)!;assert.equal(attack.attackBonus,7);assert.equal(attack.damageDisplay,'1d8+4 · рубящий');
 const imported=parseCharacterFile(JSON.parse(JSON.stringify(createNativeCharacterFile(c))),hero()).character;
 assert.deepEqual(imported.attackCustomizations,c.attackCustomizations);
 const play=createAdventureCharacter(imported,'source','date','Тест');assert.deepEqual(play.attackCustomizations,c.attackCustomizations);
 assert.equal(characterAttacks(playDerived(play),[]).find(x=>x.id===base.id)!.attackBonus,7);
});
test('invalid view settings recover without touching character data',()=>{
 assert.deepEqual(normalizePlayView({density:'huge',hiddenBlocks:['turn','unknown'],hints:'unknown',sessionPanels:{actions:true,spells:'bad'},layout:'bad'}),{density:undefined,hints:'brief',hiddenBlocks:['turn'],sessionPanels:{actions:true},layout:'columns'});
});
