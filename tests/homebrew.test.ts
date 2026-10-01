import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateFormula } from '../app/homebrewFormula';
import { normalizeHomebrewLibrary, type HomebrewElement } from '../app/homebrew';
import { validateHomebrew } from '../app/homebrewValidation';
import { activeHomebrew, bindHomebrewLibrary, homebrewReferencesOnly, homebrewExportClosure, homebrewExportWarning, hbResources, homebrewChoiceReason, homebrewChoiceStatuses, homebrewChoicesComplete, classRuleFor, hbSum } from '../app/homebrewEngine';
import { subclassTemplate, homebrewAsiLevels, homebrewTableFeatures } from '../app/homebrewTemplates';
import { createNativeCharacterFile } from '../app/characterFiles';
import { multiclassRequirement, resolvePactMagic, resolveSpellSlots, shortRestSpellSlots } from '../app/multiclass';
import { spells } from '../app/catalog';
import { alwaysPreparedSpellEntries, optimalSpellIds } from '../app/characterRules';
import { estimatedHitPoints, type ExportCharacter } from '../app/exportFormats';
import { characterAttacks } from '../app/combat';
import { homebrewPackages } from '../app/homebrewPackages';
import savant from '../app/savantExample.json';
import shamanPack from '../app/shamanExample.json';
import { speedBreakdown } from '../app/speed';
import { characterProficiencies } from '../app/proficiencies';
import { armorClassBreakdown } from '../app/armor';
import { equipmentRule, selectedEquipment } from '../app/equipment';
import { classSpellGroups } from '../app/spellSources';
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
test('a class pack is one library work and exports reverse-linked children',()=>{
 const source={kind:'homebrew',packId:'shaman-test'};
 const cls={id:'hb:test:class:shaman',type:'class',name:'Шаман',description:'',updatedAt:'2026-09-27',hitDie:'d8',source} as HomebrewElement;
 const subclass={id:'hb:test:subclass:spirits',type:'subclass',name:'Путь духов',description:'',updatedAt:'2026-09-27',parentClassId:cls.id,source} as HomebrewElement;
 const spell={id:'hb:test:spell:seance',type:'spell',name:'Сеанс',description:'',updatedAt:'2026-09-27',spellClasses:[cls.id],level:1,source} as HomebrewElement;
 const note={id:'hb:test:note:readme',type:'note',name:'Примечание',description:'',updatedAt:'2026-09-27',references:[cls.id],source} as HomebrewElement;
 const packs=homebrewPackages([cls,subclass,spell,note]);
 assert.equal(packs.length,1);
 assert.equal(packs[0].members.length,4);
 assert.deepEqual(new Set(homebrewExportClosure(cls,[cls,subclass,spell,note]).map(e=>e.id)),new Set([cls.id,subclass.id,spell.id,note.id]));
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
 const spellCatalog=[...spells,...homebrewSpells([customSpell])];
 const customRule=spellSelectionRuleForClass(hero,own.id,2);
 const optimized=optimalSpellIds(hero,spellCatalog,spell=>homebrewSpellAvailable(own.id,spell,[own,customSpell]),customRule);
 assert.ok(optimized.includes('magic-missile'));
 assert.ok(optimized.includes(customSpell.id));
 assert.ok(activeHomebrew(hero).some(e=>e.name==='Ремесло'));
 assert.ok(!activeHomebrew({...hero,level:1,classes:[{classId:own.id,level:1,acquiredAtCharacterLevel:1}]}).some(e=>e.name==='Ремесло'));
 assert.equal(spellSelectionRuleForClass(hero,own.id,2).leveled,3);
 assert.deepEqual(createNativeCharacterFile(hero).character.homebrew?.entities,[]);
});

test('inline class feature retains its choices and actions and evaluates its class level',()=>{
 const option:HomebrewElement={id:'hb:test:ability:stance',type:'ability',name:'Стойка',description:'Усиливает защиту',updatedAt:'',effects:[{type:'ac_bonus',value:1}]};
 const cls:HomebrewElement={id:'hb:test:class:warden',type:'class',name:'Страж',description:'',updatedAt:'',hitDie:'d10',features:[{id:'hb:test:ability:stance-choice',level:2,name:'Боевой приём',description:'Выберите стойку',resources:[{id:'hb:test:resource:stance',name:'Приёмы',max:'@classLevel + @pb',restore:['short_rest']}],choices:[{id:'hb:test:choice:stance',name:'Стойка',type:'feature',count:1,from:[option.id]}],actions:[{id:'hb:test:action:stance',name:'Принять стойку',actionType:'bonus_action'}]}]};
 assert.deepEqual(validateHomebrew([cls,option]),[]);
 const hero=bindHomebrewLibrary({...base,className:cls.id,level:5,backgroundSkills:[],classes:[{classId:cls.id,level:5,acquiredAtCharacterLevel:1}],homebrew:{entities:[],activeIds:[cls.id]}},{elements:[cls,option]});
 const feature=activeHomebrew(hero).find(e=>e.id==='hb:test:ability:stance-choice')!;
 assert.equal(feature.actions?.[0].name,'Принять стойку');
 assert.deepEqual(normalizeHomebrewLibrary(JSON.parse(JSON.stringify({elements:[cls,option]}))).elements[0].features?.[0].choices,cls.features?.[0].choices);
 assert.equal(homebrewChoiceStatuses(hero).find(status=>status.choice.id==='hb:test:choice:stance')?.missing,1);
 assert.equal(hbResources(hero).find(resource=>resource.name==='Приёмы')?.max,8);
 assert.equal(classRuleFor(hero,cls.id)?.features.filter(row=>row.name==='Боевой приём').length,1);
 const low={...hero,level:1,classes:[{classId:cls.id,level:1,acquiredAtCharacterLevel:1}]};
 assert.ok(!activeHomebrew(low).some(e=>e.id===feature.id));
 assert.ok(!homebrewChoiceStatuses(low).some(status=>status.choice.id==='hb:test:choice:stance'));
});

test('Homebrew class can inherit complete official spell lists without copying every spell ID',async()=>{
 const {homebrewSpellAvailable}=await import('../app/homebrewCatalog');
 const cls:HomebrewElement={id:'hb:test:class:theurge',type:'class',name:'Теург',description:'',updatedAt:'',hitDie:'d8',spellListSources:['druid','cleric'],spellList:['magic-missile']};
 const druidSpell=spells.find(spell=>spell.classes.includes('druid')&&!spell.classes.includes('cleric'))!;
 const clericSpell=spells.find(spell=>spell.classes.includes('cleric')&&!spell.classes.includes('druid'))!;
 const wizardOnly=spells.find(spell=>spell.classes.length===1&&spell.classes[0]==='wizard'&&spell.id!=='magic-missile')!;
 assert.ok(homebrewSpellAvailable(cls.id,druidSpell,[cls]));
 assert.ok(homebrewSpellAvailable(cls.id,clericSpell,[cls]));
 assert.ok(homebrewSpellAvailable(cls.id,spells.find(spell=>spell.id==='magic-missile')!,[cls]));
 assert.equal(homebrewSpellAvailable(cls.id,wizardOnly,[cls]),false);
 assert.deepEqual(validateHomebrew([cls],['official:class:druid','official:class:cleric','official:spell:magic-missile']),[]);
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

test('real Shaman choices activate HP, saves, speed and attacks instead of manual-only cards',()=>{
 const entities=(shamanPack as {entities:HomebrewElement[]}).entities;
 const cls=entities.find(entity=>entity.id==='hb:shaman:class:shaman')!;
 const hero=bindHomebrewLibrary({...base,className:cls.id,level:5,backgroundSkills:[],classes:[{classId:cls.id,level:5,acquiredAtCharacterLevel:1}],homebrew:{entities:[],activeIds:[cls.id],choices:{'shaman-sacred-focus':['hb:shaman:ability:focus-body'],'shaman-totems-1':['hb:shaman:ability:totem-bear','hb:shaman:ability:totem-winds'],'shaman-totems-4':['hb:shaman:ability:totem-eagle']}}},{elements:entities});
 assert.equal(homebrewChoicesComplete(hero),true);
 assert.equal(homebrewChoiceStatuses({...hero,homebrew:{...hero.homebrew!,choices:{}}}).find(status=>status.choice.id==='shaman-sacred-focus')?.missing,1);
 assert.equal(estimatedHitPoints(hero)-estimatedHitPoints({...hero,homebrew:{...hero.homebrew!,choices:{...hero.homebrew!.choices,'shaman-sacred-focus':[]}}}),5);
 assert.equal(speedBreakdown(hero).walk,40);
 assert.ok(characterAttacks(hero,spells).some(attack=>attack.id==='hb:shaman:attack:bear-claw-one-hand'));
 assert.ok(characterProficiencies(hero).skills.includes('Внимательность'));
 const equipment=equipmentRule(cls.id,entities);assert.equal(equipment.groups.length,3);
 const equipped={...hero,equipmentSelections:{'shaman-weapon':['quarterstaff'],'shaman-ranged':['shortbow-arrows'],'shaman-pack':['priest-pack']}};
 assert.ok(selectedEquipment(equipped).includes('Кожаный доспех (КД 11 + Лов.)'));
 assert.ok(selectedEquipment(equipped).includes('Боевой посох'));
 const mind={...hero,homebrew:{...hero.homebrew!,choices:{...hero.homebrew!.choices,'shaman-sacred-focus':['hb:shaman:ability:focus-mind']}}};
 assert.equal(hbSum(mind,'saving_throw_bonus',effect=>effect.ability==='int'),2);
 assert.equal(hbSum(mind,'saving_throw_bonus',effect=>effect.ability==='cha'),2);
});


test('Shaman defensive totems and movement modes are mechanical',()=>{
 const entities=(shamanPack as {entities:HomebrewElement[]}).entities;
 const cls=entities.find(entity=>entity.id==='hb:shaman:class:shaman')!;
 const soul=bindHomebrewLibrary({...base,className:cls.id,level:20,inventoryOverride:'',abilities:{...base.abilities,dex:14,wis:16},classes:[{classId:cls.id,level:20,acquiredAtCharacterLevel:1}],homebrew:{entities:[],activeIds:[cls.id],choices:{'shaman-sacred-focus':['hb:shaman:ability:focus-soul'],'shaman-totems-1':['hb:shaman:ability:totem-eagle','hb:shaman:ability:totem-hound'],'shaman-totems-9':['hb:shaman:ability:totem-river'],'shaman-totems-15':['hb:shaman:ability:totem-sky']}}},{elements:entities});
 assert.equal(armorClassBreakdown(soul).value,15);
 assert.equal(speedBreakdown(soul).swim,speedBreakdown(soul).walk);
 assert.equal(speedBreakdown(soul).fly,speedBreakdown(soul).walk);
 const mountain=bindHomebrewLibrary({...soul,abilities:{...soul.abilities,con:16},homebrew:{...soul.homebrew!,choices:{...soul.homebrew!.choices,'shaman-sacred-focus':['hb:shaman:ability:focus-body'],'shaman-totems-1':['hb:shaman:ability:totem-mountain','hb:shaman:ability:totem-eagle']}}},{elements:entities});
 assert.equal(armorClassBreakdown(mountain).value,16);
});

test('Homebrew libraries dedupe stable IDs and always-prepared grants remain automatic',()=>{
 const duplicate:HomebrewElement={id:'hb:test:ability:same',type:'ability',name:'Старое',description:'',updatedAt:''};
 const newer={...duplicate,name:'Новое'};
 assert.deepEqual(normalizeHomebrewLibrary({elements:[duplicate,newer]}).elements.map(element=>element.name),['Новое']);
 const cls:HomebrewElement={id:'hb:test:class:prepared',type:'class',name:'Жрец',description:'',updatedAt:'',hitDie:'d8',spellcasting:{mode:'full',ability:'wis',selection:'prepared'},spellGrants:[{spellId:'bless',level:1,mode:'always-prepared'}]};
 const hero=bindHomebrewLibrary({...base,className:cls.id,level:3,classes:[{classId:cls.id,level:3,acquiredAtCharacterLevel:1}]},{elements:[cls]});
 assert.equal(alwaysPreparedSpellEntries(hero,spells).find(entry=>entry.id==='bless')?.mode,'always-prepared');
});

test('Homebrew class proficiency IDs render like official Russian sheet labels',()=>{
 const cls:HomebrewElement={id:'hb:test:class:shaman',type:'class',name:'Шаман',description:'',updatedAt:'',hitDie:'d8',effects:[{type:'weapon_group_proficiency',group:'simple'},{type:'weapon_proficiency',id:'blowgun'},{type:'weapon_proficiency',id:'net'}]};
 const hero=bindHomebrewLibrary({...base,className:cls.id,classes:[{classId:cls.id,level:5,acquiredAtCharacterLevel:1}]},{elements:[cls]});
 assert.equal(classRuleFor(hero,cls.id)?.weapons,'Простое оружие, Духовая трубка, Сеть');
});

test('Homebrew spell damage supports cantrip tiers and slot upcasting',async()=>{
 const cls:HomebrewElement={id:'hb:test:class:mage',type:'class',name:'Маг',description:'',updatedAt:'',hitDie:'d6',spellcasting:{mode:'full',ability:'wis'},spellList:[]};
 const cantrip:HomebrewElement={id:'hb:test:spell:spark',type:'spell',name:'Искра',description:'',updatedAt:'',level:0,spellClasses:[cls.id],spellMechanics:{delivery:'save',saveAbility:'dex',saveEffect:'half',damage:[{formula:'1d8',type:'fire'}],cantripScaling:[{level:5,damage:[{formula:'1d8',type:'fire'}]},{level:11,damage:[{formula:'1d8',type:'fire'}],effect:'Цель светится'}]}};
 const blast:HomebrewElement={id:'hb:test:spell:blast',type:'spell',name:'Взрыв',description:'',updatedAt:'',level:3,spellClasses:[cls.id],spellMechanics:{delivery:'attack',damage:[{formula:'8d6',type:'fire'}],slotScaling:{every:1,damage:[{formula:'1d6',type:'fire'}]}}};
 assert.deepEqual(validateHomebrew([cls,cantrip,blast]),[]);
 const {homebrewSpells}=await import('../app/homebrewCatalog');
 const hero=bindHomebrewLibrary({...base,className:cls.id,level:11,classes:[{classId:cls.id,level:11,acquiredAtCharacterLevel:1}],spells:[cantrip.id,blast.id]},{elements:[cls,cantrip,blast]});
 const attacks=characterAttacks(hero,homebrewSpells([cantrip,blast]));
 const spark=attacks.find(attack=>attack.id===`homebrew-spell-${cantrip.id}`)!;
 const blastAttack=attacks.find(attack=>attack.id===`homebrew-spell-${blast.id}`)!;
 assert.equal(spark.saveDc,14);assert.equal(spark.damageDisplay,'1d8 огнём + 1d8 огнём + 1d8 огнём');assert.match(spark.note||'',/Цель светится/);
 assert.equal(blastAttack.attackBonus,6);assert.equal(blastAttack.damageFormula,'8d6');assert.match(blastAttack.note||'',/\+1d6 огнём/);
});


test('Homebrew class chassis applies ASI levels, multiclass rules and pact magic like an official class',()=>{
 const cls:HomebrewElement={
  id:'hb:test:class:bladepact',type:'class',name:'Клинок договора',description:'',updatedAt:'',hitDie:'d8',
  effects:[{type:'armor_proficiency',group:'heavy'}],
  advancement:{'4':[{type:'asi_or_feat'}],'8':[{type:'asi_or_feat'}]},
  multiclass:{requirements:[{ability:'str',min:13},{ability:'dex',min:13}],requirementMode:'any',skillChoices:{count:1,from:['athletics','perception']},effects:[{type:'armor_proficiency',group:'light'},{type:'weapon_group_proficiency',group:'martial'}]},
  spellcasting:{mode:'pact',ability:'cha',selection:'known',cantrips:[0,2,2,2,3,3],known:[0,2,3,4,5,6]},
 };
 assert.deepEqual(validateHomebrew([cls]),[]);
 assert.deepEqual(homebrewAsiLevels([cls],cls.id),[4,8]);
 const hero=bindHomebrewLibrary({...base,className:'fighter',startingClassId:'fighter',level:6,backgroundSkills:[],abilities:{...base.abilities,str:8,dex:14,cha:16},classes:[{classId:'fighter',level:1,acquiredAtCharacterLevel:1},{classId:cls.id,level:5,acquiredAtCharacterLevel:2,classSkills:['Атлетика']}]},{elements:[cls]});
 assert.equal(multiclassRequirement(hero,cls.id).passed,true);
 assert.equal(multiclassRequirement({...hero,abilities:{...hero.abilities,dex:12}},cls.id).passed,false);
 assert.deepEqual(resolvePactMagic(hero),{slots:2,level:3});
 const proficiencies=characterProficiencies(hero);
 assert.ok(proficiencies.armor.includes('Лёгкие доспехи'));
 assert.ok(!proficiencies.armor.includes('Тяжёлые доспехи'));
 assert.ok(proficiencies.weapons.includes('Воинское оружие'));
});


test('Shaman subclass spells are always prepared and marked outside the known-spell limit',()=>{
 const entities=(shamanPack as {entities:HomebrewElement[]}).entities;
 const cls=entities.find(entity=>entity.id==='hb:shaman:class:shaman')!;
 const subclass=entities.find(entity=>entity.id==='hb:shaman:subclass:spirit-warrior')!;
 const hero=bindHomebrewLibrary({...base,className:cls.id,subclass:subclass.id,level:5,classes:[{classId:cls.id,subclassId:subclass.id,level:5,acquiredAtCharacterLevel:1}],homebrew:{entities:[],activeIds:[cls.id,subclass.id],choices:{}}},{elements:entities});
 const automatic=alwaysPreparedSpellEntries(hero,spells);
 assert.equal(automatic.find(entry=>entry.id==='magic-weapon')?.mode,'always-prepared');
 assert.equal(automatic.find(entry=>entry.id==='spiritual-weapon')?.mode,'always-prepared');
 const group=classSpellGroups(hero,spells).find(row=>row.classId===cls.id)!;
 assert.equal(group.spells.find(entry=>entry.spell.id==='magic-weapon')?.alwaysPrepared,true);
 assert.equal(group.spells.find(entry=>entry.spell.id==='spiritual-weapon')?.alwaysPrepared,true);
});
