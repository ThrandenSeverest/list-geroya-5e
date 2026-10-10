"use client";
import { useEffect,useRef,useState,useId,type CSSProperties } from "react";
import { Settings } from "lucide-react";
import colors from "./themeColors.json";
import { defaultPreferences,normalizePreferences,paletteRoles,changePaletteRole,themeStyle,type BaseTheme,type InterfacePreferences,type ThemePreset } from "./interfacePreferences";
const storageKey="list-geroya-interface-v1";
export function useInterfacePreferences() {
  const [preferences,setPreferences]=useState<InterfacePreferences>(defaultPreferences);
  const [loaded,setLoaded]=useState(false);
  useEffect(()=>{try{setPreferences(normalizePreferences(JSON.parse(localStorage.getItem(storageKey)||"null")));}catch{/* Keep defaults if storage is invalid. */}setLoaded(true);},[]);
  useEffect(()=>{if(!loaded)return;try{localStorage.setItem(storageKey,JSON.stringify(preferences));}catch{/* The current session remains usable without storage. */}document.documentElement.style.setProperty("--interface-zoom",String(preferences.zoom/100));},[preferences,loaded]);
  return {preferences,update:setPreferences,style:themeStyle(preferences,preferences.presets.find(p=>p.id===preferences.activePreset)?.base || "classic") as CSSProperties};
}
type Appearance=ReturnType<typeof useInterfacePreferences>;
export function ThemeControls({label,theme,onCycle,onTheme,appearance}:{label:string;theme:BaseTheme;onCycle:()=>void;onTheme:(theme:BaseTheme)=>void;appearance:Appearance}) {
  const settingsId=useId();
  const dialog=useRef<HTMLDialogElement>(null);
  const {preferences,update}=appearance;
  const active=preferences.presets.find(p=>p.id===preferences.activePreset);
  const [draft,setDraft]=useState<ThemePreset|null>(null);
  const [notice,setNotice]=useState("");
  function open(){setDraft(active ? {...active,colors:{...active.colors}} : null);setNotice("");dialog.current?.showModal();}
  function select(id:string){const preset=preferences.presets.find(p=>p.id===id);update({...preferences,activePreset:id});if(preset)onTheme(preset.base);setDraft(preset?{...preset,colors:{...preset.colors}}:null);setNotice("");}
  function create(){const preset:ThemePreset={id:crypto.randomUUID(),name:"Моя тема",base:theme,colors:{}};setDraft(preset);update({...preferences,activePreset:preset.id,presets:[...preferences.presets,preset]});setNotice("Новая тема создана. Изменения цветов сохраняются автоматически.");}
  function edit(next:ThemePreset){setDraft(next);update({...preferences,presets:preferences.presets.map(p=>p.id===next.id?next:p)});}
  return <span className="theme-controls"><button className={`experimental-toggle theme-${theme}`} onClick={onCycle} title={`Включить ${theme === "classic"?"пергаментный":"синий с золотом"} дизайн`}>{label}</button><button className="experimental-toggle theme-gear" onClick={open} aria-label="Настройки интерфейса" title="Настройки интерфейса"><Settings size={18} aria-hidden="true" /></button>
    <dialog ref={dialog} className="interface-settings" aria-labelledby={settingsId} onClick={event=>{if(event.target===dialog.current){const r=dialog.current.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.current.close();}}}>
      <header><h2 id={settingsId}>Настройки интерфейса</h2><button onClick={()=>dialog.current?.close()} aria-label="Закрыть настройки">✕</button></header>
      <label>Размер интерфейса на ПК: {preferences.zoom}%<input aria-label="Размер интерфейса на ПК" type="range" min="75" max="175" step="5" value={preferences.zoom} onChange={e=>update({...preferences,zoom:Number(e.target.value)})}/></label>
      <label>Размер шрифта: {preferences.font}%<input aria-label="Размер шрифта" type="range" min="80" max="160" step="5" value={preferences.font} onChange={e=>update({...preferences,font:Number(e.target.value)})}/></label>
      <p>Масштаб интерфейса применяется на компьютере. Размер шрифта меняется отдельно; печатный и мобильный листы сохраняют свои размеры.</p>
      <button onClick={()=>update({...preferences,zoom:125,font:100})}>Сбросить размеры</button>
      <label>Цветовая тема<select value={preferences.activePreset || theme} onChange={e=>{const value=e.target.value;if(value==="classic"||value==="parchment"){update({...preferences,activePreset:""});onTheme(value);setDraft(null);}else select(value);}}><option value="classic">Синий с золотом</option><option value="parchment">Пергамент</option>{preferences.presets.map(p=><option key={p.id} value={p.id}>{p.name || "Моя тема"}</option>)}</select></label>
      <div className="theme-preset-actions"><button onClick={create}>Создать свою тему</button>{draft&&<><button onClick={()=>{const copy={...draft,id:crypto.randomUUID(),name:`${draft.name} — копия`,colors:{...draft.colors}};update({...preferences,activePreset:copy.id,presets:[...preferences.presets,copy]});setDraft(copy);}}>Копировать тему</button><button onClick={()=>{if(!confirm(`Удалить тему «${draft.name}»?`))return;update({...preferences,activePreset:"",presets:preferences.presets.filter(p=>p.id!==draft.id)});setDraft(null);}}>Удалить тему</button></>}</div>
      {draft&&<><label>Название темы<input maxLength={80} value={draft.name} onChange={e=>edit({...draft,name:e.target.value})}/></label><label>Основа темы<select value={draft.base} onChange={e=>{const base=e.target.value as BaseTheme;edit({...draft,base,colors:{},roles:{}});onTheme(base);}}><option value="classic">Синий с золотом</option><option value="parchment">Пергамент</option></select></label><div className="theme-palette">{paletteRoles.map((role,index)=><label key={role.token}>{role.label}<input type="color" aria-label={role.label} value={draft.roles?.[role.token] || draft.colors[role[draft.base]] || `#${role[draft.base]}`} onChange={e=>edit(changePaletteRole(draft,index,e.target.value))}/></label>)}</div><details><summary>Все цвета · тонкая настройка</summary><p>Здесь можно изменить отдельные оттенки, включая служебные цвета и эффекты. Исходный цвет указан рядом с образцом.</p><div className="theme-palette">{colors.map(color=><label key={color}>#{color}<input type="color" aria-label={`Цвет #${color}`} value={draft.colors[color]||`#${color}`} onChange={e=>edit({...draft,colors:{...draft.colors,[color]:e.target.value}})}/></label>)}</div></details><div className="theme-preset-actions"><button onClick={()=>edit({...draft,colors:{},roles:{}})}>Вернуть цвета основы</button><button onClick={()=>{setNotice("Тема сохранена в этом браузере.");}}>Сохранить тему</button></div></>}
      <p role="status">{notice}</p>
    </dialog></span>;
}
