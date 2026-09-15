import React from 'react';
import {createRoot} from 'react-dom/client';
import {PdfCharacterSheet, type PdfCharacterSheetProps} from '../../app/PdfCharacterSheet';
import {resolvedRaceFeatures} from '../../app/racialTraits';
import '../../app/globals.css';
const count = Number(new URLSearchParams(location.search).get('resources') || 3);
const resources = Array.from({length:count},(_,i)=>({name:['Ярость','Магическое чутьё','Восстановление магии','Выброс адреналина','Непоколебимая стойкость','Очень длинное название ограниченного расового ресурса'][i%6], current:3,max:i===8?100:3, isShortRest:false,isLongRest:true})).map((r,i)=>({...r,name:i>5?`${r.name} ${i+1}`:r.name}));
const props = {
 identity:{name:'Гарзуг Великий Искромант',playerName:'',experience:0,inspiration:false,className:'Варвар 3 / Волшебник',raceName:'Орк · Орк — Мордекайн (+2/+1)',backgroundName:'Шарлатан',alignment:'Хаотично-нейтральное',level:6},
 classId:'wizard', abilities:{str:17,dex:12,con:14,int:14,wis:10,cha:8},proficiency:3,savingThrows:['str','con'],
 proficiencies:{skills:['Атлетика','Ловкость рук','Скрытность','Обман'],expertise:[],armor:['Лёгкие и средние доспехи','щиты'],weapons:['Простое и воинское оружие'],tools:['Набор для грима','Набор для фальсификации'],languages:['Общий','Орочий']},
 ac:13,initiative:1,speed:30,hitPoints:50,hitDie:6,hitDiceLabel:'3к12 + 3к6',currentHitPoints:50,passivePerception:10,
 attacks:[{id:'javelin',name:'Метательное копьё',attackBonus:6,damageDisplay:'1d6+3'},{id:'axe',name:'Секира',attackBonus:6,damageDisplay:'1d12+3'},{id:'handaxe',name:'Ручной топор',attackBonus:6,damageDisplay:'1d6+3'}],
 resources, classFeatures:[],raceFeatures:resolvedRaceFeatures('orc','base'),featFeatures:[],backgroundFeature:{name:'Поддельная личность',description:'Вторая личность.'},equipment:['Набор путешественника (рюкзак, спальник, столовый набор, трутница, 10 факелов, 10 рационов, бурдюк и 50 футов пеньковой верёвки)','Метательное копьё ×4','Секира','Ручной топор ×2','Комплект отличной одежды','Набор для грима','Инструменты для выбранного мошенничества','Кошель с 15 зм'],currency:{gp:0,sp:0,cp:0,pp:0},personality:{traits:'',ideals:'',bonds:'',flaws:''},spellAbility:'Интеллект',spellSaveDc:13,spellAttackBonus:5,spellSlots:[4,3,3],spells:[]
};
createRoot(document.getElementById('root')!).render(<PdfCharacterSheet {...props as unknown as PdfCharacterSheetProps}/>);
