export type DieSource=((sides:number)=>number)&{prepare?:(sides:number[])=>void};
let current:DieSource|undefined;
export function activeDiceSource(){return current;}
export function withDiceSource<T>(source:DieSource,fn:()=>T):T {const previous=current;current=source;try{return fn();}finally{current=previous;}}
export class DiceNeeded extends Error {constructor(public sides:number[]){super('Dice have not landed yet');}}
/** Re-enter a pure rules calculation with completed physical throws. No guessed values. */
export async function resolvePhysicalAction<T>(fn:()=>T,request:(sides:number[])=>Promise<number[]>):Promise<T>{
 const values:{sides:number;value:number}[]=[];
 for(;;){
  let cursor=0;
  const source:DieSource=(sides)=>{const entry=values[cursor];if(!entry)throw new DiceNeeded([sides]);if(entry.sides!==sides)throw Error('Параметры броска изменились. Повторите действие.');cursor++;return entry.value;};
  source.prepare=(sides)=>{
   for(let i=0;i<sides.length;i++){const entry=values[cursor+i];if(!entry)throw new DiceNeeded(sides.slice(i));if(entry.sides!==sides[i])throw Error('Параметры броска изменились. Повторите действие.');}
  };
  try{return withDiceSource(source,fn);}catch(error){
   if(!(error instanceof DiceNeeded))throw error;
   const rolled=await request(error.sides);
   if(rolled.length!==error.sides.length||rolled.some((v,i)=>!Number.isInteger(v)||v<1||v>error.sides[i]))throw Error('Некорректный результат физических кубиков.');
   rolled.forEach((value,i)=>values.push({sides:error.sides[i],value}));
  }
 }
}
