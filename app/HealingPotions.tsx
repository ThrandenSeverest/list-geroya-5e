'use client';
import type { ExportCharacter } from './exportFormats';
import { type DiceResult } from './adventure';
import { healingPotions, potionPreset } from './healingPotions';
import { useQuickItem } from './playActions';
export function HealingPotions({character:c,onChange,onRoll}:{character:ExportCharacter;onChange:(c:ExportCharacter)=>void;onRoll:(name:string,r:DiceResult)=>void}){
 return <div className="healing-potions" aria-label="Автоматические зелья лечения">{healingPotions.map(p=>{
 const items=c.adventure!.inventory.filter(i=>potionPreset(i)?.id===p.id),count=items.reduce((n,i)=>n+i.quantity,0);
 return <button className="potion-button" key={p.id} type="button" disabled={count<=0} title={`${p.name}: ${p.formula}. В наличии: ${count}`} aria-label={`Выпить: ${p.name}, ${count} шт.`} onClick={()=>{const item=items.find(i=>i.quantity>0);if(!item)return;const action=useQuickItem(c,item.id);onChange(action.character);if(action.roll)onRoll(p.name,action.roll);}}><svg width={20+healingPotions.indexOf(p)*3} height="32" viewBox="0 0 32 40" aria-hidden="true"><path d="M11 2h10v5h-2v7l9 13c5 9-3 11-12 11S-1 36 4 27l9-13V7h-2Z" fill="none" stroke="currentColor" strokeWidth="2"/><path d="M7 26h18M16 27v8M12 31h8" stroke="currentColor" strokeWidth="2"/></svg><span><b>{p.label}</b><small>{p.formula}</small></span><strong>×{count}</strong></button>;
 })}</div>;
}
