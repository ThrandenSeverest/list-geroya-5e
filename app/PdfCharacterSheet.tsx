"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Settings } from 'lucide-react';
import { fitSheet,optimalSheetSizes,sheetColumns,type SheetPanelId } from './fitSheet';
import { defaultSheetLayout,normalizeSheetLayout,type SheetGroup } from './sheetLayout';
import type { CatalogSpell } from "./catalog";
import { automaticAttacksNotice, type CharacterAttack } from "./combat";
import type { AbilityScores, Currency } from "./exportFormats";
import { resourceRestLabel } from "./characterResources";
import { abilityLabels, skillKeys, type Feature } from "./rules";
import { spellComponentLabel } from "./spellComponents";

type PdfResource = { name: string; current: number; max: number; die?: string; unit?: number; isShortRest: boolean; isLongRest: boolean };
export type PdfSpell = CatalogSpell & { prepared: boolean; alwaysPrepared: boolean; classSource: string; grantSource?: string };

export type PdfCharacterSheetProps = {
  sheetEdition?: "2014" | "2024";
  identity: {
    name: string;
    playerName: string;
    experience: number;
    inspiration: boolean;
    className: string;
    subclassName?: string;
    raceName: string;
    backgroundName: string;
    alignment: string;
    level: number;
  };
  classId: string;
  abilities: AbilityScores;
  proficiency: number;
  savingThrows: string[];
  savingThrowBonuses?: Partial<Record<keyof AbilityScores, number>>;
  proficiencies: { skills: string[]; expertise: string[]; armor: string[]; weapons: string[]; tools: string[]; languages: string[] };
  defenses?: { resistances: string[]; immunities: string[]; vulnerabilities: string[] };
  ac: number;
  initiative: number;
  initiativeNotes?: string[];
  speed: number;
  movement?: { walk: number; swim?: number; climb?: number; fly?: number };
  hitPoints: number;
  hitDie: number;
  hitDiceLabel?: string;
  currentHitPoints?: number;
  temporaryHitPoints?: number;
  hitDiceRemaining?: number;
  passivePerception: number;
  attacks: CharacterAttack[];
  resources: PdfResource[];
  classFeatures: Feature[];
  raceFeatures: Feature[];
  featFeatures: Feature[];
  backgroundFeature: Feature;
  equipment: string[];
  currency: Currency;
  personality: { traits: string; ideals: string; bonds: string; flaws: string };
  spellAbility?: string;
  spellSaveDc?: number;
  spellAttackBonus?: number;
  spellSlots: number[];
  pactSlots?: { slots: number; level: number };
  spellcastingSources?: { name: string; ability: string; dc: number; attack: number }[];
  preparedMaximum?: number;
  spells: PdfSpell[];
};

const abilityModifier = (score: number) => Math.floor((score - 10) / 2);
const signed = (value: number) => value >= 0 ? `+${value}` : `${value}`;

function compactRulesText(value: string) {
  // Keep the same canonical rules text as the sheet. Pagination below is
  // responsible for layout; it must not discard mechanical clauses.
  return value
    .split(/\n(?:источники|источник|официальные книги|правовой статус|исключено|приложение:)/i)[0]
    .replace(/•\s*-{5,}[\s\S]*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function featureOrder(feature: Feature) {
  if (/дополнительн.*атак|мультиатак|четыре атаки/i.test(feature.name)) return -200;
  if (/ув[её]ртливость|уворот/i.test(feature.name)) return -190;
  return feature.level || 1;
}

function ordered(features: Feature[]) {
  return features.map((feature, index) => ({ feature, index }))
    .sort((a, b) => featureOrder(a.feature) - featureOrder(b.feature) || a.index - b.index)
    .map(item => item.feature);
}

type ParsedFeatureTable = {
  prefix: string;
  suffix: string;
  header: string[];
  rows: string[][];
};

function cleanFeatureTableCell(value: string) {
  return value
    .trim()
    .replace(/\*\*/g, "")
    .replace(/__/g, "")
    .replace(/`/g, "")
    .trim();
}

function parseFeatureTable(value: string): ParsedFeatureTable | null {
  const text = compactRulesText(value);
  const start = text.indexOf("|");
  const end = text.lastIndexOf("|");
  if (start < 0 || end <= start) return null;

  const tableText = text.slice(start, end + 1).replace(/\|\s+\|/g, "|\n|");
  const rows = tableText
    .split(/\r?\n+/)
    .map(line => line.trim())
    .filter(line => line.startsWith("|") && line.endsWith("|"))
    .map(line => line.slice(1, -1).split("|").map(cleanFeatureTableCell));

  const separatorIndex = rows.findIndex(row =>
    row.length >= 1 && row.every(cell => /^:?-{3,}:?$/.test(cell)),
  );
  if (separatorIndex < 1) return null;

  const header = rows[separatorIndex - 1];
  const body = rows.slice(separatorIndex + 1).filter(row =>
    row.length === header.length && row.some(Boolean),
  );
  if (header.length < 1 || body.length < 1) return null;

  return {
    prefix: text.slice(0, start).trim(),
    suffix: text.slice(end + 1).trim(),
    header,
    rows: body,
  };
}

function FeatureDescription({ description }: { description: string }) {
  const parsed = parseFeatureTable(description);
  if (!parsed) return <p>{compactRulesText(description)}</p>;

  const columns = parsed.header.length;
  const density = columns >= 6 ? 4.8 : parsed.rows.length >= 8 ? 4.9 : parsed.rows.length >= 5 ? 5.3 : 5.8;
  const cellStyle = {
    padding: ".55mm .65mm",
    border: ".22mm solid rgba(23,61,67,.35)",
    verticalAlign: "top" as const,
    whiteSpace: "normal" as const,
    overflowWrap: "anywhere" as const,
    wordBreak: "normal" as const,
  };

  return <div style={{ minWidth: 0, margin: 0, lineHeight: 1.25 }}>
    {parsed.prefix && <p style={{ margin: "0 0 1mm", fontSize: "7pt", lineHeight: 1.32 }}>{parsed.prefix}</p>}
    <table style={{ width: "100%", tableLayout: "fixed", borderCollapse: "collapse", fontSize: `${density}pt`, lineHeight: 1.14, margin: "1mm 0 0" }}>
      <thead>
        <tr>{parsed.header.map((cell, index) => <th key={index} style={{ ...cellStyle, color: "#173d43", background: "rgba(23,61,67,.08)", fontWeight: 700, textAlign: "left" }}>{cell}</th>)}</tr>
      </thead>
      <tbody>
        {parsed.rows.map((row, rowIndex) => <tr key={rowIndex} style={{ breakInside: "avoid" }}>
          {row.map((cell, cellIndex) => <td key={cellIndex} style={{ ...cellStyle, color: "#263b3d", background: rowIndex % 2 ? "rgba(164,99,62,.035)" : "rgba(255,255,255,.28)" }}>{cell}</td>)}
        </tr>)}
      </tbody>
    </table>
    {parsed.suffix && <p style={{ margin: "1mm 0 0", fontSize: "7pt", lineHeight: 1.32 }}>{parsed.suffix}</p>}
  </div>;
}

function FeatureList({ features }: { features: Feature[] }) {
  return <div className="pdf-feature-list">
    {features.map((feature, index) => <article key={`${feature.name}-${index}`}>
      <h3>{feature.name}</h3>
      <FeatureDescription description={feature.description} />
    </article>)}
  </div>;
}

function featureWeight(feature: Feature) {
  const text = compactRulesText(feature.description);
  const parsed = parseFeatureTable(feature.description);
  if (!parsed) return 92 + Math.ceil(text.length / 58) * 18;

  const proseLength = parsed.prefix.length + parsed.suffix.length;
  const charsPerCellLine = Math.max(12, Math.floor(72 / parsed.header.length));
  const headerLines = Math.max(...parsed.header.map(cell => Math.max(1, Math.ceil(cell.length / charsPerCellLine))));
  const bodyLines = parsed.rows.reduce((total, row) => {
    const rowLines = Math.max(...row.map(cell => Math.max(1, Math.ceil(cell.length / charsPerCellLine))));
    return total + rowLines;
  }, 0);
  const tableWeight = 36 + (headerLines + bodyLines) * 18;
  return 92 + Math.ceil(proseLength / 58) * 18 + tableWeight;
}

function paginateFeatureColumns(features: Feature[], columnBudget = 1225) {
  const pages: [Feature[], Feature[]][] = [];
  const used: [number, number][] = [];
  for (const feature of features) {
    const weight = featureWeight(feature);
    let best: { page: number; column: 0 | 1; remaining: number } | undefined;
    for (let page = 0; page < pages.length; page++) {
      for (const column of [0, 1] as const) {
        const remaining = columnBudget - used[page][column];
        if (weight <= remaining && (!best || remaining < best.remaining)) best = { page, column, remaining };
      }
    }
    if (!best) {
      pages.push([[feature], []]);
      used.push([weight, 0]);
      continue;
    }
    pages[best.page][best.column].push(feature);
    used[best.page][best.column] += weight;
  }
  return pages.length ? pages : [[[], []] as [Feature[], Feature[]]];
}

function paginateSpells(spells: PdfSpell[], wizardPrepared: boolean) {
  const pages: PdfSpell[][] = [];
  const firstPageCapacity = wizardPrepared ? 60 : 64;
  const continuationCapacity = wizardPrepared ? 68 : 72;
  let index = 0;
  while (index < spells.length) {
    const capacity = pages.length ? continuationCapacity : firstPageCapacity;
    pages.push(spells.slice(index, index + capacity));
    index += capacity;
  }
  return pages.length ? pages : [[]];
}

function paginateSpellCards(spells: PdfSpell[]) {
  const pages: PdfSpell[][] = [];
  for (let index = 0; index < spells.length; index += 9) pages.push(spells.slice(index, index + 9));
  return pages;
}

function spellCardDensity(spell: PdfSpell) {
  const length = spell.description.length
    + (spell.castingTime?.length || 0)
    + (spell.range?.length || 0)
    + (spell.components?.length || 0)
    + (spell.duration?.length || 0);
  if (length > 920) return "micro";
  if (length > 680) return "dense";
  if (length > 430) return "compact";
  return "normal";
}

export function PdfSpellCard({spell}:{spell:PdfSpell}) {
  return <article className={`pdf-spell-card pdf-spell-card--${spellCardDensity(spell)}`}>
    <header><div><small>{spell.level === 0 ? "Заговор" : `${spell.level} круг`} · {spell.school}</small><h3>{spell.name}{spell.ritual ? " Р" : ""}</h3><small>{spell.classSource}{spell.grantSource ? ` · ${spell.grantSource}` : ""}</small></div><b>{spell.source}</b></header>
    <dl>
      <div><dt>Накладывание</dt><dd>{spell.castingTime || "—"}</dd></div>
      <div><dt>Дистанция</dt><dd>{spell.range || "—"}</dd></div>
      <div><dt>Компоненты</dt><dd>{spell.components || spellComponentLabel(spell) || "—"}</dd></div>
      <div><dt>Длительность</dt><dd>{spell.duration || "—"}</dd></div>
    </dl>
    <p>{spell.description || "Описание заклинания появится здесь."}</p>
  </article>;
}

function paginateResources(resources: PdfResource[]) {
  const pages: PdfResource[][] = [[]];
  let used = 0;
  for (const resource of resources) {
    const marks = Math.ceil(resource.max / (resource.unit || 1));
    const weight = 1 + Math.ceil(resource.name.length / 24) + (marks > 12 && marks <= 24 ? 1 : 0);
    const budget = pages.length === 1 ? 11 : 40;
    if (pages.at(-1)!.length && used + weight > budget) { pages.push([]); used = 0; }
    pages.at(-1)!.push(resource);
    used += weight;
  }
  return pages;
}

function ResourceList({ resources }: { resources: PdfResource[] }) {
  return <>{resources.map(resource => {
    const unit = resource.unit || 1;
    const marks = Math.ceil(resource.max / unit);
    const spentMarks = Math.ceil((resource.max - resource.current) / unit);
    return <div className="pdf-resource" key={resource.name}>
      <div><b>{resource.name}{resource.die ? ` (${resource.die})` : ""}</b>{unit > 1 && <small>1 круг = {unit} хитов</small>}</div>
      {marks <= 24 ? <span className="pdf-resource-marks" aria-label={`Потрачено ${resource.max - resource.current} из ${resource.max}`}>
        {Array.from({ length: marks }, (_, index) => <i className={index < spentMarks ? "spent" : ""} key={index} />)}
      </span> : <span className="pdf-resource-counter">Осталось: {resource.current} / {resource.max}</span>}
      <small className="pdf-resource-rest">{resourceRestLabel(resource)}</small>
    </div>;
  })}</>;
}

function isCombatTechnique(feature: Feature) {
  return /удар|при[её]м|ман[её]вр|стрел|клин|фокусиров|боев.*искусств|ки|ци\b|атака/i.test(`${feature.name} ${feature.description}`)
    && !/дополнительн.*атак|мультиатак/i.test(feature.name);
}

function RacialTraitList({ features }: { features: Feature[] }) {
  if (!features.length) return <p>Расовые особенности не выбраны.</p>;
  return <div className="pdf-compact-features">{features.map((feature, index) => {
    const text = compactRulesText(feature.description);
    const summary = text;
    return <p key={`${feature.name}-${index}`}><b>{feature.name}.</b> {summary}</p>;
  })}</div>;
}

function PageHeader({ eyebrow, title, page }: { eyebrow: string; title: string; page: number }) {
  return <header className="pdf-page-header"><div><small>{eyebrow}</small><h2>{title}</h2></div><b>{page.toString().padStart(2, "0")}</b></header>;
}

type InventoryMode = "list" | "compact" | "blank";

function SheetPanelTitle({title,group,size,onSize,children}:{title:string;group:string;size:number;onSize:(delta:number)=>void;children?:ReactNode}) {
  return <div className="pdf-panel-title-row"><h2>{title}</h2><span className="pdf-panel-controls"><button type="button" disabled={size<=70} onClick={()=>onSize(-10)} aria-label={`Уменьшить шрифт: ${group}`} title={`Уменьшить шрифт (${size}%)`}>−</button><output aria-label={`Размер шрифта: ${group}`}>{size}%</output><button type="button" disabled={size>=160} onClick={()=>onSize(10)} aria-label={`Увеличить шрифт: ${group}`} title={`Увеличить шрифт (${size}%)`}>+</button>{children}</span></div>;
}

function InventoryPanel({ equipment, currency, mode, onModeChange,size,onSize,style }: Pick<PdfCharacterSheetProps, "equipment" | "currency"> & { mode: InventoryMode; onModeChange: (mode: InventoryMode) => void;size:number;onSize:(delta:number)=>void;style:CSSProperties }) {
  const nextMode: Record<InventoryMode, InventoryMode> = { list: "compact", compact: "blank", blank: "list" };
  const modeLabel: Record<InventoryMode, string> = {
    list: "Свернуть инвентарь в строку",
    compact: "Скрыть инвентарь и значения монет",
    blank: "Вернуть инвентарь",
  };
  const coins = [['ЗМ', 'Золото', currency.gp], ['СМ', 'Серебро', currency.sp], ['ММ', 'Медь', currency.cp], ['ПМ', 'Платина', currency.pp]] as const;

  return <section className={`pdf-panel pdf-inventory pdf-inventory--${mode}`} style={style} data-sheet-group="inventory" data-sheet-panel="inventory">
    <SheetPanelTitle title="Инвентарь и монеты" group="инвентарь" size={size} onSize={onSize}><button type="button" className="pdf-inventory-toggle" onClick={() => onModeChange(nextMode[mode])} aria-label={modeLabel[mode]} title={modeLabel[mode]}>↻</button></SheetPanelTitle>
    <div className="pdf-currency-grid">{coins.map(([short, label, amount]) => <div key={short}><b>{mode === "blank" ? "" : amount}</b><span>{short}</span><small>{label}</small></div>)}</div>
    {mode === "list" && <>
      <div className="pdf-inventory-list">{equipment.length ? equipment.map((item, index) => <p key={`${item}-${index}`}>□ {item}</p>) : <p>Снаряжение не выбрано.</p>}</div>
    </>}
    {mode === "compact" && <p className="pdf-inventory-compact">{equipment.length ? equipment.join(" · ") : "Снаряжение не выбрано."}</p>}
    {mode === "blank" && <div className="pdf-inventory-blank" aria-label="Пустое поле инвентаря для заполнения от руки" />}
  </section>;
}

export function PdfCharacterSheet(props: PdfCharacterSheetProps) {
  const primaryContent = useRef<HTMLDivElement>(null);
  const attackDialog=useRef<HTMLDialogElement>(null);
  const [layout,setLayout]=useState(defaultSheetLayout);
  const [layoutReady,setLayoutReady]=useState(false);
  const autoFitRequest=useRef(false);
  const [fitRevision,setFitRevision]=useState(0);
  const [fitStatus,setFitStatus]=useState("A4 · автоматическая компоновка");
  useEffect(()=>{try{setLayout(normalizeSheetLayout(JSON.parse(localStorage.getItem('list-geroya-sheet-layout-v1') || 'null')));}catch{/* Invalid settings never touch character data. */}setLayoutReady(true);},[]);
  useEffect(()=>{if(layoutReady)try{localStorage.setItem('list-geroya-sheet-layout-v1',JSON.stringify(layout));}catch{/* Session controls still work. */}},[layout,layoutReady]);
  function resize(group:SheetGroup,delta:number){setLayout(current=>({...current,sizes:{...current.sizes,[group]:Math.max(70,Math.min(160,current.sizes[group]+delta))}}));}
  function panelStyle(group:SheetGroup):CSSProperties {return {'--sheet-text-scale':layout.sizes[group]/100} as CSSProperties;}
  const [inventoryMode, setInventoryMode] = useState<InventoryMode>("list");
  const [showPreparedMarks, setShowPreparedMarks] = useState(true);
  function changeInventoryMode(mode: InventoryMode) {
    setInventoryMode(mode);
    if (mode === "blank") setShowPreparedMarks(false);
  }
  const classFeatures = ordered(props.classFeatures);
  const combatTechniques = classFeatures.filter(isCombatTechnique);
  const ordinaryClassFeatures = classFeatures.filter(feature => !combatTechniques.includes(feature));
  const originFeatures = [
    ...props.raceFeatures.map(feature => ({ ...feature, name: `Раса · ${feature.name}` })),
    { ...props.backgroundFeature, name: `Предыстория · ${props.backgroundFeature.name}` },
    ...props.featFeatures.map(feature => ({ ...feature, name: `Черта · ${feature.name}` })),
  ];
  const classPages = paginateFeatureColumns([...combatTechniques, ...ordinaryClassFeatures, ...originFeatures],1225 / Math.pow(layout.sizes.features/100,1.8));
  const abilityOrder = ["str", "dex", "con", "int", "wis", "cha"];
  const skills = Object.entries(skillKeys)
    .map(([name, detail]) => ({ name, ...detail }))
    .sort((left, right) => abilityOrder.indexOf(left.stat) - abilityOrder.indexOf(right.stat) || left.name.localeCompare(right.name, "ru"));
  const hasSpellPage = Boolean(props.spellAbility || props.spells.length);
  const wizardPrepared = props.spells.some(spell => spell.classSource === "Волшебник") || props.classId === "wizard";
  const orderedSpells = [...props.spells].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, "ru"));
  const spellPages = hasSpellPage ? paginateSpells(orderedSpells, wizardPrepared) : [];
  const spellCardPages = orderedSpells.length ? paginateSpellCards(orderedSpells) : [];
  const [primaryResources, ...resourcePages] = paginateResources(props.resources);
  const proficiencyRows = [
    ["Инструменты", props.proficiencies.tools],
    ["Языки", props.proficiencies.languages],
    ["Доспехи", props.proficiencies.armor],
    ["Оружие", props.proficiencies.weapons],
  ] as const;
  const totalPages = 2 + classPages.length + resourcePages.length + spellPages.length + spellCardPages.length;
  const lifePageNumber = 2 + classPages.length;
  const firstSpellPageNumber = lifePageNumber + resourcePages.length + 1;
  const firstSpellCardPageNumber = firstSpellPageNumber + spellPages.length;

  // Screen and print use the same fixed A4 canvas. Every adjustment solves
  // the complete layout using actual wrapped text, including saves and proficiencies.
  useLayoutEffect(() => {
    const content=primaryContent.current;
    if(!content)return;
    const page=content.parentElement!;
    const documentElement=content.closest<HTMLElement>('.pdf-document')!;
    const grid=content.querySelector<HTMLElement>('.pdf-primary-grid')!;
    const cards=new Map(Array.from(grid.children).map(el=>[(el as HTMLElement).dataset.sheetPanel as SheetPanelId,el as HTMLElement]));
    let active=true,frame=0;
    function fit(){
      if(!active)return;
      const printing=window.matchMedia('print').matches;
      const parent=documentElement.parentElement!;
      const parentStyle=getComputedStyle(parent);
      const previewWidth=parent.clientWidth-parseFloat(parentStyle.paddingLeft)-parseFloat(parentStyle.paddingRight);
      documentElement.style.zoom=String(printing?1:Math.min(1,previewWidth/(210*96/25.4)));
      const pageStyle=getComputedStyle(page);
      const width=page.clientWidth-parseFloat(pageStyle.paddingLeft)-parseFloat(pageStyle.paddingRight);
      content!.style.width=`${width}px`;
      content!.style.transform='none';
      grid.dataset.fitted='true';
      const unit=(width+8)/sheetColumns;
      const available=page.clientHeight-parseFloat(pageStyle.paddingTop)-Math.max(parseFloat(pageStyle.paddingBottom),12*96/25.4);
      const gridTop=grid.offsetTop;
      const budget=available-gridTop;
      const cache=new Map<string,number>();
      const applySizes=(sizes:typeof layout.sizes)=>cards.forEach(card=>{
        const group=card.dataset.sheetGroup as SheetGroup|undefined;
        card.style.setProperty('--sheet-text-scale',String(group?sizes[group]/100:1));
      });
      const evaluate=(sizes:typeof layout.sizes)=>fitSheet((id,span)=>{
        const card=cards.get(id)!;
        const group=card.dataset.sheetGroup as SheetGroup|undefined;
        const scale=group?sizes[group]/100:1;
        const key=`${id}:${span}:${scale}`;
        const previous=cache.get(key);
        if(previous!==undefined)return previous;
        const cardWidth=span*unit-8;
        card.style.width=`${cardWidth}px`;
        card.style.setProperty('--sheet-text-scale',String(scale));
        card.style.setProperty('--save-columns',String(Math.max(1,Math.min(3,Math.floor((cardWidth-22)/(110*scale))))));
        card.style.setProperty('--inventory-columns',cardWidth>=260*scale?'2':'1');
        card.style.setProperty('--coin-columns',cardWidth>=275*scale?'4':'2');
        const height=card.offsetHeight;
        cache.set(key,height);
        return height;
      },budget);
      let sizes=layout.sizes;
      if(autoFitRequest.current){
        sizes=optimalSheetSizes(sizes,next=>evaluate(next).height,budget);
        autoFitRequest.current=false;
        setLayout(current=>({...current,sizes}));
      }
      const result=evaluate(sizes);
      applySizes(sizes);
      for(const placement of result.placements){
        const card=cards.get(placement.id)!;
        const cardWidth=placement.span*unit-8;
        const scale=(card.dataset.sheetGroup?sizes[card.dataset.sheetGroup as SheetGroup]/100:1);
        Object.assign(card.style,{left:`${placement.start*unit}px`,top:`${placement.top}px`,width:`${cardWidth}px`});
        card.style.setProperty('--save-columns',String(Math.max(1,Math.min(3,Math.floor((cardWidth-22)/(110*scale))))));
        card.style.setProperty('--inventory-columns',cardWidth>=260*scale?'2':'1');
        card.style.setProperty('--coin-columns',cardWidth>=275*scale?'4':'2');
      }
      grid.style.height=`${result.height}px`;
      const scale=Math.min(1,available/Math.max(1,gridTop+result.height));
      content!.style.transform=`translateX(${width*(1-scale)/2}px) scale(${scale})`;
      content!.dataset.fitScale=String(scale);
      setFitStatus(scale<.995?'A4 · блоки перераспределены, лист подогнан к странице':'A4 · блоки перераспределены автоматически');
    }
    const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(fit);};
    fit();
    document.fonts.ready.then(()=>{if(active)fit();});
    window.addEventListener('resize',schedule);
    window.addEventListener('beforeprint',fit);
    window.addEventListener('afterprint',fit);
    return ()=>{active=false;cancelAnimationFrame(frame);window.removeEventListener('resize',schedule);window.removeEventListener('beforeprint',fit);window.removeEventListener('afterprint',fit);};
  },[props,inventoryMode,layout,fitRevision]);

  const sheetEdition = props.sheetEdition || "2014";

  return <div className="pdf-sheet-workspace"><div className="pdf-sheet-toolbar"><button type="button" disabled={!layoutReady} onClick={()=>{autoFitRequest.current=true;setFitRevision(value=>value+1);}}>Оптимальные настройки</button><span role="status">{fitStatus}</span></div><div className={`pdf-document pdf-document--a4 pdf-document--${sheetEdition}`} data-sheet-edition={sheetEdition}>
    <section className="pdf-page pdf-primary-page">
      <div className="pdf-primary-content" ref={primaryContent}>
      <div className="pdf-brand">ЛИСТ ГЕРОЯ <i>5e · правила 2014 · лист {sheetEdition}</i></div>
      <header className="pdf-hero-header">
        <div><small>ИМЯ ПЕРСОНАЖА</small><h1>{props.identity.name || "Безымянный герой"}</h1></div>
        <dl>
          <div><dt>Класс и уровень</dt><dd>{props.identity.className} {props.identity.level}{props.identity.subclassName ? ` · ${props.identity.subclassName}` : ""}</dd></div>
          <div><dt>Раса</dt><dd>{props.identity.raceName}</dd></div>
          <div><dt>Предыстория</dt><dd>{props.identity.backgroundName}</dd></div>
          <div><dt>Опыт</dt><dd /></div>
          <div><dt>Мировоззрение</dt><dd>{props.identity.alignment || "—"}</dd></div>
          <div><dt>Вдохновение</dt><dd>{props.identity.inspiration ? "Есть" : ""}</dd></div>
        </dl>
      </header>
      <div className="pdf-ability-row">
        {(Object.keys(abilityLabels) as (keyof AbilityScores)[]).map(key => <div key={key}><small>{abilityLabels[key]}</small><strong>{signed(abilityModifier(props.abilities[key]))}</strong><span>{props.abilities[key]}</span></div>)}
      </div>
      <div className="pdf-primary-grid">
        <section className="pdf-panel pdf-skills" style={panelStyle('skills')} data-sheet-group="skills" data-sheet-panel="skills"><SheetPanelTitle title="Навыки" group="навыки и владения" size={layout.sizes.skills} onSize={delta=>resize('skills',delta)}/>
          <p className="pdf-inline-stats"><b>БМ {signed(props.proficiency)}</b><b>Пассивная внимательность {props.passivePerception}</b></p>
          {skills.map(skill => {
            const proficient = props.proficiencies.skills.includes(skill.name);
            const expertise = props.proficiencies.expertise.includes(skill.name);
            const bonus = abilityModifier(props.abilities[skill.stat as keyof AbilityScores]) + (expertise ? props.proficiency * 2 : proficient ? props.proficiency : 0);
            return <p key={skill.key}><i>{expertise ? "◆" : proficient ? "●" : "○"}</i><b>{signed(bonus)}</b>{skill.name} <small>({abilityLabels[skill.stat as keyof AbilityScores].slice(0, 3)})</small></p>;
          })}

        </section>
        <section className="pdf-core-column" data-sheet-panel="core">
          <div className="pdf-combat-cards"><div><strong>{props.ac}</strong><span>КД</span></div><div><strong>{signed(props.initiative)}</strong><span>Инициатива</span></div><div><strong>{props.speed}</strong><span>Скорость</span>{props.movement && <small>{[props.movement.swim ? `плав. ${props.movement.swim}` : "", props.movement.climb ? `лаз. ${props.movement.climb}` : "", props.movement.fly ? `полёт ${props.movement.fly}` : ""].filter(Boolean).join(" · ")}</small>}</div></div>
          {!!props.initiativeNotes?.length && <p className="pdf-inline-stats">Инициатива: {props.initiativeNotes.join("; ")}</p>}
          <div className="pdf-panel pdf-hp"><small>МАКСИМУМ ХИТОВ</small><strong>{props.hitPoints}</strong><span>Кости хитов: {props.hitDiceLabel || `к${props.hitDie}`} · {props.hitDiceRemaining ?? props.identity.level} / {props.identity.level}</span></div>
          <div className="pdf-panel pdf-current-hp"><label>ТЕКУЩИЕ ХИТЫ <b>{props.currentHitPoints || ""}</b></label><label>ВРЕМЕННЫЕ ХИТЫ <b>{props.temporaryHitPoints || ""}</b></label></div>
          <div className="pdf-panel pdf-resources"><h2>Ресурсы</h2>
            {primaryResources.length ? <ResourceList resources={primaryResources} /> : <p>Ограниченных ресурсов нет.</p>}
            {resourcePages.length > 0 && <p className="pdf-resource-continuation">Остальные ресурсы — стр. {lifePageNumber + 1}</p>}
          </div>
        </section>
        <section className="pdf-panel pdf-attacks" style={panelStyle('attacks')} data-sheet-group="attacks" data-sheet-panel="attacks">
          <SheetPanelTitle title="Оружие и боевые заклинания" group="оружие и заклинания" size={layout.sizes.attacks} onSize={delta=>resize('attacks',delta)}><button type="button" aria-label="Настройки оружия и заклинаний" title="Что отображать на листе" onClick={()=>attackDialog.current?.showModal()}><Settings size={14} aria-hidden="true"/></button></SheetPanelTitle>
          {layout.visible.notice && <p>{automaticAttacksNotice}</p>}
          <div className="pdf-attack-head pdf-attack-columns" style={{'--attack-columns':`minmax(0,1.4fr)${layout.visible.hit?' minmax(0,.7fr)':''}${layout.visible.damage?' minmax(0,.8fr)':''}`} as CSSProperties}><b>Название</b>{layout.visible.hit&&<b>Атака / Сл</b>}{layout.visible.damage&&<b>Урон</b>}</div>
          {props.attacks.filter(attack=>layout.visible[attack.kind] && !layout.hiddenAttacks.includes(attack.id)).map(attack => <article key={attack.id}><div className="pdf-attack-columns" style={{'--attack-columns':`minmax(0,1.4fr)${layout.visible.hit?' minmax(0,.7fr)':''}${layout.visible.damage?' minmax(0,.8fr)':''}`} as CSSProperties}><b>{attack.name}</b>{layout.visible.hit&&<span>{attack.attackBonus !== undefined ? signed(attack.attackBonus) : `Сл ${attack.saveDc}`}</span>}{layout.visible.damage&&<code>{attack.damageDisplay}</code>}</div>{layout.visible.notes && attack.note && <p>{attack.note}</p>}</article>)}
          {!props.attacks.some(attack=>layout.visible[attack.kind]&&!layout.hiddenAttacks.includes(attack.id)) && <p>Нет атак для отображения. Выберите их в настройках блока.</p>}
          {layout.visible.spellNumbers && (props.spellcastingSources?.length ? <div className="pdf-spell-numbers">{props.spellcastingSources.map(source => <span key={source.name}><b>{source.name}</b> · {source.ability} · Сл {source.dc} · атака {signed(source.attack)}</span>)}</div> : props.spellAbility && <div className="pdf-spell-numbers"><span>Базовая характеристика <b>{props.spellAbility}</b></span><span>Сл <b>{props.spellSaveDc}</b></span><span>Атака <b>{signed(props.spellAttackBonus || 0)}</b></span></div>)}
        </section>
        <InventoryPanel equipment={props.equipment} currency={props.currency} mode={inventoryMode} onModeChange={changeInventoryMode} size={layout.sizes.inventory} onSize={delta=>resize('inventory',delta)} style={panelStyle('inventory')} />
        <section className="pdf-panel pdf-primary-features" style={panelStyle('features')} data-sheet-group="features" data-sheet-panel="features"><SheetPanelTitle title="Расовые способности" group="способности" size={layout.sizes.features} onSize={delta=>resize('features',delta)}/><RacialTraitList features={props.raceFeatures}/></section>
        <section className="pdf-panel pdf-saving-throws" style={panelStyle('skills')} data-sheet-group="skills" data-sheet-panel="saves">          <h2>Спасброски</h2>
          <div className="pdf-save-row">{(Object.keys(abilityLabels) as (keyof AbilityScores)[]).map(key => <span key={key}><i>{props.savingThrows.includes(key) ? "●" : "○"}</i><b>{abilityLabels[key]}</b><strong>{signed(abilityModifier(props.abilities[key]) + (props.savingThrows.includes(key) ? props.proficiency : 0) + (props.savingThrowBonuses?.[key] || 0))}</strong></span>)}</div>
</section>
        <section className="pdf-panel pdf-proficiency-panel" style={panelStyle('skills')} data-sheet-group="skills" data-sheet-panel="proficiencies">          <div className="pdf-proficiencies"><h2>Владения и защита</h2>{proficiencyRows.map(([label, values]) => <p key={label}><b>{label}:</b> {values.join(", ") || "нет"}</p>)}{props.defenses && ([ ["Сопротивления",props.defenses.resistances],["Иммунитеты к урону",props.defenses.immunities],["Уязвимости",props.defenses.vulnerabilities] ] as const).filter(([,values])=>values.length).map(([label,values])=><p key={label}><b>{label}:</b> {values.join(", ")}</p>)}</div></section>
      </div>
      </div>
      <footer>Лист Героя 5e · Основной лист <span>1 / {totalPages}</span></footer>
    </section>

    {classPages.map((pageColumns, pageIndex) => {
      const pageNumber = pageIndex + 2;
      return <section className="pdf-page pdf-class-page" key={`class-page-${pageIndex}`} style={panelStyle('features')}>
        <PageHeader eyebrow={`${props.identity.className} · ${props.identity.level} уровень${pageIndex ? " · продолжение" : ""}`} title="Боевые и классовые способности" page={pageNumber} />
        <div className="pdf-feature-toolbar"><SheetPanelTitle title="Размер текста способностей" group="классовые способности" size={layout.sizes.features} onSize={delta=>resize('features',delta)}/></div>
        {pageIndex === 0 && <p className="pdf-section-note">Особые атаки и боевые приёмы собраны в начале раздела; далее идут классовые, расовые и полученные от черт особенности. Обычные атаки оружием находятся на основном листе.</p>}
        <div className="pdf-two-columns"><FeatureList features={pageColumns[0]} /><FeatureList features={pageColumns[1]} /></div>
        <footer>Лист Героя 5e · Классовые способности{pageIndex ? " · продолжение" : ""} <span>{pageNumber} / {totalPages}</span></footer>
      </section>;
    })}

    <section className="pdf-page">
      <PageHeader eyebrow="Снаряжение, история и заметки" title="Жизнь героя" page={lifePageNumber} />
      <div className="pdf-life-grid">
        <section className="pdf-personality">
          <div className="pdf-panel"><h2>Черты характера</h2><p>{props.personality.traits || "—"}</p></div>
          <div className="pdf-panel"><h2>Идеалы</h2><p>{props.personality.ideals || "—"}</p></div>
          <div className="pdf-panel"><h2>Привязанности</h2><p>{props.personality.bonds || "—"}</p></div>
          <div className="pdf-panel"><h2>Слабости</h2><p>{props.personality.flaws || "—"}</p></div>
        </section>
      </div>
      <section className="pdf-panel pdf-notes"><h2>Заметки кампании</h2>{Array.from({ length: 18 }, (_, index) => <i key={index} />)}</section>
      <footer>Лист Героя 5e · История и заметки <span>{lifePageNumber} / {totalPages}</span></footer>
    </section>

    {resourcePages.map((resources, index) => <section className="pdf-page pdf-resource-page" key={`resources-${index}`}>
      <PageHeader eyebrow="Расовые и классовые способности" title="Ресурсы · продолжение" page={lifePageNumber + index + 1} />
      <div className="pdf-resource-page-grid"><ResourceList resources={resources} /></div>
      <footer>Лист Героя 5e · Ресурсы <span>{lifePageNumber + index + 1} / {totalPages}</span></footer>
    </section>)}

    {spellPages.map((pageSpells, spellPageIndex) => {
      const split = Math.ceil(pageSpells.length / 2);
      const columns = [pageSpells.slice(0, split), pageSpells.slice(split)];
      const pageNumber = firstSpellPageNumber + spellPageIndex;
      return <section className="pdf-page pdf-spell-page" key={`spell-page-${spellPageIndex}`}>
        <PageHeader eyebrow={`${props.identity.className} · заклинания${spellPageIndex ? " · продолжение" : ""}`} title="Книга заклинаний" page={pageNumber} />
        {spellPageIndex === 0 && <div className="pdf-slot-strip">{props.spellSlots.map((slots, index) => <div key={index}><small>{index + 1} круг</small><strong>{slots}</strong><span>{Array.from({ length: slots }, (_, slot) => <i key={slot} />)}</span></div>)}{props.pactSlots && props.pactSlots.slots > 0 && <div><small>Договор · {props.pactSlots.level} круг</small><strong>{props.pactSlots.slots}</strong></div>}</div>}
        {wizardPrepared && spellPageIndex === 0 && <div className="pdf-prepared-summary"><span>Максимум подготовленных: <b>{props.preparedMaximum ?? 0}</b></span><button type="button" onClick={() => setShowPreparedMarks(value => !value)}>{showPreparedMarks ? "Очистить отметки для печати" : "Показать текущую подготовку"}</button></div>}
        <div className={`pdf-spell-columns${wizardPrepared ? " wizard" : ""}`}>
          {columns.map((column, columnIndex) => <div className={`pdf-spell-table${wizardPrepared ? " wizard" : ""}`} key={columnIndex}>
            <header><b>Кр.</b><b>Заклинание</b><b>В/С/М</b>{wizardPrepared && <b>Подг.</b>}</header>
            {column.map(spell => <div key={`${spell.classSource}-${spell.id}`}>
              <span>{spell.level}</span>
              <strong>{spell.name} · {spell.classSource}{spell.grantSource ? ` (${spell.grantSource})` : ""}{spell.ritual ? " Р" : ""}{spell.alwaysPrepared ? " †" : ""}</strong>
              <span>{spellComponentLabel(spell)}</span>
              {wizardPrepared && <span>{spell.level === 0 || spell.classSource !== "Волшебник" ? "—" : showPreparedMarks && (spell.prepared || spell.alwaysPrepared) ? "●" : "○"}</span>}
            </div>)}
          </div>)}
        </div>
        <p className="pdf-spell-legend">Р — ритуал. М* — компонент со стоимостью или расходуемый. † — всегда подготовлено и не занимает лимит.{wizardPrepared ? showPreparedMarks ? " ● Подготовлено сейчас; ○ находится в книге." : " ○ Пустая отметка для заполнения вручную." : ""}</p>
        <footer>Лист Героя 5e · Заклинания{spellPageIndex ? " · продолжение" : ""} <span>{pageNumber} / {totalPages}</span></footer>
      </section>;
    })}

    {spellCardPages.map((pageSpells, cardPageIndex) => {
      const pageNumber = firstSpellCardPageNumber + cardPageIndex;
      return <section className="pdf-page pdf-spell-card-page" key={`spell-card-page-${cardPageIndex}`}>
        <PageHeader eyebrow={`${props.identity.className} · справочник заклинаний${cardPageIndex ? " · продолжение" : ""}`} title="Карточки заклинаний" page={pageNumber} />
        <div className="pdf-spell-card-grid">
          {pageSpells.map(spell => <PdfSpellCard spell={spell} key={`${spell.classSource}-${spell.id}`} />)}
        </div>
        <footer>Лист Героя 5e · Карточки заклинаний{cardPageIndex ? " · продолжение" : ""} <span>{pageNumber} / {totalPages}</span></footer>
      </section>;
    })}
    <dialog ref={attackDialog} className="pdf-display-settings" aria-labelledby="pdf-attack-settings-title"><header><h2 id="pdf-attack-settings-title">Оружие и заклинания на листе</h2><button type="button" onClick={()=>attackDialog.current?.close()} aria-label="Закрыть настройки оружия">✕</button></header><p>Меняется только отображение на листе. Оружие и заклинания остаются у персонажа.</p>
      <fieldset><legend>Показывать</legend>{([['weapon','Оружие'],['cantrip','Заговоры'],['spell','Заклинания'],['feature','Атаки способностей'],['hit','Попадание и сложность спасброска'],['damage','Урон'],['notes','Описания и примечания'],['spellNumbers','Параметры заклинателя'],['notice','Пояснение об автоматическом списке атак']] as const).map(([key,label])=><label key={key}><input type="checkbox" checked={layout.visible[key]} onChange={e=>setLayout(current=>({...current,visible:{...current.visible,[key]:e.target.checked}}))}/>{label}</label>)}</fieldset>
      <fieldset><legend>Отдельные атаки</legend>{props.attacks.length?props.attacks.map(attack=><label key={attack.id}><input type="checkbox" checked={!layout.hiddenAttacks.includes(attack.id)} onChange={e=>setLayout(current=>({...current,hiddenAttacks:e.target.checked?current.hiddenAttacks.filter(id=>id!==attack.id):[...current.hiddenAttacks,attack.id]}))}/>{attack.name}</label>):<p>Атаки ещё не выбраны.</p>}</fieldset>
      <button type="button" onClick={()=>setLayout(current=>({...current,visible:{...defaultSheetLayout.visible},hiddenAttacks:[]}))}>Вернуть стандартный состав</button><button type="button" onClick={()=>attackDialog.current?.close()}>Готово</button>
    </dialog>
  </div></div>;
}
