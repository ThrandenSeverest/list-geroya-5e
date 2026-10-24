'use client';
import type { ExportCharacter } from './exportFormats';
export const playTabs = [['actions','Действия'],['spells','Магия'],['inventory','Рюкзак'],['hero','Герой'],['journal','Журнал']] as const;
export function orderedPlayTabs(c: ExportCharacter) {
  const order=c.adventure?.mobileLayout?.tabOrder || [];
  return [...playTabs].sort((a,b)=>(order.includes(a[0])?order.indexOf(a[0]):order.length+playTabs.findIndex(t=>t[0]===a[0]))-(order.includes(b[0])?order.indexOf(b[0]):order.length+playTabs.findIndex(t=>t[0]===b[0])));
}
export function PlayInterfaceSettings({character:c,onChange}:{character:ExportCharacter;onChange:(c:ExportCharacter)=>void}) {
  const a=c.adventure!, layout=a.mobileLayout || {};
  const update=(patch:Partial<NonNullable<typeof a.mobileLayout>>)=>onChange({...c,adventure:{...a,mobileLayout:{...layout,...patch}}});
  const rows=orderedPlayTabs(c);
  function move(id:string,step:number) {const ids=rows.map(t=>t[0]);const index=ids.indexOf(id as typeof ids[number]);[ids[index],ids[index+step]]=[ids[index+step],ids[index]];update({tabOrder:ids});}
  return <details className="play-card play-interface-settings"><summary>Настроить интерфейс и расположение панелей</summary><p>Настройки сохраняются для этого приключения. На телефоне можно менять порядок разделов и скрывать лишние кнопки.</p><div className="play-grid">
    <label>Плотность<select aria-label="Плотность" value={a.interfaceDensity || 'compact'} onChange={e=>onChange({...c,adventure:{...a,interfaceDensity:e.target.value as 'compact'|'comfortable'}})}><option value="compact">Компактная</option><option value="comfortable">Свободная</option></select></label>
    <label>Навигация на телефоне<select aria-label="Навигация на телефоне" value={layout.navPosition || 'bottom'} onChange={e=>update({navPosition:e.target.value as 'top'|'bottom'})}><option value="bottom">Внизу экрана</option><option value="top">Над разделами</option></select></label>
    <label>Панель здоровья и КД<select aria-label="Панель здоровья и КД" value={layout.hudPosition || 'top'} onChange={e=>update({hudPosition:e.target.value as 'top'|'bottom'})}><option value="top">Над содержимым</option><option value="bottom">Под содержимым</option></select></label>
    <label>Кнопка кубов<select aria-label="Кнопка кубов" value={layout.hideDice?'hidden':layout.diceSide || 'right'} onChange={e=>update({hideDice:e.target.value==='hidden',diceSide:e.target.value==='left'?'left':'right'})}><option value="right">Справа</option><option value="left">Слева</option><option value="hidden">Скрыта</option></select></label>
  </div><div className="play-tab-settings">{rows.map(([id,label],index)=><div className="play-row" key={id}><label className="play-check"><input type="checkbox" checked={!layout.hiddenTabs?.includes(id)} disabled={id==='actions'} onChange={e=>update({hiddenTabs:e.target.checked?(layout.hiddenTabs||[]).filter(t=>t!==id):[...(layout.hiddenTabs||[]),id]})}/>{label}</label><button disabled={index===0} aria-label={`Переместить выше: ${label}`} onClick={()=>move(id,-1)}>↑</button><button disabled={index===rows.length-1} aria-label={`Переместить ниже: ${label}`} onClick={()=>move(id,1)}>↓</button></div>)}</div><button onClick={()=>onChange({...c,adventure:{...a,mobileLayout:undefined,interfaceDensity:'compact'}})}>Сбросить расположение</button></details>;
}
