import { backgrounds, classes, races, spells, type CatalogOption } from './catalog';
import { feats, subclasses } from './characterRules';
import { sheetOptionalFeatures } from './generatedSheetRules';
import { optionalClassFeatureCorpus } from './generatedRulesCorpus';
import { optionalFeatureId } from './campaignRestrictions';
import { sourceTokens } from './catalogFilters';

export type Category = 'races' | 'classes' | 'subclasses' | 'backgrounds' | 'feats' | 'spells' | 'optionalFeatures' | 'classOptions';
export type BanMode = 'deny' | 'allow';
export type BanList = { version: 3; id: string; name: string; mode: BanMode; categories: Record<Category, string[]>; tceOptionalFeaturesBanned?: boolean; tceFullBanned?: boolean };
export const categoryNames: Record<Category, string> = { races: 'Расы', classes: 'Классы', subclasses: 'Подклассы', backgrounds: 'Предыстории', feats: 'Черты', spells: 'Заклинания', optionalFeatures: 'Способности Таши', classOptions: 'Классовые опции' };
export type BanOption = CatalogOption & { classId?: string; level?: number; group?: string };
export const optionalFeatureCatalog: BanOption[] = Object.entries(sheetOptionalFeatures).flatMap(([classId, features]) => [...new Map([...(optionalClassFeatureCorpus[classId] || []), ...features].map(feature => [optionalFeatureId(classId, feature.name), feature])).values()].map(feature => ({ ...feature, id: optionalFeatureId(classId, feature.name), source: 'TCE', tags: [], classId })));
for (const classId of ['bard','cleric','druid','paladin','ranger','sorcerer','warlock','wizard']) {
  if (!optionalFeatureCatalog.some(option => option.classId === classId && option.id.includes(':дополнительные заклинания'))) optionalFeatureCatalog.push({ id: optionalFeatureId(classId, 'Дополнительные заклинания'), classId, name: 'Дополнительные заклинания', source: 'TCE', tags: [], level: 1, description: 'Расширенный список заклинаний класса из TCE. Доступен независимо от галочки опциональных способностей.' });
}
export const catalogs: Record<Category, BanOption[]> = {
  races, classes, subclasses: Object.entries(subclasses).flatMap(([classId, rule]) => rule.options.map(option => ({ ...option, classId, id: `${classId}:${option.id}` }))),
  backgrounds, feats: feats.filter(feat => feat.id !== 'asi'), spells, optionalFeatures: optionalFeatureCatalog, classOptions: [],
};
export const newBanId = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `ban-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export function normalizeBanList(value: unknown): BanList {
  const input = value && typeof value === 'object' ? value as Partial<BanList> : {};
  const mode = input.mode === 'allow' ? 'allow' : 'deny';
  let result: BanList = { version: 3, id: typeof input.id === 'string' && input.id ? input.id : newBanId(), name: typeof input.name === 'string' ? input.name : 'Правила кампании', mode,
    categories: Object.fromEntries((Object.keys(categoryNames) as Category[]).map(category => [category, Array.isArray(input.categories?.[category]) ? [...new Set(input.categories[category].filter((id): id is string => typeof id === 'string'))] : mode === 'allow' ? catalogs[category].map(option => option.id) : []])) as Record<Category, string[]>,
    tceOptionalFeaturesBanned: false, tceFullBanned: false };
  if (input.tceFullBanned) result = setSourceBan(result, 'TCE', true);
  else if (input.tceOptionalFeaturesBanned) result = setBanState(result, 'optionalFeatures', catalogs.optionalFeatures.filter(option => !option.id.includes(':дополнительные заклинания')).map(option => option.id), true);
  return result;
}
export function allowed(list: BanList | null, category: Category, id: string) {
  if (!list || !id) return true;
  if (category === 'optionalFeatures' && (list.tceOptionalFeaturesBanned || list.tceFullBanned)) return false;
  const option = catalogs[category].find(option => option.id === id);
  if (list.tceFullBanned && option && sourceTokens(option.source).includes('TCE')) return false;
  const listed = list.categories[category]?.includes(id);
  return list.mode === 'deny' ? !listed : !!listed;
}
export function setBanState(list: BanList, category: Category, ids: string[], banned: boolean): BanList {
  const values = new Set(list.categories[category]);
  for (const id of ids) { if (list.mode === 'deny' ? banned : !banned) values.add(id); else values.delete(id); }
  return { ...list, categories: { ...list.categories, [category]: [...values] } };
}
export function setSourceBan(list: BanList, source: string, banned: boolean) {
  let next = { ...list, ...(source === 'TCE' ? { tceFullBanned: false, tceOptionalFeaturesBanned: false } : {}) };
  for (const category of Object.keys(categoryNames) as Category[]) next = setBanState(next, category, catalogs[category].filter(option => sourceTokens(option.source).includes(source)).map(option => option.id), banned);
  return next;
}
