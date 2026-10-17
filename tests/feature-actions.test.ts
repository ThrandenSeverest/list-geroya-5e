import test from 'node:test';
import assert from 'node:assert/strict';
import type { ExportCharacter } from '../app/exportFormats';
import { advancePlayTurn, createAdventureCharacter, newPlayItem, restPlay } from '../app/adventure';
import { spendFeatureResource, startManualConcentration } from '../app/featureActions';
import { spellHandsWarning } from '../app/spellCasting';
import { commitPlayChange, undoPlayChange } from '../app/playTransactions';
import type { CatalogSpell } from '../app/catalog';
const hero=(className='bard')=>createAdventureCharacter({name:'Эльрин',className,level:5,startingClassId:className,classes:[{classId:className,level:5,acquiredAtCharacterLevel:1}],race:'human',raceVariant:'standard',abilities:{str:10,dex:14,con:14,int:16,wis:10,cha:16},background:'',classSkills:[],backgroundSkills:[],spells:[],alignment:'',playerName:'',currency:{gp:0,sp:0,cp:0,pp:0},personality:{traits:'',ideals:'',bonds:'',flaws:''},currentHitPoints:20} as ExportCharacter,'source','date','Тест');
test('manual concentration converts rounds, minutes and hours and expires at the exact turn',()=>{
 for(const [n,unit,rounds] of [[10,'round',10],[1,'minute',10],[1,'hour',600]] as const){
  let c=startManualConcentration(hero(),'Эффект',n,unit);
  assert.equal(c.adventure!.concentration!.remainingMinutes,rounds/10);
  for(let i=1;i<rounds;i++)c=advancePlayTurn(c);
  assert.ok(c.adventure!.concentration);
  c=advancePlayTurn(c);assert.equal(c.adventure!.concentration,undefined);
 }
 const c=startManualConcentration(hero(),'Без срока');assert.equal(advancePlayTurn(c).adventure!.concentration?.remainingMinutes,undefined);
 const next=startManualConcentration(c,'Другой',2,'hour');assert.equal(restPlay(next,'short').adventure!.concentration?.remainingMinutes,60);
 assert.throws(()=>startManualConcentration(c,'',0));assert.throws(()=>startManualConcentration(c,'',NaN));
});
test('bardic inspiration spends one class resource and a bonus action, without rolling for the ally; undo restores both',()=>{
 const c=hero(),next=spendFeatureResource(c,'bardic-inspiration');
 assert.equal(next.resourceSpent!['bardic-inspiration'],1);assert.equal(next.adventure!.turn.bonus,true);assert.equal(next.adventure!.turn.action,false);
 assert.match(next.adventure!.journal[0].text,/к8/);assert.equal(next.adventure!.journal[0].rolls,undefined);
 const restored=undoPlayChange(commitPlayChange(c,next));assert.equal(restored.resourceSpent?.['bardic-inspiration']||0,0);assert.equal(restored.adventure!.turn.bonus,false);
 assert.throws(()=>spendFeatureResource({...c,resourceSpent:{'bardic-inspiration':3}},'bardic-inspiration'));
 assert.throws(()=>spendFeatureResource(hero('wizard'),'bardic-inspiration'));
});
test('rage activation spends resource, starts timed effect and ends concentration',()=>{
 const c=startManualConcentration(hero('barbarian'),'Эффект');const next=spendFeatureResource(c,'rage');
 assert.equal(next.adventure!.concentration,undefined);assert.equal(next.adventure!.effects.find(e=>e.name==='Ярость')?.remaining,10);assert.equal(next.adventure!.turn.bonus,true);
});
test('held instruments focus bard spells; wooden staves and clubs focus wizard spells; somatic-only spells still need a free hand',()=>{
 const spell={components:'В, С, М'} as CatalogSpell;
 const equipped=(className:string,name:string)=>{const c=hero(className);c.adventure!.inventory=[{...newPlayItem(name),category:className==='bard'?'gear':'weapon',equipped:true,hands:1},{...newPlayItem('Щит'),equipped:true,hands:1}];return c;};
 const bard=equipped('bard','Лютня');assert.equal(spellHandsWarning(bard,spell,'bard'),undefined);
 assert.match(spellHandsWarning(bard,spell,'wizard')!,/свободная рука/);
 assert.match(spellHandsWarning(bard,{components:'В, С'} as CatalogSpell)!,/соматического/);
 for(const name of ['Боевой посох','Дубинка','Деревянная палочка','Ветка'])assert.equal(spellHandsWarning(equipped('wizard',name),spell),undefined);
 assert.match(spellHandsWarning(equipped('wizard','Рапира'),spell)!,/свободная рука/);
 const branch=equipped('wizard','Ветка');branch.adventure!.inventory[0].category='gear';branch.adventure!.inventory[0].hands=undefined;assert.equal(spellHandsWarning(branch,spell),undefined);
 bard.adventure!.inventory[0].equipped=false;assert.match(spellHandsWarning(bard,spell)!,/фокусировка/);
});
