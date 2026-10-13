'use client';
import type { CatalogSpell } from './catalog';
import type { SpellCastResult } from './spellCasting';
export function SpellRollPanel({spell,result,onClose}:{spell:CatalogSpell;result:SpellCastResult;onClose:()=>void}) {
 const {profile,parts,method}=result;
 const label=profile.healingFormula?'Лечение':profile.delivery==='effect'?'Эффект':'Урон';
 return <section className="play-resolution play-card" aria-label={`Результат заклинания: ${spell.name}`}>
 <header className="play-row play-wrap"><div><small>Сотворено · {method.label}</small><h2>{spell.name}</h2></div><button onClick={onClose}>Закрыть результат</button></header>
 {profile.saveDc!==undefined && <p>Цель делает спасбросок {profile.saveAbility||''}: <b>Сл {profile.saveDc}</b>.</p>}
 {profile.delivery==='automatic' && <p>Автоматическое попадание.</p>}
 {parts.map((part,index)=><article className="spell-roll-step" key={index}>
 {parts.length>1 && <h3>Снаряд {index+1}</h3>}
 {part.attack && <p>Попадание: <b>{part.attack.total}</b> · d20: {part.attack.natural}{part.attack.natural===20?' · крит':part.attack.natural===1?' · промах':''}<br/><small>{part.attack.formula} · кости [{part.attack.rolls.join(', ')}]</small></p>}
 {(part.damage||part.healing) && <p>{label}{part.attack && part.attack.natural!==20?' при попадании':''}: <strong>{(part.damage||part.healing)!.total}</strong><br/><small>{(part.damage||part.healing)!.formula} · кости [{(part.damage||part.healing)!.rolls.join(', ')}]</small></p>}
 {part.attack?.natural===1 && <p>Урон: <b>0</b> · натуральная 1.</p>}
 {!part.damage&&!part.healing&&!part.attack && <p>Эффект применяется по описанию заклинания.</p>}
 </article>)}
 {parts.length>1 && <p>Суммарный {label.toLowerCase()}{profile.delivery==='attack'?' при попадании всех остальных лучей':''}: <strong>{parts.reduce((n,p)=>n+(p.damage?.total||p.healing?.total||0),0)}</strong></p>}
 {profile.note && <p>{profile.note}</p>}
 <details><summary>Описание заклинания</summary><p className="play-description">{spell.description}</p></details>
 </section>;
}
