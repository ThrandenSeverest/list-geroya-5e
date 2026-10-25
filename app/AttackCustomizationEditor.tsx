'use client';
import {useEffect,useRef,useState} from 'react';
import type {ExportCharacter,AbilityScores} from './exportFormats';
import {abilityModifier,proficiencyBonus} from './exportFormats';
import type {CharacterAttack} from './combat';
import {abilityLabels} from './rules';
import {characterLevel} from './multiclass';
import {customizeAttack,type AttackCustomization} from './attackCustomization';
import {rollDice} from './adventure';
export function AttackCustomizationEditor({base,character:c,equipmentBonus,onSave,onClose}:{base:CharacterAttack;character:ExportCharacter;equipmentBonus:number;onSave:(patch:AttackCustomization|undefined)=>void;onClose:()=>void}){
 const [draft,setDraft]=useState<AttackCustomization>({...c.attackCustomizations?.[base.id]});
 const [error,setError]=useState('');
 const form=useRef<HTMLFormElement>(null);
 const preview=customizeAttack(base,c,draft);
 const pb=proficiencyBonus(characterLevel(c));
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;const overflow=document.body.style.overflow;document.body.style.overflow='hidden';form.current?.querySelector<HTMLInputElement>('input')?.focus();function key(e:KeyboardEvent){if(e.key==='Escape'){e.preventDefault();onClose();}if(e.key==='Tab'){const controls=[...form.current!.querySelectorAll<HTMLElement>('input,select,textarea,button,summary')].filter(x=>x.getClientRects().length);const first=controls[0],last=controls.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}}document.addEventListener('keydown',key);return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',key);previous?.focus({preventScroll:true});};},[onClose]);
 function set(patch:Partial<AttackCustomization>){setDraft({...draft,...patch});}
 return <div className="play-backdrop"><form ref={form} className="play-modal attack-editor" role="dialog" aria-modal="true" aria-label="Параметры атаки" onSubmit={e=>{e.preventDefault();try{if(!(draft.name??base.name).trim())throw new Error('Укажите название атаки.');const formula=draft.damageFormula??base.damageFormula;if(formula)rollDice(formula.replace(/\[(STR|DEX|CON|INT|WIS|CHA|PB)\]/gi,'1'),()=>0.5);onSave(draft);}catch(e){setError((e as Error).message);}}}>
 <header><h2>Параметры атаки</h2><small>{base.kind==='weapon'?'Оружие':base.kind==='feature'?'Способность':'Магия'}</small></header>
 <div className="attack-editor-fields"><label>Название<input value={draft.name??base.name} maxLength={150} onChange={e=>set({name:e.target.value})}/></label>
 {base.attackBonus!==undefined&&<><label>Характеристика попадания<select aria-label="Характеристика попадания" value={draft.ability??base.ability} onChange={e=>set({ability:e.target.value as keyof AbilityScores})}>{Object.entries(abilityLabels).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label><label className="play-check"><input type="checkbox" checked={draft.proficient??base.proficient} onChange={e=>set({proficient:e.target.checked})}/>Владение · бонус мастерства {pb}</label><output className="attack-editor-total">Попадание: {preview.attackBonus!+equipmentBonus>=0?'+':''}{preview.attackBonus!+equipmentBonus}<small>{abilityLabels[preview.ability]} {abilityModifier(c.abilities[preview.ability])} · мастерство {preview.proficient?pb:0} · особенности {preview.attackBonus!-abilityModifier(c.abilities[preview.ability])-(preview.proficient?pb:0)-(draft.bonus??0)} · ручная поправка {draft.bonus??0} · предметы {equipmentBonus}</small></output></>}
 <label>Формула урона<input aria-label="Формула урона" value={draft.damageFormula??base.damageFormula} onChange={e=>set({damageFormula:e.target.value})}/><small>Например, 1d8+[STR]. [PB] — мастерство.</small></label><label>Тип урона<input value={draft.damageType??''} placeholder="Из описания оружия / способности" onChange={e=>set({damageType:e.target.value})}/></label>
 <details><summary>Дополнительные параметры</summary><label>Дополнительный бонус попадания<input type="number" min={-100} max={100} value={draft.bonus??0} onChange={e=>set({bonus:Number(e.target.value)})}/></label><small>Магические предметы в экипировке уже учитываются автоматически. Здесь добавляется только отдельная поправка.</small><label>Описание и особые правила<textarea rows={4} value={draft.note??base.note??''} onChange={e=>set({note:e.target.value})}/></label><button type="button" onClick={()=>onSave(undefined)}>Вернуть автоматический расчёт</button></details>
 {error&&<p role="alert">{error}</p>}</div><footer><button type="button" onClick={onClose}>Отмена</button><button type="submit" className="play-primary">Сохранить</button></footer>
 </form></div>;
}
