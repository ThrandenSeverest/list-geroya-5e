'use client';
import {useEffect,useRef,useState} from 'react';
import type {PlayViewPreferences} from './playViewPreferences';
import type {DiceScreenOptions} from './DiceScreenOverlay';
import './dice-screen.css';
export function diceOptions(view:PlayViewPreferences):DiceScreenOptions{return {enabled:view.diceAnimation,color:view.diceColor,lifetime:view.diceLifetime,numberColor:view.diceNumberColor,numberStyle:view.diceNumberStyle,size:view.diceSize,numberScale:view.diceNumberScale,d4Mode:view.diceD4Mode,d4Label:view.diceD4Label,sound:view.diceSound,volume:view.diceVolume};}
export function DiceSettings({view,onChange}:{view:PlayViewPreferences;onChange:(patch:Partial<PlayViewPreferences>)=>void}){
 const [open,setOpen]=useState(false),dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{if(open&&!dialog.current?.open)dialog.current?.showModal();},[open]);
 return <><button type="button" className="dice-settings-trigger" aria-label="Настройки кубиков" title="Настройки кубиков" onClick={()=>setOpen(true)}><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m9 3 1-1h4l1 3 3 1 3 1v4l-2 2-1 3-1 3h-4l-2-2-3-1-3-1v-4l2-2 1-3Z"/><circle cx="12" cy="11" r="3"/></svg></button>
 {open&&<dialog ref={dialog} className="dice-settings-dialog" aria-label="Настройки кубиков" onCancel={()=>setOpen(false)} onClick={e=>{if(e.target===e.currentTarget){const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)setOpen(false);}}}>
 <header><h2>Кубики</h2><button type="button" onClick={()=>setOpen(false)} aria-label="Закрыть настройки кубиков">×</button></header>
 <label className="dice-check"><input type="checkbox" checked={view.diceAnimation} onChange={e=>onChange({diceAnimation:e.target.checked})}/>Анимация бросков</label>
 <label>Цвет кубиков<input type="color" aria-label="Цвет кубиков" value={view.diceColor} onChange={e=>onChange({diceColor:e.target.value})}/></label>
 <label>Цвет чисел<input type="color" aria-label="Цвет чисел на кубиках" value={view.diceNumberColor} onChange={e=>onChange({diceNumberColor:e.target.value})}/></label>
 <label>Размер кубиков · {Math.round(view.diceSize*100)}%<input type="range" aria-label="Размер кубиков" min="50" max="150" step="10" value={view.diceSize*100} onChange={e=>onChange({diceSize:Number(e.target.value)/100})}/></label>
 <label>Размер чисел · {Math.round(view.diceNumberScale*100)}%<input type="range" aria-label="Размер чисел" min="70" max="140" step="10" value={view.diceNumberScale*100} onChange={e=>onChange({diceNumberScale:Number(e.target.value)/100})}/></label>
 <label>Шрифт чисел<select aria-label="Стиль чисел на кубиках" value={view.diceNumberStyle} onChange={e=>onChange({diceNumberStyle:e.target.value as PlayViewPreferences['diceNumberStyle']})}><option value="classic">Классический</option><option value="modern">Современный</option><option value="mono">Моноширинный</option></select></label>
 <div className="dice-number-sample" aria-label="Образец чисел" style={{background:view.diceColor,color:view.diceNumberColor,fontFamily:view.diceNumberStyle==='modern'?'Arial,sans-serif':view.diceNumberStyle==='mono'?'monospace':'Georgia,serif',fontSize:24*view.diceNumberScale}}>4 · 12 · 20</div>
 <label>Отображение к4<select aria-label="Отображение к4" value={view.diceD4Mode} onChange={e=>onChange({diceD4Mode:e.target.value as 'vertex'|'face'})}><option value="vertex">Реалистично · вершиной вверх</option><option value="face">Условно · плоской гранью вверх</option></select></label>
 <label className="dice-check"><input type="checkbox" checked={view.diceD4Label} onChange={e=>onChange({diceD4Label:e.target.checked})}/>Дублировать результат под к4</label>
 <label>Исчезновение после остановки<select aria-label="Время исчезновения кубиков" value={view.diceLifetime} onChange={e=>onChange({diceLifetime:Number(e.target.value)})}>{[0,1,2,3,5,8,10,15,30].map(n=><option key={n} value={n}>{n} сек.</option>)}</select></label>
 <label className="dice-check"><input type="checkbox" checked={view.diceSound} onChange={e=>onChange({diceSound:e.target.checked})}/>Звук броска</label>
 <label>Громкость · {Math.round(view.diceVolume*100)}%<input type="range" aria-label="Громкость кубиков" min="0" max="100" step="5" value={view.diceVolume*100} onChange={e=>onChange({diceVolume:Number(e.target.value)/100})}/></label>
 </dialog>}</>;
}
