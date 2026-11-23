'use client';
import {useRef,useState} from 'react';
import {useDiceAction} from './useDiceController';
import type { ExportCharacter } from './exportFormats';
import { type DiceResult, healPlay, logPlay, rollDice } from './adventure';
import { healingPotions, potionPreset } from './healingPotions';
import { useQuickItem } from './playActions';

export function HealingPotions({character:c,onChange,onRoll}:{character:ExportCharacter;onChange:(c:ExportCharacter)=>void;onRoll:(name:string,r:DiceResult)=>void}){
  const run=useDiceAction(),current=useRef(c);current.current=c;
  const [error,setError]=useState('');
  const requireStock=c.adventure!.requirePotionStock!==false;
  return <div className="healing-potion-panel">
    <label className="play-check potion-stock-toggle">
      <input type="checkbox" aria-label="Учитывать наличие зелий" checked={requireStock} onChange={event=>onChange({...c,adventure:{...c.adventure!,requirePotionStock:event.target.checked}})}/>
      Учитывать наличие
    </label>
    {error&&<p role="alert">{error}</p>}<div className="healing-potions" aria-label="Автоматические зелья лечения">
      {healingPotions.map((p,index)=>{
        const items=c.adventure!.inventory.filter(i=>i.quantity>0&&potionPreset(i)?.id===p.id);
        const count=items.reduce((n,i)=>n+i.quantity,0);
        return <button className="potion-button" key={p.id} type="button" disabled={requireStock&&count<=0}
          title={`${p.name}: ${p.formula}. ${requireStock?`В наличии: ${count}`:'Наличие не проверяется'}`}
          aria-label={`Выпить: ${p.name}, ${requireStock?`${count} шт.`:'без проверки наличия'}`}
          onClick={async()=>{try{
            const action=await run(()=>{const hero=current.current;const item=hero.adventure!.inventory.find(i=>i.quantity>0&&potionPreset(i)?.id===p.id);
              if(item)return useQuickItem(hero,item.id);
              if(hero.adventure!.requirePotionStock!==false)throw Error('Нет зелья в инвентаре.');
              const roll=rollDice(p.formula);return {character:logPlay(healPlay(hero,roll.total),`Лечение: ${p.name} (без расхода инвентаря)`,roll),roll};});
            current.current=action.character;onChange(action.character);if(action.roll)onRoll(p.name,action.roll);setError('');
          }catch(e){if((e as Error).name!=='AbortError')setError((e as Error).message);}
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
