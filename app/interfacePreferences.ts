import colors from "./themeColors.json";
import { calmPresets,findDesign } from './designPresets';
export type BaseTheme = "classic" | "parchment";
export type ThemePreset = { id:string; name:string; base:BaseTheme; colors:Record<string,string>; roles?:Record<string,string>; layout?:string };
export type InterfacePreferences = { zoom:number; font:number; activePreset:string; presets:ThemePreset[]; rememberDesign?:boolean };
export const defaultPreferences:InterfacePreferences = { zoom:125, font:100, activePreset:"", presets:[],rememberDesign:false };
const limit = (value:unknown,min:number,max:number,fallback:number) => typeof value === "number" && Number.isFinite(value) ? Math.min(max,Math.max(min,Math.round(value))) : fallback;
export function normalizePreferences(value:unknown):InterfacePreferences {
  const raw = value && typeof value === "object" ? value as Partial<InterfacePreferences> : {};
  const seen = new Set<string>();
  const presets = (Array.isArray(raw.presets) ? raw.presets : []).filter(p => p && typeof p.id === "string" && !seen.has(p.id) && seen.add(p.id)).map(p => ({ id:p.id, name:typeof p.name === "string" ? p.name.slice(0,80) : "Моя тема", base:p.base === "parchment" ? "parchment" as const : "classic" as const, roles:Object.fromEntries(Object.entries(p.roles && typeof p.roles === "object" ? p.roles : {}).filter(([key,value])=>paletteRoles.some(role=>role.token===key) && typeof value === "string" && /^#[\da-f]{6}$/i.test(value))), colors:Object.fromEntries(Object.entries(p.colors && typeof p.colors === "object" ? p.colors : {}).filter(([key,value]) => colors.includes(key) && typeof value === "string" && /^#[\da-f]{6}$/i.test(value))) }));
  const safePresets=presets.map(p=>({...p,layout:calmPresets.some(b=>b.id===(raw.presets?.find(r=>r?.id===p.id)?.layout))?raw.presets?.find(r=>r?.id===p.id)?.layout:undefined}));
  return { zoom:limit(raw.zoom,75,175,125),font:limit(raw.font,80,160,100),activePreset:findDesign(safePresets,raw.activePreset || '')?raw.activePreset!:"",presets:safePresets,rememberDesign:raw.rememberDesign===true };
}
export const paletteRoles = [
  { label:"Фон страницы", token:"ink", classic:"050f14", parchment:"f2e3bd", aliases:[] },
  { label:"Основной фон", token:"panel", classic:"09171d", parchment:"efe0b9", aliases:["f8eccc"] },
  { label:"Вторичный фон", token:"panel-2", classic:"0d2027", parchment:"e5d0a2", aliases:["ead8ae","ead5a7","ead4a5"] },
  { label:"Фон карточек и полей", token:"surface", classic:"081116", parchment:"f6ebcb", aliases:["fff7dc"] },
  { label:"Основной текст", token:"ivory", classic:"eee1cf", parchment:"17120e", aliases:[] },
  { label:"Вторичный текст", token:"muted", classic:"9aa4a5", parchment:"5e5347", aliases:["554b40"] },
  { label:"Рамки", token:"line", classic:"34464d", parchment:"17120e", aliases:["7d6a55","8c7258"] },
  { label:"Акцент выбора", token:"selection", classic:"e1a071", parchment:"8f1821", aliases:["7a141b","7b1119","941b24","b5222d","8d1820","a91e29"] },
  { label:"Светлый акцент", token:"copper-light", classic:"e1a071", parchment:"b5222d", aliases:[] },
  { label:"Тёмный акцент", token:"copper", classic:"b8754b", parchment:"941b24", aliases:["6b0d14"] },
  { label:"Текст на акценте", token:"accent-text", classic:"f0d39a", parchment:"fff8e7", aliases:["fff7df"] },
  { label:"Ссылки и подсказки", token:"teal", classic:"76aaa5", parchment:"566f76", aliases:["405c63","4b5f65","4d6870"] },
  { label:"Золотой акцент", token:"gold", classic:"c8a15e", parchment:"8d1820", aliases:[] },
  { label:"Яркий акцент", token:"gold-bright", classic:"f0d39a", parchment:"b5222d", aliases:[] },
  { label:"Глубокий акцент", token:"gold-deep", classic:"76501e", parchment:"5e0c12", aliases:[] },
];
export function changePaletteRole(preset:ThemePreset,index:number,color:string):ThemePreset {
  const role=paletteRoles[index];
  return {...preset,roles:{...preset.roles,[role.token]:color},colors:{...preset.colors,...Object.fromEntries([role[preset.base],...(preset.base === "parchment" ? role.aliases : [])].map(key=>[key,color]))}};
}
export function themeStyle(preferences:InterfacePreferences,base:BaseTheme):Record<string,string|number> {
  const preset=findDesign(preferences.presets,preferences.activePreset);
  const style:Record<string,string|number>={"--interface-font":preferences.font/100};
  if(!preset)return style;
  for(const role of paletteRoles)style[`--${role.token}`]=preset.roles?.[role.token] || preset.colors[role[base]] || `#${role[base]}`;
  for(const [key,value] of Object.entries(preset.colors)) {
    style[`--theme-${key}`]=value;
    style[`--theme-rgb-${key}`]=[1,3,5].map(i=>parseInt(value.slice(i,i+2),16)).join(",");
  }
  return style;
}
