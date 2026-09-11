import {createJiti} from 'jiti';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const j=createJiti(import.meta.url);
const {buildRecommendedCharacter,swapStandardAbility,standardAbilityBuild}=await j.import('../app/recommendedBuild.ts');
const {chooseRaceCandidate,isQuizComplete,nextQuizQuestionId,preferredElfVariant,quizCoreQuestionIds,quizQuestion,resolveQuiz,scoreAxis}=await j.import('../app/quizEngine.ts');
const {subclasses}=await j.import('../app/characterRules.ts');
const source=fs.readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8');
const initial=Function('return '+source.match(/const initial: ExportCharacter = (\{[\s\S]*?\n\});/)[1])();
const data=JSON.parse(fs.readFileSync(new URL('../app/quizData.json',import.meta.url)));
let checked=0,failed=[];

assert.equal(data.questions.length,49);
assert.equal(data.coreQuestionIds.length,17);
assert.deepEqual(data.excludedQuestionIds,['Q09','Q11','Q26','Q27','Q32','Q42','Q43','Q49','Q50','Q59']);
assert.ok(data.excludedQuestionIds.every(id=>!data.questions.some(question=>question.id===id)));
assert.equal(new Set(data.coreQuestionIds).size,17);

for(const classId of Object.keys(data.profiles))for(const level of [1,2,3,4,5,8,12,16,20]){
 const result={classId,raceId:'human',backgroundId:'soldier',subclassId:data.profiles[classId][0].id,subclassUnlockLevel:subclasses[classId].level,dominantTraits:[]};
 try{const c=buildRecommendedCharacter(result,level,initial);assert.equal(c.level,level);assert.equal(c.subclass,level<result.subclassUnlockLevel?'':result.subclassId);assert.ok(c.currentHitPoints>0);checked++;}catch(e){failed.push([classId,level,e.message]);}
}
for(const [classId,profiles] of Object.entries(data.profiles))for(const p of profiles){
 try{buildRecommendedCharacter({classId,raceId:'human',backgroundId:'soldier',subclassId:p.id,subclassUnlockLevel:subclasses[classId].level,dominantTraits:[]},20,initial);checked++;}catch(e){failed.push([classId,p.id,20,e.message]);}
}

const a=standardAbilityBuild('wizard');
assert.deepEqual(Object.values(swapStandardAbility(a,'str',15)).sort((x,y)=>x-y),[8,10,12,13,14,15]);
assert.equal(chooseRaceCandidate([{id:'elf',raw:40,score:2,signals:3},{id:'dwarf',raw:40,score:2,signals:3},{id:'tiefling',raw:30,score:1.5,signals:2}],'wizard'),'tiefling');
assert.equal(chooseRaceCandidate([{id:'dwarf',raw:40,score:2,signals:3},{id:'elf',raw:40,score:2,signals:3},{id:'tiefling',raw:30,score:1.5,signals:1}],'wizard'),'elf');
assert.equal(preferredElfVariant('wizard'),'high');
assert.equal(preferredElfVariant('cleric'),'wood');
assert.equal(preferredElfVariant('warlock'),'drow');

let seed=912342;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const randomAnswer=id=>Math.floor(random()*quizQuestion(id).answers.length);
function completeQuiz(){
 const questionIds=[...quizCoreQuestionIds],answers=[];
 while(true){
  while(answers.length<questionIds.length)answers.push(randomAnswer(questionIds[answers.length]));
  if(isQuizComplete(questionIds,answers))return {questionIds,answers,result:resolveQuiz(questionIds,answers)};
  const next=nextQuizQuestionId(questionIds,answers);assert.ok(next);assert.ok(!questionIds.includes(next));questionIds.push(next);
 }
}
const lengthCounts={};
for(let i=0;i<500;i++){
 const run=completeQuiz();assert.ok(run.answers.length>=18&&run.answers.length<=23);lengthCounts[run.answers.length]=(lengthCounts[run.answers.length]||0)+1;
 assert.deepEqual(resolveQuiz(run.questionIds,run.answers),resolveQuiz(run.questionIds,run.answers));
 try{const c=buildRecommendedCharacter(run.result,1+(i%20),initial);if(run.result.raceId==='elf')assert.equal(c.raceVariant,run.result.raceVariantId);checked++;}catch(e){failed.push(['answers',i,run.result,e.message]);}
}
assert.ok(Object.keys(lengthCounts).length>=2,'Adaptive quiz must produce more than one length');

const distribution={race:{},class:{},background:{}};
for(let i=0;i<12000;i++){
 const answers=quizCoreQuestionIds.map(randomAnswer);
 for(const axis of Object.keys(distribution)){const winner=scoreAxis(axis,quizCoreQuestionIds,answers)[0].id;distribution[axis][winner]=(distribution[axis][winner]||0)+1;}
}
for(const [axis,counts] of Object.entries(distribution)){
 const values=Object.values(counts);assert.equal(values.length,axis==='race'?18:axis==='class'?12:13);assert.ok(Math.min(...values)>120,`${axis} has an unreachable or extremely rare result`);
}
const phbRaces=new Set(['human','dwarf','elf','halfling','dragonborn','gnome','halfelf','halforc','tiefling']);
const phbShare=Object.entries(distribution.race).filter(([id])=>phbRaces.has(id)).reduce((sum,[,count])=>sum+count,0)/12000;
assert.ok(phbShare>.5&&phbShare<.6,`PHB preference is not slight: ${phbShare}`);

console.log(JSON.stringify({checked,lengthCounts,phbShare,distribution,failed},null,2));
if(failed.length)process.exitCode=1;
