import { effectTypes, newHomebrew, type HomebrewElement, type HBChoice, type HBEffect } from './homebrew';

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
export type HBRelationNode={id:string;name:string;kind:string;entityId:string};
export function homebrewRelations(elements:HomebrewElement[]){
 const nodes:HBRelationNode[]=[],edges:HBRelation[]=[];
 const flat=editableHomebrew(elements),names=new Map(flat.map(element=>[element.id,element.name]));
 const add=(from:string,to:string,label:string,condition?:string)=>edges.push({from,to,label,condition});
 for(const element of flat){
  nodes.push({id:element.id,name:element.name,kind:element.type,entityId:element.id});
  for(const feature of element.features||[])add(element.id,feature.id,'Даёт способность',`С ${feature.level} уровня`);
  for(const choice of element.choices||[]){
   const key=`choice:${element.id}:${choice.id}`;
   nodes.push({id:key,name:choice.name,kind:'choice',entityId:element.id});add(element.id,key,`Выбрать ${choice.count}`,`С ${choice.level||1} уровня`);
   for(const id of choice.from)add(key,id,'Вариант выбора');
  }
  for(const [index,effect] of (element.effects||[]).entries()){
   if(effect.type.startsWith('grant_')&&effect.id)add(element.id,effect.id,effectTypes[effect.type],effect.when|| (effect.level?`С ${effect.level} уровня`:undefined));
   else {const key=`effect:${element.id}:${index}`;nodes.push({id:key,name:effectLabel(effect,flat),kind:'effect',entityId:element.id});add(element.id,key,'Даёт эффект',effect.when|| (effect.level?`С ${effect.level} уровня`:undefined));}
   for(const match of (effect.when||'').matchAll(/hasFeature\("([^"]+)"\)/g))add(match[1],element.id,'Включает эффект',effect.when);
  }
  for(const requirement of element.requirements||[])add(requirement.id,element.id,'Требуется для выбора');
  for(const [level,rows] of Object.entries(element.advancement||{}))for(const row of rows)if(row.id&&row.type!=='choice')add(element.id,row.id,'Выдаёт',`С ${level} уровня`);
  for(const grant of element.spellGrants||[])add(element.id,grant.spellId,'Даёт заклинание',`С ${grant.level} уровня`);
  for(const key of ['resources','attacks','actions'] as const)for(const row of element[key]||[]){const id=`${key}:${element.id}:${row.id}`;nodes.push({id,name:row.name,kind:key,entityId:element.id});add(element.id,id,key==='resources'?'Даёт ресурс':key==='attacks'?'Даёт атаку':'Даёт действие');}
  if(element.parentClassId)add(element.parentClassId,element.id,'В составе класса');
  if(element.parentRaceId)add(element.parentRaceId,element.id,'В составе расы');
 }
 for(const edge of edges)for(const id of [edge.from,edge.to])if(!nodes.some(node=>node.id===id))nodes.push({id,name:names.get(id)||id,kind:'reference',entityId:id});
 return {nodes,edges};
}
