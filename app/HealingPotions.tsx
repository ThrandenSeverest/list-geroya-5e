'use client';
import type { ExportCharacter } from './exportFormats';
import { logPlay, newPlayItem, updateInventory, type DiceResult } from './adventure';
import { healingPotions, potionPreset } from './healingPotions';
import { useQuickItem } from './playActions';
export function HealingPotions({character:c,onChange,onRoll}:{character:ExportCharacter;onChange:(c:ExportCharacter)=>void;onRoll:(name:string,r:DiceResult)=>void}){
 return <div className="healing-potions" aria-label="Автоматические зелья лечения">{healingPotions.map(p=>{
 const items=c.adventure!.inventory.filter(i=>potionPreset(i)?.id===p.id),count=items.reduce((n,i)=>n+i.quantity,0);
 return <div className="potion-tile" key={p.id}><span><b>{p.label}</b> · {p.formula} · {count} шт.</span><button type="button" className="play-primary" disabled={count<=0} onClick={()=>{const item=items.find(i=>i.quantity>0);if(!item)return;const action=useQuickItem(c,item.id);onChange(action.character);if(action.roll)onRoll(p.name,action.roll);}}>Выпить {p.label.toLocaleLowerCase('ru')}</button><button type="button" aria-label={`Добавить: ${p.name}`} onClick={()=>{const item=items[0];const inventory=item?c.adventure!.inventory.map(i=>i.id===item.id?{...i,quantity:i.quantity+1}:i):[...c.adventure!.inventory,{...newPlayItem(p.name),category:'consumable' as const,magical:true,weight:0.5,healingFormula:p.formula}];onChange(logPlay(updateInventory(c,inventory),`Добавлено: ${p.name}`));}}>+ Добавить зелье</button></div>;
 })}</div>;
}
