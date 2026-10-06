import type { HomebrewElement } from './homebrew';
import type { ExportCharacter } from './exportFormats';
import { resolveSpellSlots, resolvePactMagic } from './multiclass';
import { evaluateFormula } from './homebrewFormula';
import { spells } from './catalog';

/** Uses existing descriptive references: no new JSON schema or copied casting data. */
export function magicFeatureIds(root:HomebrewElement) {
 return (root.features||[]).filter(feature=>root.references?.includes(feature.id)).map(feature=>feature.id);
}
export function magicSpellList(root:HomebrewElement,entities:HomebrewElement[]) {
 const explicit=new Set((root.spellList||[]).map(id=>id.replace('official:spell:','')));
 return [...spells.filter(spell=>explicit.has(spell.id)||root.spellListSources?.some(source=>spell.classes.includes(source))),...entities.filter(e=>e.type==='spell'&&(explicit.has(e.id)||e.spellClasses?.includes(root.id)))].map(spell=>({id:spell.id,name:spell.name,level:spell.level||0}));
}
export function magicLevel(root:HomebrewElement,level:number,modifier=3) {
 const casting=root.spellcasting;
 const character={level,className:root.id,startingClassId:root.id,classes:[{classId:root.id,level,acquiredAtCharacterLevel:1}],homebrew:{entities:[root],activeIds:[root.id]},abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10}} as ExportCharacter;
 const pact=resolvePactMagic(character);
 const slots=casting?.mode==='pact'?Array.from({length:pact.level},(_,i)=>i===pact.level-1?pact.slots:0):resolveSpellSlots(character);
 const prepared=casting?.selection==='prepared'?Math.max(0,Math.floor(evaluateFormula(casting.preparedFormula||'@level + @mod.'+casting.ability,{values:{"@level":level,"@classLevel":level,"@pb":2+Math.floor((level-1)/4),...Object.fromEntries(["str","dex","con","int","wis","cha"].map(key=>["@mod."+key,modifier]))}}))):undefined;
 return {level,cantrips:casting?.cantrips?.[level]||0,known:casting?.known?.[level]||0,prepared,slots};
}
export function slotSummary(slots:number[]) {
 return slots.map((count,index)=>count?`${count} × ${index+1}-й круг`:'').filter(Boolean).join(' · ')||'Нет ячеек';
}
