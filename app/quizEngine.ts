import data from './quizData.json';
import { races, classes, backgrounds } from './catalog';
import { subclasses } from './characterRules';

export type Axis = 'race' | 'class' | 'background';
export type QuizAnswer = { text: string; race: Record<string, number>; class: Record<string, number>; background: Record<string, number>; traits: Record<string, number> };
export type QuizQuestion = { id: string; number: number; text: string; answers: QuizAnswer[] };
export type QuizResult = { raceId: string; raceVariantId?: string; classId: string; backgroundId: string; subclassId: string; subclassUnlockLevel: number; dominantTraits: string[] };
export type CandidateScore = { id: string; score: number; raw: number; signals: number };

export const quizQuestions = data.questions as unknown as QuizQuestion[];
export const quizCoreQuestionIds = [...data.coreQuestionIds];
export const QUIZ_MIN_QUESTIONS = data.minQuestions;
export const QUIZ_MAX_QUESTIONS = data.maxQuestions;
export const QUIZ_CORE_COUNT = quizCoreQuestionIds.length;
const questionById = new Map(quizQuestions.map(question => [question.id, question]));
const PHB_RACE_BONUS = 0.1;
const PHB_SUBCLASS_BONUS = 0.35;

const stable = (a: CandidateScore, b: CandidateScore) => b.score - a.score || b.raw - a.raw || a.id.localeCompare(b.id, 'en');
const isPhb = (source: string) => source.split(/[ ,/]+/).includes('PHB');
const variance = (values: number[]) => { const mean = values.reduce((sum, value) => sum + value, 0) / values.length; return values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length; };

export function quizQuestion(id: string) {
  const question = questionById.get(id);
  if (!question) throw new Error(`Неизвестный вопрос: ${id}`);
  return question;
}

function validateSession(questionIds: string[], answers: number[], complete = false) {
  if (questionIds.length < QUIZ_CORE_COUNT || questionIds.length > QUIZ_MAX_QUESTIONS) throw new Error('Неверный набор вопросов.');
  if (new Set(questionIds).size !== questionIds.length || quizCoreQuestionIds.some((id, index) => questionIds[index] !== id)) throw new Error('Обязательные вопросы изменены.');
  if (answers.length > questionIds.length || (complete && answers.length !== questionIds.length)) throw new Error('Ответьте на все вопросы.');
  answers.forEach((answer, index) => { if (!Number.isInteger(answer) || !quizQuestion(questionIds[index]).answers[answer]) throw new Error('Обнаружен недопустимый ответ.'); });
}

export function scoreAxis(axis: Axis, questionIds: string[], answers: number[]): CandidateScore[] {
  validateSession(questionIds, answers);
  const answered = questionIds.slice(0, answers.length).map(quizQuestion);
  const catalog = axis === 'race' ? races : axis === 'class' ? classes : backgrounds;
  const ids = [...new Set(quizQuestions.flatMap(question => question.answers.flatMap(answer => Object.keys(answer[axis]))))];
  return ids.map(id => {
    let mean = 0, totalVariance = 0, raw = 0, signals = 0;
    answered.forEach((question, index) => {
      const weights = question.answers.map(answer => answer[axis][id] || 0);
      mean += weights.reduce((sum, value) => sum + value, 0) / weights.length;
      totalVariance += variance(weights);
      const selected = weights[answers[index]]; raw += selected; if (selected > 0) signals += 1;
    });
    const entity = catalog.find(option => option.id === id);
    if (!entity) throw new Error(`Нет в каталоге: ${id}`);
    const normalized = (raw - mean) / Math.max(Math.sqrt(totalVariance), 1e-9);
    return { id, raw, signals, score: normalized + (axis === 'race' && isPhb(entity.source) ? PHB_RACE_BONUS : 0) };
  }).sort(stable);
}

const classAbilityOrder: Record<string, string[]> = {
  barbarian: ['str', 'con', 'dex'], bard: ['cha', 'dex', 'con'], cleric: ['wis', 'con', 'str'], druid: ['wis', 'con', 'dex'],
  fighter: ['str', 'dex', 'con'], monk: ['dex', 'wis', 'con'], paladin: ['str', 'cha', 'con'], ranger: ['dex', 'wis', 'con'],
  rogue: ['dex', 'int', 'cha'], sorcerer: ['cha', 'con', 'dex'], warlock: ['cha', 'con', 'dex'], wizard: ['int', 'dex', 'con'],
};
const raceAbilities: Record<string, string[]> = {
  human: ['str', 'dex', 'con', 'int', 'wis', 'cha'], dwarf: ['con', 'str', 'wis'], elf: ['dex', 'int', 'wis', 'cha'], halfling: ['dex', 'cha', 'con'],
  dragonborn: ['str', 'cha'], gnome: ['int', 'dex', 'con'], halfelf: ['cha', 'str', 'dex', 'con', 'int', 'wis'], halforc: ['str', 'con'],
  tiefling: ['cha', 'int'], aasimar: ['cha', 'wis', 'con', 'str'], changeling: ['cha'], firbolg: ['wis', 'str'], goblin: ['dex', 'con'],
  goliath: ['str', 'con'], satyr: ['cha', 'dex'], tabaxi: ['dex', 'cha'], warforged: ['con', 'str', 'dex', 'int', 'wis', 'cha'], yuanpure: ['cha', 'int'],
};
function raceClassFit(raceId: string, classId: string) {
  const order = classAbilityOrder[classId] || classAbilityOrder.fighter;
  const abilities = raceAbilities[raceId] || [];
  const first = abilities.indexOf(order[0]);
  if (first >= 0) return 3 - Math.min(first, 2);
  return abilities.includes(order[1]) ? 1 : 0;
}

export function chooseRaceCandidate(scores: CandidateScore[], classId: string) {
  const normalized = [...scores].sort(stable);
  const byRaw = [...scores].sort((a, b) => b.raw - a.raw || b.score - a.score || a.id.localeCompare(b.id, 'en'));
  const topRaw = byRaw[0]?.raw ?? 0;
  const rawLeaders = byRaw.filter(candidate => Math.abs(candidate.raw - topRaw) < 1e-9);
  if (rawLeaders.length >= 2 && topRaw > 0) {
    const underdog = byRaw.find(candidate => candidate.raw < topRaw && candidate.raw >= topRaw * 0.75 && candidate.signals >= 2);
    if (underdog) return underdog.id;
    return [...rawLeaders].sort((a, b) => raceClassFit(b.id, classId) - raceClassFit(a.id, classId) || stable(a, b))[0].id;
  }
  return normalized[0].id;
}

export function preferredElfVariant(classId: string) {
  if (classId === 'wizard') return 'high';
  if (['bard', 'paladin', 'sorcerer', 'warlock'].includes(classId)) return 'drow';
  return 'wood';
}

function traitTotals(questionIds: string[], answers: number[], start: number, end: number) {
  const totals: Record<string, number> = {};
  for (let index = start; index < Math.min(end, answers.length); index += 1) Object.entries(quizQuestion(questionIds[index]).answers[answers[index]].traits).forEach(([tag, value]) => { totals[tag] = (totals[tag] || 0) + value; });
  return totals;
}

function scoreSubclasses(classId: string, questionIds: string[], answers: number[]) {
  const profiles = (data.profiles as Record<string, { id: string; tags: string[] }[]>)[classId];
  const coreCount = Math.min(QUIZ_CORE_COUNT, answers.length);
  const optionalCount = Math.max(answers.length - QUIZ_CORE_COUNT, 0);
  const core = traitTotals(questionIds, answers, 0, coreCount);
  const optional = traitTotals(questionIds, answers, QUIZ_CORE_COUNT, answers.length);
  return profiles.map(profile => {
    const raw = profile.tags.reduce((sum, tag) => sum + 0.35 * (core[tag] || 0) / Math.max(coreCount, 1) + 0.65 * (optional[tag] || 0) / Math.max(optionalCount, 1), 0);
    let mean = 0, totalVariance = 0;
    questionIds.slice(0, answers.length).forEach((id, index) => {
      const phaseCount = index < QUIZ_CORE_COUNT ? Math.max(coreCount, 1) : Math.max(optionalCount, 1);
      const phaseWeight = index < QUIZ_CORE_COUNT ? 0.35 : 0.65;
      const values = quizQuestion(id).answers.map(answer => profile.tags.reduce((sum, tag) => sum + (answer.traits[tag] || 0), 0) * phaseWeight / phaseCount);
      mean += values.reduce((sum, value) => sum + value, 0) / values.length;
      totalVariance += variance(values);
    });
    const option = subclasses[classId].options.find(item => item.id === profile.id);
    if (!option) throw new Error(`Нет подкласса: ${classId}/${profile.id}`);
    return { id: profile.id, raw, signals: 0, score: (raw - mean) / Math.max(Math.sqrt(totalVariance), 1e-9) + (option.source === 'PHB' ? PHB_SUBCLASS_BONUS : 0) };
  }).sort(stable);
}

function resolveMain(questionIds: string[], answers: number[]) {
  const classScores = scoreAxis('class', questionIds, answers);
  const classId = classScores[0].id;
  const raceScores = scoreAxis('race', questionIds, answers);
  return { classId, classScores, raceScores, raceId: chooseRaceCandidate(raceScores, classId), backgroundScores: scoreAxis('background', questionIds, answers) };
}
const scoreMargin = (scores: CandidateScore[]) => scores.length > 1 ? scores[0].score - scores[1].score : Infinity;
function stableJitter(seed: string) { let hash = 2166136261; for (let index = 0; index < seed.length; index += 1) hash = Math.imul(hash ^ seed.charCodeAt(index), 16777619); return (hash >>> 0) / 4294967296; }

export function nextQuizQuestionId(questionIds: string[], answers: number[]) {
  validateSession(questionIds, answers);
  if (answers.length !== questionIds.length || questionIds.length >= QUIZ_MAX_QUESTIONS) return null;
  const main = resolveMain(questionIds, answers);
  const subclassScores = scoreSubclasses(main.classId, questionIds, answers);
  const contenders: Record<Axis, CandidateScore[]> = { race: main.raceScores.slice(0, 3), class: main.classScores.slice(0, 3), background: main.backgroundScores.slice(0, 3) };
  const signature = `${questionIds.join(',')}|${answers.join(',')}`;
  return quizQuestions.filter(question => !questionIds.includes(question.id)).map(question => {
    let discrimination = 0;
    (['race', 'class', 'background'] as Axis[]).forEach(axis => {
      const ids = contenders[axis].map(candidate => candidate.id);
      const weight = scoreMargin(contenders[axis]) < 0.25 ? 1.25 : 1;
      question.answers.forEach(answer => { discrimination += weight * variance(ids.map(id => answer[axis][id] || 0)); });
    });
    const profiles = (data.profiles as Record<string, { id: string; tags: string[] }[]>)[main.classId];
    const profileMap = new Map(profiles.map(profile => [profile.id, profile.tags]));
    question.answers.forEach(answer => { discrimination += 1.4 * variance(subclassScores.slice(0, 3).map(profile => (profileMap.get(profile.id) || []).reduce((sum, tag) => sum + (answer.traits[tag] || 0), 0))); });
    return { id: question.id, score: discrimination + stableJitter(`${signature}|${question.id}`) * Math.max(discrimination * 0.08, 1) };
  }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id, 'en'))[0]?.id || null;
}

export function isQuizComplete(questionIds: string[], answers: number[]) {
  validateSession(questionIds, answers);
  if (answers.length !== questionIds.length || answers.length < QUIZ_MIN_QUESTIONS) return false;
  if (answers.length >= QUIZ_MAX_QUESTIONS) return true;
  const main = resolveMain(questionIds, answers);
  const subclassScores = scoreSubclasses(main.classId, questionIds, answers);
  const mainMargin = Math.min(scoreMargin(main.raceScores), scoreMargin(main.classScores), scoreMargin(main.backgroundScores));
  return mainMargin >= 0.18 && scoreMargin(subclassScores) >= 0.14;
}

export function resolveQuiz(questionIds: string[], answers: number[]): QuizResult {
  validateSession(questionIds, answers, true);
  if (!isQuizComplete(questionIds, answers)) throw new Error('Нужен ещё один уточняющий вопрос.');
  const main = resolveMain(questionIds, answers);
  const subclass = scoreSubclasses(main.classId, questionIds, answers)[0];
  const allTraits = traitTotals(questionIds, answers, 0, answers.length);
  return {
    raceId: main.raceId, raceVariantId: main.raceId === 'elf' ? preferredElfVariant(main.classId) : undefined,
    classId: main.classId, backgroundId: main.backgroundScores[0].id, subclassId: subclass.id,
    subclassUnlockLevel: subclasses[main.classId].level,
    dominantTraits: Object.entries(allTraits).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3).map(([tag]) => tag),
  };
}
