import { itemCategory, type PlayItem } from './adventure';
export const healingPotions=[
 {id:'normal',name:'Зелье лечения',label:'Обычное',formula:'2d4+2'},
 {id:'greater',name:'Зелье большого лечения',label:'Большое',formula:'4d4+4'},
 {id:'superior',name:'Зелье отличного лечения',label:'Отличное',formula:'8d4+8'},
 {id:'supreme',name:'Зелье превосходного лечения',label:'Превосходное',formula:'10d4+20'},
] as const;
const normalized=(value:string)=>value.toLocaleLowerCase('ru').replace(/ё/g,'е').replace(/\s+/g,' ').trim();
export function potionPreset(item:PlayItem){
 if(itemCategory(item)!=='consumable'||!/(?:зелье|potion)/i.test(item.name))return undefined;
 if(item.healingFormula){const formula=item.healingFormula.toLowerCase().replace(/\s/g,'').replace(/к/g,'d');return healingPotions.find(p=>p.formula===formula);}
 return healingPotions.find(p=>normalized(p.name)===normalized(item.name));
}
export function healingFormulaForItem(item:PlayItem){return item.healingFormula||potionPreset(item)?.formula;}
