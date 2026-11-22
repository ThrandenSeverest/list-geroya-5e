import { diceSafeArea } from './diceScreenMotion';

/**
 * Lightweight top-down dice physics.
 * Dice enter from the right, bounce off each other and the four visible-area walls,
 * then gradually settle. Screen units are CSS pixels, never backing-canvas pixels.
 */
export type DiceBody = {
  id: string;
  x: number; y: number;
  vx: number; vy: number;
  radius: number;
  entered: boolean;
  impact: number;
  // Independent launch / tumble, never synchronized to the rest of the throw.
  launchDelay?: number;
  age?: number;
  spin?: number;
  spinVelocity?: number;
  surfaceDrag?: number;
};

export type DiceSpawn = {
  id: string;
  width: number;
  height: number;
  radius: number;
  seed: number;
  seedY: number;
  seedAngle?: number;
  seedDelay?: number;
  seedSpin?: number;
  index?: number;
};

export function screenDieSize(width: number, height: number): number {
  const mobile = width < 700;
  const preferred = mobile ? 36 : 45;
  // The old default scaled to 88 CSS units (up to ~200 px in apparent diameter).
  return Math.max(17, Math.min(preferred, width * .085, height * .088));
}

export function screenDieRadius(size: number): number {
  // Covers the perspective-projected circumsphere and thin outer strokes.
  return size * 1.27 + 2;
}

const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));

export function spawnScreenDie({id,width,height,radius,seed,seedY,seedAngle=seedY,seedDelay=seed,seedSpin=seed,index=0}:DiceSpawn):DiceBody {
  const area=diceSafeArea(width,height,radius);
  // Throw from the right, but each die has a different height, speed, and ANGLE.
  // Previously every die shared nearly the same negative X velocity.
  const lane=clamp(.13+.74*seedY,0,1);
  const y=area.top+(area.bottom-area.top)*lane;
  const angle=(clamp(seedAngle,0,1)*2-1)*.94; // -54° to +54°
  const speed=Math.min(1880,Math.max(880,width*1.38))*(.67+clamp(seed,0,1)*.72);
  const spinSign=seedSpin>.5?1:-1;
  return {
    id,
    x:width+radius+70+Math.min(index,14)*12,
    y,
    vx:-Math.cos(angle)*speed,
    vy:Math.sin(angle)*speed,
    radius,
    entered:false,
    impact:0,
    // A handful of dice fly immediately; others follow in a loose, irregular burst.
    launchDelay:Math.min(.53,index*.026+clamp(seedDelay,0,1)*.21),
    age:0,
    spin:(seedSpin-.5)*2.8,
    spinVelocity:spinSign*(5.5+Math.abs(seedSpin-.5)*11),
    surfaceDrag:.68+clamp(1-seedDelay,0,1)*.92
  };
}

function wallContact(body:DiceBody,width:number,height:number) {
  const area=diceSafeArea(width,height,body.radius);
  const left=area.left,right=area.right,top=area.top,bottom=area.bottom;
  // A viewport resize must not strand a still-incoming die outside the screen.
  if(!body.entered&&body.x>width+body.radius+290)body.x=width+body.radius+290;
  if(!body.entered&&body.x<=right)body.entered=true;
  if(body.entered) {
    if(body.x<left){body.x=left;if(body.vx<0)body.vx=-body.vx*.42;body.impact=Math.max(body.impact,.38);}
    if(body.x>right){body.x=right;if(body.vx>0)body.vx=-body.vx*.42;body.impact=Math.max(body.impact,.38);}
  }
  if(body.y<top){body.y=top;if(body.vy<0)body.vy=-body.vy*.44;body.impact=Math.max(body.impact,.24);}
  if(body.y>bottom){body.y=bottom;if(body.vy>0)body.vy=-body.vy*.44;body.impact=Math.max(body.impact,.24);}
}

function collision(a:DiceBody,b:DiceBody) {
  // Do not collide with dice still fully outside the right entrance.
  if(!a.entered||!b.entered||(a.launchDelay||0)>0||(b.launchDelay||0)>0)return;
  const dx=b.x-a.x,dy=b.y-a.y,required=a.radius+b.radius+2;
  if(Math.abs(dx)>=required||Math.abs(dy)>=required)return;
  let dist=Math.hypot(dx,dy);
  if(dist>=required)return;
  let nx=0,ny=0;
  if(dist>.0001){nx=dx/dist;ny=dy/dist;}
  else{
    // Stable fallback avoids NaN and deterministic stacked dice never lock together.
    const angle=((a.id.length*37+b.id.length*97)%360)*Math.PI/180;
    nx=Math.cos(angle);ny=Math.sin(angle);dist=0;
  }
  const penetration=required-dist;
  // Positional correction prevents stacking even after both bodies lose velocity.
  a.x-=nx*penetration*.51;
  a.y-=ny*penetration*.51;
  b.x+=nx*penetration*.51;
  b.y+=ny*penetration*.51;

  const relative=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;
  if(relative<0){
    const impulse=-(1+.51)*relative*.5;
    a.vx-=impulse*nx;a.vy-=impulse*ny;
    b.vx+=impulse*nx;b.vy+=impulse*ny;
    // A glancing contact redirects travel along the tangent, instead of
    // simply pushing two parallel-moving discs into a rigid line.
    const tx=-ny,ty=nx;
    const tangent=(b.vx-a.vx)*tx+(b.vy-a.vy)*ty;
    const sideways=Math.max(-110,Math.min(110,tangent*.18));
    a.vx+=sideways*tx;a.vy+=sideways*ty;
    b.vx-=sideways*tx;b.vy-=sideways*ty;
    a.spinVelocity=(a.spinVelocity||0)-sideways*.018;
    b.spinVelocity=(b.spinVelocity||0)+sideways*.018;
    const contact=Math.min(1,Math.abs(relative)/500);
    a.impact=Math.max(a.impact,contact);
    b.impact=Math.max(b.impact,contact);
  }
}

/** Mutates positions by one bounded physics step, independent of rendering FPS. */
export function stepScreenDice(bodies:DiceBody[],width:number,height:number,dt:number):void {
  const seconds=clamp(dt,0,1/24);
  if(seconds<=0||!bodies.length)return;
  for(const body of bodies){
    if((body.launchDelay||0)>0){
      body.launchDelay=Math.max(0,(body.launchDelay||0)-seconds);
      continue;
    }
    body.age=(body.age||0)+seconds;
    body.x+=body.vx*seconds;
    body.y+=body.vy*seconds;
    // Individual friction makes every die coast to a stop at a different time.
    const damping=Math.exp(-(body.surfaceDrag??1.05)*seconds);
    body.vx*=damping;
    body.vy*=damping;
    body.spin=(body.spin||0)+(body.spinVelocity||0)*seconds;
    body.spinVelocity=(body.spinVelocity||0)*Math.exp(-1.5*seconds);
    body.impact*=Math.exp(-7*seconds);
    if(Math.hypot(body.vx,body.vy)<3)body.vx=body.vy=0;
    wallContact(body,width,height);
  }
  if(bodies.length<2)return;

  // Iterative disc contacts. Spatial hashing prevents O(N²) for large damage rolls.
  const maxRadius=Math.max(...bodies.map(b=>b.radius));
  const cell=Math.max(24,2*maxRadius+4);
  for(let pass=0;pass<4;pass++){
    const cells=new Map<string,number[]>();
    for(let i=0;i<bodies.length;i++){
      const b=bodies[i];
      if(!b.entered)continue;
      const x=Math.floor(b.x/cell),y=Math.floor(b.y/cell);
      const key=x+','+y;
      const items=cells.get(key)||[];
      items.push(i);cells.set(key,items);
    }
    for(let i=0;i<bodies.length;i++){
      const b=bodies[i];
      if(!b.entered)continue;
      const x=Math.floor(b.x/cell),y=Math.floor(b.y/cell);
      for(let ox=-1;ox<=1;ox++)for(let oy=-1;oy<=1;oy++){
        for(const j of cells.get((x+ox)+','+(y+oy))||[]){
          if(j<=i)continue;
          collision(b,bodies[j]);
        }
      }
    }
    for(const body of bodies)wallContact(body,width,height);
  }
}
