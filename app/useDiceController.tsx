'use client';
import {createContext,useContext,useEffect,useRef,useState} from 'react';
import {randomDie} from './adventure';
import {resolvePhysicalAction} from './diceSource';
import {diceMesh} from './diceScreenMath';
import {DiceScreenOverlay,type DiceScreenOptions,type ScreenRollWithThrow,type HeldDiceRoll,type ManualDiceThrow} from './DiceScreenOverlay';
import {unlockDiceAudio,playDiceAudio} from './diceAudio';
export type DiceAction=<T>(fn:()=>T)=>Promise<T>;
export const DiceActionContext=createContext<DiceAction>(async fn=>fn());
export const useDiceAction=()=>useContext(DiceActionContext);
export function useDiceController(options:DiceScreenOptions){
 const [rolls,setRolls]=useState<ScreenRollWithThrow[]>([]);
 const [held,setHeld]=useState<HeldDiceRoll|null>(null);
 const pending=useRef(new Map<string,{sides:number[];resolve:(v:number[])=>void;reject:(e:Error)=>void}>());
 const latest=useRef(options);latest.current=options;
 const clear=()=>{for(const p of pending.current.values())p.reject(new DOMException('Бросок отменён','AbortError'));pending.current.clear();setRolls([]);setHeld(null);};
 useEffect(()=>()=>{for(const p of pending.current.values())p.reject(new DOMException('Бросок отменён','AbortError'));pending.current.clear();},[]);
 useEffect(()=>{if(!options.enabled){for(const p of pending.current.values())p.resolve(p.sides.map(randomDie));pending.current.clear();setRolls([]);setHeld(null);}},[options.enabled]);
 const run=async <T,>(fn:()=>T,manual?:ManualDiceThrow):Promise<T>=>{
  if(latest.current.sound)unlockDiceAudio();
  return resolvePhysicalAction(fn,sides=>{
   if(!latest.current.enabled||sides.some(n=>n!==100&&!diceMesh(n))){if(latest.current.sound)playDiceAudio(latest.current.volume);return Promise.resolve(sides.map(randomDie));}
   return new Promise<number[]>((resolve,reject)=>{const id=manual?.id||crypto.randomUUID();pending.current.set(id,{sides,resolve,reject});setRolls(old=>[...old,{id,sides,manual}]);});
  });
 };
 const beginHold=(sides:number[],x:number,y:number)=>{if(!latest.current.enabled)return '';const id=crypto.randomUUID();setHeld({id,sides,x,y,angle:0});return id;};
 const moveHold=(id:string,x:number,y:number,angle:number)=>setHeld(old=>old?.id===id?{...old,x,y,angle}:old);
 const endHold=(id:string)=>setHeld(old=>old?.id===id?null:old);
 const overlay=<DiceScreenOverlay rolls={rolls} held={held} options={options} onComplete={(id,values)=>{const p=pending.current.get(id);if(p){pending.current.delete(id);p.resolve(values);}}} onExpire={id=>setRolls(old=>old.filter(r=>r.id!==id))}/>;
 return {run,overlay,clear,beginHold,moveHold,endHold,pending:pending.current.size};
}
