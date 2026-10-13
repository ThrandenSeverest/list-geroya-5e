'use client';
import { useEffect, useRef, useState } from 'react';
/** The track previews while dragging; pointer/key release commits one change. Exact entry has no spinner. */
export function NumberSlider({label,value,min=0,max=100,step=1,onChange}:{label:string;value:number|string;min?:number;max?:number;step?:number;onChange:(value:string)=>void}){
 const [preview,setPreview]=useState<string>();
 const pending=useRef<string | undefined>(undefined);
 useEffect(()=>{if(pending.current===undefined)setPreview(undefined);},[value]);
 function commit(){const next=pending.current;if(next===undefined)return;pending.current=undefined;setPreview(undefined);if(Number(next)!==Number(value))onChange(next);}
 const display=preview??String(value);
 return <span className="number-slider"><input aria-label={`${label}: ползунок`} type="range" min={min} max={Math.max(min,max)} step={step} value={Math.min(Math.max(min,Number(display)||0),Math.max(min,max))} onChange={e=>{pending.current=e.target.value;setPreview(e.target.value);}} onPointerDown={e=>e.currentTarget.setPointerCapture(e.pointerId)} onPointerUp={commit} onPointerCancel={()=>{pending.current=undefined;setPreview(undefined);}} onKeyUp={commit} onBlur={()=>{commit();setPreview(undefined);}}/><input aria-label={label} type="text" inputMode={step<1?'decimal':'numeric'} value={display} onChange={e=>{pending.current=undefined;const next=step<1?e.target.value.replace(',','.'):e.target.value;setPreview(next);if(next.trim()===''||Number.isFinite(Number(next)))onChange(next);}}/></span>;
}
