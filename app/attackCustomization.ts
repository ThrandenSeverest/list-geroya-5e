import type { AbilityScores, ExportCharacter } from './exportFormats';
import type { CharacterAttack } from './combat';
import { abilityModifier, proficiencyBonus } from './exportFormats';
import { characterLevel } from './multiclass';
export type AttackCustomization = { name?:string; ability?:keyof AbilityScores; proficient?:boolean; bonus?:number; damageFormula?:string; damageType?:string; note?:string };
export function customizeAttack(attack:CharacterAttack,c:ExportCharacter,patch:AttackCustomization|undefined):CharacterAttack {
  if(!patch)return attack;
  const pb=proficiencyBonus(characterLevel(c));
  const ability=patch.ability??attack.ability, proficient=patch.proficient??attack.proficient;
  const attackBonus=attack.attackBonus===undefined?undefined:attack.attackBonus
    +abilityModifier(c.abilities[ability])-abilityModifier(c.abilities[attack.ability])
    +(Number(proficient)-Number(attack.proficient))*pb+(patch.bonus??0);
  const damageFormula=patch.damageFormula??attack.damageFormula;
  const damageDisplay=patch.damageFormula!==undefined?damageFormula.replace(/\[(STR|DEX|CON|INT|WIS|CHA)\]/gi,(_,key:string)=>String(abilityModifier(c.abilities[key.toLowerCase() as keyof AbilityScores]))).replace(/\[PB\]/g,String(pb)):attack.damageDisplay;
  return {...attack,sourceName:attack.sourceName||attack.name,name:patch.name??attack.name,ability,proficient,attackBonus,
    attackBonusExtra:attack.attackBonusExtra+(patch.bonus??0),damageFormula,damageDisplay:damageDisplay+(patch.damageType?` · ${patch.damageType}`:''),note:patch.note??attack.note};
}
