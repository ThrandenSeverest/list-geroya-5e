"use client";

import type { ReactNode, CSSProperties } from "react";
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
const spellCapacities = [8, 13, 13, 13, 13, 9, 9, 9, 6, 7];
// Source artwork is centered with white margins: calibrated from original 1072×1409px raster.
const referencePosition = (x:number,y:number):CSSProperties=>({
  position:"absolute",left:`${(1.20+97.30*x/1072).toFixed(4)}%`,
  top:`${(5.20+90.50*y/1409).toFixed(4)}%`
});
const originalSkillOrder=[
  "Акробатика","Атлетика","Внимательность","Выживание","Уход за животными",
  "Запугивание","Выступление","История","Ловкость рук","Магия","Медицина",
  "Обман","Природа","Проницательность","Расследование","Религия","Скрытность","Убеждение"
] as const;
const spellGeometry:Record<number,{x:number;y:number;step:number;cx?:number;cy?:number}>={
  0:{x:75,y:319,step:25.2},1:{x:75,y:621,step:25.2,cx:194,cy:555},
  2:{x:75,y:1028,step:25.5,cx:194,cy:977},
  3:{x:414,y:319,step:25.3,cx:531,cy:252},
  4:{x:414,y:723,step:25.3,cx:531,cy:663},
  5:{x:414,y:1129,step:25.8,cx:531,cy:1074},
  6:{x:748,y:320,step:25.3,cx:878,cy:253},
  7:{x:748,y:623,step:26.3,cx:878,cy:560},
  8:{x:748,y:926,step:25.3,cx:878,cy:867},
  9:{x:748,y:1181,step:25.3,cx:878,cy:1100}
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
  return <header className="classic-sheet-head">
    <div className="classic-sheet-emblem"><b>D&amp;D</b><small>ЛИСТ ПЕРСОНАЖА</small></div>
    <strong>{title}</strong><span>{page} / 3</span>
  </header>;
}

function SpellGroup({level,entries,slots}:{level:number;entries:PdfSpell[];slots:number}) {
  const g=spellGeometry[level];
  return <div className="classic-source-spell-group" data-spell-level={level}>
    {level>0&&slots>0&&<span className="classic-source-spell-slot" style={referencePosition(g.cx||0,g.cy||0)}>{slots} яч.</span>}
    {entries.map((spell,index)=><div key={spell.id} className="classic-source-spell-row"
      style={referencePosition(g.x,g.y+g.step*index-15)}
      title={spell.alwaysPrepared?"Всегда подготовлено":spell.prepared?"Подготовлено":"Не подготовлено"}>
      {spell.alwaysPrepared?"† ":spell.prepared?"● ":""}{spell.name}
    </div>)}
  </div>;
}

export function ClassicCharacterSheet(props: PdfCharacterSheetProps) {
  const skills = originalSkillOrder.map(name=>({name,...skillKeys[name]}));
  const spells = Array.from(new Map(props.spells.map(spell => [spell.id, spell])).values());
  const levelSpells = Array.from({ length: 10 }, (_, level) => spells.filter(spell => spell.level === level).sort((a, b) => a.name.localeCompare(b.name, "ru")));
  const displayed = levelSpells.map((entries, level) => entries.slice(0, spellCapacities[level]));
  const extraSpells = levelSpells.flatMap((entries, level) => entries.slice(spellCapacities[level]).map(spell => ({ ...spell, sourceLevel: level })));
  const extraPages = Array.from({ length: Math.ceil(extraSpells.length / 42) }, (_, index) => extraSpells.slice(index * 42, (index + 1) * 42));
  const features = [...props.classFeatures, ...props.raceFeatures, ...props.featFeatures, props.backgroundFeature].filter(Boolean);
  const coins = [["ПМ", props.currency.pp], ["ЗМ", props.currency.gp], ["СМ", props.currency.sp], ["ММ", props.currency.cp]] as const;
  const equipment = props.equipment.join("; ");
  const spellsByColumn = [[0, 1, 2], [3, 4, 5], [6, 7, 8, 9]];

  return <div className="classic-sheet-document classic-sheet--template" aria-label="Классический лист персонажа D&D 5e">
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
          <Field label="Опыт" value={props.identity.experience} />
        </div>
      </div>
      <div className="classic-sheet-main-grid">
        <div className="classic-sheet-column classic-sheet-left">
          <div className="classic-sheet-abilities">
            {abilityOrder.map(ability => <div className="classic-sheet-ability" key={ability}>
              <b>{abilityLabels[ability]}</b><strong>{signed(modifier(props.abilities[ability]))}</strong><span>{props.abilities[ability]}</span>
            </div>)}
          </div>
          <div className="classic-source-inspiration">{props.identity.inspiration && <strong style={referencePosition(176,229)}>●</strong>}</div>
          <div className="classic-source-proficiency"><strong style={referencePosition(164,289)}>{signed(props.proficiency)}</strong></div>
          <div className="classic-source-saves">
            {abilityOrder.map((key,i)=>{
              const trained=props.savingThrows.includes(key);
              const value=modifier(props.abilities[key])+(trained?props.proficiency:0)+(props.savingThrowBonuses?.[key]||0);
              const y=354+i*24.2;
              return <div key={key} className="classic-source-check">
                {trained&&<span className="classic-source-checkmark" style={referencePosition(169,y)}>●</span>}
                <span className="classic-source-checkvalue" style={referencePosition(186,y)}>{signed(value)}</span>
              </div>;
            })}
          </div>
          <div className="classic-source-skills">
            {skills.map((skill,i)=>{
              const trained=props.proficiencies.skills.includes(skill.name);
              const expert=props.proficiencies.expertise.includes(skill.name);
              const bonus=modifier(props.abilities[skill.stat as keyof AbilityScores])+(expert?2*props.proficiency:trained?props.proficiency:0);
              const y=556+i*24.35;
              return <div key={skill.key} className="classic-source-check">
                {(trained||expert)&&<span className="classic-source-checkmark" style={referencePosition(169,y)}>{expert?"◆":"●"}</span>}
                <span className="classic-source-checkvalue" style={referencePosition(186,y)}>{signed(bonus)}</span>
              </div>;
            })}
          </div>
          <Panel title="Пассивная мудрость (Внимательность)"><strong className="classic-sheet-inline-value">{props.passivePerception}</strong></Panel>
          <Panel title="Прочие умения и языки">
            <p><b>Языки:</b> {props.proficiencies.languages.join(", ") || "—"}</p>
            <p><b>Инструменты:</b> {props.proficiencies.tools.join(", ") || "—"}</p>
            <p><b>Доспехи:</b> {props.proficiencies.armor.join(", ") || "—"}</p>
            <p><b>Оружие:</b> {props.proficiencies.weapons.join(", ") || "—"}</p>
          </Panel>
        </div>
        <div className="classic-sheet-column classic-sheet-center">
          <div className="classic-sheet-combat">
            <Panel title="Класс брони"><strong>{props.ac}</strong></Panel>
            <Panel title="Инициатива"><strong>{signed(props.initiative)}</strong></Panel>
            <Panel title="Скорость"><strong>{props.speed}</strong></Panel>
          </div>
          <Panel title="Максимум хитов"><strong className="classic-sheet-hp">{props.hitPoints}</strong></Panel>
          <Panel title="Текущие хиты"><strong className="classic-sheet-hp">{props.currentHitPoints ?? props.hitPoints}</strong></Panel>
          <Panel title="Временные хиты"><strong className="classic-sheet-hp">{props.temporaryHitPoints ?? 0}</strong></Panel>
          <div className="classic-sheet-two">
            <Panel title="Кости здоровья"><p>{props.hitDiceLabel || (props.identity.level + "к" + props.hitDie)}</p><p>Осталось: {props.hitDiceRemaining ?? props.identity.level}</p></Panel>
            <Panel title="Испытания против смерти"><p>Успехи: ○ ○ ○</p><p>Провалы: ○ ○ ○</p></Panel>
          </div>
          <Panel title="Атаки и заклинания">
            <table className="classic-sheet-attacks"><thead><tr><th>Название</th><th>Бонус</th><th>Урон / тип</th></tr></thead>
              <tbody>{props.attacks.slice(0, 9).map((attack, index) => <tr key={attack.id || index}><td>{attack.name}</td><td>{String(attack.attackBonus ?? "")}</td><td>{String(attack.damageDisplay ?? "")}</td></tr>)}</tbody>
            </table>
          </Panel>
          <Panel title="Снаряжение">
            <div className="classic-sheet-coins">{coins.map(([name, amount]) => <div key={name}><b>{amount}</b><small>{name}</small></div>)}</div>
            <p>{equipment || " "}</p>
          </Panel>
        </div>
        <div className="classic-sheet-column classic-sheet-right">
          <Panel title="Свойства личности"><p>{props.personality.traits || " "}</p></Panel>
          <Panel title="Идеалы"><p>{props.personality.ideals || " "}</p></Panel>
          <Panel title="Узы"><p>{props.personality.bonds || " "}</p></Panel>
          <Panel title="Изъяны"><p>{props.personality.flaws || " "}</p></Panel>
          <Panel title="Особенности и свойства">
            {features.slice(0, 15).map((feature, index) => <p key={index}><b>{feature.name}</b>{feature.description ? ": " + feature.description : ""}</p>)}
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
          {features.slice(15).map((feature, index) => <p key={index}><b>{feature.name}.</b> {feature.description}</p>)}
        </Panel>
        <Panel title="Сокровища" className="classic-sheet-treasure">{coins.map(([name, amount]) => <p key={name}>{name}: {amount}</p>)}</Panel>
      </div>
    </section>
    <section className="classic-sheet-page" style={{backgroundImage:`url("${assetUrl("classic-sheet/page-3.jpg")}")`}}>
      <ClassicHeader title={props.identity.className || "Класс заклинателя"} page={3} />
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
  </div>;
}
