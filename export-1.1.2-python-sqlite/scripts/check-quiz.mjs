import {createJiti} from 'jiti';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const j=createJiti(import.meta.url);const {buildRecommendedCharacter,swapStandardAbility,standardAbilityBuild}=await j.import('../app/recommendedBuild.ts');const {resolveQuiz}=await j.import('../app/quizEngine.ts');const {subclasses}=await j.import('../app/characterRules.ts');
const source=fs.readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8');
const initial=Function('return '+source.match(/const initial: ExportCharacter = (\{[\s\S]*?\n\});/)[1])();
const data=JSON.parse(fs.readFileSync(new URL('../app/quizData.json',import.meta.url)));
let checked=0,failed=[];
for(const classId of Object.keys(data.profiles))for(const level of [1,2,3,4,5,8,12,16,20]){
 const result={classId,raceId:'human',backgroundId:'soldier',subclassId:data.profiles[classId][0].id,subclassUnlockLevel:subclasses[classId].level,dominantTraits:[]};
 try{const c=buildRecommendedCharacter(result,level,initial);assert.equal(c.level,level);assert.equal(c.subclass,level<result.subclassUnlockLevel?'':result.subclassId);assert.ok(c.currentHitPoints>0);checked++;}catch(e){failed.push([classId,level,e.message]);}
}
for(const [classId,profiles] of Object.entries(data.profiles))for(const p of profiles){
 try{buildRecommendedCharacter({classId,raceId:'human',backgroundId:'soldier',subclassId:p.id,subclassUnlockLevel:subclasses[classId].level,dominantTraits:[]},20,initial);checked++;}catch(e){failed.push([classId,p.id,20,e.message]);}
}
const a=standardAbilityBuild('wizard');assert.deepEqual(Object.values(swapStandardAbility(a,'str',15)).sort((a,b)=>a-b),[8,10,12,13,14,15]);
let seed=912342;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
for(let i=0;i<500;i++){const answers=Array.from({length:20},()=>Math.floor(random()*6));assert.deepEqual(resolveQuiz(answers),resolveQuiz(answers));const r=resolveQuiz(answers);try{buildRecommendedCharacter(r,1+(i%20),initial);checked++;}catch(e){failed.push(['answers',i,r,e.message]);}}
console.log(JSON.stringify({checked,failed},null,2));if(failed.length)process.exitCode=1;
