'use client';
import {useEffect,useState} from 'react';
export type PlayViewPreferences={density?:'compact'|'comfortable';hints:'brief'|'detailed';hiddenBlocks:string[];sessionPanels:Record<string,boolean>;layout:'columns'|'classic'};
export const defaultPlayView:PlayViewPreferences={hints:'brief',hiddenBlocks:[],sessionPanels:{},layout:'columns'};
const key='herolist-play-view-v1';
const blockIds=['potions','quickSpells','turn','features'];
export function normalizePlayView(value:unknown):PlayViewPreferences {
  const v=value&&typeof value==='object'?value as Partial<PlayViewPreferences>:{};
  return {density:v.density==='compact'||v.density==='comfortable'?v.density:undefined,hints:v.hints==='detailed'?'detailed':'brief',hiddenBlocks:Array.isArray(v.hiddenBlocks)?v.hiddenBlocks.filter(id=>blockIds.includes(id)):[],sessionPanels:Object.fromEntries(Object.entries(v.sessionPanels||{}).filter(([k,v])=>['actions','hero','spells','inventory','journal','resources'].includes(k)&&typeof v==='boolean')),layout:v.layout==='classic'?'classic':'columns'};
}
export function usePlayViewPreferences(){
  const [view,setView]=useState<PlayViewPreferences>(defaultPlayView);
  useEffect(()=>{try{setView(normalizePlayView(JSON.parse(localStorage.getItem(key)||'null')));}catch{}},[]);
  function update(patch:Partial<PlayViewPreferences>){setView(previous=>{const next=normalizePlayView({...previous,...patch});try{localStorage.setItem(key,JSON.stringify(next));}catch{}return next;});}
  return [view,update] as const;
}
