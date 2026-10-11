import type { CatalogSpell } from './catalog';
import type { AbilityScores, ExportCharacter } from './exportFormats';
import { abilityModifier, proficiencyBonus } from './exportFormats';
import { characterLevel } from './multiclass';
import { classRuleFor } from './homebrewEngine';
import { playDerived, spellItemBonus } from './adventure';
import { characterAttacks } from './combat';
import { resolvedRacialSpells } from './racialSpellcasting';
export type SpellPlayProfile = { delivery: 'attack' | 'save' | 'automatic' | 'effect'; ability: keyof AbilityScores; attackBonus?: number; saveDc?: number; saveAbility?: string; damageFormula?: string; healingFormula?: string; projectiles: number; note?: string; criticalAllowed: boolean };
const saveNames: Record<string,string> = { str:'Силы',dex:'Ловкости',con:'Телосложения',int:'Интеллекта',wis:'Мудрости',cha:'Харизмы' };
/** Structured mechanics take precedence. Official text supplies delivery; ambiguous compound damage stays manual. */
export function spellPlayProfile(c: ExportCharacter, spell: CatalogSpell, slotLevel = spell.level, classId = c.className): SpellPlayProfile {
 const d=playDerived(c),level=characterLevel(c),pb=proficiencyBonus(level),m=spell.mechanics;
 const innate=classId==='race'?resolvedRacialSpells(d,[spell])[0]:undefined;
 const ability=(m?.ability || innate?.ability || classRuleFor(c,classId)?.spellAbility || classRuleFor(c,c.className)?.spellAbility || 'int') as keyof AbilityScores;
 const mod=abilityModifier(d.abilities[ability]);
 const text=spell.description || '';
 const attack=/атак[ауи]\s+заклинанием|spell attack/i.test(text);
 const saves=/(?<!не требует )спасброс(?:ок|ки|ка)/i.test(text);
 const delivery=m ? m.delivery : attack ? 'attack' : saves ? 'save' : /автоматически попадает|автоматически попадают/.test(text) ? 'automatic' : 'effect';
 const symbolic=(value:string)=>value.replace(/@mod\.spell/g,String(mod)).replace(/@mod\.(str|dex|con|int|wis|cha)/g,(_,key:keyof AbilityScores)=>String(abilityModifier(d.abilities[key]))).replace(/@pb/g,String(pb)).replace(/@level/g,String(level));
 let damageFormula:string|undefined,healingFormula:string|undefined;
 let projectiles=1,note:string|undefined;
 if(m){
   const parts=[...m.damage,...(spell.level===0?(m.cantripScaling||[]).filter(s=>s.level<=level).flatMap(s=>s.damage):[])];
   const steps=m.slotScaling ? Math.max(0,Math.floor((slotLevel-spell.level)/Math.max(1,m.slotScaling.every))):0;
   for(let i=0;i<steps;i++)parts.push(...m!.slotScaling!.damage);
   damageFormula=parts.length?parts.map(p=>symbolic(p.formula)).join('+'):undefined;
 }else{
   // Reuse the existing cantrip profiles, including Eldritch Blast's separate beams.
   const known=characterAttacks({...d,spells:[spell.id],spellGrants:[{spellId:spell.id,sourceType:'class',sourceId:classId,classId,mode:'known'}]},[spell]).filter(a=>a.kind==='cantrip');
   const dice=text.match(/(\d+)\s*[кd](\d+)(?:\s*\+\s*(\d+))?/i);
   if(spell.level===0&&known.length){damageFormula=known[0].damageFormula.replace(/\[(STR|DEX|CON|INT|WIS|CHA)\]/g,(_,key:string)=>String(abilityModifier(d.abilities[key.toLowerCase() as keyof AbilityScores])));projectiles=known.length;note=known[0].note;}
   else if(dice && /урон|хит|лечени|восстанавлива/i.test(text)){
     let count=Number(dice[1]),sides=Number(dice[2]),flat=Number(dice[3]||0);
     if(spell.level===0) count*=level>=17?4:level>=11?3:level>=5?2:1;
     const upcast=text.match(/Ячейка выше[^:]*:\s*\+(\d+)\s*[кd](\d+)/i);
     if(upcast&&Number(upcast[2])===sides)count+=Math.max(0,slotLevel-spell.level)*Number(upcast[1]);
     if(/восстанавливает|лечени/i.test(text)&&!/урон/i.test(text)){if(/модификатор.*характеристик/i.test(text))flat+=mod;healingFormula=`${count}d${sides}${flat>=0?'+':''}${flat}`;}
     else damageFormula=`${count}d${sides}${flat?`+${flat}`:''}`;
     if(spell.id==='scorching-ray'){projectiles=3+Math.max(0,slotLevel-2);note='Каждый луч — отдельная атака и отдельный урон.';}
     if(spell.id==='magic-missile'){projectiles=3+Math.max(0,slotLevel-1);note='Показан урон одного дротика; распределите дротики между целями.';}
     if(/(?:два|несколько|различн).{0,30}(?:тип|урон)|позже|в начале каждого/i.test(text))note='Формула относится к первому указанному эффекту. Повторный и дополнительный урон сверяйте с описанием.';
   }
 }
 const saveAbility=m?.saveAbility ? saveNames[m.saveAbility] : text.match(/спасброс(?:ок|ки|ка)\s+(Силы|Ловкости|Телосложения|Интеллекта|Мудрости|Харизмы)/i)?.[1];
 return {delivery,ability,attackBonus:delivery==='attack'?pb+mod+spellItemBonus(c,'spellAttackBonus',classId):undefined,saveDc:delivery==='save'?8+pb+mod+spellItemBonus(c,'spellSaveDcBonus',classId):undefined,saveAbility,damageFormula,healingFormula,projectiles,note,criticalAllowed:delivery==='attack'};
}
