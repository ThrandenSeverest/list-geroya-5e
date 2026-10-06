'use client';
import { useState } from 'react';
import { HomebrewCommandInput } from './HomebrewCommandInput';
import { abilityLabels } from './rules';

const sources:Record<string,string>={fixed:'Постоянное число','@pb':'Бонус мастерства','@classLevel':'Уровень этого класса','@level':'Общий уровень персонажа','floor(@classLevel / 2)':'Половина уровня класса (вниз)',...Object.fromEntries(Object.entries(abilityLabels).map(([id,label])=>['@mod.'+id,'Модификатор: '+label])),dice:'Бросок кости',custom:'Своя формула'};
export function readSimpleValue(value:number|string){
 const text=String(value).trim();
 if(text!==''&&Number.isFinite(Number(text)))return {source:'fixed',amount:Number(text),bonus:0,dice:6};
 for(const source of Object.keys(sources).filter(key=>key.startsWith('@')||key.startsWith('floor('))){
  if(text===source)return {source,amount:1,bonus:0,dice:6};
  if(text.startsWith(source+' + ')||text.startsWith(source+' - ')){
   const tail=text.slice(source.length).replace(/\s/g,'');
   if(/^[+-]\d+(\.\d+)?$/.test(tail))return {source,amount:1,bonus:Number(tail),dice:6};
  }
 }
 const dice=/^(\d+)d(\d+)(?:\s*([+-])\s*(\d+))?$/.exec(text);
 if(dice)return {source:'dice',amount:Number(dice[1]),bonus:Number(dice[4]||0)*(dice[3]==='-'?-1:1),dice:Number(dice[2])};
 return {source:'custom',amount:1,bonus:0,dice:6};
}
export function simpleValueFormula(source:string,amount:number,bonus:number,dice:number){
 if(source==='fixed')return String(amount);
 const base=source==='dice'?`${amount}d${dice}`:source;
 return base+(bonus?` ${bonus<0?'-':'+'} ${Math.abs(bonus)}`:'');
}
export function HomebrewValueInput({value,onChange,label}:{value:number|string;onChange:(value:string)=>void;label:string}){
 const parsed=readSimpleValue(value),[manual,setManual]=useState(false);
 const mode=manual?'custom':parsed.source;
 const patch=(p:Partial<typeof parsed>)=>{const next={...parsed,...p};onChange(simpleValueFormula(next.source,next.amount,next.bonus,next.dice));};
 return <div className="hb-value-builder"><select aria-label={label+': способ расчёта'} value={mode} onChange={event=>{const source=event.target.value;setManual(source==='custom');if(source!=='custom')patch({source});}}>{Object.entries(sources).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select>{mode==='custom'?<HomebrewCommandInput label={label} value={String(value)} onChange={onChange}/>:<div className="hb-value-fields">{mode==='fixed'||mode==='dice'?<label>{mode==='dice'?'Количество костей':'Значение'}<input aria-label={label} type="number" min={mode==='dice'?1:undefined} max={mode==='dice'?100:undefined} value={parsed.amount} onChange={event=>patch({amount:Number(event.target.value)})}/></label>:null}{mode==='dice'&&<label>Кость<select aria-label={label+': кость'} value={parsed.dice} onChange={event=>patch({dice:Number(event.target.value)})}>{[...new Set([4,6,8,10,12,20,100,parsed.dice])].sort((a,b)=>a-b).map(die=><option key={die} value={die}>к{die}</option>)}</select></label>}{mode!=='fixed'&&<label>Дополнительный бонус<input aria-label={label+': бонус'} type="number" value={parsed.bonus} onChange={event=>patch({bonus:Number(event.target.value)})}/></label>}</div>}</div>;
}
