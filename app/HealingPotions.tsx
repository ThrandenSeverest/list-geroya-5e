'use client';
import type { ExportCharacter } from './exportFormats';
import { type DiceResult, healPlay, logPlay, rollDice } from './adventure';
import { healingPotions, potionPreset } from './healingPotions';
import { useQuickItem } from './playActions';

export function HealingPotions({character:c,onChange,onRoll}:{character:ExportCharacter;onChange:(c:ExportCharacter)=>void;onRoll:(name:string,r:DiceResult)=>void}){
  const requireStock=c.adventure!.requirePotionStock!==false;
  return <div className="healing-potion-panel">
    <label className="play-check potion-stock-toggle">
      <input type="checkbox" aria-label="Учитывать наличие зелий" checked={requireStock} onChange={event=>onChange({...c,adventure:{...c.adventure!,requirePotionStock:event.target.checked}})}/>
      Учитывать наличие
    </label>
    <div className="healing-potions" aria-label="Автоматические зелья лечения">
      {healingPotions.map((p,index)=>{
        const items=c.adventure!.inventory.filter(i=>i.quantity>0&&potionPreset(i)?.id===p.id);
        const count=items.reduce((n,i)=>n+i.quantity,0);
        return <button className="potion-button" key={p.id} type="button" disabled={requireStock&&count<=0}
          title={`${p.name}: ${p.formula}. ${requireStock?`В наличии: ${count}`:'Наличие не проверяется'}`}
          aria-label={`Выпить: ${p.name}, ${requireStock?`${count} шт.`:'без проверки наличия'}`}
          onClick={()=>{
            const item=items[0];
            if(item){
              const action=useQuickItem(c,item.id);
              onChange(action.character);
              if(action.roll)onRoll(p.name,action.roll);
            }else if(!requireStock){
              const roll=rollDice(p.formula);
              onChange(logPlay(healPlay(c,roll.total),`Лечение: ${p.name} (без расхода инвентаря)`,roll));
              onRoll(p.name,roll);
            }
          }}>
          <svg width={20+index*3} height="32" viewBox="0 0 32 40" aria-hidden="true">
            <path d="M11 2h10v5h-2v7l9 13c5 9-3 11-12 11S-1 36 4 27l9-13V7h-2Z" fill="none" stroke="currentColor" strokeWidth="2"/>
            <path d="M7 26h18M16 27v8M12 31h8" stroke="currentColor" strokeWidth="2"/>
          </svg>
          <span><b>{p.label}</b><small>{p.formula}</small></span>
          <strong>{requireStock?`×${count}`:count>0?`×${count}`:'∞'}</strong>
        </button>;
      })}
    </div>
  </div>;
}
