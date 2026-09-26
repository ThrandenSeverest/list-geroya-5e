import type { ExportCharacter, AbilityScores } from './exportFormats';
import { classRules, skillKeys, type ClassRuleDetail } from './rules';
import { spells } from './catalog';
import { homebrewTypeLabels, type HomebrewElement, type HBEffect } from './homebrew';
import { evaluateFormula, type FormulaContext } from './homebrewFormula';
export type HBCharacterData={entities:HomebrewElement[];activeIds:string[];choices?:Record<string,string[]>;equipped?:string[]};
const level=(c:ExportCharacter)=>c.classes?.length?c.classes.reduce((s,x)=>s+x.level,0):c.level||1;
export const homebrewClassLevel=(c:ExportCharacter,id:string)=>c.classes?.length?c.classes.find(x=>x.classId===id.replace('official:class:',''))?.level||0:c.className===id.replace('official:class:','')?c.level:0;
const classLevel=homebrewClassLevel;
export function homebrewChoiceReason(c:ExportCharacter,owner:HomebrewElement,choice:import('./homebrew').HBChoice,target:HomebrewElement,all:HomebrewElement[]):string {
 const ownerLevel=owner.type==='class'?classLevel(c,owner.id):owner.parentClassId?classLevel(c,owner.parentClassId):level(c);
 if(choice.level&&ownerLevel<choice.level)return `Требуется ${choice.level}-й уровень ${owner.type==='class'||owner.parentClassId?'класса':'персонажа'}`;
 if(target.level&&ownerLevel<target.level)return `Требуется ${target.level}-й уровень ${owner.type==='class'||owner.parentClassId?'класса':'персонажа'}`;
 for(const requirement of target.requirements||[])if(requirement.type==='selected_feature'&&!Object.values(c.homebrew?.choices||{}).some(ids=>ids.includes(requirement.id))&&!c.homebrew?.activeIds.includes(requirement.id))return `Требуется ${requirement.label||all.find(e=>e.id===requirement.id)?.name||requirement.id}`;
 if(choice.uniqueAcrossGroup&&choice.choiceGroup&&owner.choices?.slice(0,owner.choices.findIndex(other=>other.id===choice.id)).some(other=>other.choiceGroup===choice.choiceGroup&&(c.homebrew?.choices?.[other.id]||[]).includes(target.id)))return 'Уже выбран в этой группе';
 return '';
}
export function hbContext(c:ExportCharacter,source?:string):FormulaContext {
 const values:Record<string,number>={'@level':level(c),'@pb':2+Math.floor((level(c)-1)/4),'@currentHp':c.currentHitPoints||0,'@tempHp':c.temporaryHitPoints||0};
 for(const [k,v] of Object.entries(c.abilities)){values['@ability.'+k]=v;values['@mod.'+k]=Math.floor((v-10)/2);}
 return {values,source,classLevel:id=>classLevel(c,id),resource:(id,field)=>{const r=(c.homebrew?.entities||[]).flatMap(e=>e.resources||[]).find(r=>r.id===id);if(!r)return 0;const max=evaluateFormula(r.max,{values,classLevel:i=>classLevel(c,i)});return field==='max'?max:Math.max(0,max-(c.resourceSpent?.[id]||0));},predicate:(name,id)=>name==='equipped'?(c.homebrew?.equipped||[]).includes(id):name==='hasFeature'?(c.homebrew?.activeIds||[]).includes(id):false};
}
export function hbValue(c:ExportCharacter,value:number|string|undefined,source?:string){try{return evaluateFormula(value??0,hbContext(c,source));}catch{return 0;}}
export function hbEnabled(c:ExportCharacter,row:{level?:number;when?:string},source:HomebrewElement){const l=source.type==='class'?classLevel(c,source.id):source.parentClassId?classLevel(c,source.parentClassId):level(c);if(row.level&&row.level>l)return false;try{return !row.when||!!evaluateFormula(row.when,hbContext(c,source.id));}catch{return false;}}
export function activeHomebrew(c:ExportCharacter):HomebrewElement[]{
 const all=c.homebrew?.entities||[],byId=new Map(all.map(e=>[e.id,e])),seen=new Set<string>(),result:HomebrewElement[]=[];
 const visit=(id:string,depth=0,parentClassId?:string)=>{if(seen.has(id)||depth>24||result.length>500)return;const e=byId.get(id);if(!e)return;seen.add(id);result.push(parentClassId&&!e.parentClassId?{...e,parentClassId}:e);
  if(e.type==='class'||e.type==='subclass')for(const feature of e.features||[])if(feature.level<=classLevel(c,e.type==='class'?e.id:e.parentClassId||''))result.push({schemaVersion:2,id:feature.id,type:'ability',name:feature.name,description:feature.description,updatedAt:e.updatedAt,parentClassId:e.type==='class'?e.id:e.parentClassId,effects:feature.effects||[],resources:feature.resources||[],attacks:feature.attacks||[]});
  if(e.type==='class'||e.type==='subclass'){const l=classLevel(c,e.type==='class'?e.id:e.parentClassId||'');for(const [k,rows]of Object.entries(e.advancement||{}))if(Number(k)<=l)for(const row of rows)if(row.id&&row.type!=='choice')visit(row.id,depth+1,e.type==='class'?e.id:e.parentClassId);}
  for(const x of e.effects||[])if(['grant_feature','grant_spell','grant_attack','grant_resource'].includes(x.type)&&x.id&&hbEnabled(c,x,e))visit(x.id,depth+1,e.type==='class'?e.id:e.parentClassId||parentClassId);
  for(const choice of e.choices||[])if(hbEnabled(c,choice,e))for(const id of (c.homebrew?.choices?.[choice.id]||[]).filter(id=>choice.from.includes(id)&&byId.has(id)&&!homebrewChoiceReason(c,e,choice,byId.get(id)!,all)).slice(0,choice.count))visit(id,depth+1,e.type==='class'?e.id:e.parentClassId||parentClassId);
 };
 for(const id of [...(c.homebrew?.activeIds||[]),c.className,c.race,c.raceVariant,c.subclass,c.background,...(c.classes||[]).flatMap(e=>[e.classId,e.subclassId||''])])if(id)visit(id);
 return result;
}
export function hbEffects(c:ExportCharacter,type?:string){return activeHomebrew(c).flatMap(source=>(source.effects||[]).filter(e=>(!type||e.type===type)&&hbEnabled(c,e,source)).map(effect=>({source,effect,value:hbValue(c,effect.value??effect.formula,source.id)})));}
export function hbSum(c:ExportCharacter,type:string,filter:(e:HBEffect)=>boolean=()=>true){return hbEffects(c,type).filter(x=>filter(x.effect)).reduce((sum,x)=>sum+x.value,0);}
export function hbAbilities(c:ExportCharacter,base:AbilityScores){const result={...base};for(const key of Object.keys(result) as (keyof AbilityScores)[]){result[key]+=hbSum(c,'ability_bonus',e=>e.ability===key);for(const x of hbEffects(c,'ability_minimum'))if(x.effect.ability===key)result[key]=Math.max(result[key],x.value);}return result;}
export function hbSkillName(id:string){const normalized=id.replace(/^skill:/,'').replace(/-/g,' ');return Object.entries(skillKeys).find(([name,data])=>name===id||data.key===normalized)?.[0]||id;}
export function classRuleFor(c:ExportCharacter,id:string):ClassRuleDetail|undefined{
 const e=c.homebrew?.entities.find(e=>e.id===id&&e.type==='class');if(!e)return classRules[id];
 return {hitDie:Number((e.hitDie||'d8').slice(1)),saves:e.savingThrows||[],armor:(e.effects||[]).filter(e=>e.type==='armor_proficiency').map(e=>({light:'Лёгкие доспехи',medium:'Средние доспехи',heavy:'Тяжёлые доспехи',shield:'Щиты'})[e.group as 'light']||e.group).join(', '),weapons:(e.effects||[]).filter(e=>e.type==='weapon_proficiency'||e.type==='weapon_group_proficiency').map(e=>e.group==='simple'?'Простое оружие':e.group==='martial'?'Воинское оружие':e.id||'').join(', '),spellAbility:e.spellcasting?.mode&&e.spellcasting.mode!=='none'?e.spellcasting.ability:undefined,features:activeHomebrew(c).filter(x=>x.type==='ability').map(x=>({name:x.name,description:x.description,effectHandling:'manual'}))};
}
export function hbResources(c:ExportCharacter){const map=new Map<string,{key:string;name:string;max:number;isShortRest:boolean;isLongRest:boolean}>();for(const e of activeHomebrew(c))for(const r of e.resources||[])if(hbEnabled(c,r,e)&&r.showOnSheet!==false)map.set(r.id,{key:r.id,name:r.name,max:Math.max(0,Math.floor(hbValue(c,r.max,e.id))),isShortRest:r.restore.includes('short_rest'),isLongRest:r.restore.includes('long_rest')});for(const source of activeHomebrew(c))if(source.type==='class'||source.parentClassId)for(const grant of source.spellGrants||[])if(grant.uses&&grant.level<=classLevel(c,source.type==='class'?source.id:source.parentClassId||'')){const key=source.id+':spell:'+grant.spellId;map.set(key,{key,name:source.name+' · '+(spells.find(e=>e.id===grant.spellId)?.name||c.homebrew?.entities.find(e=>e.id===grant.spellId)?.name||grant.spellId),max:grant.uses,isShortRest:grant.recovery==='short_or_long',isLongRest:true});}return [...map.values()];}
export function hbAttacks(c:ExportCharacter){const map=new Map<string,import('./combat').CharacterAttack>();for(const e of activeHomebrew(c))for(const a of e.attacks||[])if(hbEnabled(c,a,e)){
 const mod=Math.floor((c.abilities[a.ability]-10)/2),pb=2+Math.floor((level(c)-1)/4),extra=hbValue(c,a.bonus,e.id);
 const formula=a.damage.map(d=>d.formula.replace(/@mod\.(str|dex|con|int|wis|cha)/g,(_,k)=>`[${k.toUpperCase()}]`).replace(/@pb/g,String(pb))).join(' + ');
 const display=a.damage.map(d=>d.formula.replace(/@mod\.(str|dex|con|int|wis|cha)/g,(_,k)=>String(Math.floor((c.abilities[k as keyof AbilityScores]-10)/2))).replace(/@pb/g,String(pb))+' '+d.type).join(' + ');
 map.set(a.id,{id:a.id,name:a.name,kind:'feature',ability:a.ability,proficient:a.proficient,attackBonus:a.saveAbility?undefined:mod+(a.proficient?pb:0)+extra,attackBonusExtra:extra,saveDc:a.saveAbility?hbValue(c,a.saveDc||'8 + @pb + @mod.'+a.ability,e.id):undefined,damageFormula:formula,damageDisplay:display,note:[e.name,a.range,a.actionType,a.saveAbility?'Спасбросок '+a.saveAbility:'',a.cost?'Стоимость: '+a.cost.amount+' · '+a.cost.resource:''].filter(Boolean).join(' · ')});
 }return [...map.values()];}

/** Definitions belong to the shared library; character saves contain references and play state. */
export function bindHomebrewLibrary(c:ExportCharacter,library:{elements:HomebrewElement[]}):ExportCharacter {
 return {...c,homebrew:{...c.homebrew,entities:library.elements,activeIds:c.homebrew?.activeIds||[]}};
}
export function homebrewReferencesOnly(c:ExportCharacter):ExportCharacter {
 if(!c.homebrew)return c;
 const {entities: _definitions,...state}=c.homebrew;
 return {...c,homebrew:{...state,entities:[]}};
}
export function homebrewExportClosure(root:HomebrewElement,library:HomebrewElement[]):HomebrewElement[] {
 const byId=new Map(library.map(e=>[e.id,e])),seen=new Set<string>(),result:HomebrewElement[]=[];
 const visit=(id:string)=>{if(seen.has(id))return;seen.add(id);const entity=byId.get(id);if(!entity)return;result.push(entity);
  // Includes nested choices, progression, parents, pack members and interactive tags.
  const refs=JSON.stringify(entity).match(/hb:[a-z0-9_-]+:[a-z]+:[a-z0-9_-]+/g)||[];
  for(const ref of refs)if(ref!==id)visit(ref);
 };visit(root.id);return result;
}

export function homebrewExportWarning(c:ExportCharacter):string {
 const entries=activeHomebrew(c).map(e=>`${homebrewTypeLabels[e.type]}: ${e.name}`);
 const known=new Set((c.homebrew?.entities||[]).map(e=>e.id));
 for(const id of [...c.homebrew?.activeIds||[],c.className,c.race,c.subclass,c.background,...(c.classes||[]).flatMap(x=>[x.classId,x.subclassId||''])])if(id?.startsWith('hb:')&&!known.has(id))entries.push('Не загружен элемент: '+id);
 return entries.length?'Внимание, персонаж содержит Homebrew:\n'+[...new Set(entries)].join('\n')+'\n\nПолная поддержка пользовательских правил доступна в HeroList при подключённой библиотеке Homebrew. LSS и Helpmate могут перенести только часть данных; автоматизация и таблицы могут не сохраниться. Продолжить экспорт?':'';
}
