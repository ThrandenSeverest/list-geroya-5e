"use client";
import { useEffect,useRef,useState,useId,type CSSProperties } from "react";
import { Settings } from "lucide-react";
import colors from "./themeColors.json";
import { calmPresets,designChoices,findDesign } from './designPresets';
import { assetUrl } from './assetUrl';
import { defaultPreferences,normalizePreferences,paletteRoles,changePaletteRole,themeStyle,type BaseTheme,type InterfacePreferences,type ThemePreset } from "./interfacePreferences";
const storageKey="list-geroya-interface-v1";
export function useInterfacePreferences() {
  const [preferences,setPreferences]=useState<InterfacePreferences>(defaultPreferences);
  const [loaded,setLoaded]=useState(false);
  const [showDesignPicker,setShowDesignPicker]=useState(false);
  useEffect(()=>{let next=defaultPreferences;try{next=normalizePreferences(JSON.parse(localStorage.getItem(storageKey)||"null"));}catch{/* Keep defaults if storage is invalid. */}setPreferences(next);setShowDesignPicker(!next.rememberDesign);setLoaded(true);},[]);
  useEffect(()=>{if(!loaded)return;try{localStorage.setItem(storageKey,JSON.stringify(preferences));}catch{/* The current session remains usable without storage. */}document.documentElement.style.setProperty("--interface-zoom",String(preferences.zoom/100));},[preferences,loaded]);
  return {preferences,update:setPreferences,showDesignPicker,closeDesignPicker:()=>setShowDesignPicker(false),style:themeStyle(preferences,findDesign(preferences.presets,preferences.activePreset)?.base || "classic") as CSSProperties};
}
type Appearance=ReturnType<typeof useInterfacePreferences>;
export function ThemeControls({label,theme,onCycle,onTheme,appearance}:{label:string;theme:BaseTheme;onCycle:()=>void;onTheme:(theme:BaseTheme)=>void;appearance:Appearance}) {
  const settingsId=useId();
  const dialog=useRef<HTMLDialogElement>(null);
  const {preferences,update}=appearance;
  const active=findDesign(preferences.presets,preferences.activePreset);
  const [draft,setDraft]=useState<ThemePreset|null>(null);
  const [notice,setNotice]=useState("");
  const [gallery,setGallery]=useState(false);
  const owner=useRef<HTMLSpanElement>(null);
  useEffect(()=>{if(appearance.showDesignPicker && document.querySelector('.theme-controls')===owner.current){setGallery(true);dialog.current?.showModal();}},[appearance.showDesignPicker]);
  function close(){dialog.current?.close();appearance.closeDesignPicker();}
  function open(chooser=false){setGallery(chooser);setDraft(active && !calmPresets.some(p=>p.id===active.id) ? {...active,colors:{...active.colors}} : null);setNotice("");dialog.current?.showModal();}
  function select(id:string){const preset=findDesign(preferences.presets,id);update({...preferences,activePreset:preset?id:''});onTheme(preset?.base || (id==='parchment'?'parchment':'classic'));setDraft(preset && !calmPresets.some(p=>p.id===preset.id)?{...preset,colors:{...preset.colors}}:null);setNotice("");}
  function create(){const preset:ThemePreset={id:crypto.randomUUID(),name:"Моя тема",base:active?.base || theme,layout:active?.layout || (calmPresets.some(p=>p.id===active?.id)?active?.id:undefined),colors:{...active?.colors},roles:{...active?.roles}};setDraft(preset);setGallery(false);update({...preferences,activePreset:preset.id,presets:[...preferences.presets,preset]});setNotice("Новая тема создана. Изменения цветов сохраняются автоматически.");}
  function edit(next:ThemePreset){setDraft(next);update({...preferences,presets:preferences.presets.map(p=>p.id===next.id?next:p)});}
  return <span ref={owner} className="theme-controls"><button className={`experimental-toggle theme-${theme}`} onClick={()=>open(true)} title="Выбрать оформление сайта">{label}</button><button className="experimental-toggle theme-gear" onClick={()=>open(false)} aria-label="Настройки интерфейса" title="Настройки интерфейса"><Settings size={18} aria-hidden="true" /></button>
    <dialog ref={dialog} className={`interface-settings${gallery?' design-gallery-dialog':''}`} aria-labelledby={settingsId} onClose={appearance.closeDesignPicker} onClick={event=>{if(event.target===dialog.current){const r=dialog.current.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close();}}}>
      <header><h2 id={settingsId}>{gallery?'Выберите дизайн HeroList':'Настройки интерфейса'}</h2><button onClick={close} aria-label="Закрыть настройки">✕</button></header>
      {gallery ? <>
        <p>Пять вариантов оформления. Вы сможете сменить дизайн в любой момент.</p>
        <div className="design-gallery">{designChoices.map(choice=><button key={choice.id} className="design-preview" aria-pressed={(preferences.activePreset || theme)===choice.id} onClick={()=>select(choice.id)}><img src={assetUrl(`design-previews/${choice.image}.svg`)} alt={`Превью: ${choice.name}`} width="600" height="360"/><strong>{choice.name}</strong><span>{choice.description}</span><b>{(preferences.activePreset || theme)===choice.id?'✓ Выбрано':'Выбрать'}</b></button>)}{preferences.presets.map(p=><button key={p.id} className="design-preview" aria-pressed={preferences.activePreset===p.id} onClick={()=>select(p.id)}><img src={assetUrl(`design-previews/${p.layout || p.base}.svg`)} alt={`Основа пользовательской темы: ${p.name}`} width="600" height="360"/><strong>{p.name}</strong><span>Своя палитра</span></button>)}</div>
        <label className="design-remember"><input type="checkbox" checked={preferences.rememberDesign===true} onChange={e=>update({...preferences,rememberDesign:e.target.checked})}/>Запомнить выбор и не спрашивать при запуске</label>
        <div className="theme-preset-actions"><button onClick={create}>Создать свой дизайн</button><button onClick={close}>Использовать выбранный дизайн</button></div>
      </> : <>
      <label>Размер интерфейса на ПК: {preferences.zoom}%<input aria-label="Размер интерфейса на ПК" type="range" min="75" max="175" step="5" value={preferences.zoom} onChange={e=>{const zoom=Number(e.target.value);update(current=>({...current,zoom}));}}/></label>
      <label>Размер шрифта: {preferences.font}%<input aria-label="Размер шрифта" type="range" min="80" max="160" step="5" value={preferences.font} onChange={e=>{const font=Number(e.target.value);update(current=>({...current,font}));}}/></label>
      <p>Масштаб интерфейса применяется на компьютере. Размер шрифта меняется отдельно; печатный и мобильный листы сохраняют свои размеры.</p>
      <button onClick={()=>update({...preferences,zoom:125,font:100})}>Сбросить размеры</button>
      <label>Цветовая тема<select value={preferences.activePreset || theme} onChange={e=>select(e.target.value)}>{designChoices.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}{preferences.presets.map(p=><option key={p.id} value={p.id}>{p.name || "Моя тема"}</option>)}</select></label>
      <button onClick={()=>setGallery(true)}>Превью всех дизайнов</button>
      <div className="theme-preset-actions"><button onClick={create}>Создать свою тему</button>{draft&&<><button onClick={()=>{const copy={...draft,id:crypto.randomUUID(),name:`${draft.name} — копия`,colors:{...draft.colors}};update({...preferences,activePreset:copy.id,presets:[...preferences.presets,copy]});setDraft(copy);}}>Копировать тему</button><button onClick={()=>{if(!confirm(`Удалить тему «${draft.name}»?`))return;update({...preferences,activePreset:"",presets:preferences.presets.filter(p=>p.id!==draft.id)});setDraft(null);}}>Удалить тему</button></>}</div>
      {draft&&<><label>Название темы<input maxLength={80} value={draft.name} onChange={e=>edit({...draft,name:e.target.value})}/></label><label>Основа темы<select value={draft.base} onChange={e=>{const base=e.target.value as BaseTheme;edit({...draft,base,colors:{},roles:{}});onTheme(base);}}><option value="classic">Синий с золотом</option><option value="parchment">Пергамент</option></select></label><div className="theme-palette">{paletteRoles.map((role,index)=><label key={role.token}>{role.label}<input type="color" aria-label={role.label} value={draft.roles?.[role.token] || draft.colors[role[draft.base]] || `#${role[draft.base]}`} onChange={e=>edit(changePaletteRole(draft,index,e.target.value))}/></label>)}</div><details><summary>Все цвета · тонкая настройка</summary><p>Здесь можно изменить отдельные оттенки, включая служебные цвета и эффекты. Исходный цвет указан рядом с образцом.</p><div className="theme-palette">{colors.map(color=><label key={color}>#{color}<input type="color" aria-label={`Цвет #${color}`} value={draft.colors[color]||`#${color}`} onChange={e=>edit({...draft,colors:{...draft.colors,[color]:e.target.value}})}/></label>)}</div></details><div className="theme-preset-actions"><button onClick={()=>edit({...draft,colors:{},roles:{}})}>Вернуть цвета основы</button><button onClick={()=>{setNotice("Тема сохранена в этом браузере.");}}>Сохранить тему</button></div></>}
      <p role="status">{notice}</p></>}
    </dialog></span>;
}
