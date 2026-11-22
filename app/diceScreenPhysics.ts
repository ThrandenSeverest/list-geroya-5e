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
  spinDirection?: number;
  // Small vertical motion (screen pixels), not sideways position teleportation.
  hopHeight?: number;
  hopVelocity?: number;
  // Quaternion accumulated from distance travelled around the contact axis.
  orientation?: [number, number, number, number];
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
    spinVelocity:spinSign*speed/Math.max(8,(radius-2)/1.27*.82),
    spinDirection:spinSign,
    surfaceDrag:.90+clamp(1-seedDelay,0,1)*.20,
    hopHeight:0,hopVelocity:0,
    orientation:[0,0,0,1]
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
    // Only a hard impact can lift a die. Transfer, never invent, energy:
    // vertical kinetic energy is paid for by the outgoing horizontal motion.
    if(Math.abs(relative)>650){
      for(const body of [a,b]){
        const speed=Math.hypot(body.vx,body.vy);
        const lift=Math.min(150,speed*.22);
        if((body.hopHeight||0)===0 && lift>70){
          const remaining=Math.sqrt(Math.max(0,speed*speed-lift*lift))/speed;
          body.vx*=remaining;body.vy*=remaining;
          body.hopVelocity=lift;
        }
      }
    }
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
    const speed=Math.hypot(body.vx,body.vy);
    const airborne=(body.hopHeight||0)>0 || (body.hopVelocity||0)>0;
    // Constant rolling resistance on wood gives a finite stopping distance.
    // Stronger loss at each face/edge is represented by the surface coefficient.
    // Do not brake outside the entrance: every launch must reach the table.
    const deceleration=body.entered&&!airborne?520*(body.surfaceDrag??1):0;
    const nextSpeed=Math.max(0,speed-deceleration*seconds);
    const movingTime=deceleration>0?Math.min(seconds,speed/deceleration):seconds;
    const travel=speed>0?(speed+nextSpeed)*.5*movingTime:0;
    const dx=speed>0?body.vx/speed*travel:0;
    const dy=speed>0?body.vy/speed*travel:0;
    body.x+=dx;body.y+=dy;
    const factor=speed>0?nextSpeed/speed:0;
    body.vx*=factor;body.vy*=factor;
    // Rolling without slip: arc length = angle * contact radius. Screen Y
    // points downward, Z toward the viewer, so the axis is (-dy, dx, 0).
    const contactRadius=Math.max(8,(body.radius-2)/1.27*.82);
    const angle=travel/contactRadius;
    body.spinVelocity=(body.spinDirection||1)*nextSpeed/contactRadius;
    body.spin=(body.spin||0)+(body.spinDirection||1)*angle;
    if(travel>0){
      const q=body.orientation??[0,0,0,1];
      const sin=Math.sin(angle/2),c=Math.cos(angle/2);
      const ax=-dy/travel*sin,ay=dx/travel*sin;
      const next:[number,number,number,number]=[
        c*q[0]+ax*q[3]+ay*q[2], c*q[1]+ay*q[3]-ax*q[2],
        c*q[2]+ax*q[1]-ay*q[0], c*q[3]-ax*q[0]-ay*q[1]
      ];
      const length=Math.hypot(...next);
      body.orientation=next.map(v=>v/length) as typeof next;
    }
    // No timer-based or random jumps on a flat tabletop. Gravity acts only
    // after a fast collision has supplied a vertical impulse.
    if(airborne){
      const v=body.hopVelocity||0;
      body.hopHeight=Math.max(0,(body.hopHeight||0)+v*seconds-.5*2400*seconds*seconds);
      body.hopVelocity=body.hopHeight>0?v-2400*seconds:0;
    }
    body.impact*=Math.exp(-7*seconds);
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
