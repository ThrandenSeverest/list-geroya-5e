import type { ExportCharacter } from './exportFormats';
import { consumePlayItem, healPlay, logPlay, rollD20, rollDice, type DiceResult, type RollMode } from './adventure';
export function useQuickItem(c:ExportCharacter,id:string,die?:(sides:number)=>number):{character:ExportCharacter;roll?:DiceResult;name:string} {
 const item=c.adventure?.inventory.find(i=>i.id===id);
 if(!item)throw new Error('Предмет не найден.');
 if(item.quantity<=0)throw new Error('Предмет закончился.');
 const roll=item.healingFormula?rollDice(item.healingFormula,die):undefined;
 let next=consumePlayItem(c,id);
 if(roll)next=logPlay(healPlay(next,roll.total),`Лечение: ${item.name}`,roll);
 return {character:next,roll,name:item.name};
}
export function resolvePlayAttack(c:ExportCharacter,name:string,bonus:number|undefined,formula:string,mode:RollMode,die?:(sides:number)=>number){
 if(formula)rollDice(formula,()=>1);
 const attack=bonus!==undefined?rollD20(bonus,mode,die):undefined;
 const damage=formula&&attack?.natural!==1?rollDice(formula,die,attack?.natural===20):undefined;
 let next=c;
 if(attack)next=logPlay(next,`Атака: ${name}`,attack);
 if(damage)next=logPlay(next,`Урон: ${name}`,damage);
 return {character:next,name,attack,damage};
}
