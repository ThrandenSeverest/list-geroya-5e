import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateFormula } from '../app/homebrewFormula';
import { normalizeHomebrewLibrary, type HomebrewElement } from '../app/homebrew';
import { validateHomebrew } from '../app/homebrewValidation';
import { activeHomebrew, bindHomebrewLibrary, homebrewReferencesOnly, homebrewExportClosure, homebrewExportWarning, hbResources, homebrewChoiceReason } from '../app/homebrewEngine';
import { subclassTemplate, homebrewTableFeatures } from '../app/homebrewTemplates';
import { createNativeCharacterFile } from '../app/characterFiles';
import { resolveSpellSlots, shortRestSpellSlots } from '../app/multiclass';
import { spells } from '../app/catalog';
import { alwaysPreparedSpellEntries } from '../app/characterRules';
import { estimatedHitPoints, type ExportCharacter } from '../app/exportFormats';
import savant from '../app/savantExample.json';
const library=normalizeHomebrewLibrary({elements:savant as HomebrewElement[]});
const base={className:'hb:savant:class:savant',level:5,abilities:{str:10,dex:12,con:12,int:16,wis:14,cha:10},race:'human',raceVariant:'standard',background:'',classSkills:[],spells:[],feats:[],advancements:[],homebrew:{entities:[],activeIds:['hb:savant:class:savant']}} as unknown as ExportCharacter;
test('bounded formulas and rejection of code injection',()=>{
 assert.equal(evaluateFormula('max(1, @mod.int) + 2d6',{values:{'@mod.int':3}}),10);
 for(const code of ['globalThis.alert(1)','@mod.int.constructor','1 / 0','999999d6','min()'])assert.throws(()=>evaluateFormula(code,{values:{'@mod.int':3}}));
});
test('Savant library validates, has nine subclasses and portable dependency closure',()=>{
 assert.deepEqual(validateHomebrew(library.elements),[]);
 assert.equal(library.elements.filter(e=>e.type==='subclass').length,9);
 const cls=library.elements.find(e=>e.id===base.className)!;
 const pack=homebrewExportClosure(cls,library.elements);
 assert.ok(pack.some(e=>e.type==='ability'));
 assert.deepEqual(validateHomebrew(pack),[]);
 assert.deepEqual(Object.keys(subclassTemplate(cls.id,library.elements)),['3','6','10','15']);
});
test('one library supports multiple characters; play state and exports never duplicate definitions',()=>{
 const r:HomebrewElement={id:'hb:test:resource:focus',type:'resource',name:'Фокус',description:'',updatedAt:'',resources:[{id:'hb:test:resource:pool',name:'Фокус',max:3,restore:['short_rest']}]};
 const lib={elements:[...library.elements,r]};
 const a=bindHomebrewLibrary({...base,homebrew:{entities:[],activeIds:[base.className,r.id]},resourceSpent:{'hb:test:resource:pool':2}},lib);
 const b=bindHomebrewLibrary({...base,homebrew:{entities:[],activeIds:[base.className,r.id]},resourceSpent:{}},lib);
 assert.equal(hbResources(a)[0].max,3);assert.equal(b.resourceSpent?.['hb:test:resource:pool'],undefined);
 assert.deepEqual(homebrewReferencesOnly(a).homebrew?.entities,[]);
 assert.deepEqual(createNativeCharacterFile(a).character.homebrew?.entities,[]);
 assert.ok(activeHomebrew(a).some(e=>e.name==='Ускоренные рефлексы'));
 assert.match(homebrewExportWarning(a),/Класс: Савант/);
 assert.equal(homebrewExportWarning({...base,className:'fighter',homebrew:undefined}),'');
});
test('subclass templates follow 2014 parent class and PDF tables repeat headers',()=>{
 assert.deepEqual(Object.keys(subclassTemplate('official:class:fighter',[])),['3','7','10','15','18']);
 assert.deepEqual(Object.keys(subclassTemplate('official:class:wizard',[])),['2','6','10','14']);
 const table={id:'hb:test:table:progress',type:'table',name:'Развитие',description:'',updatedAt:'',table:{columns:['Уровень','Бонус'],rows:Array.from({length:20},(_,i)=>[String(i+1),'+2'])}} as HomebrewElement;
 const features=homebrewTableFeatures([table]);assert.equal(features.length,3);
 assert.ok(features.every(f=>f.description.includes('| Уровень | Бонус |')));
 assert.ok(validateHomebrew([{...table,table:{columns:['a'],rows:[['a','b']]}}]).length);
 assert.ok(validateHomebrew([null] as unknown as HomebrewElement[]).length);
});

test('inline class features belong to one reusable class and unlock at their class level',async()=>{
 const {homebrewOptions,homebrewSpells,homebrewSpellAvailable}=await import('../app/homebrewCatalog');
 const {spellSelectionRuleForClass}=await import('../app/characterRules');
 const own:HomebrewElement={id:'hb:test:class:artisan',type:'class',name:'Артизан',description:'Ремесленный класс',updatedAt:'2026-09-26',hitDie:'d8',features:[{id:'hb:test:ability:craft',name:'Ремесло',description:'Добавляет инициативу',level:2,effects:[{type:'initiative_bonus',value:2}]}],spellcasting:{mode:'full',ability:'int',selection:'known',cantrips:[0,2,2],known:[0,2,3]},spellList:['magic-missile']};
 const customSpell:HomebrewElement={id:'hb:test:spell:spark',type:'spell',name:'Искра',description:'Свет',updatedAt:'2026-09-26',level:0,school:'Воплощение',spellClasses:[own.id]};
 assert.deepEqual(validateHomebrew([own,customSpell],['official:spell:magic-missile']),[]);
 assert.equal(homebrewOptions([own],'class')[0].source,'Homebrew');
 assert.ok(homebrewSpellAvailable(own.id,homebrewSpells([customSpell])[0],[own,customSpell]));
 assert.ok(!homebrewSpellAvailable('wizard',homebrewSpells([customSpell])[0],[own,customSpell]));
 const hero=bindHomebrewLibrary({...base,className:own.id,level:2,classes:[{classId:own.id,level:2,acquiredAtCharacterLevel:1}],homebrew:{entities:[],activeIds:[]}}, {elements:[own,customSpell]});
 assert.ok(activeHomebrew(hero).some(e=>e.name==='Ремесло'));
 assert.ok(!activeHomebrew({...hero,level:1,classes:[{classId:own.id,level:1,acquiredAtCharacterLevel:1}]}).some(e=>e.name==='Ремесло'));
 assert.equal(spellSelectionRuleForClass(hero,own.id,2).leveled,3);
 assert.deepEqual(createNativeCharacterFile(hero).character.homebrew?.entities,[]);
});

test('Shaman style choices respect class level, focus and uniqueness across tiers',()=>{
 const focus:HomebrewElement={id:'hb:test:ability:focus',type:'ability',name:'Фокус Душа',description:'',updatedAt:''};
 const totem:HomebrewElement={id:'hb:test:ability:totem',type:'ability',name:'Тотем',description:'',updatedAt:'',level:5,requirements:[{type:'selected_feature',id:focus.id}]};
 const cls:HomebrewElement={id:'hb:test:class:shaman',type:'class',name:'Шаман',description:'',updatedAt:'',hitDie:'d8',spellcasting:{mode:'custom',ability:'wis',recovery:'short_or_long',slots:{'3':[0,2]}},spellGrants:[{spellId:'magic-missile',level:3,mode:'known',countsAgainstKnown:false}],choices:[{id:'focus',name:'Фокус',type:'feature',count:1,from:[focus.id],level:1},{id:'totem-1',name:'Тотем',type:'feature',count:1,from:[totem.id],level:1,choiceGroup:'totems',uniqueAcrossGroup:true},{id:'totem-2',name:'Тотем',type:'feature',count:1,from:[totem.id],level:5,choiceGroup:'totems',uniqueAcrossGroup:true}]};
 const hero=bindHomebrewLibrary({...base,className:cls.id,level:15,classes:[{classId:cls.id,level:3,acquiredAtCharacterLevel:1},{classId:'fighter',level:12,acquiredAtCharacterLevel:4}],spellSlotsUsed:[0,1],homebrew:{entities:[],activeIds:[],choices:{focus:[focus.id],'totem-1':[totem.id],'totem-2':[totem.id]}}},{elements:[cls,focus,totem]});
 assert.match(homebrewChoiceReason(hero,cls,cls.choices![1],totem,[cls,focus,totem]),/5-й уровень/);
 assert.ok(!activeHomebrew(hero).some(e=>e.id===totem.id));
 const leveled={...hero,classes:[{classId:cls.id,level:5,acquiredAtCharacterLevel:1},{classId:'fighter',level:10,acquiredAtCharacterLevel:6}]};
 assert.ok(activeHomebrew(leveled).some(e=>e.id===totem.id));
 assert.match(homebrewChoiceReason(leveled,cls,cls.choices![2],totem,[cls,focus,totem]),/Уже выбран/);
 assert.deepEqual(resolveSpellSlots(hero),[0,2]);assert.deepEqual(shortRestSpellSlots(hero),[0,0]);
 assert.equal(alwaysPreparedSpellEntries(hero,spells).find(e=>e.id==='magic-missile')?.source,'Шаман');
 assert.deepEqual(shortRestSpellSlots({...hero,homebrew:{...hero.homebrew!,entities:[{...cls,spellcasting:{...cls.spellcasting!,recovery:'long'}},focus,totem]}}),[0,1]);
 const hpFocus={...focus,effects:[{type:'hp_per_level',value:1}]};const withHp=bindHomebrewLibrary({...hero,classes:[{classId:cls.id,level:3,acquiredAtCharacterLevel:1},{classId:'fighter',level:12,acquiredAtCharacterLevel:4}]},{elements:[cls,hpFocus,totem]});
 assert.equal(estimatedHitPoints(withHp)-estimatedHitPoints({...withHp,homebrew:{...withHp.homebrew!,choices:{}}}),3);
});
