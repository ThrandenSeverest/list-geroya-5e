import type { CatalogOption } from "./catalog";

export type BackgroundChoiceGroup = { key: string; title: string; description: string; count: number; options: Array<{ id: string; name: string; detail?: string }>; grantsFeat?: boolean };
const option = (id: string, name: string, detail?: string) => ({ id, name, detail });
const tools = [option("Набор для грима", "Набор для грима"), option("Музыкальный инструмент", "Музыкальный инструмент"), option("Игровой набор", "Игровой набор"), option("Набор ремесленных инструментов", "Набор ремесленных инструментов"), option("Инструменты картографа", "Инструменты картографа"), option("Инструменты навигатора", "Инструменты навигатора")];
const colleges: Record<string, string> = { "witherbloom-student": "Визерблум", "quandrix-student": "Квандрикс", "lorehold-student": "Лорхолд", "prismari-student": "Призмари", "silverquill-student": "Сильверквилл" };
const bonusFeats: Record<string, string[]> = { "giant-foundling": ["strike-of-the-giants"], "rune-carver": ["rune-shaper"], rewarded: ["lucky", "magic-initiate", "skilled"], ruined: ["alert", "skilled", "tough"], "mage-of-high-sorcery": ["initiate-of-high-sorcery"], "knight-of-solamnia": ["squire-of-solamnia"] };
const toolVariants = new Set(["prismari-student", "archaeologist", "witchlight-hand", "far-traveler", "inheritor", "selesnya-initiate", "knight-of-the-order", "uthgardt-tribe-member"]);

export function backgroundChoiceGroups(id: string, feats: CatalogOption[]): BackgroundChoiceGroup[] {
  const groups: BackgroundChoiceGroup[] = [];
  if (colleges[id]) groups.push({ key: "college", title: "Факультет Стриксхейвена", count: 1, description: `Предыстория фиксирует факультет ${colleges[id]}; его расширенный список заклинаний не делает все заклинания известными.`, options: [option(colleges[id], colleges[id])] });
  if (bonusFeats[id]) groups.push({ key: "bonusFeat", title: "Бонусная черта", count: 1, grantsFeat: true, description: "Черта добавляется в лист отдельным бонусным выбором и открывает её обычные настройки.", options: bonusFeats[id].map(featId => { const feat = feats.find(item => item.id === featId); return option(featId, feat?.name || featId, feat?.description); }) });
  if (toolVariants.has(id)) groups.push({ key: "tool", title: "Вариант владения", count: 1, description: "Выберите конкретный инструмент или набор предыстории.", options: tools });
  return groups;
}
