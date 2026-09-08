import data from './quizData.json';
import { races, classes, backgrounds } from './catalog';
import { subclasses } from './characterRules';
type Question = {text:string;answers:{text:string;race:Record<string,number>;class:Record<string,number>;background:Record<string,number>;traits:Record<string,number>}[]};
export const quizQuestions = data.questions as unknown as Question[];
type Axis = 'race' | 'class' | 'background';
export type QuizResult = { raceId: string; classId: string; backgroundId: string; subclassId: string; subclassUnlockLevel: number; dominantTraits: string[] };
const stable = (a: {id:string;score:number}, b: {id:string;score:number}) => b.score-a.score || a.id.localeCompare(b.id,'en');
export function resolveQuiz(answers: number[]): QuizResult {
  if (answers.length !== 20 || answers.some((a,i)=>!Number.isInteger(a)||!quizQuestions[i].answers[a])) throw new Error('Ответьте на все вопросы.');
  const resolve = (axis: Axis) => {
    const catalog = axis==='race'?races:axis==='class'?classes:backgrounds;
    const ids = [...new Set(quizQuestions.slice(0,17).flatMap(q=>q.answers.flatMap(a=>Object.keys(a[axis]))))];
    return ids.map(id=>{
      let mean=0,variance=0,raw=0,signals=0;
      quizQuestions.slice(0,17).forEach((q,i)=>{
        const weights=q.answers.map(a=>(a[axis] as Record<string,number>)[id]||0);
        const avg=weights.reduce((s,v)=>s+v,0)/weights.length;
        mean+=avg;variance+=weights.reduce((s,v)=>s+(v-avg)**2,0)/weights.length;
        const w=weights[answers[i]];raw+=w;if(w>0)signals++;
      });
      const entity=catalog.find(x=>x.id===id); if(!entity)throw new Error(`Нет в каталоге: ${id}`);
      const z=(raw-mean)/Math.max(Math.sqrt(variance),1);
      const phb=entity.source.split(/[ ,/]+/).includes('PHB');
      return {id,score:axis==='race' ? phb?z+.75:signals>=3&&z>=1.25?z:-Infinity:z};
    }).sort(stable)[0].id;
  };
  const raceId=resolve('race'),classId=resolve('class'),backgroundId=resolve('background');
  const inherited:Record<string,number>={},adaptive:Record<string,number>={};
  answers.forEach((a,i)=>Object.entries(quizQuestions[i].answers[a].traits).forEach(([k,v])=>{const target=i<17?inherited:adaptive;target[k]=(target[k]||0)+v;}));
  const profiles=(data.profiles as Record<string,{id:string;tags:string[]}[]>)[classId];
  const raw=profiles.map(p=>({id:p.id,score:p.tags.reduce((s,t)=>s+.35*(inherited[t]||0)+.65*(adaptive[t]||0),0)}));
  // Calibrate every profile against the uniform-answer baseline, preserving
  // variance differences between sparse and frequently signalled profiles.
  const ranked=raw.map(p=>{
    const profile=profiles.find(x=>x.id===p.id)!;let mean=0,variance=0;
    quizQuestions.forEach((q,i)=>{
      const values=q.answers.map(a=>profile.tags.reduce((s,t)=>s+((a.traits as Record<string,number>)[t]||0),0)*(i<17?.35:.65));
      const avg=values.reduce((s,v)=>s+v,0)/values.length;mean+=avg;variance+=values.reduce((s,v)=>s+(v-avg)**2,0)/values.length;
    });
    const option=subclasses[classId].options.find(x=>x.id===p.id);if(!option)throw new Error(`Нет подкласса: ${classId}/${p.id}`);
    return {...p,score:(p.score-mean)/Math.max(Math.sqrt(variance),1)+(option.source==='PHB'?.95:0)};
  }).sort(stable);
  return {raceId,classId,backgroundId,subclassId:ranked[0].id,subclassUnlockLevel:subclasses[classId].level,dominantTraits:Object.entries(inherited).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,3).map(x=>x[0])};
}
