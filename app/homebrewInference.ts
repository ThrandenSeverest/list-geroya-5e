import type { HomebrewElement, HBChoice, HBClassFeature } from './homebrew';

/** Read-only associations for legacy v2 documents; never rewrite gameplay rules. */
function words(value:string){return value.toLowerCase().replace(/ё/g,'е').replace(/[^a-zа-я0-9]+/g,' ').trim().split(/\s+/).filter(Boolean);}
function choiceTitle(value:string){
 return words(value).filter(word=>!['выбор','выбора','связанные','связанный','на','уровне','уровень','уровня','м','ом','choice','level'].includes(word)&&!/^\d+$/.test(word)).join(' ');
}
export function choiceMatchesClassFeature(feature:HBClassFeature,choice:HBChoice){
 const name=choiceTitle(feature.name),title=choiceTitle(choice.name);
 if(name&&title&&(title===name||title.startsWith(name+' ')||name.startsWith(title+' ')))return true;
 const key=feature.id.split(':').pop()?.toLowerCase()||'';
 const group=(choice.choiceGroup||choice.id).toLowerCase();
 return key.length>=4&&(group===key||group.endsWith(':'+key)||group.includes('-'+key+'-')||group.endsWith('-'+key));
}
export function choiceFeatureIds(root:HomebrewElement,choice:HBChoice){
 const matches=(root.features||[]).filter(feature=>choiceMatchesClassFeature(feature,choice));
 // Do not invent a gameplay parent when a legacy document is ambiguous.
 // Every choice still belongs to its real owner and remains fully navigable.
 const exact=matches.filter(feature=>choiceTitle(feature.name)===choiceTitle(choice.name));
 return (exact.length===1?exact:matches.length===1?matches:[]).map(feature=>feature.id);
}
export function linkedChoicesForFeature(root:HomebrewElement,featureId:string){
 return (root.choices||[]).filter(choice=>choiceFeatureIds(root,choice).includes(featureId));
}
export function choicesForFeature(root:HomebrewElement,feature:HBClassFeature){
 return [...new Map([...(feature.choices||[]),...linkedChoicesForFeature(root,feature.id)].map(choice=>[choice.id,choice])).values()];
}
export function inferredMagicFeatureIds(root:HomebrewElement){
 return (root.features||[]).filter(feature=>{
  if(root.references?.includes(feature.id))return true;
  const title=words(feature.name).join(' ');
  return /^(?:(?:первобытная|природная|тайная|божественная|мистическая|ритуальная|врожденная|договорная) )?магия(?: договора|пакта)?$/.test(title)
   || /^(?:использование|сотворение|накладывание|наложение) заклинаний$/.test(title)
   || /^(?:колдовство|заклинания|spellcasting|pact magic|primal magic|innate spellcasting)$/.test(title);
 }).map(feature=>feature.id);
}
