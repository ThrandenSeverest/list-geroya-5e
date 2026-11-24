'use client';
import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Body,Vec3 as PhysicsVec3} from 'cannon-es';
import type {Vec3} from './diceScreenMath';
import {diceRenderPixelRatio} from './diceScreenMotion';
import {screenDieSize} from './diceScreenPhysics';
import {DiceTable,DICE_UNIT,physicalFaceValue,vertexValue,bottomFace,launchManualDie,type PhysicalDie} from './diceRigidPhysics';
import {playDiceAudio} from './diceAudio';
import './dice-screen.css';
export type ScreenRoll={id:string;sides:number[]};
export type HeldDiceRoll={id:string;sides:number[];x:number;y:number;angle:number};
export type ManualDiceThrow=HeldDiceRoll & {vx:number;vy:number;spin:number};
export type ScreenRollWithThrow=ScreenRoll & {manual?:ManualDiceThrow};
export type DiceScreenOptions={enabled:boolean;color:string;lifetime:number;numberColor:string;numberStyle:'classic'|'modern'|'mono';size:number;numberScale:number;d4Mode:'vertex'|'face';d4Label:boolean;sound:boolean;volume:number};
type MovingDie=PhysicalDie & {rollId:string;originalIndex:number};
type Point2=[number,number];
const clamp=(n:number,a=0,b=1)=>Math.min(b,Math.max(a,n));
const random=()=>{const a=new Uint32Array(1);crypto.getRandomValues(a);return a[0]/4294967296;};
const add=(a:Vec3,b:Vec3):Vec3=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const sub=(a:Vec3,b:Vec3):Vec3=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const cross=(a:Vec3,b:Vec3):Vec3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a:Vec3,b:Vec3)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const normalize=(v:Vec3):Vec3=>{
  const length=Math.hypot(...v)||1;
  return [v[0]/length,v[1]/length,v[2]/length];
};
const average=(points:Vec3[]):Vec3=>{
  const n=points.length||1;
  return points.reduce<Vec3>((p,v)=>[p[0]+v[0]/n,p[1]+v[1]/n,p[2]+v[2]/n],[0,0,0]);
};
function rgb(input:string):number[]{
  const color=/^#[\da-f]{6}$/i.test(input)?input:'#332c27';
  return [1,3,5].map(i=>parseInt(color.slice(i,i+2),16));
}
const shade=(color:number[],brightness:number)=>
  'rgb('+color.map(n=>Math.round(clamp(n*brightness,0,255))).join(',')+')';
function polygon(ctx:CanvasRenderingContext2D,points:Point2[]){
  ctx.beginPath();
  points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));
  ctx.closePath();
}
function faceInradius(points:Point2[],center:Point2){
  let result=Infinity;
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length];
    const dx=b[0]-a[0],dy=b[1]-a[1];
    const length=Math.hypot(dx,dy)||1;
    result=Math.min(result,Math.abs(dx*(center[1]-a[1])-dy*(center[0]-a[0]))/length);
  }
  return result;
}
function faceNumber(die:MovingDie,face:number){
 const value=physicalFaceValue(die.sides,face);
 return die.numbering==='tens'?String((value-1)*10).padStart(2,'0'):die.numbering==='units'?String(value-1):String(value);
}
function renderFaceNumber(
  ctx:CanvasRenderingContext2D,
  die:MovingDie,
  face:{vertices:number[];normal:Vec3},
  faceIndex:number,
  faceCount:number,
  vertices:Vec3[],
  transform:(v:Vec3)=>Vec3,
  project:(v:Vec3)=>Point2,
  scale:number,
  inradius:number,
  numberColor:string,numberStyle:DiceScreenOptions['numberStyle'],numberScale:number,textOverride?:string,anchor?:Vec3
){
  const center=anchor??average(face.vertices.map(i=>vertices[i]));
  const point=project(center);
  const a=face.vertices[0],b=face.vertices[1];
  const u=normalize(sub(vertices[b],vertices[a]));
  // Already transformed vertices define an intrinsic face direction.
  const normal=normalize(transform(face.normal));
  const v=normalize(cross(normal,u));
  const unitX=project(add(center,u));
  const unitY=project(add(center,v));
  const right:Point2=[(unitX[0]-point[0])/scale,(unitX[1]-point[1])/scale];
  const down:Point2=[(unitY[0]-point[0])/scale,(unitY[1]-point[1])/scale];
  if(Math.abs(right[0]*down[1]-right[1]*down[0])<.09)return;
  const text=textOverride??faceNumber(die,faceIndex);
  const fontSize=Math.max(10,Math.min(die.size*(textOverride!==undefined ? .22 : .41),inradius*(text.length>1?1.18:1.5)));
  ctx.save();
  // Text is physically attached to the face's plane. No screen-upright labels.
  ctx.translate(point[0],point[1]);
  ctx.transform(right[0],right[1],down[0],down[1],0,0);
  ctx.fillStyle=numberColor;
  const font=numberStyle==='modern'?'Arial,sans-serif':numberStyle==='mono'?'ui-monospace,Consolas,monospace':'Georgia,serif';
  ctx.font=(numberStyle==='classic'?'italic 700 ':numberStyle==='mono'?'400 ':'900 ')+(fontSize*numberScale).toFixed(1)+'px '+font;
  ctx.textAlign='center';
  ctx.textBaseline='middle';
  ctx.fillText(text,0,0,Math.max(13,inradius*1.75));
  ctx.restore();
}

function renderDie(ctx:CanvasRenderingContext2D,die:MovingDie,options:DiceScreenOptions,alpha:number){
 const {body,size,mesh}=die;
 const x=body.position.x*DICE_UNIT+10,groundY=body.position.y*DICE_UNIT+10;
 const lift=body.position.z*DICE_UNIT;
 const y=groundY-lift*.34;
 const inverted=die.sides===4&&options.d4Mode==='face'?-1:1;
 const transform=(v:Vec3):Vec3=>{const p=body.quaternion.vmult(new PhysicsVec3(v[0]*inverted,v[1]*inverted,v[2]*inverted));return [p.x,p.y*.94-p.z*.34,p.y*.34+p.z*.94];};
 const transformed=mesh.vertices.map(transform),maxRadius=Math.max(...mesh.vertices.map(v=>Math.hypot(...v))),scale=size/maxRadius;
 const project=(v:Vec3):Point2=>[x+v[0]*scale,y+v[1]*scale];
 const color=rgb(options.color);
 ctx.save();ctx.globalAlpha=alpha;
 ctx.fillStyle='rgba(0,0,0,.20)';ctx.beginPath();ctx.ellipse(x,groundY,size*.72,size*.25,0,0,Math.PI*2);ctx.fill();
 const faces=mesh.faces.map((face,index)=>{const points=face.vertices.map(i=>transformed[i]);return {face,index,points,normal:normalize(transform(face.normal)),center:average(points)};}).filter(f=>f.normal[2]>.01).sort((a,b)=>a.center[2]-b.center[2]);
 for(const f of faces){
  const points=f.points.map(project),center=project(f.center);polygon(ctx,points);
  const light=.65+.32*f.normal[2]+.18*Math.max(0,-f.normal[0]);
  ctx.fillStyle=shade(color,light);ctx.fill();ctx.strokeStyle='#d4b57b';ctx.lineWidth=Math.max(1,size/60);ctx.lineJoin='round';ctx.stroke();
  if(f.normal[2]<.18)continue;
  const inradius=faceInradius(points,center);
  if(die.sides===4&&options.d4Mode==='vertex'){
   for(const index of f.face.vertices){const v=transformed[index],at=v.map((n,i)=>n*.60+f.center[i]*.40) as Vec3;
    renderFaceNumber(ctx,die,f.face,f.index,mesh.faces.length,transformed,transform,project,scale,Math.max(8,inradius*.7),options.numberColor,options.numberStyle,options.numberScale,String(vertexValue(die,index)),at);
   }
  }else renderFaceNumber(ctx,die,f.face,f.index,mesh.faces.length,transformed,transform,project,scale,inradius,options.numberColor,options.numberStyle,options.numberScale);
 }
 if(die.sides===4&&die.settled&&options.d4Label){ctx.font='700 '+Math.round(size*.4)+'px '+(options.numberStyle==='modern'?'Arial,sans-serif':options.numberStyle==='mono'?'monospace':'Georgia,serif');ctx.textAlign='center';ctx.textBaseline='top';ctx.fillStyle=options.numberColor;ctx.fillText(String(die.value),x,groundY+size*.85);}
 ctx.restore();
}
export function DiceScreenOverlay({rolls,held,options,onComplete,onExpire}:{rolls:ScreenRollWithThrow[];held:HeldDiceRoll|null;options:DiceScreenOptions;onComplete:(id:string,values:number[])=>void;onExpire:(id:string)=>void}){
 const [portal,setPortal]=useState<HTMLElement|null>(null);
 const canvas=useRef<HTMLCanvasElement>(null),table=useRef<DiceTable|null>(null);
 const batches=useRef(new Map<string,{roll:ScreenRollWithThrow;dice:MovingDie[];completedAt?:number}>());
 const preview=useRef<{id:string;dice:MovingDie[]}|null>(null);
 const props=useRef({rolls,held,options,onComplete,onExpire});props.current={rolls,held,options,onComplete,onExpire};
 useEffect(()=>setPortal(document.body),[]);
 useEffect(()=>{
  if(!portal)return;
  let frame:number,last=0,accumulator=0;
  const tick=(now:number)=>{
   const node=canvas.current,ctx=node?.getContext('2d');if(!node||!ctx){frame=requestAnimationFrame(tick);return;}
   const {rolls:current,held:holding,options:opts,onComplete:complete,onExpire:expire}=props.current;
   const width=Math.max(120,Math.min(window.innerWidth,window.visualViewport?.width||window.innerWidth));
   const height=Math.max(160,Math.min(window.innerHeight,window.visualViewport?.height||window.innerHeight));
   const w=width-20,h=height-(width<700?100:40);
   if(!table.current)table.current=new DiceTable(w,h);
   const sim=table.current;if(sim.width!==w||sim.height!==h)sim.resize(w,h);
   const size=Math.max(6,Math.min(screenDieSize(width,height)*opts.size,Math.min(w,h)*.18));
   if(holding&&opts.enabled&&preview.current?.id!==holding.id){
    const dice:MovingDie[]=[];
    holding.sides.forEach((s,index)=>{for(const numbering of s===100?['tens','units'] as const:['regular'] as const){
     const d=sim.add(holding.id+':'+dice.length,s===100?10:s,size,random,numbering,dice.length) as MovingDie;
     d.rollId=holding.id;d.originalIndex=index;dice.push(d);
     sim.dice.pop(); // A held die is rendered but is not yet in the physics world.
    }});
    preview.current={id:holding.id,dice};
   }
   if(holding&&preview.current?.id===holding.id){
    preview.current.dice.forEach((d,i)=>{
     const spread=Math.min(d.size*.45,12),theta=i*2.39996;
     d.body.position.set(clamp((holding.x+Math.cos(theta)*spread-10)/DICE_UNIT,d.size/DICE_UNIT,w-d.size/DICE_UNIT),clamp((holding.y+Math.sin(theta)*spread-10)/DICE_UNIT,d.size/DICE_UNIT,h-d.size/DICE_UNIT),d.size/DICE_UNIT*1.8);
     d.body.quaternion.setFromEuler(holding.angle+i*.37,holding.angle*.7+i*.59,holding.angle*.4+i*.81);
    });
   }
   const ids=new Set(current.map(r=>r.id));
   for(const [id,b] of batches.current)if(!ids.has(id)){b.dice.forEach(d=>sim.remove(d.id));batches.current.delete(id);}
   for(const roll of current){
    if(batches.current.has(roll.id))continue;
    // Retire completed older throws if they would crowd a new throw.
    const count=roll.sides.reduce((n,s)=>n+(s===100?2:1),0);
    if(sim.dice.length+count>(width<700?24:40))for(const [id,b] of batches.current)if(b.completedAt!==undefined){b.dice.forEach(d=>sim.remove(d.id));batches.current.delete(id);expire(id);}
    const items:MovingDie[]=[];
    if(roll.manual&&preview.current?.id===roll.id){items.push(...preview.current.dice);preview.current=null;sim.dice.push(...items);}
    else roll.sides.forEach((s,index)=>{
     const parts=s===100?['tens','units'] as const:['regular'] as const;
     for(const numbering of parts){const d=sim.add(roll.id+':'+items.length,s===100?10:s,size,random,numbering,items.length) as MovingDie;d.rollId=roll.id;d.originalIndex=index;items.push(d);}
    });
    if(roll.manual)items.forEach((d,i)=>launchManualDie(d,roll.manual!,w,h,i));
    batches.current.set(roll.id,{roll,dice:items});
   }
   if(!holding&&preview.current&&!current.some(r=>r.id===preview.current!.id))preview.current=null;
   const dt=last?Math.min(.1,(now-last)/1000):0;last=now;accumulator+=dt;
   while(accumulator>=1/120){if(sim.dice.length)sim.step(1/120);accumulator-=1/120;}
   let impact=0;for(const d of sim.dice){impact=Math.max(impact,d.lastImpact);d.lastImpact=0;}if(opts.sound&&impact>2.5)playDiceAudio(opts.volume,Math.min(1,impact/13));
   for(const [id,b] of batches.current){
    if(b.completedAt===undefined&&b.dice.every(d=>d.settled)){
     b.completedAt=now;
     for(const d of b.dice){d.body.type=Body.STATIC;d.body.mass=0;d.body.updateMassProperties();}
     const values=b.roll.sides.map((s,i)=>{const parts=b.dice.filter(d=>d.originalIndex===i);return s===100?(parts.reduce((n,d)=>n+d.value!,0)||100):parts[0].value!;});
     complete(id,values);
    }
    if(b.completedAt!==undefined&&now-b.completedAt>opts.lifetime*1000+350){b.dice.forEach(d=>sim.remove(d.id));batches.current.delete(id);expire(id);}
   }
   const ratio=diceRenderPixelRatio(width,height,window.devicePixelRatio||1);
   node.style.zoom=String(1/(parseFloat(getComputedStyle(document.body).zoom)||1));node.style.width=width+'px';node.style.height=height+'px';
   if(node.width!==Math.round(width*ratio)||node.height!==Math.round(height*ratio)){node.width=Math.round(width*ratio);node.height=Math.round(height*ratio);}
   ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,width,height);
   for(const b of batches.current.values()){const alpha=b.completedAt===undefined?1:clamp((opts.lifetime*1000+350-(now-b.completedAt))/350);for(const d of b.dice)if(d.launched)renderDie(ctx,d,opts,alpha);}
   if(holding&&preview.current?.id===holding.id)for(const d of preview.current.dice)renderDie(ctx,d,opts,1);
   node.dataset.diceEngine='physical-outcome-v9';node.dataset.numberColor=opts.numberColor;node.dataset.numberStyle=opts.numberStyle;
   if(window.location.pathname.includes('/dice-lab'))node.dataset.diceState=JSON.stringify(sim.dice.map(d=>({id:d.id,sides:d.sides,numbering:d.numbering,x:d.body.position.x*DICE_UNIT+10,y:d.body.position.y*DICE_UNIT+10,modelSize:d.size,entered:d.entered,settled:d.settled,value:d.value,flat:bottomFace(d).alignment,orientation:[d.body.quaternion.x,d.body.quaternion.y,d.body.quaternion.z,d.body.quaternion.w],labels:d.mesh.faces.map((_,i)=>physicalFaceValue(d.sides,i))})));
   frame=requestAnimationFrame(tick);
  };
  frame=requestAnimationFrame(tick);return()=>{cancelAnimationFrame(frame);table.current=null;batches.current.clear();preview.current=null;};
 },[portal]);
 return portal?createPortal(<canvas ref={canvas} className="hero-screen-dice" aria-hidden="true"/>,portal):null;
}
