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
};

export type DiceSpawn = {
  id: string;
  width: number;
  height: number;
  radius: number;
  seed: number;
  seedY: number;
  index?: number;
};

export function screenDieSize(width: number, height: number): number {
  const mobile = width < 700;
  const preferred = mobile ? 24 : 29;
  // The old default scaled to 88 CSS units (up to ~200 px in apparent diameter).
  return Math.max(12, Math.min(preferred, width * .061, height * .063));
}

export function screenDieRadius(size: number): number {
  // Covers the perspective-projected circumsphere and thin outer strokes.
  return size * 1.46 + 3;
}

const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));

export function spawnScreenDie({id,width,height,radius,seed,seedY,index=0}:DiceSpawn):DiceBody {
  const area=diceSafeArea(width,height,radius);
  const y=area.top+(area.bottom-area.top)*clamp(.18+seedY*.64,0,1);
  const speed=Math.min(2200,Math.max(680,width*1.47))*(.85+seed*.29);
  return {
    id,
    // Offscreen only before entrance. Subsequent motion stays inside the arena.
    x:width+radius+5+index*4,
    y,
    vx:-speed,
    vy:(seedY-.5)*(width<700?200:295),
    radius,
    entered:false,
    impact:0
  };
}

function wallContact(body:DiceBody,width:number,height:number) {
  const area=diceSafeArea(width,height,body.radius);
  const left=area.left,right=area.right,top=area.top,bottom=area.bottom;
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
  if(!a.entered||!b.entered)return;
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
    const impulse=-(1+.46)*relative*.5;
    a.vx-=impulse*nx;a.vy-=impulse*ny;
    b.vx+=impulse*nx;b.vy+=impulse*ny;
    const contact=Math.min(1,Math.abs(relative)/500);
    a.impact=Math.max(a.impact,contact);
    b.impact=Math.max(b.impact,contact);
  }
}

/** Mutates positions by one bounded physics step, independent of rendering FPS. */
export function stepScreenDice(bodies:DiceBody[],width:number,height:number,dt:number):void {
  const seconds=clamp(dt,0,1/24);
  if(seconds<=0||!bodies.length)return;
  const damping=Math.exp(-3.7*seconds);
  for(const body of bodies){
    body.x+=body.vx*seconds;
    body.y+=body.vy*seconds;
    body.vx*=damping;
    body.vy*=damping;
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
