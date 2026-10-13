import test from 'node:test';
import assert from 'node:assert/strict';
import { spells, type CatalogSpell } from '../app/catalog';
import type { ExportCharacter } from '../app/exportFormats';
import { createAdventureCharacter, newPlayItem, updateInventory, consumePlayItem, itemCategory, spellItemBonus, weaponItemBonus, playDerived } from '../app/adventure';
import { spellPlayProfile } from '../app/playSpells';
import { characterAttacks } from '../app/combat';
const hero=()=>createAdventureCharacter({name:'Маг',playerName:'',background:'sage',alignment:'',className:'wizard',level:5,startingClassId:'wizard',classes:[{classId:'wizard',level:5,acquiredAtCharacterLevel:1}],race:'human',raceVariant:'standard',abilities:{str:10,dex:14,con:12,int:16,wis:12,cha:10},spells:[],classSkills:[],backgroundSkills:[],currency:{gp:0,sp:0,cp:0,pp:0},inventoryOverride:'Рапира\nКинжал',personality:{traits:'',ideals:'',bonds:'',flaws:''}} as ExportCharacter,'source','date','Тест');
const spell=(id:string)=>{const s=spells.find(s=>s.id===id);assert.ok(s,id);return s;};
test('official attacks roll with casting ability, cantrips scale, saves and automatic hits cannot crit',()=>{
 const c=hero(),bolt=spellPlayProfile(c,spell('firebolt'));
 assert.equal(bolt.attackBonus,6);assert.equal(bolt.damageFormula,'2d10');assert.equal(bolt.criticalAllowed,true);
 const ball=spellPlayProfile(c,spell('fireball'),5);assert.equal(ball.delivery,'save');assert.equal(ball.saveDc,14);assert.equal(ball.saveAbility,'Ловкости');assert.equal(ball.damageFormula,'10d6');assert.equal(ball.attackBonus,undefined);assert.equal(ball.criticalAllowed,false);
 const missile=spellPlayProfile(c,spell('magic-missile'),3);assert.equal(missile.delivery,'automatic');assert.equal(missile.damageFormula,'1d4+1');assert.equal(missile.projectiles,5);assert.equal(missile.criticalAllowed,false);
 const ray=spellPlayProfile(c,spell('scorching-ray'),4);assert.equal(ray.damageFormula,'2d6');assert.equal(ray.projectiles,5);
});
test('focus bonuses require equipment and attunement, apply to attack and save DC, respect class restriction',()=>{
 let c=hero();const focus={...newPlayItem('Фокусировка +2'),category:'focus' as const,equipped:true,requiresAttunement:true,spellAttackBonus:2,spellSaveDcBonus:2,bonusClassId:'wizard'};
 c=updateInventory(c,[focus]);assert.equal(spellPlayProfile(c,spell('firebolt')).attackBonus,6);
 c=updateInventory(c,[{...focus,attuned:true}]);assert.equal(spellPlayProfile(c,spell('firebolt')).attackBonus,8);assert.equal(spellPlayProfile(c,spell('fireball')).saveDc,16);assert.equal(spellItemBonus(c,'spellAttackBonus','cleric'),0);
 c=updateInventory(c,[{...focus,attuned:true,equipped:false}]);assert.equal(spellPlayProfile(c,spell('fireball')).saveDc,14);
});
test('magic weapon applies to its own attacks including weapon cantrips, never other weapons or spell attacks',()=>{
 let c=hero();const rapier={...newPlayItem('Рапира +3'),category:'weapon' as const,weaponBase:'Рапира',equipped:true,weaponAttackBonus:3,weaponDamageBonus:3};
 c=updateInventory(c,[rapier,{...newPlayItem('Кинжал'),category:'weapon',equipped:true}]);
 assert.equal(weaponItemBonus(c,'Рапира','weaponAttackBonus'),3);assert.equal(weaponItemBonus(c,'Громовой клинок · Рапира','weaponDamageBonus'),3);assert.equal(weaponItemBonus(c,'Кинжал','weaponAttackBonus'),0);assert.equal(spellPlayProfile(c,spell('firebolt')).attackBonus,6);
 assert.ok(characterAttacks(playDerived(c),spells).some(a=>a.name==='Рапира'));
 c=updateInventory(c,[rapier,{...rapier,id:'second',weaponAttackBonus:1}]);assert.equal(weaponItemBonus(c,'Рапира','weaponAttackBonus'),3,'separate weapons do not stack');
});
test('only consumables and ammunition can be consumed, empty stacks are rejected',()=>{
 const c=hero(),rapier={...newPlayItem('Рапира'),quantity:1},potion={...newPlayItem('Зелье лечения'),quantity:2},arrows={...newPlayItem('Стрелы'),quantity:3};
 const n=updateInventory(c,[rapier,potion,arrows]);assert.equal(itemCategory(rapier),'weapon');assert.equal(itemCategory(potion),'consumable');assert.equal(itemCategory(arrows),'ammunition');assert.throws(()=>consumePlayItem(n,rapier.id));
 const used=consumePlayItem(n,potion.id);assert.equal(used.adventure!.inventory[1].quantity,1);assert.equal(n.adventure!.inventory[1].quantity,2);assert.throws(()=>consumePlayItem(consumePlayItem(used,potion.id),potion.id));
});
test('healing uses source class ability and higher slot; structured homebrew mechanics take precedence over prose',()=>{
 const c=hero();const healing=spellPlayProfile(c,spell('curewounds'),3,'cleric');assert.equal(healing.healingFormula,'3d8+1');assert.equal(healing.criticalAllowed,false);
 const custom={id:'custom',name:'HB',level:1,source:'HB',classes:['wizard'],school:'Воплощение',description:'атака заклинанием',mechanics:{delivery:'save',ability:'wis',saveAbility:'con',damage:[{formula:'1d6+@mod.spell',type:'fire'}],slotScaling:{every:1,damage:[{formula:'1d6',type:'fire'}]}}} as CatalogSpell;
 const p=spellPlayProfile(c,custom,3);assert.equal(p.delivery,'save');assert.equal(p.saveDc,12);assert.equal(p.damageFormula,'1d6+1+1d6+1d6');assert.equal(p.criticalAllowed,false);
});

test('leveled magic calculates damage without placing the spell in the attacks list or known cantrips',()=>{
 const c=hero();assert.deepEqual(c.spells,[]);
 for(const [id,slot,formula] of [['burning-hands',3,'5d6'],['inflict-wounds',2,'4d10'],['chromatic-orb',3,'5d8'],['shatter',4,'5d8'],['ice-storm',6,'4d8+4d6'],['flame-strike',7,'4d6+4d6+2d6'],['witch-bolt',3,'3d12'],['hail-of-thorns',9,'6d10'],['sleep',3,'9d8'],['false-life',3,'1d4+14']] as const){
   assert.equal(spellPlayProfile(c,spell(id),slot).damageFormula,formula,id);
 }
});
test('spell result panel shows already rolled damage without separate roll buttons',async()=>{
 const {renderToStaticMarkup}=await import('react-dom/server');
 const {createElement}=await import('react');
 const {SpellRollPanel}=await import('../app/SpellRollPanel');
 const {castPlaySpell}=await import('../app/spellCasting');
 const cast=castPlaySpell(hero(),spell('fireball'),'slot:2','wizard','normal',()=>2);
 const html=renderToStaticMarkup(createElement(SpellRollPanel,{spell:spell('fireball'),result:cast.result,onClose:()=>{}}));
 assert.match(html,/8d6/);assert.match(html,/16/);assert.match(html,/Сл/);assert.doesNotMatch(html,/Бросить урон|Критический урон/);
});
