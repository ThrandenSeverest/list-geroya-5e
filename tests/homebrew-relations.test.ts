import test from 'node:test';
import assert from 'node:assert/strict';
import { newHomebrew, normalizeHomebrewLibrary, type HomebrewElement } from '../app/homebrew';
import { conditionFormula, readConditions, createChoiceOption, homebrewRelations } from '../app/homebrewRelations';
import { activeHomebrew, hbSum, homebrewExportClosure, homebrewChoiceStatuses } from '../app/homebrewEngine';
import { homebrewPackages } from '../app/homebrewPackages';
import { validateHomebrew } from '../app/homebrewValidation';
import type { ExportCharacter } from '../app/exportFormats';
const entity=(type:HomebrewElement['type'],name:string)=>newHomebrew(type,name);
const hero=(elements:HomebrewElement[],root:HomebrewElement,choices:Record<string,string[]>,level=5)=>({className:root.type==='class'?root.id:'fighter',level,classes:[{classId:root.type==='class'?root.id:'fighter',level,acquiredAtCharacterLevel:1}],abilities:{str:10,dex:10,con:10,int:10,wis:14,cha:10},homebrew:{entities:elements,activeIds:[root.id],choices}} as unknown as ExportCharacter);
test('inline choices belong to each root type and export in the existing v2 shape',()=>{
 for(const type of ['feat','race','subrace','background','item','ability','subclass'] as const){
  const root=entity(type,'Источник'),choice={id:'hb:test:ability:choice',name:'Фокус',type:'ability',count:1,from:[] as string[]};
  const option=createChoiceOption(root,choice,'Тело');root.choices=[{...choice,from:[option.id]}];
  const elements=[root,option],roundtrip=normalizeHomebrewLibrary(JSON.parse(JSON.stringify({elements})));
  assert.equal(JSON.stringify(roundtrip.elements),JSON.stringify(normalizeHomebrewLibrary({elements}).elements));
  assert.deepEqual(validateHomebrew(elements),[]);
  assert.equal(homebrewPackages(elements).length,1);
  assert.equal(homebrewExportClosure(root,elements).length,2);
  assert.ok(activeHomebrew(hero(elements,root,{[choice.id]:[option.id]})).some(row=>row.id===option.id));
 }
});
test('nested class choices activate effects, nested choices and conditional grants',()=>{
 const root=entity('class','Шаман'),focus=entity('ability','Тело'),dependent=entity('ability','Тотем');
 const featureId='hb:test:ability:focus',choiceId='hb:test:ability:focus-choice';
 root.features=[{id:featureId,name:'Фокус',level:1,description:'',choices:[{id:choiceId,name:'Фокус',type:'ability',count:1,from:[focus.id]}]}];
 focus.effects=[{type:'ac_bonus',value:1}];focus.choices=[{id:'hb:test:ability:nested',name:'Вложенный выбор',type:'ability',count:1,from:[dependent.id]}];
 dependent.effects=[{type:'ac_bonus',value:2}];dependent.requirements=[{type:'selected_feature',id:focus.id}];
 root.effects=[{type:'hp_bonus',value:7,when:`hasFeature("${focus.id}") && @classLevel >= 5`}];
 const c=hero([root,focus,dependent],root,{[choiceId]:[focus.id],'hb:test:ability:nested':[dependent.id]});
 assert.equal(hbSum(c,'ac_bonus'),3);assert.equal(hbSum(c,'hp_bonus'),7);
 assert.ok(homebrewChoiceStatuses(c).every(status=>status.missing===0));
 assert.equal(hbSum({...c,level:3,classes:[{...c.classes![0],level:3}]},'hp_bonus'),0);
});
test('obsolete selections in closed or future branches do not satisfy prerequisites',()=>{
 const root=entity('class','Шаман'),body=entity('ability','Тело'),mind=entity('ability','Разум'),totem=entity('ability','Тотем тела');
 root.choices=[{id:'hb:test:ability:focus',name:'Фокус',type:'ability',count:1,from:[body.id,mind.id]},{id:'hb:test:ability:totem',name:'Тотем',type:'ability',count:1,from:[totem.id]}];
 totem.requirements=[{type:'selected_feature',id:body.id}];totem.effects=[{type:'ac_bonus',value:8}];
 const c=hero([root,body,mind,totem],root,{'hb:test:ability:focus':[body.id],'hb:test:ability:totem':[totem.id]});
 assert.equal(hbSum(c,'ac_bonus'),8);
 const changed={...c,homebrew:{...c.homebrew!,choices:{...c.homebrew!.choices,'hb:test:ability:focus':[mind.id]}}};
 assert.equal(hbSum(changed,'ac_bonus'),0);assert.equal(homebrewChoiceStatuses(changed).find(status=>status.choice.name==='Тотем')?.missing,1);
 body.level=10;assert.equal(hbSum(c,'ac_bonus'),0);
});
test('relation graph is derived and preserves IDs across rename and nested references',()=>{
 const root=entity('class','Шаман'),option=entity('ability','Тело');
 root.features=[{id:'hb:test:ability:focus',name:'Фокус',level:1,description:'',choices:[{id:'hb:test:ability:choice',name:'Фокус',type:'ability',count:1,from:[option.id]}]}];
 option.requirements=[{type:'selected_feature',id:root.features[0].id}];
 assert.deepEqual(validateHomebrew([root,option]),[]);
 const graph=homebrewRelations([root,option]);
 assert.ok(graph.edges.some(edge=>edge.to===option.id&&edge.label==='Вариант выбора'));
 option.name='Новое имя';assert.equal(homebrewRelations([root,option]).nodes.find(node=>node.id===option.id)?.name,'Новое имя');
 option.requirements=[{type:'selected_feature',id:option.id}];assert.ok(validateHomebrew([root,option]).some(problem=>problem.message.includes('Циклическое требование')));
});
test('condition builder round-trips supported all/any conditions and preserves complex formulas',()=>{
 const rows=[{kind:'selected' as const,id:'hb:test:ability:focus'},{kind:'classLevel' as const,level:5}];
 for(const mode of ['all','any'] as const)assert.deepEqual(readConditions(conditionFormula(rows,mode)),{rows,mode});
 assert.equal(readConditions('equipped(@source) && @level > 3'),null);
});
