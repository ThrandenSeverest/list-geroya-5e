'use client';
import { useState } from 'react';
import type { CatalogSpell } from './catalog';
import type { ExportCharacter } from './exportFormats';
import { rollD20, rollDice, type DiceResult, type RollMode } from './adventure';
import { spellPlayProfile } from './playSpells';

type Props = { character: ExportCharacter; spell: CatalogSpell; classId: string; slotLevel: number; committed: boolean; initialAttack?: DiceResult; mode: RollMode; onRoll: (name: string, result: DiceResult) => void; onClose: () => void };
export function SpellRollPanel({ character, spell, classId, slotLevel, committed, initialAttack, mode, onRoll, onClose }: Props) {
 const [level,setLevel] = useState(slotLevel);
 const [manual,setManual] = useState<string | undefined>();
 const [attacks,setAttacks] = useState<Record<number,DiceResult>>(initialAttack ? {0:initialAttack} : {});
 const [error,setError] = useState('');
 const profile = spellPlayProfile(character,spell,level,classId);
 const formula = manual ?? profile.damageFormula ?? profile.healingFormula ?? '';
 function cast(name:string,fn:()=>DiceResult) { try { const result=fn();onRoll(`${spell.name}: ${name}`,result);setError('');return result; } catch(e) {setError(e instanceof Error?e.message:String(e));} }
 function damage(index=0,critical=false) {cast(`${profile.healingFormula ? 'лечение' : profile.delivery==='effect' ? 'эффект' : 'урон'}${profile.projectiles>1 ? ` · снаряд ${index+1}` : ''}${critical?' · крит':''}`,()=>rollDice(formula,undefined,critical));}
 return <section className="play-resolution play-card" aria-label={`Броски заклинания: ${spell.name}`}>
 <header className="play-row play-wrap"><div><small>{committed?'Сотворено · стоимость уже учтена':'Броски · без расхода ячейки'}</small><h2>{spell.name}</h2></div><button onClick={onClose}>Закрыть броски</button></header>
 {spell.level>0 && <label>Круг ячейки для расчёта<select aria-label="Круг ячейки для расчёта" disabled={committed} value={level} onChange={e=>{setLevel(Number(e.target.value));setManual(undefined);setAttacks({});}}>{Array.from({length:10-spell.level},(_,i)=>spell.level+i).map(n=><option key={n} value={n}>{n} круг</option>)}</select></label>}
 <p>{committed?'Броски ниже не расходуют ячейку повторно.':'Чтобы потратить ячейку и начать концентрацию, используйте «Сотворить» в карточке.'}</p>
 {profile.saveDc!==undefined && <p>Спасбросок {profile.saveAbility||'цели'}: <b>Сл {profile.saveDc}</b>. Крит недоступен.</p>}
 {profile.delivery==='automatic' && <p>Автоматическое попадание. Крит недоступен.</p>}
 <label>{profile.healingFormula?'Формула лечения':profile.delivery==='effect'?'Формула эффекта':'Формула урона'}<input aria-label="Формула броска заклинания" value={formula} placeholder="Например, 8d6 или 2d8+4d6" onChange={e=>setManual(e.target.value)}/></label>
 {!formula && <p>Автоматическая формула не определена. Введите её по описанию заклинания.</p>}
 {manual!==undefined && <button onClick={()=>setManual(undefined)}>Вернуть формулу заклинания</button>}
 {profile.projectiles>1 && <p>Снарядов / лучей: {profile.projectiles}. Результаты попадания учитываются отдельно; урон указан для одного снаряда.</p>}
 {Array.from({length:profile.projectiles},(_,index)=><div className="play-row play-wrap spell-roll-step" key={index}>
 {profile.projectiles>1 && <b>Снаряд {index+1}</b>}
 {profile.attackBonus!==undefined && <><button onClick={()=>{const r=cast(`атака${profile.projectiles>1?` · снаряд ${index+1}`:''}`,()=>rollD20(profile.attackBonus!,mode));if(r)setAttacks(old=>({...old,[index]:r}));}}>Атака {profile.attackBonus>=0?'+':''}{profile.attackBonus}</button>{attacks[index] && <span>Попадание {attacks[index].total} · d20: {attacks[index].natural}{attacks[index].natural===20?' · крит':attacks[index].natural===1?' · промах':''}</span>}</>}
 <button disabled={!formula.trim()} onClick={()=>damage(index)}>{profile.healingFormula?'Бросить лечение':profile.delivery==='effect'?'Бросить эффект':'Бросить урон'}</button>
 {profile.criticalAllowed && <button disabled={!formula.trim()} onClick={()=>damage(index,true)}>Критический урон</button>}
 </div>)}
 {profile.recurringDamageFormula && <button onClick={()=>cast('повторный урон · без крита',()=>rollDice(profile.recurringDamageFormula!))}>Повторный урон {profile.recurringDamageFormula} · без крита</button>}
 {profile.note && <p>{profile.note}</p>}
 <details><summary>Описание заклинания</summary><p className="play-description">{spell.description}</p></details>
 {error && <p className="play-error" role="alert">{error}</p>}
 </section>;
}
