import { classes, races, backgrounds, classSkillRules, spells } from './catalog';
import { type AbilityScores, type ExportCharacter, estimatedHitPoints } from './exportFormats';
import { asiLevelsForClass, finalAbilityScores, optimalSpellIds, optimalPreparedSpellIds, raceSkillChoiceCount, selectedRaceVariant, variantsFor, spellSelectionRule, subclasses } from './characterRules';
import { backgroundFixedSkills } from './backgroundChoices';
import { backgroundStartingGold } from './backgroundRules';
import { classChoiceGroups, classChoicesComplete } from './classChoices';
import { characterProficiencies, proficiencyChoiceRequirements, proficiencyChoiceUsedElsewhere, proficiencyChoicesComplete, classSkillUsedElsewhere } from './proficiencies';
import { languageRule, knownLanguageOptions } from './languages';
import { optimalEquipmentSelections, equipmentComplete } from './equipment';
import { migrateMulticlassCharacter } from './multiclass';
import { personalityOptions, skillKeys } from './rules';
import type { QuizResult } from './quizEngine';
export const standardArray=[15,14,13,12,10,8];
type Key=keyof AbilityScores;
const orders:Record<string,string>={barbarian:'str con dex wis cha int',bard:'cha dex con wis int str',cleric:'wis con str dex cha int',druid:'wis con dex int cha str',fighter:'str con dex wis cha int',monk:'dex wis con str int cha',paladin:'str cha con wis dex int',ranger:'dex wis con str int cha',rogue:'dex con int wis cha str',sorcerer:'cha con dex wis int str',warlock:'cha con dex wis int str',wizard:'int con dex wis cha str',artificer:'int con dex wis cha str'};
export function abilityOrder(classId:string,subclassId=''):Key[]{
 if(classId==='warlock'&&subclassId==='hexblade')return ['cha','con','dex','wis','str','int'];
 return (orders[classId]||orders.fighter).split(' ') as Key[];
}
export function standardAbilityBuild(classId:string,subclassId=''):AbilityScores{return Object.fromEntries(abilityOrder(classId,subclassId).map((key,i)=>[key,standardArray[i]])) as AbilityScores;}
export function swapStandardAbility(abilities:AbilityScores,key:Key,value:number):AbilityScores{
 if(!standardArray.includes(value))return abilities;
 const other=(Object.keys(abilities) as Key[]).find(k=>abilities[k]===value);
 if(!other)return abilities;
 return {...abilities,[key]:value,[other]:abilities[key]};
}
export function buildRecommendedCharacter(result:QuizResult,level:number,initial:ExportCharacter):ExportCharacter{
 if(!Number.isInteger(level)||level<1||level>20)throw new Error('Уровень должен быть от 1 до 20.');
 if(!races.some(x=>x.id===result.raceId)||!classes.some(x=>x.id===result.classId)||!backgrounds.some(x=>x.id===result.backgroundId)||!subclasses[result.classId]?.options.some(x=>x.id===result.subclassId))throw new Error('Результат несовместим с каталогом.');
 const order=abilityOrder(result.classId,result.subclassId);
 const variants=variantsFor(result.raceId);
 const variant=variants.find(x=>x.id===result.raceVariantId)?.id||variants.find(x=>x.id!=='variant')?.id||'base';
 let c:ExportCharacter={...structuredClone(initial),race:result.raceId,raceVariant:variant,className:result.classId,startingClassId:result.classId,classes:[],levelHistory:[],level,subclass:level>=result.subclassUnlockLevel?result.subclassId:'',recommendedSubclassId:result.subclassId,recommendedBuildVersion:'1.2.0',abilityMethod:'standard',background:result.backgroundId,abilities:standardAbilityBuild(result.classId,result.subclassId),name:`${classes.find(x=>x.id===result.classId)!.name} — новый герой`,backgroundSkills:backgroundFixedSkills(result.backgroundId)};
 const sync=()=>{c.classes=[{classId:c.className,level:c.level,acquiredAtCharacterLevel:1,subclassId:c.subclass,classSkills:c.classSkills,choiceValues:c.classChoices}];c=migrateMulticlassCharacter(c);};
 const flexible=selectedRaceVariant(c.race,c.raceVariant)?.chooseBonuses;
 c.raceAbilityChoices=flexible?order.filter(k=>!flexible.exclude?.includes(k)).slice(0,flexible.count):[];
 c.currency.gp=backgroundStartingGold(c.background,backgrounds.find(x=>x.id===c.background));
 sync();
 const skillOrder=['Внимательность','Скрытность','Проницательность','Атлетика','Магия','Убеждение','Выживание','Расследование',...Object.keys(skillKeys)];
 const rankSkills=(a:string,b:string)=>{const x=skillOrder.indexOf(a),y=skillOrder.indexOf(b);return (x<0?999:x)-(y<0?999:y)||a.localeCompare(b,'ru');};
 // Reserve restricted subclass pools before the wider starting-class pool.
 for(const req of proficiencyChoiceRequirements(c))c.proficiencyChoices={...c.proficiencyChoices,[req.key]:req.options.filter(v=>!proficiencyChoiceUsedElsewhere(c,req.key,v)).slice(0,req.count)};
 const skillRule=classSkillRules[c.className];
 c.classSkills=[...skillRule.skills].sort(rankSkills).filter(s=>!classSkillUsedElsewhere(c,c.className,s)).slice(0,skillRule.count);sync();
 c.raceSkills=Object.keys(skillKeys).sort(rankSkills).filter(s=>!characterProficiencies(c).skills.includes(s)).slice(0,raceSkillChoiceCount(c));
 for(const at of asiLevelsForClass(c.className).filter(x=>x<=level)){
  const choice={key:`class-${at}`,level:at,featId:'asi',asiChoices:[] as Key[],featChoices:{}};
  c.advancements=[...(c.advancements||[]),choice];
  for(let i=0;i<2;i++){const final=finalAbilityScores(c);const key=order.find(k=>final[k]<20);if(key)choice.asiChoices.push(key);}
 }
 c.feats=(c.advancements||[]).map(x=>x.featId);c.asiChoices=(c.advancements||[]).flatMap(x=>x.asiChoices);
 // Resolve dependent groups again after pact, subclass and spell selections.
 for(let pass=0;pass<4;pass++){
  sync();
  for(const req of proficiencyChoiceRequirements(c)){
   const values=req.options.filter(v=>!proficiencyChoiceUsedElsewhere(c,req.key,v)).slice(0,req.count);
   c.proficiencyChoices={...c.proficiencyChoices,[req.key]:values};
  }
  for(const group of classChoiceGroups(c,spells)){
   let options=group.options;
   if(group.key==='expertise')options=options.filter(o=>characterProficiencies(c).skills.includes(o.name));
   if(group.key.startsWith('spell-mastery')||group.key==='signature-spells')options=options.filter(o=>c.spells.includes(o.id));
   const preferred=group.key==='fighting-style'?(c.className==='ranger'?['archery']:['defense','dueling','great-weapon']):group.key==='metamagic'?['twinned','quickened','subtle','heightened']:group.key==='invocations'?['agonizing-blast','repelling-blast','devils-sight']:[];
   options=[...options].sort((a,b)=>{const x=preferred.indexOf(a.id),y=preferred.indexOf(b.id);return (x<0?999:x)-(y<0?999:y);});
   c.classChoices={...c.classChoices,[group.key]:options.slice(0,group.count).map(o=>o.id)};sync();
  }
  const final={...c,abilities:finalAbilityScores(c)};
  c.spells=optimalSpellIds(final,spells);c.preparedSpells=optimalPreparedSpellIds(final,spells,c.spells);
 }
 sync();
 const lr=languageRule(c);c.languages=knownLanguageOptions.filter(s=>!lr.fixed.includes(s)).slice(0,lr.choices);
 c.equipmentSelections=optimalEquipmentSelections(c.className,finalAbilityScores(c),{classChoices:c.classChoices,subclass:c.subclass,feats:c.feats});
 const personality=personalityOptions(c.background);
 c.personality=Object.fromEntries(['traits','ideals','bonds','flaws'].map((k,i)=>[k,personality?.[k as keyof typeof personality]?.[0]||['Довожу начатое до конца.','Каждый заслуживает шанс.','Помню тех, кто помог мне.','Иногда слишком полагаюсь на себя.'][i]])) as ExportCharacter['personality'];
 c.currentHitPoints=estimatedHitPoints({...c,abilities:finalAbilityScores(c)});
 c.spellGrants=c.spells.map(spellId=>({spellId,sourceType:'class',sourceId:c.className,classId:c.className,mode:spellSelectionRule({...c,abilities:finalAbilityScores(c)}).mode==='spellbook'?'spellbook':spellSelectionRule({...c,abilities:finalAbilityScores(c)}).mode==='prepared'?'prepared':'known'}));
 const errors=validateRecommendedCharacter(c);if(errors.length)throw new Error(`Не удалось завершить сборку: ${errors.join('; ')}`);
 return c;
}
export function validateRecommendedCharacter(c:ExportCharacter):string[]{
 const errors:string[]=[];const final={...c,abilities:finalAbilityScores(c)};const rule=spellSelectionRule(final);
 if(!classChoicesComplete(c,spells))errors.push('классовые выборы');
 if(!proficiencyChoicesComplete(c))errors.push('владения');
 if(!equipmentComplete(c))errors.push('снаряжение');
 if(c.classSkills.length!==classSkillRules[c.className].count)errors.push('навыки класса');
 if((c.raceSkills||[]).length!==raceSkillChoiceCount(c))errors.push('навыки расы');
 const selected=spells.filter(s=>c.spells.includes(s.id));
 if(selected.filter(s=>s.level===0).length!==rule.cantrips||selected.filter(s=>s.level>0).length!==rule.leveled)errors.push('число заклинаний');
 if(rule.mode==='spellbook'&&(c.preparedSpells||[]).length!==rule.prepared)errors.push('подготовка заклинаний');
 if(rule.levelLimits?.some((limit,level)=>level>0&&selected.filter(s=>s.level>=level).length>limit))errors.push('лимиты кругов');
 return errors;
}
