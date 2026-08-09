import type { CatalogSpell } from "./catalog";
import type { CharacterAttack } from "./combat";
import type { AbilityScores } from "./exportFormats";
import { abilityLabels, skillKeys, type Feature } from "./rules";

type PdfResource = { name: string; current: number; max: number; die?: string };
type PdfSpell = CatalogSpell & { prepared: boolean; alwaysPrepared: boolean };

export type PdfCharacterSheetProps = {
  identity: {
    name: string;
    playerName: string;
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
  passivePerception: number;
  attacks: CharacterAttack[];
  resources: PdfResource[];
  classFeatures: Feature[];
  raceFeatures: Feature[];
  featFeatures: Feature[];
  backgroundFeature: Feature;
  equipment: string[];
  personality: { traits: string; ideals: string; bonds: string; flaws: string };
  spellAbility?: string;
  spellSaveDc?: number;
  spellAttackBonus?: number;
  spellSlots: number[];
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

function paginateFeatures(features: Feature[], pageBudget = 1280) {
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

function isCombatTechnique(feature: Feature) {
  return /удар|при[её]м|ман[её]вр|стрел|клин|фокусиров|боев.*искусств|ки|ци\b|атака/i.test(`${feature.name} ${feature.description}`)
    && !/дополнительн.*атак|мультиатак/i.test(feature.name);
}

function CompactFeatureList({ features, empty = "нет" }: { features: Feature[]; empty?: string }) {
  if (!features.length) return <p>{empty}</p>;
  return <div className="pdf-compact-features">{features.map((feature, index) =>
    <p key={`${feature.name}-${index}`}><b>{feature.name}.</b> {compactRulesText(feature.description)}</p>,
  )}</div>;
}

function PageHeader({ eyebrow, title, page }: { eyebrow: string; title: string; pо</b>}</header>
        {groupedSpells.flatMap((levelSpells, level) => levelSpells.map(spell => <div key={spell.id}>
          <span>{level === 0 ? "З" : level}</span><strong>{spell.name}{spell.alwaysPrepared ? " *" : ""}</strong><span>{spell.school}</span><span>{spell.ritual ? "◇" : "—"}</span>{wizardPrepared && <span>{level === 0 ? "—" : spell.prepared || spell.alwaysPrepared ? "●" : "○"}</span>}
        </div>))}
      </div>
      <p className="pdf-spell-legend">* Всегда подготовлено и не занимает лимит. ◇ Ритуал.{wizardPrepared ? " ● Подготовлено сейчас; ○ находится в книге." : ""}</p>
      <footer>Лист Героя 5e · Заклинания <span>{spellPageNumber} / {totalPages}</span></footer>
    </section>}
  </div>;
}
