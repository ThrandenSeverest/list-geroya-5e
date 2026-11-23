'use client';
import {useEffect,useState} from 'react';
export type PlayViewPreferences={density?:'compact'|'comfortable';hints:'brief'|'detailed';hiddenBlocks:string[];sessionPanels:Record<string,boolean>;layout:'columns'|'classic';diceAnimation:boolean;diceColor:string;diceLifetime:number;diceNumberColor:string;diceNumberStyle:'classic'|'modern'|'mono';diceSize:number;diceNumberScale:number;diceD4Mode:'vertex'|'face';diceD4Label:boolean;diceSound:boolean;diceVolume:number};
export const defaultPlayView:PlayViewPreferences={hints:'brief',hiddenBlocks:[],sessionPanels:{},layout:'columns',diceAnimation:true,diceColor:'#332c27',diceLifetime:3,diceNumberColor:'#fff0c8',diceNumberStyle:'classic',diceSize:1,diceNumberScale:1,diceD4Mode:'vertex',diceD4Label:true,diceSound:true,diceVolume:.5};
const key='herolist-play-view-v1';
const blockIds=['potions','quickSpells','turn','features'];
export function normalizePlayView(value:unknown):PlayViewPreferences {
  const v=value&&typeof value==='object'?value as Partial<PlayViewPreferences>:{};
  return {density:v.density==='compact'||v.density==='comfortable'?v.density:undefined,hints:v.hints==='detailed'?'detailed':'brief',hiddenBlocks:Array.isArray(v.hiddenBlocks)?v.hiddenBlocks.filter(id=>blockIds.includes(id)):[],sessionPanels:Object.fromEntries(Object.entries(v.sessionPanels||{}).filter(([k,v])=>['actions','hero','spells','inventory','journal','resources'].includes(k)&&typeof v==='boolean')),layout:v.layout==='classic'?'classic':'columns',diceAnimation:v.diceAnimation!==false,diceColor:typeof v.diceColor==='string'&&/^#[0-9a-f]{6}$/i.test(v.diceColor)?v.diceColor:'#332c27',diceNumberColor:typeof v.diceNumberColor==='string'&&/^#[0-9a-f]{6}$/i.test(v.diceNumberColor)?v.diceNumberColor:'#fff0c8',diceNumberStyle:v.diceNumberStyle==='modern'||v.diceNumberStyle==='mono'?v.diceNumberStyle:'classic',diceSize:typeof v.diceSize==='number'&&Number.isFinite(v.diceSize)?Math.max(.5,Math.min(3,v.diceSize)):1,diceNumberScale:typeof v.diceNumberScale==='number'&&Number.isFinite(v.diceNumberScale)?Math.max(.7,Math.min(1.4,v.diceNumberScale)):1,diceD4Mode:v.diceD4Mode==='face'?'face':'vertex',diceD4Label:v.diceD4Label!==false,diceSound:v.diceSound!==false,diceVolume:typeof v.diceVolume==='number'&&Number.isFinite(v.diceVolume)?Math.max(0,Math.min(1,v.diceVolume)):.5,diceLifetime:typeof v.diceLifetime==='number'&&Number.isFinite(v.diceLifetime)?Math.max(0,Math.min(300,v.diceLifetime)):3};
}
export function usePlayViewPreferences(){
  const [view,setView]=useState<PlayViewPreferences>(defaultPlayView);
  useEffect(()=>{try{setView(normalizePlayView(JSON.parse(localStorage.getItem(key)||'null')));}catch{}},[]);
  function update(patch:Partial<PlayViewPreferences>){setView(previous=>{const next=normalizePlayView({...previous,...patch});try{localStorage.setItem(key,JSON.stringify(next));}catch{}return next;});}
  return [view,update] as const;
}
