"use client";

import { useState } from "react";
import type { CatalogSpell } from "./catalog";
import type { CharacterAttack } from "./combat";
import type { AbilityScores, Currency } from "./exportFormats";
import { resourceRestLabel } from "./characterResources";
import { abilityLabels, skillKeys, type Feature } from "./rules";
import { spellComponentLabel } from "./spellComponents";

type PdfResource = { name: string; current: number; max: number; die?: string; unit?: number; isShortRest: boolean; isLongRest: boolean };
type PdfSpell = CatalogSpell & { prepared: boolean; alwaysPrepared: boolean };

export type PdfCharacterSheetProps = {
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
  proficiencies: { skills: string[]; expertise: string[]; armor: string[]; weapons: string[]; tools: string[]; languages: string[] };
  ac: number;
  initiative: number;
  speed: number;
  hitPoints: number;
  hitDie: number;
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
  preparedMaximum?: number;
  spells: PdfSpell[];
};

const abilityModifier = (score: number) => Math.floor((score - 10) / 2);
const signed = (value: number) => value >= 0 ? `+${value}` : `${value}`;

function compactRulesText(value: string) {
  const clean = value
    .split(/\n(?:источники|источник|официальные книги|правовой статус|исключено|приложение:)/i)[0]
    .replace(/•\s*-{5,}[\s\S]*/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (clean.length <= 650) return clean;
  const sentences = clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map(text => text.trim()) || [clean];
  const mechanics = /действием|реакци|спасброс|атак|урон|использ|соверш|накладыва|восстанавлив|сопротивлен|преимуществ|помех|кд|скорост/i;
  return [...new Set([sentences[0], ...sentences.filter(sentence => mechanics.test(sentence))])].join(" ").slice(0, 900).trim();
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

function FeatureList({ features }: { features: Feature[] }) {
  return <div className="pdf-feature-list">
    {features.map((feature, index) => <article key={`${feature.name}-${index}`}>
      <h3>{feature.name}</h3>
      <p>{compactRulesText(feature.description)}</p>
    </article>)}
  </div>;
}

function featureWeight(feature: Feature) {
  const text = compactRulesText(feature.description);
  return 92 + Math.ceil(text.length / 58) * 18;
}

function paginateFeatures(features: Feature[], pageBudget = 2450) {
  const pages: Feature[][] = [];
  let page: Feature[] = [];
  let used = 0;
  for (const feature of features) {
    const weight = featureWeight(feature);
    if (page.length && used + weight > pageBudget) {
      pages.push(page);
      page = [];
      used = 0;
    }
    page.push(feature);
    used += weight;
  }
  if (page.length) pages.push(page);
  return pages.length ? pages : [[]];
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

function resourceDensity(resources: PdfResource[]) {
  const marks = resources.reduce((sum, resource) => sum + Math.ceil(resource.max / (resource.unit || 1)), 0);
  if (resources.length >= 6 || marks >= 32) return "micro";
  if (resources.length >= 4 || marks >= 22) return "dense";
  if (resources.length >= 3 || marks >= 14) return "compact";
  return "normal";
}

function isCombatTechnique(feature: Feature) {
  return /удар|при[её]м|ман[её]вр|стрел|клин|фокусиров|боев.*искусств|ки|ци\b|атака/i.test(`${feature.name} ${feature.description}`)
    && !/дополнительн.*атак|мультиатак/i.test(feature.name);
}

function RacialTraitList({ features }: { features: Feature[] }) {
  if (!features.length) return <p>Расовые особенности не выбраны.</p>;
  return <div className="pdf-compact-features">{features.map((feature, index) => {
    const text = compactRulesText(feature.description);
    const summary = text.length > 210 ? `${text.slice(0, 207).trimEnd()}…` : text;
    return <p key={`${feature.name}-${index}`}><b>{feature.name}.</b> {summary}</p>;
  })}</div>;
}

function PageHeader({ eyebrow, title, page }: { eyebrow: string; title: string; page: number }) {
  return <header className="pdf-page-header"><div><small>{eyebrow}</small><h2>{title}</h2></div><b>{page.toString().padStart(2, "0")}</b></header>;
}

type InventoryMode = "list" | "compact" | "blank";

function InventoryPanel({ equipment, currency, mode, onModeChange }: Pick<PdfCharacterSheetProps, "equipment" | "currency"> & { mode: InventoryMode; onModeChange: (mode: InventoryMode) => void }) {
  const nextMode: Record<InventoryMode, InventoryMode> = { list: "compact", compact: "blank", blank: "list" };
  const modeLabel: Record<InventoryMode, string> = {
    list: "Свернуть инвентарь в строку",
    compact: "Скрыть инвентарь и значения монет",
    blank: "Вернуть инвентарь",
  };
  const coins = [['ЗМ', 'Золото', currency.gp], ['СМ', 'Серебро', currency.sp], ['ММ', 'Медь', currency.cp], ['ПМ', 'Платина', currency.pp]] as const;

  return <section className={`pdf-panel pdf-inventory pdf-inventory--${mode}`}>
    <div className="pdf-panel-title-row"><h2>Инвентарь и монеты</h2><button type="button" className="pdf-inventory-toggle" onClick={() => onModeChange(nextMode[mode])} aria-label={modeLabel[mode]} title={modeLabel[mode]}>↻</button></div>
    <div className="pdf-currency-grid">{coins.map(([short, label, amount]) => <div key={short}><b>{mode === "blank" ? "" : amount}</b><span>{short}</span><small>{label}</small></div>)}</div>
    {mode === "list" && <>
      <div className="pdf-inventory-list">{equipment.length ? equipment.map((item, index) => <p key={`${item}-${index}`}>□ {item}</p>) : <p>Снаряжение не выбрано.</p>}</div>
    </>}
    {mode === "compact" && <p className="pdf-inventory-compact">{equipment.length ? equipment.join(" · ") : "Снаряжение не выбрано."}</p>}
    {mode === "blank" && <div className="pdf-inventory-blank" aria-label="Пустое поле инвентаря для заполнения от руки" />}
  </section>;
}

export function PdfCharacterSheet(props: PdfCharacterSheetProps) {
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
  const classPages = paginateFeatures([...combatTechniques, ...ordinaryClassFeatures, ...originFeatures]);
  const abilityOrder = ["str", "dex", "con", "int", "wis", "cha"];
  const skills = Object.entries(skillKeys)
    .map(([name, detail]) => ({ name, ...detail }))
    .sort((left, right) => abilityOrder.indexOf(left.stat) - abilityOrder.indexOf(right.stat) || left.name.localeCompare(right.name, "ru"));
  const hasSpellPage = Boolean(props.spellAbility || props.spells.length);
  const wizardPrepared = props.classId === "wizard";
  const orderedSpells = [...props.spells].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, "ru"));
  const spellPages = hasSpellPage ? paginateSpells(orderedSpells, wizardPrepared) : [];
  const spellCardPages = orderedSpells.length ? paginateSpellCards(orderedSpells) : [];
  const resourcesDensity = resourceDensity(props.resources);
  const proficiencyRows = [
    ["Инструменты", props.proficiencies.tools],
    ["Языки", props.proficiencies.languages],
    ["Доспехи", props.proficiencies.armor],
    ["Оружие", props.proficiencies.weapons],
  ] as const;
  const totalPages = 2 + classPages.length + spellPages.length + spellCardPages.length;
  const lifePageNumber = 2 + classPages.length;
  const firstSpellPageNumber = lifePageNumber + 1;
  const firstSpellCardPageNumber = firstSpellPageNumber + spellPages.length;

  return <div className="pdf-document" aria-hidden="true">
    <section className="pdf-page pdf-primary-page">
      <div className="pdf-brand">ЛИСТ ГЕРОЯ <i>5e · 2014</i></div>
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
        <section className="pdf-panel pdf-skills"><h2>Навыки и спасброски</h2>
          <p className="pdf-inline-stats"><b>БМ {signed(props.proficiency)}</b><b>Пассивная внимательность {props.passivePerception}</b></p>
          {skills.map(skill => {
            const proficient = props.proficiencies.skills.includes(skill.name);
            const expertise = props.proficiencies.expertise.includes(skill.name);
            const bonus = abilityModifier(props.abilities[skill.stat as keyof AbilityScores]) + (expertise ? props.proficiency * 2 : proficient ? props.proficiency : 0);
            return <p key={skill.key}><i>{expertise ? "◆" : proficient ? "●" : "○"}</i><b>{signed(bonus)}</b>{skill.name} <small>({abilityLabels[skill.stat as keyof AbilityScores].slice(0, 3)})</small></p>;
          })}
          <h3 className="pdf-saves-title">Спасброски</h3>
          <div className="pdf-save-row">{(Object.keys(abilityLabels) as (keyof AbilityScores)[]).map(key => <span key={key}><i>{props.savingThrows.includes(key) ? "●" : "○"}</i><b>{abilityLabels[key].slice(0, 3)}</b><strong>{signed(abilityModifier(props.abilities[key]) + (props.savingThrows.includes(key) ? props.proficiency : 0))}</strong></span>)}</div>
          <div className="pdf-proficiencies"><h3>Владения</h3>{proficiencyRows.map(([label, values]) => <p key={label}><b>{label}:</b> {values.join(", ") || "нет"}</p>)}</div>
        </section>
        <section className="pdf-core-column">
          <div className="pdf-combat-cards"><div><strong>{props.ac}</strong><span>КД</span></div><div><strong>{signed(props.initiative)}</strong><span>Инициатива</span></div><div><strong>{props.speed}</strong><span>Скорость</span></div></div>
          <div className="pdf-panel pdf-hp"><small>МАКСИМУМ ХИТОВ</small><strong>{props.hitPoints}</strong><span>Кости хитов: к{props.hitDie} · {props.hitDiceRemaining ?? props.identity.level} / {props.identity.level}</span></div>
          <div className="pdf-panel pdf-current-hp"><label>ТЕКУЩИЕ ХИТЫ <b>{props.currentHitPoints || ""}</b></label><label>ВРЕМЕННЫЕ ХИТЫ <b>{props.temporaryHitPoints || ""}</b></label></div>
          <div className={`pdf-panel pdf-resources pdf-resources--${resourcesDensity}`}><h2>Ресурсы</h2>{props.resources.length ? props.resources.map(resource => {
            const unit = resource.unit || 1;
            const marks = Math.ceil(resource.max / unit);
            const spentMarks = Math.ceil((resource.max - resource.current) / unit);
            return <div className="pdf-resource" key={resource.name}><div><b>{resource.name}{resource.die ? ` (${resource.die})` : ""}</b>{unit > 1 && <small>1 круг = {unit} хитов</small>}</div><span className="pdf-resource-marks" aria-label={`Потрачено ${resource.max - resource.current} из ${resource.max}`}>{Array.from({ length: marks }, (_, index) => <i className={index < spentMarks ? "spent" : ""} key={index} />)}</span><small className="pdf-resource-rest">{resourceRestLabel(resource)} отдых</small></div>;
          }) : <p>Ограниченных классовых ресурсов нет.</p>}</div>
        </section>
        <section className="pdf-panel pdf-attacks"><h2>Оружие и боевые заклинания</h2>
          <div className="pdf-attack-head"><b>Название</b><b>Попадание / Сл</b><b>Урон</b></div>
          {props.attacks.length ? props.attacks.map(attack => <article key={attack.id}><div><b>{attack.name}</b><span>{attack.attackBonus !== undefined ? signed(attack.attackBonus) : `Сл ${attack.saveDc}`}</span><code>{attack.damageDisplay}</code></div>{attack.note && <p>{attack.note}</p>}</article>) : <p>Атаки ещё не выбраны.</p>}
          {props.spellAbility && <div className="pdf-spell-numbers"><span>Базовая характеристика <b>{props.spellAbility}</b></span><span>Сл <b>{props.spellSaveDc}</b></span><span>Атака <b>{signed(props.spellAttackBonus || 0)}</b></span></div>}
          <div className="pdf-racial-traits"><h3>Расовые способности</h3><RacialTraitList features={props.raceFeatures} /></div>
        </section>
        <InventoryPanel equipment={props.equipment} currency={props.currency} mode={inventoryMode} onModeChange={changeInventoryMode} />
      </div>
      <footer>Лист Героя 5e · Основной лист <span>1 / {totalPages}</span></footer>
    </section>

    {classPages.map((pageFeatures, pageIndex) => {
      const split = Math.ceil(pageFeatures.length / 2);
      const pageNumber = pageIndex + 2;
      return <section className="pdf-page pdf-class-page" key={`class-page-${pageIndex}`}>
        <PageHeader eyebrow={`${props.identity.className} · ${props.identity.level} уровень${pageIndex ? " · продолжение" : ""}`} title="Боевые и классовые способности" page={pageNumber} />
        {pageIndex === 0 && <p className="pdf-section-note">Особые атаки и боевые приёмы собраны в начале раздела; далее идут классовые, расовые и полученные от черт особенности. Обычные атаки оружием находятся на основном листе.</p>}
        <div className="pdf-two-columns"><FeatureList features={pageFeatures.slice(0, split)} /><FeatureList features={pageFeatures.slice(split)} /></div>
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

    {spellPages.map((pageSpells, spellPageIndex) => {
      const split = Math.ceil(pageSpells.length / 2);
      const columns = [pageSpells.slice(0, split), pageSpells.slice(split)];
      const pageNumber = firstSpellPageNumber + spellPageIndex;
      return <section className="pdf-page pdf-spell-page" key={`spell-page-${spellPageIndex}`}>
        <PageHeader eyebrow={`${props.identity.className} · заклинания${spellPageIndex ? " · продолжение" : ""}`} title="Книга заклинаний" page={pageNumber} />
        {spellPageIndex === 0 && <div className="pdf-slot-strip">{props.spellSlots.map((slots, index) => <div key={index}><small>{index + 1} круг</small><strong>{slots}</strong><span>{Array.from({ length: slots }, (_, slot) => <i key={slot} />)}</span></div>)}</div>}
        {wizardPrepared && spellPageIndex === 0 && <div className="pdf-prepared-summary"><span>Максимум подготовленных: <b>{props.preparedMaximum ?? 0}</b></span><button type="button" onClick={() => setShowPreparedMarks(value => !value)}>{showPreparedMarks ? "Очистить отметки для печати" : "Показать текущую подготовку"}</button></div>}
        <div className={`pdf-spell-columns${wizardPrepared ? " wizard" : ""}`}>
          {columns.map((column, columnIndex) => <div className={`pdf-spell-table${wizardPrepared ? " wizard" : ""}`} key={columnIndex}>
            <header><b>Кр.</b><b>Заклинание</b><b>В/С/М</b>{wizardPrepared && <b>Подг.</b>}</header>
            {column.map(spell => <div key={spell.id}>
              <span>{spell.level === 0 ? "З" : spell.level}</span>
              <strong>{spell.name}{spell.ritual ? " Р" : ""}{spell.alwaysPrepared ? " †" : ""}</strong>
              <span>{spellComponentLabel(spell)}</span>
              {wizardPrepared && <span>{spell.level === 0 ? "—" : showPreparedMarks && (spell.prepared || spell.alwaysPrepared) ? "●" : "○"}</span>}
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
          {pageSpells.map(spell => <article className={`pdf-spell-card pdf-spell-card--${spellCardDensity(spell)}`} key={spell.id}>
            <header><div><small>{spell.level === 0 ? "Заговор" : `${spell.level} круг`} · {spell.school}</small><h3>{spell.name}{spell.ritual ? " Р" : ""}</h3></div><b>{spell.source}</b></header>
            <dl>
              <div><dt>Накладывание</dt><dd>{spell.castingTime || "—"}</dd></div>
              <div><dt>Дистанция</dt><dd>{spell.range || "—"}</dd></div>
              <div><dt>Компоненты</dt><dd>{spell.components || spellComponentLabel(spell) || "—"}</dd></div>
              <div><dt>Длительность</dt><dd>{spell.duration || "—"}</dd></div>
            </dl>
            <p>{spell.description}</p>
          </article>)}
        </div>
        <footer>Лист Героя 5e · Карточки заклинаний{cardPageIndex ? " · продолжение" : ""} <span>{pageNumber} / {totalPages}</span></footer>
      </section>;
    })}
  </div>;
}
