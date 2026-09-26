import type { CatalogOption, CatalogSpell } from './catalog';
import type { HomebrewElement } from './homebrew';

export function homebrewOptions(entities:HomebrewElement[],type:HomebrewElement['type']):CatalogOption[] {
 return entities.filter(e=>e.type===type).map(e=>({id:e.id,name:e.name,source:'Homebrew',description:e.summary||e.description,tags:e.tags}));
}
export function homebrewSpells(entities:HomebrewElement[]):CatalogSpell[] {
 const damage=(rows:{formula:string;type:string}[]|undefined)=>(rows||[]).map(row=>`${row.formula} ${row.type}`).join(' + ');
 return entities.filter(e=>e.type==='spell').map(e=>{const mechanics=e.spellMechanics;const rules=mechanics?[
  `Урон: ${damage(mechanics.damage)}.`,
  ...(mechanics.cantripScaling||[]).map(row=>`С ${row.level}-го уровня: +${damage(row.damage)}${row.effect?`; ${row.effect}`:''}.`),
  mechanics.slotScaling?`Ячейка выше базовой: +${damage(mechanics.slotScaling.damage)} за каждые ${mechanics.slotScaling.every} круга${mechanics.slotScaling.effect?`; ${mechanics.slotScaling.effect}`:''}.`:''
 ].filter(Boolean).join(' '):'';return {id:e.id,name:e.name,source:'Homebrew',description:[e.description,rules,e.higherLevels].filter(Boolean).join('\n\n'),level:e.level||0,school:e.school||'Авторская',classes:e.spellClasses?.length?e.spellClasses:[],ritual:e.ritual,castingTime:e.castingTime,range:e.range,duration:e.concentration?`Концентрация · ${e.duration||''}`:e.duration,components:e.components,mechanics};});
}
export function homebrewSpellAvailable(classId:string,spell:CatalogSpell,entities:HomebrewElement[]):boolean {
 if(!spell.id.startsWith('hb:') && !entities.some(e=>e.type==='spell'&&e.id===spell.id))return !!entities.find(e=>e.type==='class'&&e.id===classId)?.spellList?.includes(spell.id);
 const entity=entities.find(e=>e.id===spell.id&&e.type==='spell');
 return !!entity && (!entity.spellClasses?.length || entity.spellClasses.includes(classId));
}
export function homebrewSubclassOptions(classId:string,entities:HomebrewElement[]) {
 return entities.filter(e=>e.type==='subclass'&&e.parentClassId?.replace('official:class:','')===classId).map(e=>({id:e.id,name:e.name,source:'Homebrew',description:e.description,flags:undefined,expandedSpells:undefined,features:(e.features||[]).map(f=>({name:f.name,description:f.description,level:f.level}))}));
}
