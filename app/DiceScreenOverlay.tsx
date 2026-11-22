'use client';
import { useEffect, useRef } from 'react';
import type { DiceResult } from './adventure';
import { diceFromResult, diceMesh, type Vec3 } from './diceScreenMath';
import './dice-screen.css';

export type ScreenRoll = { id: string; name: string; result: DiceResult };
export type DiceScreenOptions = { enabled: boolean; color: string; lifetime: number };

type MovingDie = {
  id: string; sides: number; value: number; suffix?: string;
  born: number; x: number; y: number; seed: number; size: number;
};
const FLIGHT = 1220;
const FADE = 350;
const lerp = (a:number,b:number,t:number) => a+(b-a)*t;
const clamp = (n:number,a=0,b=1)=>Math.max(a,Math.min(b,n));
const hash = (s:string) => {
  let h=2166136261;
  for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);
  return (h>>>0)/4294967295;
};
const cross = (a:Vec3,b:Vec3):Vec3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a:Vec3,b:Vec3)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const normalize=(a:Vec3):Vec3=>{const n=Math.hypot(...a)||1;return[a[0]/n,a[1]/n,a[2]/n];};
const average=(vs:Vec3[]):Vec3=>vs.reduce<Vec3>((sum,p)=>[sum[0]+p[0]/vs.length,sum[1]+p[1]/vs.length,sum[2]+p[2]/vs.length],[0,0,0]);
const rotate=(v:Vec3, ax:number,ay:number,az:number):Vec3=>{
  const [x,y,z]=v;
  const y1=y*Math.cos(ax)-z*Math.sin(ax),z1=y*Math.sin(ax)+z*Math.cos(ax);
  const x2=x*Math.cos(ay)+z1*Math.sin(ay),z2=-x*Math.sin(ay)+z1*Math.cos(ay);
  return[x2*Math.cos(az)-y1*Math.sin(az),x2*Math.sin(az)+y1*Math.cos(az),z2];
};
function alignFace(v:Vec3,normal:Vec3):Vec3 {
  // Rodrigues rotation, exactly aligning the chosen face normal with the camera.
  const to:Vec3=[0,0,1], axis=cross(normal,to), c=clamp(dot(normal,to),-1,1);
  const s=Math.hypot(...axis);
  if(s<1e-6)return c>0?v:[v[0],-v[1],-v[2]];
  const k=normalize(axis),p=cross(k,v),d=dot(k,v);
  return [v[0]*c+p[0]*s+k[0]*d*(1-c),v[1]*c+p[1]*s+k[1]*d*(1-c),v[2]*c+p[2]*s+k[2]*d*(1-c)];
}
function rgb(color:string):number[] {
  const h=/^#[0-9a-f]{6}$/i.test(color)?color:'#332c27';
  return [1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
}
function shade(color:number[],scale:number):string {
  return 'rgb('+color.map(channel=>Math.round(clamp(channel*scale,0,255))).join(',')+')';
}
function poly(ctx:CanvasRenderingContext2D,points:[number,number][]) {
  ctx.beginPath();
  points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));
  ctx.closePath();
}
function position(die:MovingDie,now:number,w:number,h:number) {
  const t=clamp((now-die.born)/FLIGHT);
  const mobile=w<700;
  const sx=w*(.24+die.seed*.52);
  const ex=w*(.13+die.x*.74);
  const ey=h*(.22+die.y*.55);
  // Vertical throw, damped single bounce. Ends at exactly the same absolute coordinates.
  const bounce=t>.78?Math.sin((t-.78)/.22*Math.PI)*Math.pow(1-t,1.4)*38:0;
  return {
    x:lerp(sx,ex,1-Math.pow(1-t,3)),
    y:ey-(1-t)*(1-t)*Math.min(h*.65,480)-bounce,
    size:Math.max(mobile?20:26,Math.min(mobile?43:56,die.size)),
    t,
  };
}
function draw(ctx:CanvasRenderingContext2D,die:MovingDie,now:number,w:number,h:number,color:number[],hold:number) {
  const elapsed=now-die.born;
  const fade=clamp((FLIGHT+hold+FADE-elapsed)/FADE);
  if(fade<=0)return;
  const {x,y,size,t}=position(die,now,w,h);
  const mesh=diceMesh(die.sides);
  const spin=Math.pow(1-t,2)*(Math.PI*5.5+die.seed*Math.PI*3);
  const ax=.3+spin*.75,ay=.24+spin,az=(die.seed-.5)*.25+spin*.15;
  const angle=Math.pow(1-t,2)*Math.PI*3;
  const cx=x,cy=y;
  ctx.save();
  ctx.globalAlpha=fade;
  if(!mesh){
    // Preserve nonstandard formula types without making up a different die.
    const count=die.sides>100?10:die.sides;
    const points:[number,number][]=[];
    for(let i=0;i<count;i++){const th=Math.PI*2*i/count+angle;points.push([cx+Math.cos(th)*size*.85,cy+Math.sin(th)*size*.85]);}
    poly(ctx,points);
    ctx.fillStyle=shade(color,1.07);ctx.fill();
    ctx.strokeStyle='#dec48e';ctx.lineWidth=1.5;ctx.stroke();
    ctx.fillStyle='#f7e9c9';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='700 '+Math.round(size*.47)+'px Georgia,serif';
    ctx.fillText(String(die.value),cx,cy-4);
    ctx.font='600 '+Math.round(size*.20)+'px Georgia,serif';ctx.fillText('d'+die.sides,cx,cy+size*.48);
    ctx.restore();return;
  }
  const face=mesh.faces[Math.floor(die.seed*mesh.faces.length)%mesh.faces.length];
  const r=Math.max(...mesh.vertices.map(p=>Math.hypot(...p)))||1;
  const scale=size/r;
  const transform=(v:Vec3)=>rotate(alignFace(v,face.normal),ax*(1-t)*(1-t),ay*(1-t)*(1-t),az*(1-t)*(1-t));
  const vertices=mesh.vertices.map(transform);
  // The actual die's orientation and its face labels belong to the same mesh.
  const candidates=mesh.faces.map((f,i)=>{
    const pts=f.vertices.map(k=>vertices[k]);
    const normal=normalize(transform(f.normal));
    const center=average(pts);
    return {pts,normal,center,index:i};
  }).filter(f=>f.normal[2]>.03).sort((a,b)=>a.center[2]-b.center[2]);
  const primary=face;
  for(const f of candidates){
    const pts=f.pts.map(p=>[cx+p[0]*scale,cy+p[1]*scale] as [number,number]);
    poly(ctx,pts);
    ctx.fillStyle=shade(color,.75+.24*f.normal[2]+.14*Math.max(0,-f.normal[0]*.7+f.normal[1]*.45));
    ctx.fill();
    ctx.strokeStyle='rgba(228,199,143,.92)';ctx.lineWidth=Math.max(1,size/45);ctx.stroke();
    const showResult=f.index===mesh.faces.indexOf(primary);
    const n=showResult?die.value:die.sides===10?(f.index%10):((f.index+2)%die.sides)+1;
    const label=die.suffix?String(n):String(n);
    if(f.normal[2]<.24)continue;
    // No text shadow and no per-face drop shadow: numbers stay sharp.
    ctx.save();
    const projected=pts.map(([px,py])=>[px-cx,py-cy] as [number,number]);
    const pcenter:[number,number]=[cx+f.center[0]*scale,cy+f.center[1]*scale];
    const faceExtent=Math.min(...pts.map(([px,py])=>Math.hypot(px-pcenter[0],py-pcenter[1])));
    ctx.fillStyle='#f7eaca';
    ctx.font='700 '+Math.max(9,Math.round(Math.min(size*.36,faceExtent*.85)*(f.normal[2]*.3+.7)))+'px Georgia,serif';
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(label,pcenter[0],pcenter[1],Math.max(10,faceExtent*1.8));
    ctx.restore();
  }
  if(die.suffix && t>.95){
    ctx.fillStyle='#f7eaca';ctx.font='600 '+Math.max(10,Math.round(size*.2))+'px Georgia,serif';
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(die.suffix,cx,cy+size*.88);
  }
  ctx.restore();
}

/** A persistent canvas and one animation clock: incoming rolls never restart old dice. */
export function DiceScreenOverlay({rolls,options,onExpire}:{
  rolls:ScreenRoll[];
  options:DiceScreenOptions;
  onExpire:(id:string)=>void;
}) {
  const canvas=useRef<HTMLCanvasElement>(null);
  const dice=useRef(new Map<string,MovingDie>());
  const started=useRef(new Map<string,number>());
  const props=useRef({options,onExpire});
  props.current={options,onExpire};
  useEffect(()=>{
    const current=performance.now();
    const active=new Set(rolls.map(roll=>roll.id));
    for(const [key] of started.current)if(!active.has(key))started.current.delete(key);
    for(const [key] of dice.current)if(!active.has(key.split(':')[0]))dice.current.delete(key);
    for(const roll of rolls){
      if(started.current.has(roll.id))continue;
      started.current.set(roll.id,current);
      let entries=diceFromResult(roll.result);
      // A percentile die is a real pair of d10s: tens and units.
      entries=entries.flatMap(d=>d.sides===100?[
        {sides:10,value:Math.floor(d.value%100/10)*10,suffix:'десятки'},
        {sides:10,value:d.value%10,suffix:'единицы'}
      ]:[d]);
      entries.forEach((die,index)=>{
        const id=roll.id+':'+index;
        const seed=hash(id),x=hash(id+'/x'),y=hash(id+'/y');
        dice.current.set(id,{...die,id,born:current,x,y,seed,size:62});
      });
    }
  },[rolls]);
  useEffect(()=>{
    let frame=0,alive=true;
    const paint=(now:number)=>{
      if(!alive)return;
      const node=canvas.current;
      const opts=props.current.options;
      if(node){
        const ctx=node.getContext('2d',{alpha:true});
        if(ctx){
          const w=window.innerWidth,h=window.innerHeight;
          const dpr=Math.min(2.5,window.devicePixelRatio||1);
          const pw=Math.round(w*dpr),ph=Math.round(h*dpr);
          if(node.width!==pw||node.height!==ph){node.width=pw;node.height=ph;}
          ctx.setTransform(dpr,0,0,dpr,0,0);
          ctx.clearRect(0,0,w,h);
          if(opts.enabled){
            const color=rgb(opts.color);
            const hold=clamp(opts.lifetime,0,30)*1000;
            for(const die of dice.current.values())draw(ctx,die,now,w,h,color,hold);
            for(const [id,born] of [...started.current]){
              if(now-born>=FLIGHT+hold+FADE) {
                started.current.delete(id);
                for(const key of dice.current.keys())if(key.startsWith(id+':'))dice.current.delete(key);
                props.current.onExpire(id);
              }
            }
          }
        }
      }
      frame=requestAnimationFrame(paint);
    };
    frame=requestAnimationFrame(paint);
    return()=>{alive=false;cancelAnimationFrame(frame);};
  },[]);
  return <canvas ref={canvas} className="hero-screen-dice" aria-hidden="true" style={{display:options.enabled?'block':'none'}}/>;
}
