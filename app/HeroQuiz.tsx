'use client';
import { useEffect, useState } from 'react';
import {
  QUIZ_CORE_COUNT, QUIZ_MAX_QUESTIONS, isQuizComplete, nextQuizQuestionId, preferredElfVariant,
  quizCoreQuestionIds, quizQuestion, resolveQuiz, type QuizResult,
} from './quizEngine';
import { races, classes, backgrounds } from './catalog';
import { subclasses, variantsFor } from './characterRules';

const storageKey = 'herolist.quiz.v1.2.1';
type SavedQuiz = { questionIds: string[]; answers: number[]; index: number };

function validSaved(value: unknown): value is SavedQuiz {
  if (!value || typeof value !== 'object') return false;
  const saved = value as SavedQuiz;
  try {
    return Array.isArray(saved.questionIds) && Array.isArray(saved.answers) && Number.isInteger(saved.index)
      && saved.questionIds.length >= QUIZ_CORE_COUNT && saved.questionIds.length <= QUIZ_MAX_QUESTIONS
      && quizCoreQuestionIds.every((id, index) => saved.questionIds[index] === id)
      && saved.answers.length <= saved.questionIds.length && saved.index >= 0 && saved.index <= saved.answers.length
      && saved.answers.every((answer, index) => Number.isInteger(answer) && !!quizQuestion(saved.questionIds[index]).answers[answer]);
  } catch { return false; }
}

export function HeroQuiz({ onClose, onCreate }: { onClose: () => void; onCreate: (result: QuizResult, level: number) => void }) {
  const [questionIds, setQuestionIds] = useState<string[]>([...quizCoreQuestionIds]);
  const [answers, setAnswers] = useState<number[]>([]);
  const [index, setIndex] = useState(0);
  const [level, setLevel] = useState(1);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
      if (validSaved(saved)) { setQuestionIds(saved.questionIds); setAnswers(saved.answers); setIndex(saved.index); }
    } catch {}
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (loaded) try { localStorage.setItem(storageKey, JSON.stringify({ questionIds, answers, index })); } catch {}
  }, [questionIds, answers, index, loaded]);

  const finished = answers.length === questionIds.length && isQuizComplete(questionIds, answers);
  const result = finished ? resolveQuiz(questionIds, answers) : null;
  const current = !result ? quizQuestion(questionIds[index]) : null;
  const answerCurrent = (answer: number) => {
    const nextAnswers = [...answers.slice(0, index), answer];
    let nextQuestionIds = index < QUIZ_CORE_COUNT ? [...quizCoreQuestionIds] : questionIds.slice(0, index + 1);
    if (nextAnswers.length === nextQuestionIds.length && !isQuizComplete(nextQuestionIds, nextAnswers)) {
      const nextId = nextQuizQuestionId(nextQuestionIds, nextAnswers);
      if (nextId) nextQuestionIds = [...nextQuestionIds, nextId];
    }
    setAnswers(nextAnswers); setQuestionIds(nextQuestionIds); setIndex(index + 1); setError('');
  };
  const reset = () => { setQuestionIds([...quizCoreQuestionIds]); setAnswers([]); setIndex(0); setError(''); };
  const raceName = result ? races.find(option => option.id === result.raceId)?.name : '';
  const raceVariant = result?.raceId === 'elf' ? variantsFor('elf').find(option => option.id === (result.raceVariantId || preferredElfVariant(result.classId)))?.name : '';

  return <section className="hero-quiz">
    <header><button onClick={onClose}>← Главное меню</button><span>Какой из тебя герой?</span><strong>{result ? answers.length : Math.min(index + 1, QUIZ_MAX_QUESTIONS)} / {result ? answers.length : `до ${QUIZ_MAX_QUESTIONS}`}</strong></header>
    <progress max={QUIZ_MAX_QUESTIONS} value={result ? answers.length : index} />
    {result ? <>
      <h1>Твой герой</h1>
      <div className="quiz-result">
        {[["Раса", raceVariant ? `${raceName} — ${raceVariant}` : raceName], ["Класс", classes.find(option => option.id === result.classId)?.name], ["Предыстория", backgrounds.find(option => option.id === result.backgroundId)?.name], ["Подкласс", subclasses[result.classId].options.find(option => option.id === result.subclassId)?.name]].map(([label, value]) => <div key={label}><small>{label}</small><strong>{value}</strong></div>)}
      </div>
      <p>Ответы на 17 обязательных и {answers.length - QUIZ_CORE_COUNT} уточняющих вопросов определили происхождение и путь героя.</p>
      <label className="quiz-level">Уровень персонажа<select value={level} onChange={event => setLevel(Number(event.target.value))}>{Array.from({ length: 20 }, (_, option) => <option key={option} value={option + 1}>{option + 1}</option>)}</select></label>
      {level < result.subclassUnlockLevel && <p role="status">Подкласс станет доступен на уровне {result.subclassUnlockLevel}. Рекомендация сохранится в персонаже.</p>}
      <p>Характеристики, навыки, заклинания и снаряжение будут заполнены автоматически. Готового героя можно редактировать.</p>
      {error && <p role="alert">{error}</p>}
      <button className="primary-action" onClick={() => { try { onCreate(result, level); localStorage.removeItem(storageKey); } catch (caught) { setError(caught instanceof Error ? caught.message : 'Не удалось создать персонажа.'); } }}>Создать готового персонажа</button>
      <button onClick={reset}>Пройти заново</button>
      <details><summary>Почему такой результат?</summary><p>Все прохождения включают 17 одинаковых основных вопросов. Затем тест задаёт от одного до шести уточнений, выбирая полезные для близких результатов. У вариантов PHB есть небольшой бонус, но все варианты из банка остаются достижимыми.</p><p>При споре двух лидеров расы учитывается подтверждённый минимум двумя ответами менее очевидный вариант; иначе выбор сверяется с основной характеристикой класса. Подраса эльфа также подбирается под класс.</p></details>
    </> : current ? <>
      <h1>{current.text}</h1>
      <div className="quiz-answers">{current.answers.map((answer, answerIndex) => <button key={answerIndex} onClick={() => answerCurrent(answerIndex)}><span>{answerIndex + 1}</span>{answer.text}</button>)}</div>
      {index > 0 && <button onClick={() => setIndex(index - 1)}>← Назад</button>}
    </> : <p role="alert">Не удалось подобрать следующий вопрос.</p>}
  </section>;
}
