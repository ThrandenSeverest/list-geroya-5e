'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { DiceResult } from './adventure';
import { diceFromResult, diceMesh, type Vec3 } from './diceScreenMath';
import { diceRenderPixelRatio } from './diceScreenMotion';
import { spawnScreenDie, screenDieSize, screenDieRadius, stepScreenDice, type DiceBody } from './diceScreenPhysics';
import './dice-screen.css';

export type ScreenRoll = { id: string; name: string; result: DiceResult };
export type DiceScreenOptions = { enabled: boolean; color: string; lifetime: number; numberColor: string; numberStyle: 'classic' | 'modern' | 'mono' };
type Numbering = 'regular' | 'tens' | 'units';
type MovingDie = {
  id: string; rollId: string; sides: number; value: number; numbering: Numbering;
  born: number; seed: number; size: number; faceIndex: number; anchorFaceIndex: number; settled: boolean; body: DiceBody;
};
type Point2 = [number, number];

const FLIGHT_MS = 1900;
const FADE_MS = 350;
const clamp=(n:number,a=0,b=1)=>Math.min(b,Math.max(a,n));
const hash=(text:string)=>{
  let hash=2166136261;
  for(let i=0;i<text.length;i++)hash=Math.imul(hash^text.charCodeAt(i),16777619);
  // Avalanche the hash so adjacent dice IDs do not produce correlated directions.
  hash^=hash>>>16;hash=Math.imul(hash,0x7feb352d);
  hash^=hash>>>15;hash=Math.imul(hash,0x846ca68b);
  hash^=hash>>>16;
  return (hash>>>0)/4294967295;
};
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
const rotate=(v:Vec3,rx:number,ry:number,rz:number):Vec3=>{
  const [x,y,z]=v;
  const y1=y*Math.cos(rx)-z*Math.sin(rx), z1=y*Math.sin(rx)+z*Math.cos(rx);
  const x2=x*Math.cos(ry)+z1*Math.sin(ry), z2=-x*Math.sin(ry)+z1*Math.cos(ry);
  return [x2*Math.cos(rz)-y1*Math.sin(rz),x2*Math.sin(rz)+y1*Math.cos(rz),z2];
};
/** Rodrigues rotation aligns the selected physical face toward the viewer. */
function alignFace(v:Vec3,normal:Vec3):Vec3 {
  const axis=cross(normal,[0,0,1]), c=clamp(dot(normal,[0,0,1]),-1,1);
  const s=Math.hypot(...axis);
  if(s<1e-7)return c>0?v:[v[0],-v[1],-v[2]];
  const k=normalize(axis),p=cross(k,v),d=dot(k,v);
  return [v[0]*c+p[0]*s+k[0]*d*(1-c),v[1]*c+p[1]*s+k[1]*d*(1-c),v[2]*c+p[2]*s+k[2]*d*(1-c)];
}
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
/** Map every face to a stable natural value, including 00/90 on percentile tens. */
function faceNumber(die:MovingDie,face:number,faceCount:number){
  const actual=die.numbering==='tens'?Math.round(die.value/10)
    :die.numbering==='units'?die.value:die.value-1;
  const digit=((face-die.faceIndex+actual)%faceCount+faceCount)%faceCount;
  if(die.numbering==='tens')return String(digit*10).padStart(2,'0');
  if(die.numbering==='units')return String(digit);
  return String(digit+1);
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
  numberColor:string,numberStyle:DiceScreenOptions['numberStyle']
){
  const center=average(face.vertices.map(i=>vertices[i]));
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
  const text=faceNumber(die,faceIndex,faceCount);
  const fontSize=Math.max(10,Math.min(die.size*.41,inradius*(text.length>1?1.18:1.5)));
  ctx.save();
  // Text is physically attached to the face's plane. No screen-upright labels.
  ctx.translate(point[0],point[1]);
  ctx.transform(right[0],right[1],down[0],down[1],0,0);
  ctx.fillStyle=numberColor;
  const font=numberStyle==='modern'?'Arial,sans-serif':numberStyle==='mono'?'ui-monospace,Consolas,monospace':'Georgia,serif';
  ctx.font='700 '+fontSize.toFixed(1)+'px '+font;
  ctx.textAlign='center';
  ctx.textBaseline='middle';
  ctx.fillText(text,0,0,Math.max(13,inradius*1.75));
  ctx.restore();
}

function renderDie(
  ctx:CanvasRenderingContext2D,
  die:MovingDie,now:number,
  width:number,height:number,color:number[],hold:number,numberColor:string,numberStyle:DiceScreenOptions['numberStyle']
){
  const elapsed=now-die.born;
  if(elapsed>=FLIGHT_MS+hold+FADE_MS)return;
  const fade=clamp((FLIGHT_MS+hold+FADE_MS-elapsed)/FADE_MS);
  const {x,y:groundY}=die.body;
  // The underlying collision position stays fixed; only the die lifts briefly.
  const hop=Math.min(14,Math.max(0,die.body.hopHeight||0));
  const y=groundY-hop;
  const mesh=diceMesh(die.sides);
  ctx.save();
  ctx.globalAlpha=fade;
  const landed=1;
  // Contact shadow is on the ground, never on the digits.
  if(landed>0){
    ctx.save();
    ctx.globalAlpha=fade*.22*landed*(1-hop/24);
    ctx.fillStyle='#000';
    ctx.beginPath();
    ctx.ellipse(x,groundY+die.size*.72,die.size*.67+hop*.14,die.size*.18+hop*.04,0,0,Math.PI*2);
    ctx.fill();
    ctx.restore();
  }
  // Spin is integrated by physics using each die's actual travel speed.
  // Unsupported custom dice retain their final 2D rotation.
  const tumble=die.body.spin||0;
  const wrapAngle=(angle:number)=>Math.atan2(Math.sin(angle),Math.cos(angle));
  const twist=die.seed*Math.PI*2;
  if(!mesh){
    // A nonstandard user-defined die never gets silently replaced by a d20.
    const points:Point2[]=[];
    for(let i=0;i<8;i++){
      const angle=2*Math.PI*i/8+twist+wrapAngle(tumble*.9);
      points.push([x+Math.cos(angle)*die.size*.94,y+Math.sin(angle)*die.size*.94]);
    }
    polygon(ctx,points);
    const gradient=ctx.createLinearGradient(x-die.size,y-die.size,x+die.size,y+die.size);
    gradient.addColorStop(0,shade(color,1.38));
    gradient.addColorStop(.6,shade(color,1.03));
    gradient.addColorStop(1,shade(color,.68));
    ctx.fillStyle=gradient;ctx.fill();
    ctx.strokeStyle='#e5c68b';ctx.lineWidth=2;ctx.stroke();
    ctx.save();ctx.translate(x,y);ctx.rotate(twist+wrapAngle(tumble*.9));
    ctx.fillStyle=numberColor;ctx.font='700 '+Math.round(die.size*.51)+'px '+(numberStyle==='modern'?'Arial,sans-serif':numberStyle==='mono'?'ui-monospace,Consolas,monospace':'Georgia,serif');
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(String(die.value),0,-die.size*.09,die.size*1.38);
    ctx.font='600 '+Math.round(die.size*.21)+'px Georgia,serif';
    ctx.fillText('d'+die.sides,0,die.size*.5);
    ctx.restore();ctx.restore();return;
  }
  const selected=mesh.faces[die.anchorFaceIndex%mesh.faces.length];
  // Keep the physical orientation even after the die stops. Blending the
  // quaternion toward identity made the die roll backward after landing.
  const q=die.body.orientation??[0,0,0,1];
  const transform=(v:Vec3):Vec3=>{
    const base=rotate(alignFace(v,selected.normal),.10,-.10,twist);
    const u:Vec3=[q[0],q[1],q[2]];
    const uv=cross(u,base),uuv=cross(u,uv);
    return add(base,add(uv.map(n=>2*q[3]*n) as Vec3,uuv.map(n=>2*n) as Vec3));
  };
  if(die.settled && Math.hypot(die.body.vx,die.body.vy)>0)die.settled=false;
  if(!die.settled && die.body.entered && Math.hypot(die.body.vx,die.body.vy)===0 && !(die.body.hopVelocity||0)) {
    // The face that actually ends on top carries the predetermined result.
    // Changing the face's label never rotates or repositions the stopped die.
    let highest=-Infinity;
    mesh.faces.forEach((face,index)=>{const height=transform(face.normal)[2];if(height>highest){highest=height;die.faceIndex=index;}});
    die.settled=true;
  }
  const transformed=mesh.vertices.map(transform);
  const maxRadius=Math.max(...mesh.vertices.map(v=>Math.hypot(...v)))||1;
  const scale=die.size/maxRadius;
  const project=(v:Vec3):Point2=>{
    // Slight perspective gives depth without a low-res bitmap.
    const perspective=4.7/(4.7-v[2]);
    return [x+v[0]*scale*perspective,y+v[1]*scale*perspective];
  };
  const faces=mesh.faces.map((face,index)=>{
    const points=face.vertices.map(i=>transformed[i]);
    const normal=normalize(transform(face.normal));
    const center=average(points);
    return {face,index,normal,center,points};
  }).filter(face=>face.normal[2]>.018).sort((a,b)=>a.center[2]-b.center[2]);
  for(const f of faces){
    const points=f.points.map(project);
    const center=project(f.center);
    polygon(ctx,points);
    const light=.70+.22*Math.max(0,f.normal[2])+.16*Math.max(0,-f.normal[0]*.65+f.normal[1]*.45);
    const gradient=ctx.createLinearGradient(x-die.size*.85,y-die.size*.85,x+die.size*.85,y+die.size*.85);
    gradient.addColorStop(0,shade(color,light*1.28));
    gradient.addColorStop(.5,shade(color,light*1.04));
    gradient.addColorStop(1,shade(color,light*.81));
    ctx.fillStyle=gradient;
    ctx.fill();
    ctx.strokeStyle='rgba(239,205,146,.94)';
    ctx.lineWidth=Math.max(1.1,die.size/59);
    ctx.lineJoin='round';
    ctx.stroke();
    // Fine inset edge highlight to give thickness without shadowing text.
    ctx.save();
    ctx.clip();
    ctx.strokeStyle='rgba(255,237,197,.12)';
    ctx.lineWidth=Math.max(2,die.size*.047);
    ctx.stroke();
    ctx.restore();
    if(f.normal[2]<.19)continue;
    const inradius=faceInradius(points,center);
    if(inradius<5)continue;
    renderFaceNumber(ctx,die,f.face,f.index,mesh.faces.length,transformed,transform,project,scale,inradius,numberColor,numberStyle);
  }
  ctx.restore();
}

/** Each new throw uses its own trajectory; existing dice never get re-laid out. */
export function DiceScreenOverlay({
  rolls,options,onExpire
}:{rolls:ScreenRoll[];options:DiceScreenOptions;onExpire:(id:string)=>void;}){
  const [portal,setPortal]=useState<HTMLElement|null>(null);
  const canvas=useRef<HTMLCanvasElement>(null);
  const dice=useRef(new Map<string,MovingDie>());
  const started=useRef(new Map<string,number>());
  const props=useRef({options,onExpire});
  const raf=useRef<number|null>(null);
  const lastFrame=useRef<number|null>(null);
  const frame=useRef<(now:number)=>void>(()=>{});
  props.current={options,onExpire};
  const requestFrame=()=>{
    if(raf.current===null)raf.current=requestAnimationFrame(time=>frame.current(time));
  };
  useEffect(()=>setPortal(document.body),[]);
  useEffect(()=>{
    const now=performance.now();
    const active=new Set(rolls.map(roll=>roll.id));
    for(const key of started.current.keys())if(!active.has(key))started.current.delete(key);
    for(const [key,die] of dice.current)if(!active.has(die.rollId))dice.current.delete(key);
    for(const roll of rolls){
      if(started.current.has(roll.id))continue;
      started.current.set(roll.id,now);
      const all=diceFromResult(roll.result).flatMap(die=>
        die.sides===100?[
          {sides:10,value:die.value===100?0:Math.floor(die.value/10)*10,numbering:'tens' as Numbering},
          {sides:10,value:die.value===100?0:die.value%10,numbering:'units' as Numbering}
        ]:[{...die,numbering:'regular' as Numbering}]
      );
      // Repeated test throws must not turn the screen into a packed, regular lattice.
      // Keep every die from the *current* formula; retire only oldest previous
      // throws when the display becomes too crowded to collide naturally.
      const maxVisible=window.innerWidth<700?24:36;
      while(dice.current.size+all.length>maxVisible) {
        const oldest=[...started.current.keys()].find(id=>id!==roll.id);
        if(!oldest)break;
        started.current.delete(oldest);
        for(const [key,die] of dice.current)if(die.rollId===oldest)dice.current.delete(key);
        props.current.onExpire(oldest);
      }
      for(let i=0;i<all.length;i++){
        const id=roll.id+':'+i,seed=hash(id+'|orientation');
        const die=all[i];
        const faces=diceMesh(die.sides)?.faces.length||8;
        const width=Math.max(1,Math.min(window.innerWidth,document.documentElement.clientWidth||window.innerWidth,window.visualViewport?.width||window.innerWidth));
        const height=Math.max(1,Math.min(window.innerHeight,window.visualViewport?.height||window.innerHeight));
        const size=screenDieSize(width,height);
        const radius=screenDieRadius(size);
        const body=spawnScreenDie({
          id,width,height,radius,
          seed:hash(id+'|speed'),seedY:hash(id+'|lane'),
          seedAngle:hash(id+'|angle'),seedDelay:hash(id+'|delay'),
          seedSpin:hash(id+'|spin'),index:i
        });
        dice.current.set(id,{
          ...die,id,rollId:roll.id,born:now,seed,size,body,
          faceIndex:Math.floor(hash(id+'face')*faces),anchorFaceIndex:Math.floor(hash(id+'face')*faces),settled:false
        });
      }
    }
    if(dice.current.size)requestFrame();
  },[rolls]);
  useEffect(()=>{
    frame.current=(now:number)=>{
      raf.current=null;
      const node=canvas.current;
      const {options:opts,onExpire:expire}=props.current;
      if(node){
        const ctx=node.getContext('2d',{alpha:true});
        if(ctx){
          // CSS canvas boxes can differ from the actual visual viewport due to
          // zoom/scrollbars; physics must never use that larger rectangle.
          const width=Math.max(1,Math.min(
            window.innerWidth,
            document.documentElement.clientWidth||window.innerWidth,
            window.visualViewport?.width||window.innerWidth
          ));
          const height=Math.max(1,Math.min(
            window.innerHeight,
            window.visualViewport?.height||window.innerHeight
          ));
          // HeroList uses body { zoom: 1.25 } on desktop. Fixed descendants
          // inherit that magnification; counter it for viewport-sized dice only.
          // Never alter the user's UI zoom preference.
          const bodyZoom=parseFloat(getComputedStyle(document.body).zoom)||1;
          node.style.zoom=String(1/bodyZoom);
          // Match the *physical* viewport exactly: never CSS-stretch the backing buffer.
          node.style.width=width+'px';
          node.style.height=height+'px';
          node.style.left='0px';
          node.style.top='0px';
          const dt=lastFrame.current===null?0:clamp((now-lastFrame.current)/1000,0,.055);
          lastFrame.current=now;
          if(opts.enabled&&dt>0){
            const bodies=[...dice.current.values()].map(d=>d.body);
            const steps=Math.max(1,Math.ceil(dt/(1/90)));
            for(let i=0;i<steps;i++)stepScreenDice(bodies,width,height,dt/steps);
          }
          const ratio=diceRenderPixelRatio(width,height,window.devicePixelRatio||1);
          const pixelsW=Math.round(width*ratio),pixelsH=Math.round(height*ratio);
          if(node.width!==pixelsW||node.height!==pixelsH){
            node.width=pixelsW;node.height=pixelsH;
          }
          ctx.setTransform(ratio,0,0,ratio,0,0);
          ctx.imageSmoothingEnabled=true;
          ctx.imageSmoothingQuality='high';
          ctx.clearRect(0,0,width,height);
          node.dataset.diceEngine='wood-contact-rolling-v8';
          node.dataset.numberStyle=opts.numberStyle;
          node.dataset.numberColor=opts.numberColor;
          if(window.location.pathname.includes('/dice-lab')){
            node.dataset.diceState=JSON.stringify([...dice.current.values()].map(d=>({
              id:d.id,x:d.body.x,y:d.body.y,radius:d.body.radius,
              entered:d.body.entered,modelSize:d.size,vx:d.body.vx,vy:d.body.vy,
              launchDelay:d.body.launchDelay||0,spin:d.body.spin||0,
              spinVelocity:d.body.spinVelocity||0,hopHeight:d.body.hopHeight||0,
              age:d.body.age||0,orientation:d.body.orientation,faceIndex:d.faceIndex,settled:d.settled
            })));
          }
          if(opts.enabled){
            const color=rgb(opts.color);
            const hold=clamp(opts.lifetime,0,30)*1000;
            for(const die of dice.current.values())renderDie(ctx,die,now,width,height,color,hold,/^#[0-9a-f]{6}$/i.test(opts.numberColor)?opts.numberColor:'#fff0c8',opts.numberStyle);
            for(const [id,born] of started.current){
              if(now-born<FLIGHT_MS+hold+FADE_MS)continue;
              started.current.delete(id);
              for(const [key,die] of dice.current)if(die.rollId===id)dice.current.delete(key);
              expire(id);
            }
          }
        }
      }
      if(dice.current.size&&opts.enabled)requestFrame();
    };
    if(dice.current.size)requestFrame();
    return()=>{if(raf.current!==null)cancelAnimationFrame(raf.current);raf.current=null;lastFrame.current=null;};
  },[]);
  useEffect(()=>{
    if(options.enabled&&dice.current.size)requestFrame();
    if(!options.enabled){
      dice.current.clear();
      started.current.clear();
      lastFrame.current=null;
      const node=canvas.current,ctx=node?.getContext('2d');
      if(node&&ctx)ctx.clearRect(0,0,node.width,node.height);
    }
  },[options.enabled,options.color,options.lifetime,options.numberColor,options.numberStyle]);
  return portal?createPortal(
    <canvas ref={canvas} className="hero-screen-dice" aria-hidden="true"
      style={{display:options.enabled?'block':'none'}}/>,portal
  ):null;
}
