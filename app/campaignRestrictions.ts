import type { ExportCharacter } from './exportFormats';

const featureAliases: Record<string, string> = {
  'выбранное оружие': 'выделенное оружие', 'атака, наделённая ци': 'атака, подпитанная ци',
  'фокусировка на цели': 'сосредоточенное прицеливание', 'универсальность воина': 'воинская универсальность',
  'многогранность воина': 'воинская универсальность', 'природная завеса': 'покров природы',
  'точное прицеливание': 'верный прицел', 'направление божественной силы': 'праведное восстановление',
};
export const optionalFeatureId = (classId: string, name: string) => {
  const clean = name.toLowerCase().replace(/ё/g, 'е').replace(/\s*\(tco?e\)/g, '').trim();
  const aliases = Object.fromEntries(Object.entries(featureAliases).map(([key, value]) => [key.replace(/ё/g, 'е'), value.replace(/ё/g, 'е')]));
  return `${classId}:${aliases[clean] || clean}`;
};
export const classOptionId = (classId: string, key: string, id: string) => `${classId}:${key}:${id}`;
export function optionalFeatureAllowed(character: Partial<ExportCharacter>, classId: string, name: string) {
  return !!character.useTasha && !character.tceFullBanned && !character.bannedOptionalFeatures?.includes(optionalFeatureId(classId, name));
}
const choiceFeatures: Record<string, string> = {
  'tce-primal-knowledge': 'Первобытное знание', 'tce-dedicated-weapon': 'Выделенное оружие (TCE)',
  'tce-favored-foe': 'Предпочтительный противник', 'tce-deft-explorer': 'Искусный исследователь',
  'tce-deft-explorer-skill': 'Искусный исследователь', 'tce-primal-awareness': 'Изначальная осведомлённость',
  'tce-natures-veil': 'Покров природы', 'tce-blessed-strikes': 'Благословлённые удары',
};
export function optionalChoiceAllowed(character: ExportCharacter, key: string) {
  const name = choiceFeatures[key];
  return !name || optionalFeatureAllowed(character, character.className, name);
}
/** A derived view: restrictions never erase a saved character's choices. */
export function restrictedCharacter(character: ExportCharacter): ExportCharacter {
  const choicesFor = (classId: string, values: Record<string, string[]> = {}) => Object.fromEntries(Object.entries(values).filter(([key]) => {
    const localKey = key.startsWith(`${classId}:`) ? key.slice(classId.length + 1) : key;
    return optionalChoiceAllowed({ ...character, className: classId }, localKey);
  }).map(([key, ids]) => {
    const localKey = key.startsWith(`${classId}:`) ? key.slice(classId.length + 1) : key;
    return [key, ids.filter(id => !character.bannedClassOptions?.includes(classOptionId(classId, localKey, id)))];
  }));
  const classChoices = Object.fromEntries(Object.entries(character.classChoices || {}).flatMap(([key, ids]) => {
    const classId = key.includes(':') ? key.split(':')[0] : character.className;
    return Object.entries(choicesFor(classId, { [key]: ids }));
  }));
  return { ...character, classChoices, classes: character.classes?.map(entry => ({ ...entry, choiceValues: choicesFor(entry.classId, entry.choiceValues) })) };
}
