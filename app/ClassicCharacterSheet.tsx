"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode, type CSSProperties } from "react";
import type { PdfCharacterSheetProps, PdfSpell } from "./PdfCharacterSheet";
import { abilityLabels, skillKeys } from "./rules";
import type { AbilityScores } from "./exportFormats";
import "./classic-character-sheet.css";
import "./classic-sheet-template.css";
import { assetUrl } from "./assetUrl";
import { SpellCardsAppendix } from "./PdfCharacterSheet";

const abilityOrder: (keyof AbilityScores)[] = ["str", "dex", "con", "int", "wis", "cha"];
const modifier = (score: number) => Math.floor((score - 10) / 2);
const signed = (n: number) => (n >= 0 ? "+" : "") + n;
const spellCapacities = [12, 9, 9, 10, 9, 9, 6, 6, 5, 7];
type TextEdit = { scale: number; bold: boolean; hidden: boolean };
const editSelector = [
  '.classic-sheet-head > strong', '.classic-sheet-field-value', '.classic-sheet-ability strong', '.classic-sheet-ability span',
  '.classic-source-checkvalue', '.classic-sheet-inline-value', '.classic-sheet-combat strong', '.classic-sheet-hp',
  '.classic-sheet-two p', '.classic-sheet-attacks tbody tr', '.classic-sheet-coins > div', '.classic-equipment-text',
  '.classic-sheet-proficiencies p', '.classic-sheet-right .classic-sheet-panel p',
  '.classic-sheet-backstory p', '.classic-sheet-additional p', '.classic-sheet-treasure p',
  '.classic-source-spell-row', '.classic-source-spell-slot'
].join(', ');
const fitSelector = [
  '.classic-sheet-panel-body', '.classic-sheet-field-value', '.classic-sheet-head > strong',
  '.classic-sheet-proficiencies p', '.classic-equipment-text', '.classic-spell-name',
  '.classic-sheet-attack-cell'
].join(', ');

function fitSheetText(box: HTMLElement, preferredSize: number) {
  const resize = (size: number) => box.style.setProperty('font-size', `${size}px`, 'important');
  const ribbonText = box.querySelector<SVGTextElement>('.classic-sheet-ribbon-text');
  const ribbonWidth = box.querySelector<SVGPathElement>('path')?.getTotalLength();
  const fits = () => ribbonText && ribbonWidth
    ? ribbonText.getComputedTextLength() <= ribbonWidth - 4
    : box.scrollHeight <= box.clientHeight && box.scrollWidth <= box.clientWidth;
  resize(preferredSize);
  if (fits()) return;
  const minimum = Math.min(preferredSize, ribbonText ? 1 : 6);
  let low = minimum;
  let high = preferredSize;
  while (high - low > 0.25) {
    const size = (low + high) / 2;
    resize(size);
    if (fits()) low = size;
    else high = size;
  }
  resize(low);
}

function readEdits(key:string):Record<string,TextEdit>{
  if(typeof window==='undefined')return {};
  try{return JSON.parse(localStorage.getItem(key)||'{}') as Record<string,TextEdit>}catch{return {}}
}
function purseGold(item:string):number|null{
  const match=item.trim().match(/^кошел[ьё]\s+с\s+(\d+)\s*зм\.?$/i);
  return match?Number(match[1]):null;
}
// Coordinates are percentages of the accepted full-page raster artwork.
const referencePosition = (x:number,y:number):CSSProperties=>({position:"absolute",left:`${x}%`,top:`${y}%`});
const originalSkillOrder=["Акробатика","Атлетика","Внимательность","Выживание","Выступление","Запугивание","История","Ловкость рук","Магия","Медицина","Обман","Природа","Проницательность","Расследование","Религия","Скрытность","Убеждение","Уход за животными"] as const;
const spellGeometry:Record<number,{x:number;y:number;step:number;cx?:number;cy?:number}>={
0:{x:6.2,y:30.0,step:1.49},1:{x:6.2,y:57.7,step:1.49,cx:14.8,cy:53.8},2:{x:6.2,y:80.45,step:1.49,cx:14.8,cy:76.8},
3:{x:38.7,y:32.6,step:1.49,cx:46.6,cy:28.8},4:{x:38.7,y:57.3,step:1.49,cx:46.6,cy:53.4},5:{x:38.7,y:80.45,step:1.49,cx:46.6,cy:76.8},
6:{x:70.3,y:32.6,step:1.44,cx:78.4,cy:28.8},7:{x:70.3,y:49.7,step:1.44,cx:78.4,cy:46.8},8:{x:70.3,y:66.7,step:1.44,cx:78.4,cy:63.5},9:{x:70.3,y:83.0,step:1.44,cx:78.4,cy:79.4}
};

function Panel({ title, children, className = "" }: { title: string; children?: ReactNode; className?: string }) {
  return <section className={"classic-sheet-panel " + className}>
    <div className="classic-sheet-panel-body">{children}</div>
    <div className="classic-sheet-panel-caption">{title}</div>
  </section>;
}

function Field({ label, value }: { label: string; value?: ReactNode }) {
  return <div className="classic-sheet-field"><div className="classic-sheet-field-value">{value ?? "\u00a0"}</div><small>{label}</small></div>;
}

function ClassicHeader({ title, page }: { title: string; page: number }) {
  const ribbonId = useId();
  return <header className="classic-sheet-head">
    <div className="classic-sheet-emblem"><b>D&amp;D</b><small>ЛИСТ ПЕРСОНАЖА</small></div>
    <strong title={title}>
      {page === 2 ? <svg className="classic-sheet-ribbon-name" viewBox="0 0 310 34" role="img" aria-label={title}>
        <defs><path id={ribbonId} d="M 3,27 Q 155,12 307,27" /></defs>
        <text className="classic-sheet-ribbon-text" textAnchor="middle">
          <textPath href={`#${ribbonId}`} startOffset="50%">{title}</textPath>
        </text>
      </svg> : title}
    </strong><span>{page} / 3</span>
  </header>;
}

function SpellGroup({level,entries,slots}:{level:number;entries:PdfSpell[];slots:number}) {
  const g=spellGeometry[level];
  return <div className="classic-source-spell-group" data-spell-level={level}>
    {level>0&&slots>0&&<span className="classic-source-spell-slot" style={referencePosition((g.cx||0)-1.6,(g.cy||0)-.45)}>{slots}</span>}
    {entries.map((spell,index)=><div key={spell.id} className="classic-source-spell-row"
      style={referencePosition(g.x,g.y+g.step*index)}
      title={spell.alwaysPrepared?"Всегда подготовлено":spell.prepared?"Подготовлено":"Не подготовлено"}>
      <span className={"classic-spell-mark"+(spell.prepared&&!spell.alwaysPrepared?" classic-spell-mark--dot":"")}>{spell.alwaysPrepared?"†":spell.prepared?"●":""}</span><span className="classic-spell-name" title={spell.name}>{spell.name}</span>
    </div>)}
  </div>;
}

export function ClassicCharacterSheet(props: PdfCharacterSheetProps) {
  const root=useRef<HTMLDivElement>(null);
  const editKey=`herolist-classic-text-v1:${props.identity.name || 'unnamed'}`;
  const [editMode,setEditMode]=useState(false);
  const [hideChangeable,setHideChangeable]=useState(false);
  const [selected,setSelected]=useState<string|null>(null);
  const [editScope,setEditScope]=useState(editKey);
  const [edits,setEdits]=useState<Record<string,TextEdit>>(()=>readEdits(editKey));
  useEffect(()=>{if(editScope!==editKey){setEditScope(editKey);setEdits(readEdits(editKey));setSelected(null)}},[editKey,editScope]);
  useEffect(()=>{if(editScope!==editKey)return;try{localStorage.setItem(editKey,JSON.stringify(edits))}catch{}},[edits,editKey,editScope]);
  const updateSelected=(patch:Partial<TextEdit>)=>{
    if(!selected)return;
    setEdits(current=>({...current,[selected]:{...{scale:100,bold:false,hidden:false},...current[selected],...patch}}));
  };
  const selectedEdit=selected?edits[selected]:undefined;
  useLayoutEffect(() => {
    const sheet = root.current;
    if (!sheet) return;
    const template = '.classic-sheet-page:not(.classic-sheet-overflow)';
    const editNodes = [...sheet.querySelectorAll<HTMLElement>(editSelector)];
    const boxes = [...sheet.querySelectorAll<HTMLElement>(fitSelector)]
      .filter(box => box.closest(template));
    const targets = new Set([...editNodes, ...boxes]);
    const scales = new Map<HTMLElement, number>();

    editNodes.forEach((element, index) => {
      const id = `text-${index}`;
      const edit = edits[id];
      element.dataset.classicEdit = id;
      element.classList.toggle('classic-edited-hidden', Boolean(edit?.hidden));
      element.classList.toggle('classic-edited-selected', editMode && selected === id);
      if (editMode && !edit?.hidden && element.textContent?.trim()) element.tabIndex = 0;
      else element.removeAttribute("tabindex");
      element.style.setProperty('font-weight', edit?.bold ? '700' : '', 'important');
      if (Number.isFinite(edit?.scale)) scales.set(element, Math.max(60, Math.min(180, edit.scale)) / 100);
    });

    const fit = () => {
      targets.forEach(element => element.style.removeProperty('font-size'));
      scales.forEach((scale, element) => {
        if (scale !== 1) element.style.setProperty('font-size',
          `${parseFloat(getComputedStyle(element).fontSize) * scale}px`, 'important');
      });
      // Fit children with independent bounds before measuring their parent panels.
      for (const box of [...boxes].reverse()) {
        if (!box.clientWidth || !box.clientHeight) continue;
        const owner = box.matches('.classic-spell-name, .classic-sheet-attack-cell')
          ? box.closest<HTMLElement>('[data-classic-edit]') : null;
        const scale = owner ? scales.get(owner) ?? 1 : 1;
        if (owner) box.style.fontWeight = owner.style.fontWeight;
        fitSheetText(box, parseFloat(getComputedStyle(box).fontSize) * scale);
      }
    };

    let active = true;
    fit();
    void document.fonts.ready.then(() => { if (active) fit(); });
    const resize = new ResizeObserver(fit);
    sheet.querySelectorAll(template).forEach(page => resize.observe(page));
    window.addEventListener('beforeprint', fit);
    window.addEventListener('afterprint', fit);
    return () => {
      active = false;
      resize.disconnect();
      window.removeEventListener('beforeprint', fit);
      window.removeEventListener('afterprint', fit);
    };
  }, [props, edits, editMode, selected]);
  function selectEditable(target: EventTarget | null, point?: { x: number; y: number }) {
    const sheet = root.current;
    if (!editMode || !sheet) return;
    const candidates = target instanceof Element ? [target] : [];
    if (point) candidates.push(...document.elementsFromPoint(point.x, point.y));
    for (const candidate of candidates) {
      const field = candidate.closest<HTMLElement>('[data-classic-edit][tabindex="0"]');
      if (!field || !sheet.contains(field)) continue;
      setSelected(field.dataset.classicEdit ?? null);
      return;
    }
  }

  const skills = originalSkillOrder.map(name=>({name,...skillKeys[name]}));
  const spells = Array.from(new Map(props.spells.map(spell => [spell.id, spell])).values());
  const levelSpells = Array.from({ length: 10 }, (_, level) => spells.filter(spell => spell.level === level).sort((a, b) => a.name.localeCompare(b.name, "ru")));
  const displayed = levelSpells.map((entries, level) => entries.slice(0, spellCapacities[level]));
  const extraSpells = levelSpells.flatMap((entries, level) => entries.slice(spellCapacities[level]).map(spell => ({ ...spell, sourceLevel: level })));
  const extraPages = Array.from({ length: Math.ceil(extraSpells.length / 42) }, (_, index) => extraSpells.slice(index * 42, (index + 1) * 42));
  const features = [...props.classFeatures, ...props.raceFeatures, ...props.featFeatures, props.backgroundFeature].filter(Boolean);
  const purse=props.equipment.map(purseGold).filter((n):n is number=>n!==null).reduce((a,b)=>a+b,0);
  const gold=props.currency.gp||purse;
  const coins = [["ПП", props.currency.pp], ["ЗМ", gold], ["СМ", props.currency.sp], ["ММ", props.currency.cp]] as const;
  const equipment = props.equipment.filter(item=>purseGold(item)===null).join("; ");
  const spellsByColumn = [[0, 1, 2], [3, 4, 5], [6, 7, 8, 9]];

  return <>
    <div className="classic-sheet-editor" role="group" aria-label="Настройки классического листа">
      <button type="button" aria-pressed={editMode} onClick={()=>{setEditMode(!editMode);setSelected(null)}}>{editMode?'Завершить редактирование':'Редактировать лист'}</button>
      <button type="button" aria-pressed={hideChangeable} onClick={()=>setHideChangeable(value=>!value)}>{hideChangeable?'Показать изменяемую информацию':'Скрыть изменяемую информацию'}</button>
      {editMode&&<>
        <span>{selected?'Выбран текст на листе':'Выберите текст на листе'}</span>
        <button type="button" disabled={!selected} onClick={()=>updateSelected({scale:Math.max(60,(selectedEdit?.scale||100)-10)})} aria-label="Уменьшить текст">А−</button>
        <output>{selectedEdit?.scale||100}%</output>
        <button type="button" disabled={!selected} onClick={()=>updateSelected({scale:Math.min(180,(selectedEdit?.scale||100)+10)})} aria-label="Увеличить текст">А+</button>
        <button type="button" disabled={!selected} aria-pressed={!!selectedEdit?.bold} onClick={()=>updateSelected({bold:!selectedEdit?.bold})}><b>Жирный</b></button>
        <button type="button" disabled={!selected} onClick={()=>updateSelected({hidden:true})}>Удалить с листа</button>
        <button type="button" disabled={!selected} onClick={()=>{if(!selected)return;setEdits(current=>{const next={...current};delete next[selected];return next})}}>Вернуть текст</button>
        <button type="button" onClick={()=>{setEdits({});setSelected(null)}}>Сбросить правки</button>
      </>}
    </div>
  <div ref={root} className={"classic-sheet-document classic-sheet--template"+(editMode?" classic-sheet--editing":"")+(hideChangeable?" classic-sheet--hide-changeable":"")}
    onClickCapture={event => selectEditable(event.target, { x: event.clientX, y: event.clientY })}
    onFocusCapture={event => selectEditable(event.target)}
    aria-label="Классический лист персонажа D&D 5e">

    <section className="classic-sheet-page" style={{backgroundImage:`url("${assetUrl("classic-sheet/page-1.jpg")}")`}}>
      <ClassicHeader title={props.identity.name || "Имя персонажа"} page={1} />
      <div className="classic-sheet-identity">
        <Field label="Имя персонажа" value={props.identity.name} />
        <div className="classic-sheet-identity-fields">
          <Field label="Класс и уровень" value={props.identity.className + " " + props.identity.level} />
          <Field label="Предыстория" value={props.identity.backgroundName} />
          <Field label="Имя игрока" value={props.identity.playerName} />
          <Field label="Раса" value={props.identity.raceName} />
          <Field label="Мировоззрение" value={props.identity.alignment} />
          <Field label="Опыт" value={props.identity.experience||""} />
        </div>
      </div>
      <div className="classic-sheet-main-grid">
        <div className="classic-sheet-column classic-sheet-left">
          <div className="classic-sheet-abilities">
            {abilityOrder.map(ability => <div className="classic-sheet-ability" key={ability}>
              <b>{abilityLabels[ability]}</b><strong>{signed(modifier(props.abilities[ability]))}</strong><span>{props.abilities[ability]}</span>
            </div>)}
          </div>
          <div className="classic-source-inspiration">{props.identity.inspiration && <strong style={referencePosition(15.5,16.6)}>●</strong>}</div>
          <div className="classic-source-proficiency"><strong style={referencePosition(15.8,21.5)}>{signed(props.proficiency)}</strong></div>
          <div className="classic-source-saves">
            {abilityOrder.map((key,i)=>{
              const trained=props.savingThrows.includes(key);
              const value=modifier(props.abilities[key])+(trained?props.proficiency:0)+(props.savingThrowBonuses?.[key]||0);
              const y=26.3+i*1.735;
              return <div key={key} className="classic-source-check">
                {trained&&<span className="classic-source-checkmark classic-source-checkmark--dot" style={referencePosition(16.05,y)}>●</span>}
                <span className="classic-source-checkvalue" style={referencePosition(17.9,y)}>{signed(value)}</span>
              </div>;
            })}
          </div>
          <div className="classic-source-skills">
            {skills.map((skill,i)=>{
              const trained=props.proficiencies.skills.includes(skill.name);
              const expert=props.proficiencies.expertise.includes(skill.name);
              const bonus=modifier(props.abilities[skill.stat as keyof AbilityScores])+(expert?2*props.proficiency:trained?props.proficiency:0);
              const y=41.0+i*1.713;
              return <div key={skill.key} className="classic-source-check">
                {(trained||expert)&&<span className={"classic-source-checkmark "+(expert?"classic-source-checkmark--expert":"classic-source-checkmark--dot")} style={referencePosition(16.05,y)}>{expert?"◆":"●"}</span>}
                <span className="classic-source-checkvalue" style={referencePosition(17.9,y)}>{signed(bonus)}</span>
              </div>;
            })}
          </div>
          <Panel title="Пассивная мудрость (Внимательность)"><strong className="classic-sheet-inline-value">{props.passivePerception}</strong></Panel>
          <Panel title="Прочие умения и языки" className="classic-sheet-proficiencies">
            <p title={props.proficiencies.languages.join(", ")}><b>Языки:</b> {props.proficiencies.languages.join(", ") || "—"}</p>
            <p title={props.proficiencies.tools.join(", ")}><b>Инструменты:</b> {props.proficiencies.tools.join(", ") || "—"}</p>
            <p title={props.proficiencies.armor.join(", ")}><b>Доспехи:</b> {props.proficiencies.armor.join(", ") || "—"}</p>
            <p title={props.proficiencies.weapons.join(", ")}><b>Оружие:</b> {props.proficiencies.weapons.join(", ") || "—"}</p>
          </Panel>
        </div>
        <div className="classic-sheet-column classic-sheet-center">
          <div className="classic-sheet-combat">
            <Panel title="Класс брони"><strong>{props.ac}</strong></Panel>
            <Panel title="Инициатива"><strong>{signed(props.initiative)}</strong></Panel>
            <Panel title="Скорость"><strong>{props.speed}</strong></Panel>
          </div>
          <Panel title="Максимум хитов"><strong className="classic-sheet-hp">{props.hitPoints}</strong></Panel>
          <Panel title="Текущие хиты"><strong className="classic-sheet-hp classic-sheet-hp--changeable">{props.currentHitPoints ?? props.hitPoints}</strong></Panel>
          <Panel title="Временные хиты"><strong className="classic-sheet-hp classic-sheet-hp--changeable">{props.temporaryHitPoints||""}</strong></Panel>
          <div className="classic-sheet-two">
            <Panel title="Кости здоровья"><p>{props.hitDiceLabel || (props.identity.level + "к" + props.hitDie)}</p><p>{props.hitDiceRemaining ?? props.identity.level}</p></Panel>
            <Panel title="Испытания против смерти"></Panel>
          </div>
          <Panel title="Атаки и заклинания">
            <table className="classic-sheet-attacks" style={{ "--classic-attack-count": Math.max(props.attacks.length, 1) } as CSSProperties}><thead><tr><th>Название</th><th>Бонус</th><th>Урон / тип</th></tr></thead>
              <tbody>{props.attacks.map((attack, index) => <tr key={attack.id || index}>{[attack.name, String(attack.attackBonus ?? ""), String(attack.damageDisplay ?? "")].map((value, column) =>
                <td key={column}><span className="classic-sheet-attack-cell" title={value}>{value}</span></td>
              )}</tr>)}</tbody>
            </table>
          </Panel>
          <Panel title="Снаряжение">
            <div className="classic-sheet-coins">{coins.map(([name, amount]) => <div key={name}><b>{amount||""}</b><small>{name}</small></div>)}</div>
            <p className="classic-equipment-text" title={equipment}>{equipment || " "}</p>
          </Panel>
        </div>
        <div className="classic-sheet-column classic-sheet-right">
          <Panel title="Свойства личности"><p>{props.personality.traits || " "}</p></Panel>
          <Panel title="Идеалы"><p>{props.personality.ideals || " "}</p></Panel>
          <Panel title="Узы"><p>{props.personality.bonds || " "}</p></Panel>
          <Panel title="Изъяны"><p>{props.personality.flaws || " "}</p></Panel>
          <Panel title="Особенности и свойства">
            {features.slice(0, 6).map((feature, index) => <p key={index}><b>{feature.name}</b>{feature.description ? ": " + feature.description : ""}</p>)}
          </Panel>
        </div>
      </div>
    </section>
    <section className="classic-sheet-page" style={{backgroundImage:`url("${assetUrl("classic-sheet/page-2.jpg")}")`}}>
      <ClassicHeader title={props.identity.name || "Имя персонажа"} page={2} />
      <div className="classic-sheet-bio">{["Возраст", "Рост", "Вес", "Глаза", "Кожа", "Волосы"].map(name => <Field key={name} label={name} />)}</div>
      <div className="classic-sheet-story-grid">
        <Panel title="Внешность персонажа" className="classic-sheet-portrait" />
        <Panel title="Союзники и организации" className="classic-sheet-allies" />
        <Panel title="Символ" className="classic-sheet-symbol" />
        <Panel title="Предыстория персонажа" className="classic-sheet-backstory"><p>{props.identity.backgroundName}</p></Panel>
        <Panel title="Прочие свойства и особенности" className="classic-sheet-additional">
          {features.slice(6).map((feature, index) => <p key={index}><b>{feature.name}.</b> {feature.description}</p>)}
        </Panel>
        <Panel title="Сокровища" className="classic-sheet-treasure">{coins.filter(([,amount])=>amount>0).map(([name, amount]) => <p key={name}>{name}: {amount}</p>)}</Panel>
      </div>
    </section>
    <section className="classic-sheet-page" style={{backgroundImage:`url("${assetUrl("classic-sheet/page-3.jpg")}")`}}>
      <ClassicHeader title={props.identity.name || ""} page={3} />
      <div className="classic-sheet-magic-header">
        <Field label="Класс заклинателя" value={props.identity.className} />
        <Field label="Заклинательная характеристика" value={props.spellAbility} />
        <Field label="Сл испытаний" value={props.spellSaveDc} />
        <Field label="Бонус атаки заклинанием" value={props.spellAttackBonus == null ? "" : signed(props.spellAttackBonus)} />
      </div>
      <div className="classic-sheet-spell-columns">
        {spellsByColumn.flat().map(level=><SpellGroup key={level} level={level} entries={displayed[level]} slots={props.spellSlots[level-1]||(props.pactSlots?.level===level?props.pactSlots.slots:0)} />)}
      </div>
      <div className="classic-sheet-note">● подготовлено · † всегда подготовлено · ○ не подготовлено</div>
    </section>
    {extraPages.map((page, pageIndex) => <section className="classic-sheet-page classic-sheet-overflow" key={pageIndex}>
      <ClassicHeader title="Продолжение списка заклинаний" page={4 + pageIndex} />
      {page.map(spell => <div key={spell.id} className="classic-sheet-spell-row">
        <span className="classic-sheet-prepare">{spell.alwaysPrepared ? "†" : spell.prepared ? "●" : "○"}</span>
        <span>{spell.sourceLevel} круг · {spell.name}</span>
      </div>)}
    </section>)}
    <SpellCardsAppendix spells={props.spells} identityName={props.identity.name} className={props.identity.className} startPage={4 + extraPages.length} />
  </div></>;
}
