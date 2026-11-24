import { Body, Box, ContactMaterial, ConvexPolyhedron, GSSolver, Material, Plane, Vec3, World } from 'cannon-es';
import { diceMesh, type DiceMesh } from './diceScreenMath';

export const DICE_UNIT=40;
export type PhysicalDie={id:string;sides:number;numbering:'regular'|'tens'|'units';body:Body;mesh:DiceMesh;size:number;delay:number;launched:boolean;entered:boolean;still:number;settled:boolean;value?:number;age:number;lastImpact:number;cocked:number;localVertices:Vec3[];random:()=>number;rerolls:number};
const dot=(a:number[],b:number[])=>a.reduce((sum,n,i)=>sum+n*b[i],0);
/** Fixed labels are assigned to mesh faces once; opposite faces add to N+1. */
export function faceValues(sides:number):number[]{
 const mesh=diceMesh(sides);if(!mesh)return [];
 if(sides===4)return mesh.faces.map((_,i)=>i+1);
 const values=mesh.faces.map(()=>0);let low=1;
 for(let i=0;i<values.length;i++)if(!values[i]){
  let opposite=i,best=1;mesh.faces.forEach((f,j)=>{const d=dot(mesh.faces[i].normal,f.normal);if(d<best&&!values[j]){best=d;opposite=j;}});
  values[i]=low;values[opposite]=sides+1-low;low++;
 }
 return values;
}
const labels=new Map<number,number[]>();
export function physicalFaceValue(sides:number,index:number){if(!labels.has(sides))labels.set(sides,faceValues(sides));return labels.get(sides)![index];}
export function bottomFace(d:PhysicalDie){let index=0,alignment=-1;d.mesh.faces.forEach((f,i)=>{const n=d.body.quaternion.vmult(new Vec3(...f.normal));if(-n.z>alignment){alignment=-n.z;index=i;}});return {index,alignment};}
export function readPhysicalDie(d:PhysicalDie):number {
 // A tetrahedron is read at its upper vertex, opposite its supporting face.
 let index=bottomFace(d).index;
 if(d.sides!==4){let highest=-Infinity;d.mesh.faces.forEach((f,i)=>{const z=d.body.quaternion.vmult(new Vec3(...f.normal)).z;if(z>highest){highest=z;index=i;}});}
 const face=physicalFaceValue(d.sides,index);
 return d.numbering==='tens'?(face-1)*10:d.numbering==='units'?face-1:face;
}
export function vertexValue(d:PhysicalDie,vertex:number){const opposite=d.mesh.faces.findIndex(f=>!f.vertices.includes(vertex));return physicalFaceValue(4,opposite);}
export class DiceTable {
 world:World;dice:PhysicalDie[]=[];width:number;height:number;time=0;private walls:Body[]=[];
 private dieMaterial=new Material('dice');private wood=new Material('wood');private rim=new Material('rim');
 constructor(width:number,height:number){
  this.width=width;this.height=height;
  const solver=new GSSolver();solver.iterations=28;solver.tolerance=1e-7;
  this.world=new World({gravity:new Vec3(0,0,-45),allowSleep:false,solver});
  this.world.addContactMaterial(new ContactMaterial(this.dieMaterial,this.wood,{friction:.55,restitution:.17,contactEquationStiffness:1e8,contactEquationRelaxation:4}));
  this.world.addContactMaterial(new ContactMaterial(this.dieMaterial,this.rim,{friction:.24,restitution:.52,contactEquationStiffness:1e8,contactEquationRelaxation:3}));
  // Dice should rebound and roll off one another rather than lock face to face.
  this.world.addContactMaterial(new ContactMaterial(this.dieMaterial,this.dieMaterial,{friction:.28,restitution:.3,contactEquationStiffness:1e8,contactEquationRelaxation:3}));
  const floor=new Body({mass:0,shape:new Plane(),material:this.wood,collisionFilterGroup:1});this.world.addBody(floor);this.resize(width,height);
 }
 resize(width:number,height:number){
  this.width=width;this.height=height;this.walls.forEach(w=>this.world.removeBody(w));this.walls=[];
  const w=width/DICE_UNIT,h=height/DICE_UNIT;
  const wall=(x:number,y:number,sx:number,sy:number,group=4)=>{const b=new Body({mass:0,shape:new Box(new Vec3(sx,sy,8)),material:this.rim,position:new Vec3(x,y,7),collisionFilterGroup:group});this.world.addBody(b);this.walls.push(b);};
  wall(-1,h/2,1,h+2);wall(w+1,h/2,1,h+2,8);wall(w/2,-1,w+2,1);wall(w/2,h+1,w+2,1);
 }
 add(id:string,sides:number,size:number,random:()=>number=Math.random,numbering:PhysicalDie['numbering']='regular',index=0):PhysicalDie{
  const mesh=diceMesh(sides);if(!mesh)throw Error('Для этой кости используется обычный генератор.');
  const radius=size/DICE_UNIT,max=Math.max(...mesh.vertices.map(v=>Math.hypot(...v)));
  const localVertices=mesh.vertices.map(v=>new Vec3(...v.map(n=>n/max*radius) as [number,number,number]));
  const shape=new ConvexPolyhedron({vertices:localVertices,faces:mesh.faces.map(f=>f.vertices.slice())});
  const b=new Body({mass:1,shape,material:this.dieMaterial,linearDamping:.13,angularDamping:.28,allowSleep:true,collisionFilterGroup:2,collisionFilterMask:7});
  const angle=(random()-.5)*1.35,speed=Math.sqrt(this.width/DICE_UNIT)*7*(.9+random()*.3);
  b.position.set(this.width/DICE_UNIT+radius+.3,(radius+.2)+(this.height/DICE_UNIT-2*radius-.4)*random(),radius*(1.1+random()*.35));
  // Uniform random orientation determines the physical initial state, never a target result.
  const a=random(),b1=random()*Math.PI*2,c=random()*Math.PI*2;
  b.quaternion.set(Math.sqrt(1-a)*Math.sin(b1),Math.sqrt(1-a)*Math.cos(b1),Math.sqrt(a)*Math.sin(c),Math.sqrt(a)*Math.cos(c));
  b.velocity.set(-Math.cos(angle)*speed,Math.sin(angle)*speed,-.8);
  b.angularVelocity.set(-b.velocity.y/(radius*.8),b.velocity.x/(radius*.8),(random()-.5)*5);
  const die:PhysicalDie={id,sides,numbering,body:b,mesh,size,delay:random()*.14+index*.025,launched:false,entered:false,still:0,settled:false,age:0,lastImpact:0,cocked:0,localVertices,random,rerolls:0};
  b.addEventListener('collide',(event:{contact:{getImpactVelocityAlongNormal:()=>number}})=>{const impact=Math.abs(event.contact.getImpactVelocityAlongNormal());if(impact>2.5)die.lastImpact=Math.max(die.lastImpact,impact);});
  this.dice.push(die);return die;
 }
 remove(id:string){const d=this.dice.find(x=>x.id===id);if(d?.launched)this.world.removeBody(d.body);this.dice=this.dice.filter(x=>x.id!==id);}
 /** Solve unilateral horizontal body contacts after the initial airborne phase.
  * Translation never changes an already landed face or its recorded result. */
 solvePlanarContacts(){
  const dice=this.dice.filter(d=>d.launched&&d.entered&&d.age>=1);
  const w=this.width/DICE_UNIT,h=this.height/DICE_UNIT;
  // Keep the actual horizontal footprint clear without a generous halo.
  const radius=(d:PhysicalDie)=>d.size/DICE_UNIT*.98;
  const cy=(d:PhysicalDie)=>d.body.position.y;
  const move=(d:PhysicalDie,x:number,y:number)=>{d.body.position.x+=x;d.body.position.y+=y;d.body.aabbNeedsUpdate=true;};
  for(let pass=0;pass<48;pass++){
   let error=0;
   for(const d of dice){
    const r=radius(d),b=d.body;
    const px=Math.max(r,Math.min(w-r,b.position.x)),py=Math.max(r,Math.min(h-r,cy(d)));
    if(px!==b.position.x||py!==cy(d)){
     move(d,px-b.position.x,py-cy(d));
    }
    // An inward normal impulse also reverses the roll that drove the die into
    // the rim. Resolve each wall independently, including a simultaneous corner hit.
    if(!d.settled){
     const hitX=(b.position.x<=r+.035&&b.velocity.x<-.2)||(b.position.x>=w-r-.035&&b.velocity.x>.2);
     const hitY=(b.position.y<=r+.035&&b.velocity.y<-.2)||(b.position.y>=h-r-.035&&b.velocity.y>.2);
     if(hitX){b.velocity.x=-b.velocity.x*.5;b.angularVelocity.y=-b.angularVelocity.y*.5;b.wakeUp();}
     if(hitY){b.velocity.y=-b.velocity.y*.5;b.angularVelocity.x=-b.angularVelocity.x*.5;b.wakeUp();}
    }
   }
   for(let i=0;i<dice.length;i++)for(let j=i+1;j<dice.length;j++){
    const a=dice[i],b=dice[j];let dx=b.body.position.x-a.body.position.x,dy=cy(b)-cy(a),distance=Math.hypot(dx,dy);
    const gap=radius(a)+radius(b)-distance;if(gap<=0)continue;
    error=Math.max(error,gap);
    if(distance<1e-8){const angle=(i*2.399963+j)*1.7;dx=Math.cos(angle);dy=Math.sin(angle);distance=1;}
    const nx=dx/distance,ny=dy/distance,shift=(gap+.001)/2;
    move(a,-nx*shift,-ny*shift);move(b,nx*shift,ny*shift);
    // Transfer closing velocity so touching dice can push each other apart.
    const closing=(b.body.velocity.x-a.body.velocity.x)*nx+(b.body.velocity.y-a.body.velocity.y)*ny;
    if(closing<0){const impulse=-closing*.62;if(!a.settled){a.body.velocity.x-=impulse*nx;a.body.velocity.y-=impulse*ny;a.body.wakeUp();}if(!b.settled){b.body.velocity.x+=impulse*nx;b.body.velocity.y+=impulse*ny;b.body.wakeUp();}}
   }
   if(error<.002)break;
  }
 }
 step(dt=1/120){
  this.time+=dt;
  for(const d of this.dice)if(d.settled)d.age+=dt;
  if(this.dice.length&&this.dice.every(d=>d.settled)){this.solvePlanarContacts();return;}
  for(const d of this.dice){if(!d.launched){d.delay-=dt;if(d.delay<=0&&(d.rerolls>0||!this.dice.some(other=>other!==d&&other.launched&&other.body.position.distanceTo(d.body.position)<(other.size+d.size)/DICE_UNIT*1.05))){this.world.addBody(d.body);d.launched=true;}}}
  this.world.step(dt);
  for(const d of this.dice){
   if(!d.launched)continue;if(d.settled){if(d.body.sleepState===Body.SLEEPING||d.body.type===Body.STATIC)continue;d.settled=false;d.value=undefined;d.still=0;}d.age+=dt;
   const b=d.body,r=d.size/DICE_UNIT;
   if(!d.entered&&b.position.x+Math.max(...d.localVertices.map(v=>b.quaternion.vmult(v).x))<this.width/DICE_UNIT-.02){d.entered=true;b.collisionFilterMask=d.rerolls>0?1:15;}
   if(!d.entered){
    if(b.velocity.x>-6){b.velocity.x=-6;b.angularVelocity.y=-6/(r*.8);}
    if(b.position.y<r){b.position.y=r;b.velocity.y=Math.abs(b.velocity.y)*.17;}
    if(b.position.y>this.height/DICE_UNIT-r){b.position.y=this.height/DICE_UNIT-r;b.velocity.y=-Math.abs(b.velocity.y)*.17;}
   }
   // Resizing or a very hard impact must not strand a die beyond the walls.
   if(d.entered){
    if(b.position.x<0){b.position.x=r;b.velocity.x=Math.abs(b.velocity.x)*.5;}
    if(b.position.x>this.width/DICE_UNIT){b.position.x=this.width/DICE_UNIT-r;b.velocity.x=-Math.abs(b.velocity.x)*.5;}
    if(b.position.y<0){b.position.y=r;b.velocity.y=Math.abs(b.velocity.y)*.5;}
    if(b.position.y>this.height/DICE_UNIT){b.position.y=this.height/DICE_UNIT-r;b.velocity.y=-Math.abs(b.velocity.y)*.5;}
   }
   if(d.entered&&d.rerolls>0){
    if(b.position.x<r){b.position.x=r;b.velocity.x=Math.abs(b.velocity.x)*.5;}
    if(b.position.x>this.width/DICE_UNIT-r){b.position.x=this.width/DICE_UNIT-r;b.velocity.x=-Math.abs(b.velocity.x)*.5;}
    if(b.position.y<r){b.position.y=r;b.velocity.y=Math.abs(b.velocity.y)*.5;}
    if(b.position.y>this.height/DICE_UNIT-r){b.position.y=this.height/DICE_UNIT-r;b.velocity.y=-Math.abs(b.velocity.y)*.5;}
   }
   const flat=bottomFace(d),slow=b.velocity.length()<.18&&b.angularVelocity.length()<.22;
   const floorHeight=Math.min(...d.localVertices.map(v=>b.quaternion.vmult(v).z+b.position.z));
   const supported=flat.alignment>.9995&&Math.abs(floorHeight)<.035;
   d.still=slow?d.still+dt:0;
   if(d.entered&&supported&&d.still>.35){
    d.settled=true;d.value=readPhysicalDie(d);b.velocity.setZero();b.angularVelocity.setZero();b.sleep();
   }
   // A cocked die is invalid, as on a real table. Re-throw it; never invent a face.
   d.cocked=!supported&&b.velocity.length()<.7&&b.angularVelocity.length()<1?d.cocked+dt:0;
   // A die resting on another die can remain motionless indefinitely. Nudge the
   // upper die sideways while preserving its physical orientation and outcome.
   if(d.cocked>.45&&floorHeight>r*.2){
    const lower=this.dice.find(other=>other!==d&&other.launched&&other.body.position.z<b.position.z-r*.25
      &&Math.hypot(other.body.position.x-b.position.x,other.body.position.y-b.position.y)<(other.size+d.size)/DICE_UNIT*.7);
    if(lower){
     let dx=b.position.x-lower.body.position.x,dy=b.position.y-lower.body.position.y;
     if(Math.hypot(dx,dy)<.05){const angle=d.random()*Math.PI*2;dx=Math.cos(angle);dy=Math.sin(angle);}
     const length=Math.hypot(dx,dy);
     b.applyImpulse(new Vec3(dx/length*4.5,dy/length*4.5,.5),new Vec3(-dy/length*r*.65,dx/length*r*.65,0));
     b.wakeUp();d.cocked=0;
    }
   }
   if(d.cocked>.45){
    const w=this.width/DICE_UNIT,h=this.height/DICE_UNIT;
    const dx=b.position.x<r*1.15?1:b.position.x>w-r*1.15?-1:0;
    const dy=b.position.y<r*1.15?1:b.position.y>h-r*1.15?-1:0;
    if(dx||dy){
     const length=Math.hypot(dx,dy);
     b.applyImpulse(new Vec3(dx/length*3.2,dy/length*3.2,.35),new Vec3(-dy*r*.55,dx*r*.55,0));
     b.wakeUp();d.cocked=0;
    }
   }
   if(!d.settled&&d.rerolls>0&&d.cocked>2){
    // Once other dice are intangible, ease a rare die off the wall or its edge
    // without showing it fly across the table for another throw.
    const dx=this.width/DICE_UNIT/2-b.position.x,dy=this.height/DICE_UNIT/2-b.position.y;
    const length=Math.hypot(dx,dy)||1;
    b.applyImpulse(new Vec3(dx/length*2.5,dy/length*2.5,.6),new Vec3(r*.7,0,0));
    b.wakeUp();d.cocked=0;
   }
   if(!d.settled&&d.rerolls===0&&(d.cocked>.75||d.age>10)){
    this.world.removeBody(b);d.launched=false;d.entered=false;d.delay=.2;d.age=0;d.still=0;d.cocked=0;d.rerolls++;
    const random=d.random,angle=(random()-.5)*1.35,speed=Math.sqrt(this.width/DICE_UNIT)*7*(.9+random()*.3);
    b.position.set(this.width/DICE_UNIT+r+.3,this.height/DICE_UNIT*(.25+.5*random()),r*1.3);
    const a=random(),u=random()*Math.PI*2,v=random()*Math.PI*2;
    b.quaternion.set(Math.sqrt(1-a)*Math.sin(u),Math.sqrt(1-a)*Math.cos(u),Math.sqrt(a)*Math.sin(v),Math.sqrt(a)*Math.cos(v));
    b.velocity.set(-Math.cos(angle)*speed,Math.sin(angle)*speed,-.8);b.angularVelocity.set(-b.velocity.y/(r*.8),b.velocity.x/(r*.8),(random()-.5)*5);
    // The first rethrow keeps collisions with wood and the boundaries, but
    // ignores every other die until this die has physically settled.
    b.collisionFilterMask=1;b.aabbNeedsUpdate=true;b.wakeUp();
   }


  }
  this.solvePlanarContacts();
 }
}
