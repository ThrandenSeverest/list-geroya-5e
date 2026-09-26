import { damageTypes, effectTypes, homebrewTypeLabels, type HomebrewElement } from './homebrew';
import { evaluateFormula } from './homebrewFormula';
export type HBProblem={id:string;message:string};
export function validateHomebrew(entities:HomebrewElement[],officialIds:string[]=[]):HBProblem[]{
 const problems:HBProblem[]=[],ids=new Set<string>(),all=new Set([...entities.filter(e=>e&&typeof e==='object').map(e=>e.id),...officialIds]);
 const add=(id:string,message:string)=>problems.push({id,message});
 const values:Record<string,number>={'@level':5,'@pb':3,'@maxHp':30,'@currentHp':20,'@tempHp':0,'@ac':15,'@initiative':2};
 for(const a of ['str','dex','con','int','wis','cha']){values['@mod.'+a]=2;values['@ability.'+a]=14;}
 for(const m of ['walk','fly','swim','climb'])values['@speed.'+m]=30;
 const formula=(id:string,value:unknown)=>{if(value===undefined)return;try{if(typeof value!=='string'&&typeof value!=='number')throw Error('Ожидалось число или формула');evaluateFormula(value,{values,classLevel:()=>5,resource:()=>3,predicate:()=>true});}catch(e){add(id,'Формула: '+(e as Error).message);}};
 const ref=(owner:string,id:string|undefined)=>{if(id&&!all.has(id))add(owner,'Не найдена ссылка: '+id);};
 for(const e of entities){
  if(!e||typeof e!=='object'){add('','Некорректная сущность');continue;}
  if(typeof e.id!=='string'||(!/^hb:[a-z0-9_-]+:[a-z]+:[a-z0-9_-]+$/.test(e.id)&&!/^homebrew-/.test(e.id)))add(e.id||'','Некорректный ID');
  if(ids.has(e.id))add(e.id,'Повторяющийся ID');ids.add(e.id);
  if(!(e.type in homebrewTypeLabels)||typeof e.name!=='string'||!e.name.trim()||typeof e.description!=='string')add(e.id,'Нужны допустимый тип, название и описание');
  if(new TextEncoder().encode(JSON.stringify(e)).length>32768)add(e.id,'Элемент превышает 32 КиБ; разделите способности на отдельные элементы');
  if(e.icon!==undefined&&(!['class','race','background'].includes(e.type)||typeof e.icon!=='string'||!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(e.icon)||e.icon.length>18000))add(e.id,'Иконка: нужен небольшой PNG для класса, расы или предыстории');
  if(e.features!==undefined){
   if(!['class','subclass'].includes(e.type)||!Array.isArray(e.features)||e.features.length>40)add(e.id,'Особенности допустимы только внутри класса или подкласса (до 40)');
   else {const used=new Set<string>();for(const f of e.features){if(!f||typeof f.id!=='string'||!/^hb:[a-z0-9_-]+:ability:[a-z0-9_-]+$/.test(f.id)||used.has(f.id)||!Number.isInteger(f.level)||f.level<1||f.level>20||typeof f.name!=='string'||!f.name.trim()||typeof f.description!=='string')add(e.id,'Особенность: название, текст, уникальный ID и уровень 1–20 обязательны');if(f?.id)used.add(f.id);for(const effect of f?.effects||[]){if(!effectTypes[effect.type])add(e.id,'Неизвестный эффект особенности');formula(e.id,effect.value);formula(e.id,effect.when);}}}
  }
  if(e.spellList?.some(id=>!all.has(id)&&!all.has('official:spell:'+id)))add(e.id,'В списке заклинаний класса есть неизвестный ID');
  if(e.spellGrants?.some(grant=>!Number.isInteger(grant.level)||grant.level<1||grant.level>20||(!all.has(grant.spellId)&&!all.has('official:spell:'+grant.spellId))||grant.uses!==undefined&&(!Number.isInteger(grant.uses)||grant.uses<1||grant.uses>20)))add(e.id,'Бонусное заклинание: выберите заклинание, уровень и допустимое число применений');
  if(e.requirements?.some(r=>r.type!=='selected_feature'||!r.id||!all.has(r.id)))add(e.id,'Требование: выберите существующую способность');
  if(e.spellcasting?.recovery&&!['long','short_or_long'].includes(e.spellcasting.recovery))add(e.id,'Магия: неизвестный способ восстановления ячеек');
  if(e.spellcasting?.slots&&Object.entries(e.spellcasting.slots).some(([level,slots])=>!Number.isInteger(Number(level))||Number(level)<1||Number(level)>20||!Array.isArray(slots)||slots.length>9||slots.some(v=>!Number.isInteger(v)||v<0||v>20)))add(e.id,'Магия: ячейки должны быть таблицей уровней 1–20');
  if(e.spellMechanics!==undefined){
   const m=e.spellMechanics;
   if(e.type!=='spell'||!['attack','save','automatic'].includes(m.delivery)||!Array.isArray(m.damage)||!m.damage.length)add(e.id,'Урон заклинания: выберите способ попадания и хотя бы один бросок урона');
   if(m.delivery==='save'&&!m.saveAbility)add(e.id,'Урон заклинания: выберите характеристику спасброска');
   const damage=[...(m.damage||[]),...(m.cantripScaling||[]).flatMap(row=>row.damage||[]),...(m.slotScaling?.damage||[])];
   for(const row of damage){formula(e.id,row.formula);if(!damageTypes.includes(row.type))add(e.id,'Урон заклинания: неизвестный тип урона');}
   if((m.cantripScaling||[]).some(row=>!Number.isInteger(row.level)||row.level<2||row.level>20||!Array.isArray(row.damage)))add(e.id,'Развитие заговора: уровень должен быть от 2 до 20');
   if((e.level||0)!==0&&(m.cantripScaling?.length||0)>0)add(e.id,'Развитие по уровню персонажа доступно только заговорам');
   if(m.slotScaling&&(!Number.isInteger(m.slotScaling.every)||m.slotScaling.every<1||m.slotScaling.every>9))add(e.id,'Усиление ячейкой: шаг должен быть от 1 до 9 кругов');
   if((e.level||0)===0&&m.slotScaling)add(e.id,'Заговор не может усиливаться ячейкой');
  }
  for(const key of ['effects','resources','attacks','actions','choices','references'] as const)if(e[key]!==undefined&&!Array.isArray(e[key]))add(e.id,key+': требуется массив');
  for(const key of ['effects','resources','attacks','actions','choices'] as const)if(Array.isArray(e[key])&&e[key]!.some(row=>!row||typeof row!=='object'))add(e.id,key+': некорректная запись');
  if(problems.some(p=>p.id===e.id))continue;
  if(e.table&&(!Array.isArray(e.table.columns)||!Array.isArray(e.table.rows)||e.table.columns.length<1||e.table.columns.length>6||e.table.rows.length>200||e.table.columns.some(c=>typeof c!=='string'||c.length>80)||e.table.rows.some(r=>!Array.isArray(r)||r.length!==e.table!.columns.length||r.some(c=>typeof c!=='string'||c.length>160))))add(e.id,'Таблица: 1–6 колонок, до 200 строк, до 160 символов в ячейке');
  if((e.effects?.length||0)>100||(e.attacks?.length||0)>50||(e.resources?.length||0)>50)add(e.id,'Слишком много механик в одной сущности');
  if(e.type==='class'&&!['d6','d8','d10','d12'].includes(e.hitDie||''))add(e.id,'Выберите кость хитов');
  for(const ef of e.effects||[]){if(!effectTypes[ef.type])add(e.id,'Неизвестный эффект: '+ef.type);formula(e.id,ef.value);formula(e.id,ef.formula);formula(e.id,ef.when);if(ef.type.startsWith('grant_'))ref(e.id,ef.id);}
  const localIds=new Set<string>();
  for(const row of [...e.resources||[],...e.attacks||[],...e.actions||[],...e.choices||[]]){if(!row.id||localIds.has(row.id))add(e.id,'Повторяющийся или пустой вложенный ID');localIds.add(row.id);}
  for(const r of e.resources||[]){formula(e.id,r.max);formula(e.id,r.when);if(!Array.isArray(r.restore))add(e.id,'Ресурс: выберите восстановление');}
  for(const a of e.attacks||[]){if(!['str','dex','con','int','wis','cha'].includes(a.ability)||!Array.isArray(a.damage))add(e.id,'Атака: выберите характеристику и урон');else for(const d of a.damage)formula(e.id,d.formula);formula(e.id,a.bonus);formula(e.id,a.saveDc);formula(e.id,a.when);}
  for(const c of e.choices||[]){if(!Array.isArray(c.from)||!Number.isInteger(c.count)||c.count<1||c.count>50)add(e.id,'Выбор: количество 1–50 и список вариантов');if(c.choiceGroup!==undefined&&(!c.choiceGroup.trim()||c.choiceGroup.length>80))add(e.id,'Выбор: название общей группы обязательно');if(c.uniqueAcrossGroup&&!c.choiceGroup)add(e.id,'Выбор: для запрета повторов задайте группу');for(const id of c.from||[])ref(e.id,id);}
  for(const [l,rows]of Object.entries(e.advancement||{})){if(!Number.isInteger(Number(l))||Number(l)<1||Number(l)>20||!Array.isArray(rows)){add(e.id,'Прогрессия: уровни 1–20');continue;}for(const r of rows)if(r.id&&r.type!=='choice')ref(e.id,r.id);}
  ref(e.id,e.parentClassId);ref(e.id,e.parentRaceId);
  for(const id of e.references||[])ref(e.id,id);
 }
 // Only automatically expanded edges participate; descriptive references may point back.
 if(problems.length)return problems;
 const byId=new Map(entities.map(e=>[e.id,e]));const done=new Set<string>(),path=new Set<string>();
 const visit=(id:string,depth=0)=>{if(path.has(id)){add(id,'Циклическая выдача особенностей');return;}if(done.has(id)||!byId.has(id))return;if(depth>24){add(id,'Глубина зависимостей больше 24');return;}path.add(id);const e=byId.get(id)!;
  const edges=[...(e.effects||[]).filter(x=>x.type==='grant_feature').map(x=>x.id),...Object.values(e.advancement||{}).flat().map(x=>x.id)];for(const ref of edges)if(ref)visit(ref,depth+1);path.delete(id);done.add(id);};
 if(!problems.length)for(const e of entities)visit(e.id);
 return problems;
}
