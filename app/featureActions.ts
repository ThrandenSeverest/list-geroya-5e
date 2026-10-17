import type { ExportCharacter } from './exportFormats';
import { characterResources, resourceCurrent } from './characterResources';
import { orderedCharacterClasses } from './multiclass';
import { endConcentration, logPlay, playDerived, playId } from './adventure';
export type ActionTiming = 'action' | 'bonus' | 'reaction';
export const actionTimingLabels = {action:'Действие',bonus:'Бонусное действие',reaction:'Реакция'};
// Explicit action costs only: descriptions can refer to several different actions.
export const resourceActionTiming: Record<string,ActionTiming> = {
 'bardic-inspiration':'bonus',rage:'bonus','second-wind':'bonus','wild-shape':'action',
 'harness-divine-power':'bonus','lay-on-hands':'action',
 'giants-might':'bonus','fighting-spirit':'bonus','wrath-of-storm':'reaction',
 'healing-light':'bonus','tentacle-of-deeps':'bonus','defensive-field':'bonus',
 'flash-of-genius':'reaction','chronal-shift':'reaction','momentary-stasis':'action',
};
export function featureResourceTiming(c:ExportCharacter,key:string):ActionTiming|undefined {
 if(key==='wild-shape'&&(c.rulesetId==='5e-2024'||orderedCharacterClasses(c).some(entry=>entry.classId==='druid'&&entry.subclassId==='moon')))return 'bonus';
 if(key==='lay-on-hands'&&c.rulesetId==='5e-2024')return 'bonus';
 return resourceActionTiming[key];
}
export function spendFeatureResource(c:ExportCharacter,key:string,timing?:ActionTiming) {
 const resource=characterResources(playDerived(c)).find(r=>r.key===key);
 if(!c.adventure||!resource)throw new Error('Способность недоступна этому герою.');
 const cost=resource.unit||1;
 if(resourceCurrent(c,resource)<cost)throw new Error('Ресурс способности закончился.');
 const action=timing??featureResourceTiming(c,key);
 let next:ExportCharacter={...c,resourceSpent:{...c.resourceSpent,[key]:(c.resourceSpent?.[key]||0)+cost},adventure:{...c.adventure,turn:{...c.adventure.turn,...(action?{[action]:true}:{})}}};
 if(key==='rage'){
  next=endConcentration(next);
  next.adventure={...next.adventure!,conditions:next.adventure!.conditions.filter(n=>n!=='Ярость'),effects:[...next.adventure!.effects.filter(e=>e.name!=='Ярость'),{id:playId(),name:'Ярость',remaining:10}]};
 }
 const note=key==='bardic-inspiration'?` · передайте союзнику ${resource.die}; бросок делает союзник при использовании` : '';
 return logPlay(next,`${resource.name}${resource.die?' '+resource.die:''}: потрачено ${cost}${action?' · '+actionTimingLabels[action]:''}${note}`);
}
export type ConcentrationUnit = 'round'|'minute'|'hour';
export function startManualConcentration(c:ExportCharacter,name:string,amount?:number,unit:ConcentrationUnit='minute') {
 if(!c.adventure)return c;
 if(amount!==undefined&&(!Number.isFinite(amount)||amount<=0||amount>100000))throw new Error('Укажите положительную длительность или оставьте поле пустым.');
 const minutes=amount===undefined?undefined:amount*(unit==='round'?0.1:unit==='hour'?60:1);
 const duration=amount===undefined?'Без указанного срока':`${amount} ${unit==='round'?'раундов':unit==='hour'?'часов':'минут'}`;
 const next=endConcentration(c);
 return logPlay({...next,adventure:{...next.adventure!,concentration:{name:name.trim()||'Концентрация',duration,remainingMinutes:minutes}}},`Начата концентрация: ${name.trim()||'Концентрация'} · ${duration}`);
}
