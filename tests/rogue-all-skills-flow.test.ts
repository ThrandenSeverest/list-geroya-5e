import test from 'node:test';
import assert from 'node:assert/strict';
import { spells } from '../app/catalog';
import { createAdventureCharacter, equipInHand, advancePlayTurn } from '../app/adventure';
import { createHelpmateExport, createLongStoryShortExport, type ExportCharacter } from '../app/exportFormats';
import { characterProficiencies, characterExpertiseSkills, proficiencyChoicesComplete } from '../app/proficiencies';
import { skillKeys } from '../app/rules';
import { skillBonusBreakdown } from '../app/derivedSkills';
import { armorClassBreakdown } from '../app/armor';

test('all-skill rogue multiclass exports to LSS and Helpmate and enters adventure',()=>{
  // Half-elf Rogue 4 / Lore Bard 3 / Knowledge Cleric 1 / Ranger 1,
  // with Skilled at Rogue 4: all eighteen choices have distinct sources.
  const hero:ExportCharacter={
    name:'Следопыт знаний',playerName:'',className:'rogue',startingClassId:'rogue',level:9,
    classes:[
      {classId:'rogue',level:4,acquiredAtCharacterLevel:1,classSkills:['Акробатика','Скрытность','Ловкость рук','Внимательность']},
      {classId:'bard',level:3,subclassId:'lore',acquiredAtCharacterLevel:5,classSkills:['Запугивание']},
      {classId:'cleric',level:1,subclassId:'knowledge',acquiredAtCharacterLevel:8},
      {classId:'ranger',level:1,acquiredAtCharacterLevel:9,classSkills:['Выживание']},
    ],
    race:'halfelf',raceVariant:'base',raceSkills:['Атлетика','Выступление'],background:'',backgroundSkills:['Убеждение','Обман'],
    proficiencyChoices:{'multiclass-bard-music':['Лютня'],'subclass-bard-lore-skills':['Проницательность','Медицина','Уход за животными'],'subclass-cleric-knowledge-skills':['Магия','История']},
    advancements:[{key:'rogue-4',level:4,featId:'skilled',asiChoices:[],featChoices:{proficiencies:['Расследование','Природа','Религия']}}],
    expertiseSkills:['Скрытность','Ловкость рук'],abilities:{str:13,dex:16,con:12,int:13,wis:14,cha:14},
    inventoryOverride:'Кинжал\nКожаный доспех',spells:[],currency:{gp:0,sp:0,cp:0,pp:0},alignment:'',personality:{traits:'',ideals:'',bonds:'',flaws:''},
  } as unknown as ExportCharacter;
  const allSkills=Object.keys(skillKeys);
  assert.equal(proficiencyChoicesComplete(hero),true);
  assert.deepEqual(characterProficiencies(hero).skills.slice().sort(),allSkills.slice().sort());
  assert(characterExpertiseSkills(hero).includes('Скрытность'));
  const context={character:hero,spells,raceFeatureList:[],classFeatureList:[]};
  const lss=JSON.parse(createLongStoryShortExport(context).data);
  assert.equal(Object.keys(lss.skills).length,18);
  assert(Object.values(lss.skills).every((skill:any)=>skill.isProf>=1));
  const helpmate=createHelpmateExport(context);
  assert.equal(helpmate.Parameters.flatMap(parameter=>parameter.Abilities).filter(skill=>skill.Proficiency).length,18);
  const adventure=createAdventureCharacter(hero,'source','date','Проверка');
  assert.equal(adventure.adventure!.inventory.length,2);
  assert.deepEqual(characterProficiencies(adventure).skills.slice().sort(),allSkills.slice().sort());
  assert.equal(skillBonusBreakdown(adventure,'Скрытность').value,skillBonusBreakdown(hero,'Скрытность').value);
  const knife=adventure.adventure!.inventory.find(item=>item.name==='Кинжал')!;
  const equipped=equipInHand(adventure,knife.id,'right');
  assert.equal(advancePlayTurn(equipped).adventure!.round,2);
  assert.equal(armorClassBreakdown(equipped).selectedSource,'armor');
  const restored=JSON.parse(JSON.stringify(equipped)) as ExportCharacter;
  assert.equal(characterProficiencies(restored).skills.length,18);
});
