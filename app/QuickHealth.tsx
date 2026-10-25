'use client';
import { useRef, useState } from 'react';
import type { ExportCharacter } from './exportFormats';
import { applyPlayDamage, healPlay, integer, logPlay, playMaximum } from './adventure';
import { undoPlayChange } from './playTransactions';
import { NumberSlider } from './NumberSlider';

export function healthAmount(input: string): number {
  if (!/^\d+$/.test(input.trim()) || !Number.isSafeInteger(Number(input)) || Number(input) < 1 || Number(input) > 999999) {
    throw new Error('Введите целое число от 1 до 999999.');
  }
  return Number(input);
}
export function QuickHealth({character:c,onChange,onUndo}:{character:ExportCharacter;onChange:(c:ExportCharacter)=>void;onUndo:(c:ExportCharacter)=>void}) {
  const [amount,setAmount]=useState('5');
  const [defense,setDefense]=useState<'normal'|'resistance'|'vulnerability'|'immune'>('normal');
  const [error,setError]=useState('');
  const [last,setLast]=useState<{text:string;transaction?:string}>();
  const lock=useRef({at:0,signature:''});
  const max=playMaximum(c),hp=c.currentHitPoints??max;
  function apply(kind:'damage'|'heal'|'temporary') {
    try {
      const value=healthAmount(amount);
      const signature=`${kind}:${value}:${defense}`;
      if(Date.now()-lock.current.at<450&&lock.current.signature===signature)return;
      const next=kind==='damage'?applyPlayDamage(c,value,defense):kind==='heal'?healPlay(c,value):logPlay({...c,temporaryHitPoints:Math.max(c.temporaryHitPoints||0,value)},`Временные HP: ${Math.max(c.temporaryHitPoints||0,value)} (не складываются)`);
      lock.current={at:Date.now(),signature};
      onChange(next);
      setLast({text:next.adventure!.journal[0]?.text||'Здоровье изменено',transaction:c.adventure?.undo?.at(-1)?.id});setError('');
    }catch(e){setError((e as Error).message);}
  }
  const latest=c.adventure?.undo?.at(-1);
  const canUndo=!!last&&!!latest&&latest.id!==last.transaction&&latest.label===last.text;
  return <section className="quick-health" aria-label="Быстрые хиты">
    <div className="quick-health-heading"><h2>Хиты</h2><strong aria-live="polite">{hp} / {max}</strong><span>Временные: +{c.temporaryHitPoints||0}</span>{defense!=='normal'&&<span>{defense==='resistance'?'Сопротивление ×½':defense==='vulnerability'?'Уязвимость ×2':'Иммунитет'}</span>}</div>
    <progress aria-label="Здоровье" value={hp} max={Math.max(1,max)}/>
    <div className="quick-health-actions"><label>Количество<NumberSlider label="Количество хитов" min={0} max={100} value={amount} onChange={setAmount}/></label><button className="play-danger" onClick={()=>apply('damage')}>− Урон</button><button className="play-primary" onClick={()=>apply('heal')}>+ Лечение</button></div>
    {error&&<p role="alert">{error}</p>}
    {last&&<div className="health-last" role="status"><span>{last.text}</span>{canUndo&&<button onClick={()=>{onUndo(undoPlayChange(c));setLast(undefined);}}>Отменить</button>}</div>}
    <details><summary>Временные хиты и параметры</summary><label>Получаемый урон<select aria-label="Получаемый урон" value={defense} onChange={e=>setDefense(e.target.value as typeof defense)}><option value="normal">Обычный</option><option value="resistance">Сопротивление ×½</option><option value="vulnerability">Уязвимость ×2</option><option value="immune">Иммунитет</option></select></label><button onClick={()=>apply('temporary')}>Выдать временные хиты</button><small>Берётся большее значение; временные хиты не складываются.</small><label>Текущие хиты вручную<NumberSlider label="Текущие хиты вручную" min={0} max={max} value={hp} onChange={value=>onChange({...c,currentHitPoints:integer(value,0,max)})}/></label><label>Временные хиты вручную<NumberSlider label="Временные хиты вручную" min={0} max={Math.max(100,c.temporaryHitPoints||0)} value={c.temporaryHitPoints||0} onChange={value=>onChange({...c,temporaryHitPoints:integer(value)})}/></label><label>Максимум хитов<NumberSlider label="Максимум хитов" min={1} max={Math.max(200,max)} value={max} onChange={value=>onChange({...c,adventure:{...c.adventure!,hpMaximum:integer(value,1)}})}/></label></details>
  </section>;
}
