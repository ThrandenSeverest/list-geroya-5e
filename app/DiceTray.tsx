'use client';
import { NumberSlider } from './NumberSlider';
import { useRef, useState, type PointerEvent, type KeyboardEvent } from 'react';
import type { DiceResult } from './adventure';
import { integer, diceFormulaTerms } from './adventure';
import { DiceSettings } from './DiceSettings';
import type {PlayViewPreferences} from './playViewPreferences';
import type {ManualDiceThrow} from './DiceScreenOverlay';
export type VisibleRoll = { id:string; name:string; result:DiceResult };
const shapes:Record<number,string>={4:'50,5 95,88 5,88',6:'14,14 86,14 86,86 14,86',8:'50,4 95,50 50,96 5,50',10:'50,4 91,34 77,87 23,87 9,34',12:'50,4 94,36 78,89 22,89 6,36',20:'50,4 92,27 92,73 50,96 8,73 8,27',100:'50,4 91,34 77,87 23,87 9,34'};
export function DiceFace({sides,value}:{sides:number;value?:number}){return <svg className="dice-face" viewBox="0 0 100 100" aria-hidden="true"><polygon points={shapes[sides]||shapes[20]} /><path d={sides===20?'M8 27L50 22L92 27M8 73L30 77L50 96L70 77L92 73M50 4L50 22L30 77L8 27M50 22L70 77L92 27M30 77L70 77':sides===4?'M50 5L50 66L5 88M50 66L95 88':''} /><text x="50" y="57" textAnchor="middle">{value??`d${sides}`}</text></svg>;}
type Hold={id:string;pointerId:number;formula:string;x:number;y:number;angle:number;shake:number;samples:{x:number;y:number;t:number}[];timer?:ReturnType<typeof setTimeout>};
export function DiceTray({rolls,onRoll,onHoldStart,onHoldMove,onHoldEnd,view,onViewChange}:{rolls:VisibleRoll[];onRoll:(name:string,formula:string,manual?:ManualDiceThrow)=>void;onHoldStart:(sides:number[],x:number,y:number)=>string;onHoldMove:(id:string,x:number,y:number,angle:number)=>void;onHoldEnd:(id:string)=>void;view:PlayViewPreferences;onViewChange:(patch:Partial<PlayViewPreferences>)=>void}){
 const [sides,setSides]=useState(20),[count,setCount]=useState(1),[modifier,setModifier]=useState(0),[formula,setFormula]=useState('1d20'),[error,setError]=useState('');
 const hold=useRef<Hold|null>(null),suppressClick=useRef(false);
 const currentFormula=()=>`${count}d${sides}${modifier>=0?'+':''}${modifier}`;
 function activate(g:Hold){if(g.id||!view.diceAnimation)return;g.id=onHoldStart(Array(count).fill(sides),g.x,g.y);}
 function stop(cancel=false){const g=hold.current;if(!g)return;hold.current=null;clearTimeout(g.timer);if(!g.id)return;
  onHoldEnd(g.id);suppressClick.current=true;setTimeout(()=>{suppressClick.current=false;},0);if(cancel)return;
  const recent=g.samples.filter(s=>g.samples[g.samples.length-1].t-s.t<=110);
  const first=recent[0]||g.samples[0],last=g.samples[g.samples.length-1];
  const dt=Math.max(16,last.t-first.t),vx=Math.max(-1700,Math.min(1700,(last.x-first.x)/dt*1000)),vy=Math.max(-1700,Math.min(1700,(last.y-first.y)/dt*1000));
  onRoll('Кубы',g.formula,{id:g.id,sides:Array(count).fill(sides),x:g.x,y:g.y,angle:g.angle,vx,vy,spin:(g.angle<0?-1:1)*Math.min(12,g.shake)});
 }
 function press(e:PointerEvent<HTMLButtonElement>){if(e.button!==0||!view.diceAnimation)return;
  e.currentTarget.setPointerCapture(e.pointerId);const now=performance.now(),g:Hold={id:'',pointerId:e.pointerId,formula:currentFormula(),x:e.clientX,y:e.clientY,angle:0,shake:0,samples:[{x:e.clientX,y:e.clientY,t:now}]};
  g.timer=setTimeout(()=>{if(hold.current===g)activate(g);},180);hold.current=g;
 }
 function move(e:PointerEvent<HTMLButtonElement>){const g=hold.current;if(!g||g.pointerId!==e.pointerId)return;
  const now=performance.now(),previous=g.samples[g.samples.length-1];g.x=e.clientX;g.y=e.clientY;
  const dx=e.clientX-previous.x,dy=e.clientY-previous.y;g.angle+=(dx+dy)*.018;g.shake=Math.min(12,g.shake+Math.hypot(dx,dy)*.045);
  g.samples.push({x:g.x,y:g.y,t:now});if(g.samples.length>16)g.samples.shift();
  if(Math.hypot(g.x-g.samples[0].x,g.y-g.samples[0].y)>8)activate(g);
  if(g.id)onHoldMove(g.id,g.x,g.y,g.angle);
 }
 function keyDown(e:KeyboardEvent<HTMLButtonElement>){if(!view.diceAnimation)return;
  if(e.key===' '||e.key==='Enter')e.preventDefault();
  if((e.key===' '||e.key==='Enter')&&!e.repeat&&!hold.current){e.preventDefault();const r=e.currentTarget.getBoundingClientRect(),now=performance.now(),g:Hold={id:'',pointerId:-1,formula:currentFormula(),x:r.left+r.width/2,y:r.top+r.height/2,angle:0,shake:0,samples:[{x:r.left+r.width/2,y:r.top+r.height/2,t:now}]};g.timer=setTimeout(()=>{if(hold.current===g)activate(g);},180);hold.current=g;}
  else if(hold.current?.pointerId===-1&&e.key.startsWith('Arrow')){e.preventDefault();const g=hold.current;activate(g);g.x+=e.key==='ArrowRight'?24:e.key==='ArrowLeft'?-24:0;g.y+=e.key==='ArrowDown'?24:e.key==='ArrowUp'?-24:0;g.angle+=.4;g.shake=Math.min(12,g.shake+1);g.samples.push({x:g.x,y:g.y,t:performance.now()});onHoldMove(g.id,g.x,g.y,g.angle);}
 }
 function keyUp(e:KeyboardEvent<HTMLButtonElement>){if(hold.current?.pointerId===-1&&(e.key===' '||e.key==='Enter')){e.preventDefault();const active=!!hold.current.id,formula=hold.current.formula;stop();if(!active)cast(formula);}}
 function cast(value:string){try{diceFormulaTerms(value);onRoll('Кубы',value);setError('');}catch(e){setError((e as Error).message);}}
 const latest=rolls[0];
 const dieSides=latest ? [...latest.result.formula.matchAll(/(\d+)d(\d+)/gi)].flatMap(m=>Array(Number(m[1])*(latest.result.formula.includes("крит:")?2:1)).fill(Number(m[2]))) : [];
 return <aside className="dice-tray" aria-label="Постоянная панель кубов"><header><span className="eyebrow">Броски</span><h2>Кубы</h2></header><div className="dice-types">{[4,6,8,10,12,20,100].map(n=><button key={n} className={sides===n?'active':''} aria-pressed={sides===n} onClick={()=>setSides(n)} aria-label={`Выбрать d${n}`}><DiceFace sides={n}/><span>d{n}</span></button>)}</div><div className="dice-config"><label>Количество кубов<NumberSlider label="Количество кубов" min={1} max={20} value={count} onChange={value=>setCount(integer(value,1,20))}/></label><label>Модификатор<NumberSlider label="Модификатор" min={-20} max={20} value={modifier} onChange={value=>setModifier(integer(value,-100,100))}/></label></div><div className="dice-roll-controls"><button className="play-primary dice-roll-button" onClick={()=>{if(suppressClick.current){suppressClick.current=false;return;}cast(currentFormula());}} onPointerDown={press} onPointerMove={move} onPointerUp={e=>{if(hold.current?.pointerId===e.pointerId)stop();}} onPointerCancel={()=>stop(true)} onKeyDown={keyDown} onKeyUp={keyUp} title="Нажмите для броска или удерживайте и потяните кубы">Бросить {count}d{sides}{modifier?`${modifier>=0?'+':''}${modifier}`:''}</button><DiceSettings view={view} onChange={onViewChange}/></div><details><summary>Своя формула</summary><label>Формула броска<input value={formula} onChange={e=>setFormula(e.target.value)} placeholder="2d6+1d4+3"/></label><button onClick={()=>cast(formula)}>Бросить формулу</button></details>{error&&<p role="alert">{error}</p>}{latest&&<section className="dice-latest" aria-live="polite"><small>{latest.name} · {latest.result.formula}</small><div className="dice-values">{latest.result.rolls.map((value,i)=><span className="die-result" key={i}><DiceFace sides={dieSides[i]||20} value={value}/><b>{value}</b></span>)}</div>{latest.result.natural !== undefined && <p>Выбранный d20: <b>{latest.result.natural}</b>. Остальные кости и модификаторы учтены в результате.</p>}<div className="dice-total"><span>Сумма с модификатором</span><strong>{latest.result.total}</strong></div></section>}<section className="dice-history"><h3>Последние результаты</h3>{rolls.slice(0,3).map(r=><article key={r.id}><div><strong>{r.name}</strong><small>{r.result.formula}</small><span>Кости: [{r.result.rolls.join(', ')}]</span></div><b>{r.result.total}</b></article>)}{!rolls.length&&<p>Здесь появятся три последних броска.</p>}</section></aside>;
}
