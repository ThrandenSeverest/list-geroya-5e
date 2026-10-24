import React from 'react';
import {createRoot} from 'react-dom/client';
import {PdfCharacterSheet, type PdfCharacterSheetProps} from '../../app/PdfCharacterSheet';
import {resolvedRaceFeatures} from '../../app/racialTraits';
import '../../app/globals.css';
import '../../app/sheet-layout.css';
const count = Number(new URLSearchParams(location.search).get('resources') || 3);
const sheetEdition = new URLSearchParams(location.search).get('edition') === '2024' ? '2024' : '2014';
const resources = Array.from({length:count},(_,i)=>({name:['Ярость','Магическое чутьё','Восстановление магии','Выброс адреналина','Непоколебимая стойкость','Очень длинное название ограниченного расового ресурса'][i%6], current:3,max:i===8?100:3, isShortRest:false,isLongRest:true})).map((r,i)=>({...r,name:i>5?`${r.name} ${i+1}`:r.name}));
const props = {
 sheetEdition,
 identity:{name:'Гарзуг Великий Искромант',playerName:'',experience:0,inspiration:false,className:'Варвар 3 / Волшебник',raceName:'Орк · Орк — Мордекайн (+2/+1)',backgroundName:'Шарлатан',alignment:'Хаотично-нейтральное',level:6},
 classId:'wizard', abilities:{str:17,dex:12,con:14,int:14,wis:10,cha:8},proficiency:3,savingThrows:['str','con'],
 proficiencies:{skills:['Атлетика','Ловкость рук','Скрытность','Обман'],expertise:[],armor:['Лёгкие и средние доспехи','щиты'],weapons:['Простое и воинское оружие'],tools:['Набор для грима','Набор для фальсификации'],languages:['Общий','Орочий']},
 // Legacy conditional hints must not appear in the narrow AC/HP column.
 acNotes:['Доспехи мага: если наложены, база КД 13 + Ловкость.','Щит (заклинание): реакцией +5 КД до начала следующего хода.'],
 ac:13,initiative:1,speed:30,hitPoints:50,hitDie:6,hitDiceLabel:'3к12 + 3к6',currentHitPoints:50,passivePerception:10,
 attacks:[{id:'javelin',kind:'weapon',name:'Метательное копьё',attackBonus:6,damageDisplay:'1d6+3'},{id:'axe',kind:'weapon',name:'Секира',attackBonus:6,damageDisplay:'1d12+3'},{id:'handaxe',kind:'weapon',name:'Ручной топор',attackBonus:6,damageDisplay:'1d6+3'}],
 resources, classFeatures:[],raceFeatures:resolvedRaceFeatures('orc','base'),featFeatures:[],backgroundFeature:{name:'Поддельная личность',description:'Вторая личность.'},equipment:['Набор путешественника (рюкзак, спальник, столовый набор, трутница, 10 факелов, 10 рационов, бурдюк и 50 футов пеньковой верёвки)','Метательное копьё ×4','Секира','Ручной топор ×2','Комплект отличной одежды','Набор для грима','Инструменты для выбранного мошенничества','Кошель с 15 зм'],currency:{gp:0,sp:0,cp:0,pp:0},personality:{traits:'',ideals:'',bonds:'',flaws:''},spellAbility:'Интеллект',spellSaveDc:13,spellAttackBonus:5,spellSlots:[4,3,3],spells:[]
};
if(new URLSearchParams(location.search).get('scenario')==='adenon')Object.assign(props,{
 identity:{...props.identity,name:'Аденон Мислав Регулус Эденбургский',className:'Волшебник',raceName:'Дампир · Гибкие характеристики',backgroundName:'Благородный',level:1},
 raceFeatures:resolvedRaceFeatures('dhampir','base'),
 attacks:Array.from({length:7},(_,i)=>({id:'test-'+i,kind:i<2?'weapon':'cantrip',name:['Боевой посох (1 рука)','Боевой посох (2 руки)','Вампирский укус','Громовой клинок — боевой посох','Электрошок','Огненный снаряд','Луч холода'][i],attackBonus:5,damageDisplay:'1d8+3',note:i>1?'Наложение заговора: одна атака оружием по цели в пределах 5 футов; оружие считается материальным компонентом. При попадании наносится обычный урон оружия и дополнительный урон в соответствии с уровнем персонажа.':''})),
});
createRoot(document.getElementById('root')!).render(<PdfCharacterSheet {...props as unknown as PdfCharacterSheetProps}/>);
