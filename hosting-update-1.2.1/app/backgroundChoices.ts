import type { CatalogOption } from "./catalog";
import { backgroundRule } from "./backgroundRules";
import { artisanTools, gamingSets, musicalInstruments } from "./proficiencies";

export type BackgroundChoiceGroup = {
  key: string;
  kind: "college" | "feat" | "skill" | "tool";
  title: string;
  description: string;
  count: number;
  options: Array<{ id: string; name: string; detail?: string }>;
  grantsFeatId?: string;
};

const skillNames = ["Акробатика", "Атлетика", "Внимательность", "Выживание", "Запугивание", "История", "Ловкость рук", "Магия", "Медицина", "Обман", "Природа", "Проницательность", "Расследование", "Религия", "Скрытность", "Убеждение", "Уход за животными", "Выступление"];
const intelligenceSkills = ["Магия", "История", "Расследование", "Природа", "Религия"];
const option = (id: string, name = id, detail?: string) => ({ id, name, detail });
const allToolOptions = [...artisanTools, ...musicalInstruments, ...gamingSets, "Набор для грима", "Набор для фальсификации", "Набор травника", "Воровские инструменты", "Инструменты картографа", "Инструменты навигатора"].map(value => option(value));
const colleges: Record<string, string> = { "witherbloom-student": "Визерблум", "quandrix-student": "Квандрикс", "lorehold-student": "Лорхолд", "prismari-student": "Призмари", "silverquill-student": "Сильверквилл" };
const bonusFeats: Record<string, string[]> = { "giant-foundling": ["strike-of-the-giants"], "rune-carver": ["rune-shaper"], rewarded: ["lucky", "magic-initiate", "skilled"], ruined: ["alert", "skilled", "tough"], "mage-of-high-sorcery": ["initiate-of-high-sorcery"], "knight-of-solamnia": ["squire-of-solamnia"] };

export function backgroundFixedSkills(id: string) {
  return backgroundRule(id).skills.filter(skill => skillNames.includes(skill));
}

function skillGroup(id: string): BackgroundChoiceGroup | null {
  const rule = backgroundRule(id);
  const instruction = rule.skillChoice || rule.skills.find(skill => !skillNames.includes(skill));
  if (!instruction) return null;
  const explicit = skillNames.filter(skill => instruction.includes(skill));
  const count = /выберите\s*2|два\s+из/i.test(instruction) ? 2 : 1;
  const options = explicit.length ? explicit : /инт/i.test(instruction) ? intelligenceSkills : skillNames;
  return { key: "skills", kind: "skill", title: "Выбор владения навыками", count, description: instruction, options: options.map(value => option(value)) };
}

function toolGroup(id: string): BackgroundChoiceGroup | null {
  const rule = backgroundRule(id);
  const instruction = [rule.toolChoice, ...rule.tools].filter(Boolean).join(" · ");
  if (!instruction || !/(или|\b1\s+(?:ремеслен|музыкальн|игров)|\b2\s+владени|по таблице)/i.test(instruction)) return null;
  const values = new Set<string>();
  if (/ремеслен/i.test(instruction)) artisanTools.forEach(value => values.add(value));
  if (/музыкальн/i.test(instruction)) musicalInstruments.forEach(value => values.add(value));
  if (/игров/i.test(instruction)) gamingSets.forEach(value => values.add(value));
  if (/набор для грима/i.test(instruction)) values.add("Набор для грима");
  if (/картограф/i.test(instruction)) values.add("Инструменты картографа");
  if (/навигатор/i.test(instruction)) values.add("Инструменты навигатора");
  if (/по таблице/i.test(instruction)) allToolOptions.forEach(value => values.add(value.id));
  if (!values.size) return null;
  return { key: "tool", kind: "tool", title: "Вариант владения инструментом", count: /\b2\s+владени/i.test(instruction) ? 2 : 1, description: instruction, options: [...values].map(value => option(value)) };
}

export function backgroundChoiceGroups(id: string, feats: CatalogOption[]): BackgroundChoiceGroup[] {
  const groups: BackgroundChoiceGroup[] = [];
  if (colleges[id]) groups.push({ key: "college", kind: "college", title: "Факультет Стриксхейвена", count: 1, grantsFeatId: "strixhaven-initiate", description: `Подтвердите факультет ${colleges[id]}. Предыстория добавит черту «Поступивший в Стриксхейвен»; её заклинания настраиваются на шаге уровня.`, options: [option(colleges[id])] });
  const skills = skillGroup(id);
  if (skills) groups.push(skills);
  const tools = toolGroup(id);
  if (tools) groups.push(tools);
  if (bonusFeats[id]) groups.push({ key: "bonusFeat", kind: "feat", title: "Бонусная черта", count: 1, description: "Черта добавляется в лист отдельным бонусным выбором и открывает её обычные настройки.", options: bonusFeats[id].map(featId => { const feat = feats.find(item => item.id === featId); return option(featId, feat?.name || featId, feat?.description); }) });
  return groups;
}
