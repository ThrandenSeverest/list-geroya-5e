import type { HomebrewElement, HBProgression } from './homebrew';
/** D&D 5e 2014 subclass feature progression (including cleric domain levels). */
export const subclassFeatureLevels:Record<string,number[]>={barbarian:[3,6,10,14],bard:[3,6,14],cleric:[1,2,6,8,17],druid:[2,6,10,14],fighter:[3,7,10,15,18],monk:[3,6,11,17],paladin:[3,7,15,20],ranger:[3,7,11,15],rogue:[3,9,13,17],sorcerer:[1,6,14,18],warlock:[1,6,10,14],wizard:[2,6,10,14],artificer:[3,5,9,15]};
export function subclassTemplate(parentId:string,entities:HomebrewElement[]):Record<string,HBProgression[]> {
 const parent=entities.find(e=>e.id===parentId);
 const levels=subclassFeatureLevels[parentId.replace('official:class:','')]||parent?.subclass?.featureLevels||[parent?.subclass?.chooseAtLevel||3];
 return Object.fromEntries(levels.map(level=>[String(level),[{type:'feature' as const}]]));
}
export function homebrewTableFeatures(entities:HomebrewElement[]) {
 return entities.filter(e=>e.table?.columns.length).flatMap(e=>{
  const table=e.table!;const clean=(s:string)=>s.replace(/\|/g,'／').replace(/[\r\n]+/g,' ');
  const features=[];for(let i=0;i<table.rows.length;i+=8)features.push({name:e.name+(i?' — продолжение':''),description:[i?'':e.description,'| '+table.columns.map(clean).join(' | ')+' |','| '+table.columns.map(()=>'---').join(' | ')+' |',...table.rows.slice(i,i+8).map(row=>'| '+table.columns.map((_,j)=>clean(row[j]||'')).join(' | ')+' |')].filter(Boolean).join('\n')});
  return features;
 });
}
