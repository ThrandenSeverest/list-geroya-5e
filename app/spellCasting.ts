import type { CatalogSpell } from './catalog';
import type { ExportCharacter } from './exportFormats';
import { resolvePactMagic, resolveSpellSlots } from './multiclass';
import { resolvedRacialSpells } from './racialSpellcasting';
import { durationMinutes, endConcentration, logPlay, rollD20, rollDice, type DiceResult, type RollMode } from './adventure';
import { equippedHands, itemCategory, isShieldItem } from './adventure';
import { spellPlayProfile, type SpellPlayProfile } from './playSpells';
export function spellHandsWarning(c:ExportCharacter,spell:CatalogSpell):string|undefined {
  const parts=(spell.components||'').split(/[,;\s]+/).map(s=>s.toUpperCase().replace(/[^ВСМVSM]/g,''));
  const somatic=parts.includes('С')||parts.includes('S');
  const material=parts.includes('М')||parts.includes('M');
  if(!somatic&&!material)return;
  const hands=equippedHands(c);
  const warCaster=(c.feats||[]).includes('war-caster')||(c.advancements||[]).some(a=>a.featId==='war-caster');
  const focus=hands.held.some(i=>itemCategory(i)==='focus'||/священный символ|фокусировк/i.test(i.name));
  const pouch=(c.adventure?.inventory||[]).some(i=>i.quantity>0&&/мешочек с компонентами/i.test(i.name));
  if(material&&!focus&&hands.free===0)return 'Для материального компонента нужна свободная рука, фокусировка или доступный мешочек с компонентами. Сначала освободите руку.';
  if(material&&!focus&&hands.free===0)return 'Нет руки для материального компонента.';
  if(somatic&&!warCaster&&!(focus&&material)&&hands.free===0)return 'Для соматического компонента нужна свободная рука. Черта «Боевой заклинатель» разрешает жесты с оружием или щитом в руках.';
  if(material&&!focus&&!pouch)return 'Для материального компонента требуется фокусировка, мешочек с компонентами или сам компонент (особенно если указана стоимость).';
}
export type CastOption = { id: string; label: string; level: number; freeKey?: string };
export type CastPart = { attack?: DiceResult; damage?: DiceResult; healing?: DiceResult };
export type SpellCastResult = { profile: SpellPlayProfile; method: CastOption; parts: CastPart[]; events: {name:string; result:DiceResult}[] };
export function spellCastOptions(c:ExportCharacter,spell:CatalogSpell,classId=c.className):CastOption[] {
 if(spell.level===0)return [{id:'cantrip',label:'Заговор · без ячейки',level:0}];
 const innate=classId==='race'?resolvedRacialSpells(c,[spell])[0]:undefined;
 const options:CastOption[]=[];
 if(innate?.resourceKey && innate.remainingUses>0)options.push({id:'free',label:`Расовое использование · осталось ${innate.remainingUses}`,level:spell.level,freeKey:innate.resourceKey});
 if(!innate || innate.castWithSlots){
   resolveSpellSlots(c).forEach((n,i)=>{const left=n-(c.spellSlotsUsed?.[i]||0);if(i+1>=spell.level && left>0)options.push({id:`slot:${i}`,label:`${i+1} круг · осталось ${left}`,level:i+1});});
   const pact=resolvePactMagic(c),left=pact.slots-(c.pactSlotsUsed||0);
   if(pact.level>=spell.level && left>0)options.push({id:'pact',label:`Магия договора · ${pact.level} круг · осталось ${left}`,level:pact.level});
 }
 if(spell.ritual)options.push({id:'ritual',label:'Ритуал · проверьте право класса',level:spell.level});
 return options;
}
/** Cost, concentration, every attack and damage roll are one atomic character update. */
export function castPlaySpell(c:ExportCharacter,spell:CatalogSpell,methodId:string,classId=c.className,mode:RollMode='normal',die?:(sides:number)=>number,manualFormula?:string,ignoreHands=false):{character:ExportCharacter;result:SpellCastResult} {
 if(!c.adventure)throw new Error('Откройте игровую копию героя.');
 const method=spellCastOptions(c,spell,classId).find(x=>x.id===methodId);
 if(!method)throw new Error('Выбранная ячейка или использование уже недоступны.');
 const base=spellPlayProfile(c,spell,method.level,classId);
 const profile={...base,...(manualFormula?.trim()?base.healingFormula?{healingFormula:manualFormula.trim()}:{damageFormula:manualFormula.trim()}:{})};
 for(const formula of [profile.damageFormula,profile.healingFormula])if(formula)rollDice(formula,()=>1);
 const parts:CastPart[]=[],events:SpellCastResult['events']=[];
 for(let i=0;i<profile.projectiles;i++){
   const part:CastPart={},suffix=profile.projectiles>1?` · снаряд ${i+1}`:'';
   if(profile.attackBonus!==undefined){part.attack=rollD20(profile.attackBonus,mode,die);events.push({name:`${spell.name}: атака${suffix}`,result:part.attack});}
   // Natural 1 is a guaranteed miss. Other damage is potential until target AC is checked.
   if(profile.damageFormula && part.attack?.natural!==1){part.damage=rollDice(profile.damageFormula,die,profile.criticalAllowed && part.attack?.natural===20);events.push({name:`${spell.name}: ${profile.delivery==='effect'?'эффект':'урон'}${suffix}${part.attack?.natural===20 && profile.criticalAllowed?' · крит':''}`,result:part.damage});}
   if(profile.healingFormula){part.healing=rollDice(profile.healingFormula,die);events.push({name:`${spell.name}: лечение${suffix}`,result:part.healing});}
   parts.push(part);
 }
 let next={...c};
 if(method.id.startsWith('slot:')){const i=Number(method.id.slice(5));const used=resolveSpellSlots(c).map((_,j)=>c.spellSlotsUsed?.[j]||0);used[i]++;next.spellSlotsUsed=used;}
 if(method.id==='pact')next.pactSlotsUsed=(c.pactSlotsUsed||0)+1;
 if(method.id==='free' && method.freeKey)next.resourceSpent={...c.resourceSpent,[method.freeKey]:(c.resourceSpent?.[method.freeKey]||0)+1};
 if(/концентрац|concentration/i.test(spell.duration||'')){next=endConcentration(next);next.adventure={...next.adventure!,concentration:{name:spell.name,duration:spell.duration||'',remainingMinutes:durationMinutes(spell.duration||'')}};}
 next=logPlay(next,`Сотворено: ${spell.name} · ${method.label}`);
 for(const event of events)next=logPlay(next,event.name,event.result);
 return {character:next,result:{profile,method,parts,events}};
}
