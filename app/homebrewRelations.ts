import { effectTypes, newHomebrew, type HomebrewElement, type HBChoice, type HBEffect } from './homebrew';
import { magicFeatureIds, magicSpellList } from './homebrewMagic';
import { choiceFeatureIds } from './homebrewInference';
import { classes, races, backgrounds, spells } from './catalog';
import { feats } from './characterRules';
import { skillKeys } from './rules';

/** Editor-only projections. No graph metadata is written to the v2 document. */
export function editableHomebrew(elements:HomebrewElement[]):HomebrewElement[] {
 return elements.flatMap(element=>[element,...(element.features||[]).map(feature=>({...feature,type:'ability' as const,updatedAt:element.updatedAt,parentClassId:element.type==='class'?element.id:element.parentClassId}))]);
}
export function createChoiceOption(owner:HomebrewElement,choice:HBChoice,name:string):HomebrewElement {
 const type=choice.type==='feature'||choice.type==='option'?'ability':(['ability','feat','spell','item'].includes(choice.type)?choice.type:'ability');
 const option=newHomebrew(type as HomebrewElement['type'],name);
 return {...option,level:choice.level||owner.level||1,parentClassId:owner.type==='class'?owner.id:owner.parentClassId,source:owner.source,references:[owner.id]};
}
export type HBCondition={kind:'selected'|'level'|'classLevel';id?:string;level?:number};
export function conditionFormula(rows:HBCondition[],mode:'all'|'any'):string {
 return rows.map(row=>row.kind==='selected'?`hasFeature("${row.id}")`:`@${row.kind==='level'?'level':'classLevel'} >= ${row.level||1}`).join(mode==='all'?' && ':' || ');
}
export function readConditions(formula:string):{rows:HBCondition[];mode:'all'|'any'}|null {
 if(!formula.trim())return {rows:[],mode:'all'};
 if(formula.includes('&&')&&formula.includes('||'))return null;
 const mode=formula.includes('||')?'any':'all';const rows:HBCondition[]=[];
 for(const part of formula.split(mode==='all'?'&&':'||')){
  const selected=/^hasFeature\("([^"\\]+)"\)$/.exec(part.trim());
  const level=/^@(level|classLevel)\s*>=\s*(\d+)$/.exec(part.trim());
  if(selected)rows.push({kind:'selected',id:selected[1]});
  else if(level)rows.push({kind:level[1] as 'level'|'classLevel',level:Number(level[2])});else return null;
 }
 return {rows,mode};
}
export function effectLabel(effect:HBEffect,elements:HomebrewElement[]):string {
 const target=elements.find(element=>element.id===effect.id)?.name;
 const amount=effect.formula??effect.value;
 return [effectTypes[effect.type]||effect.type,target||effect.id,amount!==undefined?String(amount):'',effect.ability,effect.skill,effect.mode].filter(Boolean).join(' · ');
}
export type HBRelation={from:string;to:string;label:string;condition?:string};
export type HBRelationNode={id:string;name:string;kind:string;entityId:string;choiceId?:string};
export function homebrewRelations(elements:HomebrewElement[]){
 const flat=editableHomebrew(elements),byId=new Map(flat.map(element=>[element.id,element]));
 const officialNames=new Map([...classes.map(e=>['official:class:'+e.id,e.name]),...races.map(e=>['official:race:'+e.id,e.name]),...backgrounds.map(e=>['official:background:'+e.id,e.name]),...spells.map(e=>['official:spell:'+e.id,e.name]),...feats.map(e=>['official:feat:'+e.id,e.name]),...Object.entries(skillKeys).map(([name,row])=>[row.key,name])] as [string,string][]);
 const nodesById=new Map<string,HBRelationNode>(),edgesByKey=new Map<string,HBRelation>();
 const node=(value:HBRelationNode)=>{if(!nodesById.has(value.id))nodesById.set(value.id,value);};
 const add=(from:string,to:string,label:string,condition?:string)=>{
  if(!from||!to||from===to)return;
  const edge={from,to,label,condition};edgesByKey.set(JSON.stringify(edge),edge);
 };
 const conditions=(formula:string|number|undefined,target:string,label='Условие')=>{
  if(typeof formula!=='string')return;
  for(const match of formula.matchAll(/(hasFeature|equipped|@resource|@classLevel)\s*\(\s*["']([^"']+)["']\s*\)/g)){
   add(match[2],target,match[1]==='@resource'?'Использует значение ресурса':match[1]==='@classLevel'?'Зависит от уровня класса':label,formula);
  }
 };
 for(const element of flat){
  node({id:element.id,name:element.name,kind:element.type,entityId:element.id});
  for(const key of ['resources','attacks','actions'] as const)for(const row of element[key]||[]){
   node({id:row.id,name:row.name,kind:key,entityId:element.id});
   add(element.id,row.id,key==='resources'?'Даёт ресурс':key==='attacks'?'Даёт атаку':'Даёт действие');
   if('when' in row)conditions(row.when,row.id);
   if('max' in row)conditions(row.max,row.id);
   if('cost' in row&&row.cost)add(row.cost.resource,row.id,`Расходует ресурс: ${row.cost.amount}`);
   if('damage' in row)for(const part of row.damage)conditions(part.formula,row.id);
   if('bonus' in row)conditions(row.bonus,row.id);
   if('saveDc' in row)conditions(row.saveDc,row.id);
  }
 }
 for(const element of flat){
  if(element.spellcasting&&element.spellcasting.mode!=='none'){
   const magic=`magic:${element.id}`;
   node({id:magic,name:(element.type==='class'?'Магия класса: ':'Магия: ')+element.name,kind:'magic',entityId:element.id});
   add(element.id,magic,'Настройки магии');
   for(const id of magicFeatureIds(element))add(id,magic,'Определяет магию');
   for(const [key,name] of [['slots','Ячейки и восстановление'],['known','Известные / подготовленные заклинания'],['cantrips','Заговоры'],['list','Список доступных заклинаний']]){
    const id=`${magic}:${key}`;node({id,name,kind:'magic',entityId:element.id});add(magic,id,'Определяет');
   }
   conditions(element.spellcasting.preparedFormula,magic+':known');
   for(const spell of magicSpellList(element,elements)){
    const id=spell.id.startsWith('hb:')?spell.id:'official:spell:'+spell.id;node({id,name:spell.name,kind:'spell',entityId:id});add(magic+':list',id,'Доступно в списке класса',spell.level?`${spell.level}-й круг`:'Заговор');
   }
  }
  for(const feature of element.features||[])add(element.id,feature.id,'Даёт способность',`С ${feature.level} уровня`);
  for(const choice of element.choices||[]){
   const key=`choice:${element.id}:${choice.id}`;
   node({id:key,name:choice.name,kind:'choice',entityId:element.id,choiceId:choice.id});
   add(element.id,key,`Выбрать ${choice.count}`,`С ${choice.level||element.level||1} уровня`);
   for(const id of choiceFeatureIds(element,choice))add(id,key,`Выбрать ${choice.count}`,`С ${choice.level||1} уровня`);
   for(const id of choice.from)add(key,id,'Вариант выбора');
  }
  for(const [index,effect] of (element.effects||[]).entries()){
   const condition=effect.when||(effect.level?`С ${effect.level} уровня`:undefined);
   if(effect.type.startsWith('grant_')&&effect.id){
    add(element.id,effect.id,effectTypes[effect.type]||effect.type,condition);
    conditions(effect.when,effect.id,'Условие выдачи');
   }else{
    const key=`effect:${element.id}:${index}`;
    node({id:key,name:effectLabel(effect,flat),kind:'effect',entityId:element.id});add(element.id,key,'Даёт эффект',condition);
    conditions(effect.when,key,'Включает эффект');conditions(effect.formula??effect.value,key);
   }
   // Also expose dependent abilities, not just a terminal effect node.
   conditions(effect.when,element.id,'Включает эффект способности');
  }
  for(const requirement of element.requirements||[])add(requirement.id,element.id,'Требуется для выбора');
  for(const [level,rows] of Object.entries(element.advancement||{}))for(const row of rows){
   if(row.id){const choice=element.choices?.find(c=>c.id===row.id);add(element.id,row.type==='choice'&&choice?`choice:${element.id}:${choice.id}`:row.id,'Выдаёт',`С ${level} уровня`);}
   else if(row.type==='subclass')for(const child of elements.filter(child=>child.type==='subclass'&&child.parentClassId===element.id))add(element.id,child.id,'Выбор подкласса',`С ${level} уровня`);
  }
  for(const grant of element.spellGrants||[])add(element.id,grant.spellId,grant.mode==='always-prepared'?'Всегда подготовлено':'Даёт заклинание',`С ${grant.level} уровня`);
  for(const ref of element.references||[])add(element.id,ref,'Упоминает элемент');
  for(const ref of element.entities||[])add(element.id,ref,'В составе набора');
  for(const ref of element.spellClasses||[])add(ref,element.id,'В списке заклинаний');
  if(element.parentClassId)add(element.parentClassId,element.id,'В составе класса');
  if(element.parentRaceId)add(element.parentRaceId,element.id,'В составе расы');
  // Interactive description commands refer to resources/objects by their real IDs.
  for(const tag of (element.description||'').matchAll(/\[\[[^\]]+\]\]/g))for(const ref of tag[0].matchAll(/(?:id|resource)=["']([^"']+)["']/g))add(ref[1],element.id,'Использует в описании');
 }
 const edges=[...edgesByKey.values()];
 for(const edge of edges)for(const id of [edge.from,edge.to])if(!nodesById.has(id))node({id,name:byId.get(id)?.name||officialNames.get(id)||id,kind:'reference',entityId:id});
 return {nodes:[...nodesById.values()],edges};
}
