import test from 'node:test';
import assert from 'node:assert/strict';
import { newHomebrew, normalizeHomebrewLibrary, type HomebrewElement } from '../app/homebrew';
import { conditionFormula, readConditions, createChoiceOption, homebrewRelations } from '../app/homebrewRelations';
import { choicesForFeature, linkedChoicesForFeature } from '../app/homebrewInference';
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
 option.requirements=[{type:'selected_feature',id:root.features![0].id}];
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

test('legacy Shaman sacred focus automatically connects all four options and their dependent totems',async()=>{
 const {default:example}=await import('../app/shamanExample.json');
 const elements=example.entities as HomebrewElement[],before=JSON.stringify(elements),graph=homebrewRelations(elements);
 const root=elements.find(row=>row.type==='class')!,feature=root.features!.find(row=>row.name==='Сакральный фокус')!,choice=root.choices!.find(row=>row.name==='Сакральный фокус')!;
 const node=`choice:${root.id}:${choice.id}`;
 assert.ok(graph.edges.some(edge=>edge.from===feature.id&&edge.to===node));
 assert.deepEqual(graph.edges.filter(edge=>edge.from===node&&edge.label==='Вариант выбора').map(edge=>edge.to),choice.from);
 assert.equal(choice.from.length,4);
 for(const id of choice.from)assert.ok(graph.edges.some(edge=>edge.from===id&&edge.label==='Требуется для выбора'));
 assert.equal(JSON.stringify(elements),before);
});
test('choice-feature associations are shared by graph and editor, scoped to their owner across every type',()=>{
 for(const type of ['class','subclass','race','subrace','feat','background','ability','item','spell'] as const){
  const root=entity(type,'Источник'),other=entity(type,'Другой источник'),body=entity('ability','Тело');
  root.features=[{id:root.id+'-focus',name:'Сакральный фокус',level:1,description:''}];
  other.features=[{id:other.id+'-focus',name:'Сакральный фокус',level:1,description:''}];
  root.choices=[{id:'focus-stage-1',name:'Сакральный фокус — выбор на 1-м уровне',count:1,type:'ability',from:[body.id]}];
  const graph=homebrewRelations([root,other,body]),node=`choice:${root.id}:focus-stage-1`;
  assert.ok(graph.edges.some(edge=>edge.from===root.features![0].id&&edge.to===node),type);
  assert.ok(!graph.edges.some(edge=>edge.from===other.features![0].id&&edge.to===node),type);
 }
});

test('feature choice projection keeps inline and legacy-linked stages in one automatic view',()=>{
 const root=entity('class','Шаман'),body=entity('ability','Тело'),mind=entity('ability','Разум');
 const feature={id:'hb:test:ability:focus',name:'Сакральный фокус',level:1,description:'',choices:[{id:'hb:test:choice:nested',name:'Углубление фокуса',type:'ability',count:1,from:[mind.id],level:5}]};
 root.features=[feature];root.choices=[{id:'hb:test:choice:root',name:'Сакральный фокус',type:'ability',count:1,from:[body.id],level:1}];
 assert.deepEqual(linkedChoicesForFeature(root,feature.id).map(choice=>choice.id),['hb:test:choice:root']);
 assert.deepEqual(choicesForFeature(root,feature).map(choice=>choice.id),['hb:test:choice:nested','hb:test:choice:root']);
});
test('conditions, resource costs, progression choices and explicit references expose actual dependencies',()=>{
 const root=entity('feat','Черта'),focus=entity('ability','Фокус'),dependent=entity('ability','Усиление'),resource='hb:test:resource:charges',attack='hb:test:attack:beam';
 root.resources=[{id:resource,name:'Заряды',max:`1 + hasFeature('${focus.id}')`,restore:['long']}];
 root.attacks=[{id:attack,name:'Луч',ability:'wis',proficient:true,damage:[{formula:`@resource('${resource}').current`,type:'force'}],cost:{resource,amount:2},when:`hasFeature('${focus.id}')`}];
 root.choices=[{id:'focus',name:'Фокус',count:1,type:'ability',from:[focus.id]}];root.advancement={'3':[{type:'choice',id:'focus'}]};
 dependent.effects=[{type:'ac_bonus',value:1,when:`hasFeature('${focus.id}')`}];
 dependent.references=[root.id];
 const graph=homebrewRelations([root,focus,dependent]);
 assert.ok(graph.edges.some(edge=>edge.from===resource&&edge.to===attack&&edge.label.includes('Расходует')));
 assert.ok(graph.edges.some(edge=>edge.from===focus.id&&edge.to===resource));
 assert.ok(graph.edges.some(edge=>edge.from===focus.id&&edge.to===dependent.id));
 assert.ok(graph.edges.some(edge=>edge.from===root.id&&edge.to===`choice:${root.id}:focus`&&edge.condition==='С 3 уровня'));
 assert.equal(graph.nodes.find(node=>node.id===resource)?.name,'Заряды');
 assert.ok(graph.edges.some(edge=>edge.from===dependent.id&&edge.to===root.id));
 assert.equal(new Set(graph.nodes.map(node=>node.id)).size,graph.nodes.length);
 assert.equal(new Set(graph.edges.map(edge=>JSON.stringify(edge))).size,graph.edges.length);
});
