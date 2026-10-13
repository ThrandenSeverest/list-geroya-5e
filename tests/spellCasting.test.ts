import test from 'node:test';
import assert from 'node:assert/strict';
import type { ExportCharacter } from '../app/exportFormats';
import { spells } from '../app/catalog';
import { createAdventureCharacter } from '../app/adventure';
import { castPlaySpell, spellCastOptions } from '../app/spellCasting';
import { commitPlayChange, undoPlayChange } from '../app/playTransactions';
const hero=()=>createAdventureCharacter({name:'Маг',className:'wizard',startingClassId:'wizard',level:7,classes:[{classId:'wizard',level:7,acquiredAtCharacterLevel:1}],race:'human',raceVariant:'standard',background:'sage',abilities:{str:10,dex:14,con:12,int:16,wis:12,cha:10},spells:[],classSkills:[],backgroundSkills:[],currency:{gp:0,sp:0,cp:0,pp:0},personality:{traits:'',ideals:'',bonds:'',flaws:''},alignment:'',playerName:''} as ExportCharacter,'source','date','Поход');
const spell=(id:string)=>spells.find(s=>s.id===id)!;
test('one cast spends one slot, rolls attack and automatically critical damage, undo restores everything',()=>{
 const c=hero();const cast=castPlaySpell(c,spell('inflict-wounds'),'slot:0','cleric','normal',s=>s);
 assert.equal(cast.character.spellSlotsUsed![0],1);assert.equal(cast.result.parts[0].attack!.natural,20);assert.equal(cast.result.parts[0].damage!.rolls.length,6);assert.equal(cast.result.parts[0].damage!.total,60);
 assert.equal(c.spellSlotsUsed,undefined);
 const saved=commitPlayChange(c,cast.character);assert.equal(saved.adventure!.undo!.length,1);
 const restored=undoPlayChange(saved);assert.equal(restored.spellSlotsUsed,undefined);assert.equal(restored.adventure!.journal.some(x=>x.formula),false);
});
test('save spells roll damage immediately with no d20 or crit; higher circle uses scaled dice',()=>{
 const cast=castPlaySpell(hero(),spell('fireball'),'slot:3','wizard','advantage',s=>s);
 assert.equal(cast.character.spellSlotsUsed![3],1);assert.equal(cast.result.parts[0].attack,undefined);assert.equal(cast.result.parts[0].damage!.rolls.length,9);assert.equal(cast.result.parts[0].damage!.total,54);assert.equal(cast.result.profile.criticalAllowed,false);
});
test('every scorching ray has its own attack and damage, but the slot is spent only once',()=>{
 const values=[20,1];const cast=castPlaySpell(hero(),spell('scorching-ray'),'slot:3','wizard','normal',s=>s===20?(values.shift()||10):2);
 assert.equal(cast.character.spellSlotsUsed![3],1);assert.equal(cast.result.parts.length,5);
 assert.equal(cast.result.parts[0].damage!.rolls.length,4);assert.equal(cast.result.parts[1].attack!.natural,1);assert.equal(cast.result.parts[1].damage,undefined);assert.equal(cast.result.parts[2].damage!.rolls.length,2);
});
test('cantrip casts need no slot; healing rolls automatically and does not assume target is caster',()=>{
 const c=hero();const bolt=castPlaySpell(c,spell('firebolt'),'cantrip','wizard','normal',()=>2);
 assert.equal(bolt.character.spellSlotsUsed,undefined);assert.equal(bolt.result.parts[0].damage!.rolls.length,2);
 const healing=castPlaySpell(c,spell('curewounds'),'slot:2','cleric','normal',()=>3);
 assert.equal(healing.result.parts[0].healing!.total,10);assert.equal(healing.character.currentHitPoints,c.currentHitPoints);
});
test('unavailable or invalid cast rejects without cost, concentration changes, or random rolls',()=>{
 const c=hero();c.adventure!.concentration={name:'Старое',duration:'1 минута'};c.spellSlotsUsed=[4,3,3,1];let calls=0;
 assert.throws(()=>castPlaySpell(c,spell('fireball'),'slot:2','wizard','normal',()=>{calls++;return 1;}));
 assert.throws(()=>castPlaySpell(c,spell('fireball'),'slot:0'));
 c.spellSlotsUsed=[];
 assert.throws(()=>castPlaySpell(c,spell('fireball'),'slot:2','wizard','normal',()=>{calls++;return 1;},'alert(1)'));
 assert.equal(calls,0);assert.deepEqual(c.spellSlotsUsed,[]);assert.equal(c.adventure!.concentration.name,'Старое');
});
test('pact casting spends pact slots and replaces concentration atomically',()=>{
 const c=hero();c.classes=[{classId:'warlock',level:7,acquiredAtCharacterLevel:1}];c.className='warlock';c.startingClassId='warlock';c.adventure!.concentration={name:'Старое',duration:'1 час'};
 assert.ok(spellCastOptions(c,spell('witch-bolt'),'warlock').some(o=>o.id==='pact'));
 const cast=castPlaySpell(c,spell('witch-bolt'),'pact','warlock','normal',()=>2);
 assert.equal(cast.character.pactSlotsUsed,1);assert.equal(cast.character.spellSlotsUsed,undefined);assert.equal(cast.character.adventure!.concentration!.name,spell('witch-bolt').name);
 const restored=undoPlayChange(commitPlayChange(c,cast.character));assert.equal(restored.pactSlotsUsed,undefined);assert.equal(restored.adventure!.concentration!.name,'Старое');
});
