'use client';
import { useState, type ReactNode } from 'react';
import type { HomebrewElement } from './homebrew';
import { abilityLabels } from './rules';
import { magicLevel, magicSpellList, slotSummary, magicFeatureIds } from './homebrewMagic';

export function HomebrewMagicWorkspace({root,level,entities,settings,onChange,featureId}:{root:HomebrewElement;level:number;entities:HomebrewElement[];settings:ReactNode;onChange:(p:Partial<HomebrewElement>)=>void;featureId?:string}) {
 const [modifier,setModifier]=useState(3),[previewLevel,setPreviewLevel]=useState(level),[query,setQuery]=useState('');
 const [settingsOpen,setSettingsOpen]=useState(()=>!root.spellcasting||root.spellcasting.mode==='none');
 const linked=featureId?magicFeatureIds(root).includes(featureId):true;
 if(!linked)return null;
 const casting=root.spellcasting;
 const list=magicSpellList(root,entities);
 let error='',rows:ReturnType<typeof magicLevel>[]=[];
 try {rows=Array.from({length:20},(_,i)=>magicLevel(root,i+1,modifier));}catch(e){error=(e as Error).message;}
 const current=rows[previewLevel-1];
 const sources=magicFeatureIds(root).map(id=>root.features?.find(f=>f.id===id)?.name).filter(Boolean);
 return <section className="hb-magic-workspace" aria-label="Магия и заклинания способности"><header><h3>Магия и заклинания</h3><small>Связь с настройками определяется автоматически</small></header>
 <p>Настройки класса «{root.name}»{sources.length?` · способности: ${sources.join(', ')}`:''}. Изменения здесь сразу обновляют общую магию класса. Доступность ячеек и заклинаний определяется таблицей уровней ниже.</p>
 {!casting||casting.mode==='none'?<p role="status">Магия ещё не настроена. Выберите прогрессию и заполните лимиты ниже.</p>:<>
 <div className="hb-magic-facts"><span><b>Характеристика</b>{abilityLabels[casting.ability]}</span><span><b>Получение заклинаний</b>{{known:'Известные',prepared:'Подготовленные',spellbook:'Книга заклинаний'}[casting.selection||'known']}</span><span><b>Восстановление ячеек</b>{casting.recovery==='short_or_long'||casting.mode==='pact'?'Короткий или длинный отдых':'Длинный отдых'}</span><span><b>Список класса</b>{list.length} заклинаний</span></div>
 <div className="hb-toolbar"><label>Уровень предпросмотра<input aria-label="Уровень предпросмотра магии" type="number" min={1} max={20} value={previewLevel} onChange={e=>setPreviewLevel(Math.max(1,Math.min(20,Number(e.target.value)||1)))}/></label><label>Модификатор магии<input aria-label="Модификатор магии предпросмотра" type="number" min={-5} max={10} value={modifier} onChange={e=>setModifier(Number(e.target.value))}/></label></div>
 {error?<p role="alert">Проверьте формулу: {error}</p>:current&&<output className="hb-magic-preview"><strong>{previewLevel} уровень</strong><span>Заговоров: {current.cantrips}</span><span>{casting.selection==='prepared'?'Подготовлено: '+current.prepared:'Известно: '+current.known}</span><span>Ячейки: {slotSummary(current.slots)}</span><span>СЛ спасброска: {8+2+Math.floor((previewLevel-1)/4)+modifier} · Атака заклинанием: {2+Math.floor((previewLevel-1)/4)+modifier>=0?'+':''}{2+Math.floor((previewLevel-1)/4)+modifier}</span></output>}
 <details><summary>Развитие магии: уровни 1–20</summary><div className="hb-magic-table-wrap"><table><thead><tr><th>Уровень</th><th>Заговоры</th><th>{casting.selection==='prepared'?'Подготовлено':'Известно'}</th><th>Ячейки по кругам</th></tr></thead><tbody>{rows.map(row=><tr key={row.level}><td>{row.level}</td><td>{row.cantrips}</td><td>{row.prepared??row.known}</td><td>{slotSummary(row.slots)}</td></tr>)}</tbody></table></div></details>
 <details><summary>Доступные заклинания · {list.length}</summary><input aria-label="Поиск в списке магии способности" placeholder="Название заклинания" value={query} onChange={e=>setQuery(e.target.value)}/>{!list.length&&<p>Список пуст: подключите готовый список или добавьте заклинания в настройках ниже.</p>}<div className="hb-magic-spell-list">{list.filter(spell=>spell.name.toLowerCase().includes(query.toLowerCase())).map(spell=><span key={spell.id}>{spell.name}<small>{spell.level?`${spell.level}-й круг`:'Заговор'}</small></span>)}</div></details></>}
 <details className="hb-magic-settings" open={settingsOpen} onToggle={event=>setSettingsOpen(event.currentTarget.open)}><summary>Редактировать магию, ячейки и список заклинаний</summary>{settings}</details>
 <p className="hb-sidebar-note">Описание способности содержит правила, которые не выражены настройками: например, ритуалы, фокусировку и особые ограничения.</p>
 </section>;
}
