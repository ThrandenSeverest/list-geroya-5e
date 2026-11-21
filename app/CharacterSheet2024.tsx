"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { PdfCharacterSheetProps, PdfSpell } from "./PdfCharacterSheet";
import type { AbilityScores } from "./exportFormats";
import type { CharacterAttack } from "./combat";
import { abilityLabels, type Feature } from "./rules";
import { spellComponentLabel } from "./spellComponents";
import { resourceRestLabel } from "./characterResources";
import "./character-sheet-2024.css";

const signed = (value: number) => value < 0 ? String(value) : `+${value}`;
const modifier = (score: number) => Math.floor((score - 10) / 2);
const attackRows = 6;
const spellRows = 30;
const skillsByAbility = {
  str: ["Атлетика"],
  dex: ["Акробатика", "Ловкость рук", "Скрытность"],
  con: [],
  int: ["История", "Магия", "Природа", "Расследование", "Религия"],
  wis: ["Внимательность", "Выживание", "Медицина", "Проницательность", "Уход за животными"],
  cha: ["Выступление", "Запугивание", "Обман", "Убеждение"],
} satisfies Record<keyof AbilityScores, string[]>;

function Panel({ title, className = "", children }: { title: string; className?: string; children: ReactNode }) {
  return <section className={`hs24-panel ${className}`}><h2>{title}</h2>{children}</section>;
}

function Value({ label, children }: { label: string; children?: ReactNode }) {
  return <div className="hs24-value"><span>{label}</span><strong>{children}</strong></div>;
}

function Marks({ total, used = 0, label }: { total: number; used?: number; label: string }) {
  return <span className="hs24-marks" role="img" aria-label={`${label}: ${used} из ${total}`}>
    {Array.from({ length: total }, (_, i) => <i key={i} className={i < used ? "filled" : ""} />)}
  </span>;
}

function Ability({ ability, props }: { ability: keyof AbilityScores; props: PdfCharacterSheetProps }) {
  const score = props.abilities[ability];
  const mod = modifier(score);
  const save = props.savingThrows.includes(ability);
  return <Panel title={abilityLabels[ability]} className="hs24-ability">
    <div className="hs24-ability-values"><Value label="Модификатор">{signed(mod)}</Value><strong className="hs24-ability-score" aria-label={`${abilityLabels[ability]}: ${score}`}>{score}</strong></div>
    <div className="hs24-check hs24-save"><Marks total={1} used={Number(save)} label="Владение" /><b>{signed(mod + (save ? props.proficiency : 0) + (props.savingThrowBonuses?.[ability] ?? 0))}</b>Спасбросок</div>
    {skillsByAbility[ability].map(skill => {
      const trained = props.proficiencies.skills.includes(skill);
      const expert = props.proficiencies.expertise.includes(skill);
      const bonus = props.sheet2024?.skillBonuses?.[skill] ?? mod + (expert ? 2 : trained ? 1 : 0) * props.proficiency;
      return <div className="hs24-check" key={skill}><Marks total={1} used={Number(trained || expert)} label={expert ? "Компетентность" : "Владение"} /><b>{signed(bonus)}</b>{skill === "Внимательность" ? "Восприятие" : skill}</div>;
    })}
  </Panel>;
}

function AttackTable({ attacks, blankRows = 0 }: { attacks: CharacterAttack[]; blankRows?: number }) {
  return <table className="hs24-table hs24-attacks"><colgroup><col style={{ width: "30%" }} /><col style={{ width: "16%" }} /><col style={{ width: "19%" }} /><col /></colgroup>
    <thead><tr><th>Название</th><th>Атака / Сл</th><th>Урон и эффект</th><th>Заметки</th></tr></thead>
    <tbody>{Array.from({ length: Math.max(attacks.length, blankRows) }, (_, index) => {
      const a = attacks[index];
      return <tr key={index}><td>{a?.name}</td><td>{a?.attackBonus != null ? signed(a.attackBonus) : a?.saveDc != null ? `Сл ${a.saveDc}` : ""}</td><td>{a?.damageDisplay}</td><td>{a?.note}</td></tr>;
    })}</tbody>
  </table>;
}

function SpellTable({ spells, blankRows = 0 }: { spells: PdfSpell[]; blankRows?: number }) {
  return <table className="hs24-table hs24-spells"><colgroup><col style={{ width: "6%" }} /><col style={{ width: "30%" }} /><col style={{ width: "20%" }} /><col style={{ width: "19%" }} /><col /></colgroup>
    <thead><tr><th>Ур.</th><th>Название</th><th>Время накладывания</th><th>К / Р / М</th><th>Заметки</th></tr></thead>
    <tbody>{Array.from({ length: Math.max(spells.length, blankRows) }, (_, index) => {
      const spell = spells[index];
      const flags = spell ? [/(?:концентрац|concentration)/i.test(spell.duration ?? ""), !!spell.ritual, spellComponentLabel(spell).includes("М")] : [];
      return <tr key={index}><td>{spell?.level}</td><td>{spell?.alwaysPrepared ? "† " : ""}{spell?.name}</td><td>{spell?.castingTime}</td><td><div className="hs24-flags">{["К", "Р", "М"].map((label, i) => <span key={label}><Marks total={1} used={Number(!!flags[i])} label={label} />{label}</span>)}</div></td><td>{[spell?.range, spell?.classSource].filter(Boolean).join(" · ")}</td></tr>;
    })}</tbody>
  </table>;
}

function FeatureList({ features }: { features: Feature[] }) {
  return <>{features.map((f, i) => <p key={i}><b>{f.name}.</b> {f.description}</p>)}</>;
}

export function CharacterSheet2024(props: PdfCharacterSheetProps) {
  const root = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState<string[]>([]);
  const [tableOverflow, setTableOverflow] = useState({ attacks: false, spells: false });
  const { identity, proficiencies, sheet2024: data } = props;
  const primaryAbility = Object.entries(abilityLabels).find(([, label]) => label === props.spellAbility)?.[0] as keyof AbilityScores | undefined;
  const spells = [...new Map(props.spells.filter(s => s.level === 0 || s.prepared || s.alwaysPrepared)
    .map(s => [`${s.id}:${s.classSource}:${s.grantSource ?? ""}`, s])).values()]
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, "ru"));
  const armor = proficiencies.armor.join(", ");
  const notes: { id: string; label: string; content: ReactNode }[] = [
    { id: "class", label: "Классовые умения", content: <FeatureList features={props.classFeatures} /> },
    { id: "species", label: "Особенности вида", content: <FeatureList features={props.raceFeatures} /> },
    { id: "feats", label: "Черты", content: <FeatureList features={props.featFeatures} /> },
    { id: "weapons", label: "Владение оружием", content: proficiencies.weapons.join(", ") },
    { id: "tools", label: "Владение инструментами", content: proficiencies.tools.join(", ") },
    { id: "history", label: "Предыстория и личность", content: <><p><b>{identity.backgroundName}</b></p>{props.backgroundFeature?.name && <FeatureList features={[props.backgroundFeature]} />}{Object.entries({ "Черты характера": props.personality.traits, "Идеалы": props.personality.ideals, "Привязанности": props.personality.bonds, "Слабости": props.personality.flaws }).filter(([, value]) => value).map(([label, value]) => <p key={label}><b>{label}.</b> {value}</p>)}</> },
    { id: "languages", label: "Языки", content: proficiencies.languages.join(", ") },
    { id: "equipment", label: "Снаряжение", content: props.equipment.join(" · ") },
    { id: "attuned", label: "Настроенные предметы", content: data?.attuned?.join(", ") },
  ];

  useLayoutEffect(() => {
    const doc = root.current;
    if (!doc) return;
    const measure = () => {
      const clipped = [...doc.querySelectorAll<HTMLElement>("[data-hs24-fit]")].filter(box => {
        box.style.removeProperty("font-size");
        if (box.scrollHeight <= box.clientHeight + 1 && box.scrollWidth <= box.clientWidth + 1) return false;
        box.style.fontSize = "7pt";
        return box.scrollHeight > box.clientHeight + 1 || box.scrollWidth > box.clientWidth + 1;
      }).map(box => box.dataset.hs24Fit!);
      setOverflow(previous => clipped.join("|") === previous.join("|") ? previous : clipped);
      const hasClippedCells = (table: string) => [...doc.querySelectorAll<HTMLElement>(`.hs24-page ${table} td`)]
        .some(cell => cell.scrollWidth > cell.clientWidth + 1);
      const attacks = hasClippedCells(".hs24-attacks");
      const spells = hasClippedCells(".hs24-spells");
      setTableOverflow(previous => attacks === previous.attacks && spells === previous.spells ? previous : { attacks, spells });
    };
    measure();
    const observer = new ResizeObserver(measure);
    doc.querySelectorAll(".hs24-page").forEach(page => observer.observe(page));
    return () => observer.disconnect();
  }, [props]);

  function note(id: string, className = "") {
    const entry = notes.find(item => item.id === id)!;
    return <div className={`hs24-paper ${className}`}><div data-hs24-fit={id}>{entry.content}</div>{overflow.includes(id) && <span className="hs24-overflow-hint">Полный текст в приложении</span>}</div>;
  }

  const moreAttacks = props.attacks.length > attackRows || tableOverflow.attacks;
  const moreSpells = spells.length > spellRows || tableOverflow.spells;
  const hasBattleNotes = props.resources.length > 0 || !!props.initiativeNotes?.length ||
    Object.values(props.defenses ?? {}).some(values => values.length > 0);
  const battleNotes = <>
      {props.resources.map((resource, i) => <div className="hs24-resource" key={i}>
        <b>{resource.name}</b><strong>{resource.current}/{resource.max}{resource.die ? ` · ${resource.die}` : ""}</strong>
        <small>{resourceRestLabel(resource)}</small>
      </div>)}
      {([["Сопротивления", props.defenses?.resistances], ["Иммунитеты", props.defenses?.immunities], ["Уязвимости", props.defenses?.vulnerabilities]] as const)
        .filter(([, values]) => values?.length).map(([label, values]) => <p key={label}><b>{label}.</b> {values?.join(", ")}</p>)}
      {props.initiativeNotes?.map((entry, i) => <p key={i}>{entry}</p>)}
    </>;
  return <div className="hs24-preview"><div ref={root} className="hs24-document" aria-label="Лист Героя 2024">
    <section className="hs24-page hs24-main">
      <div className="hs24-top">
        <section className="hs24-panel hs24-identity"><Value label="Имя персонажа">{identity.name}</Value><div><Value label="Предыстория">{identity.backgroundName}</Value><Value label="Класс">{identity.className}</Value><Value label="Вид">{identity.raceName}</Value><Value label="Подкласс">{identity.subclassName}</Value></div></section>
        <section className="hs24-panel hs24-level"><Value label="Уровень">{identity.level}</Value><Value label="Опыт">{identity.experience}</Value></section>
        <Panel title="Класс брони" className="hs24-ac"><strong>{props.ac}</strong><span>Щит <Marks total={1} used={Number(!!data?.shield)} label="Щит в руках" /></span></Panel>
        <div className="hs24-panel hs24-health">
          <Panel title="Хиты" className="hs24-vitals"><Value label="Текущие">{props.currentHitPoints ?? props.hitPoints}</Value><Value label="Временные">{props.temporaryHitPoints || ""}</Value><Value label="Максимум">{props.hitPoints}</Value></Panel>
          <Panel title="Кости хитов" className="hs24-dice"><Value label="Потрачено">{data?.hitDiceSpent}</Value><Value label="Максимум">{data?.hitDiceMaximum ?? `${identity.level}к${props.hitDie}`}</Value></Panel>
          <Panel title="Спасброски от смерти" className="hs24-death"><Value label="Успехи"><Marks total={3} used={data?.deathSuccesses} label="Успехи" /></Value><Value label="Провалы"><Marks total={3} used={data?.deathFailures} label="Провалы" /></Value></Panel>
        </div>
      </div>
      <div className="hs24-wordmark">Лист Героя <span>2024</span></div>
      <div className="hs24-body">
        <aside className="hs24-left">
          <div className="hs24-abilities">
            <div><Panel title="Бонус мастерства" className="hs24-counter"><strong>{signed(props.proficiency)}</strong></Panel><Ability ability="str" props={props} /><Ability ability="dex" props={props} /><Ability ability="con" props={props} /><Panel title="Героическое вдохновение" className="hs24-inspiration"><Marks total={1} used={Number(identity.inspiration)} label="Вдохновение" /></Panel></div>
            <div><Ability ability="int" props={props} /><Ability ability="wis" props={props} /><Ability ability="cha" props={props} /></div>
          </div>
          <Panel title="Владение инструментами и снаряжением" className="hs24-training">
            <div className="hs24-armor"><b>Обращение<br />с доспехами</b>{[["Лёгкие", /л[её]гк/i], ["Средние", /средн/i], ["Тяжёлые", /тяж[её]л/i], ["Щит", /щит/i]].map(([label, match]) => <span key={String(label)}><Marks total={1} used={Number((match as RegExp).test(armor))} label={String(label)} />{String(label)}</span>)}</div>
            <h3>Оружие</h3>{note("weapons")}<h3>Инструменты</h3>{note("tools")}
          </Panel>
        </aside>
        <div className="hs24-right">
          <div className="hs24-stats"><Value label="Инициатива">{signed(props.initiative)}</Value><Value label="Скорость">{props.speed} фт.</Value><Value label="Размер">{data?.size}</Value><Value label="Пассивное восприятие">{props.passivePerception}</Value></div>
          <Panel title="Оружие и боевые заговоры"><AttackTable attacks={props.attacks.slice(0, attackRows)} blankRows={attackRows} /></Panel>
          <Panel title="Классовые умения" className="hs24-class">{note("class", "hs24-two-columns")}</Panel>
          <div className="hs24-traits">
            <Panel title="Особенности вида">{note("species")}</Panel>
            <Panel title="Черты">{note("feats")}</Panel>
          </div>
        </div>
      </div>
    </section>
    <section className="hs24-page hs24-magic">
      <div className="hs24-magic-main">
        <div className="hs24-magic-top">
          <Panel title="Базовая характеристика" className="hs24-casting">
            <Value label="Характеристика">{props.spellAbility}</Value>
            <Value label="Модификатор">{primaryAbility ? signed(modifier(props.abilities[primaryAbility])) : ""}</Value>
            <Value label="Сл спасброска">{props.spellSaveDc}</Value>
            <Value label="Бонус атаки">{props.spellAttackBonus == null ? "" : signed(props.spellAttackBonus)}</Value>
          </Panel>
          <div className="hs24-slot-column"><div className="hs24-wordmark">Лист Героя <span>2024</span></div><Panel title="Ячейки заклинаний" className="hs24-slots">
            <div>{[0, 3, 6].map(start => <section key={start}><small>Круг · всего / потрачено</small>{[start, start + 1, start + 2].map(i => {
              const total = props.spellSlots[i] || 0;
              return <div key={i}><b>{i + 1}</b><span>{total || "—"}</span><Marks total={total || (i === 0 ? 4 : i < 5 ? 3 : i < 7 ? 2 : 1)} used={data?.spellSlotsUsed?.[i]} label="Потрачено" /></div>;
            })}</section>)}</div>
            {!!props.pactSlots?.slots && <p>Магия договора · {props.pactSlots.level} круг · {props.pactSlots.slots} <Marks total={props.pactSlots.slots} used={data?.pactSlotsUsed} label="Потрачено" /></p>}
          </Panel></div>
        </div>
        <Panel title="Заговоры и подготовленные заклинания" className="hs24-spellbook"><SpellTable spells={spells.slice(0, spellRows)} blankRows={spellRows} /></Panel>
      </div>
      <aside className="hs24-magic-side">
        <Panel title="Внешность"><div className="hs24-paper" /></Panel>
        <Panel title="Предыстория и личность">{note("history")}<Value label="Мировоззрение">{identity.alignment}</Value></Panel>
        <Panel title="Языки">{note("languages")}</Panel>
        <Panel title="Снаряжение" className="hs24-equipment">{note("equipment")}<h3>Магические предметы с настройкой</h3>{note("attuned", "hs24-attuned")}</Panel>
        <Panel title="Кошелёк"><div className="hs24-wallet">{([["ММ", props.currency.cp], ["СМ", props.currency.sp], ["ЭМ", data?.electrum], ["ЗМ", props.currency.gp], ["ПМ", props.currency.pp]] as const).map(([label, value]) => <Value key={label} label={label}>{value}</Value>)}</div></Panel>
      </aside>
    </section>
    {(overflow.length > 0 || moreSpells || moreAttacks || hasBattleNotes || (props.spellcastingSources?.length ?? 0) > 1) && <section className="hs24-appendix">
      <h2>{identity.name} · Приложение к листу 2024</h2>
      {moreAttacks && <Panel title="Оружие и боевые заговоры"><AttackTable attacks={props.attacks} /></Panel>}
      {moreSpells && <Panel title={tableOverflow.spells ? "Полный список заклинаний" : "Продолжение списка заклинаний"}><SpellTable spells={tableOverflow.spells ? spells : spells.slice(spellRows)} /></Panel>}
      {(props.spellcastingSources?.length ?? 0) > 1 && <Panel title="Источники заклинаний">{props.spellcastingSources?.map((source, i) => <p key={i}>{source.name} · {source.ability} · Сл {source.dc} · атака {signed(source.attack)}</p>)}</Panel>}
      {hasBattleNotes && <Panel title="Ресурсы и защита">{battleNotes}</Panel>}
      {notes.filter(entry => overflow.includes(entry.id)).map(entry => <Panel key={entry.id} title={entry.label}>{entry.content}</Panel>)}
    </section>}
  </div></div>;
}
