import { Body, Box, ContactMaterial, ConvexPolyhedron, GSSolver, Material, Plane, Vec3, World } from 'cannon-es';
import { diceMesh, type DiceMesh } from './diceScreenMath';

export const DICE_UNIT=40;
export type PhysicalDie={id:string;sides:number;numbering:'regular'|'tens'|'units';body:Body;mesh:DiceMesh;size:number;delay:number;launched:boolean;entered:boolean;still:number;settled:boolean;value?:number;age:number;lastImpact:number;cocked:number;localVertices:Vec3[]};
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
 private dieMaterial=new Material('dice');private wood=new Material('wood');
 constructor(width:number,height:number){
  this.width=width;this.height=height;
  const solver=new GSSolver();solver.iterations=18;solver.tolerance=1e-7;
  this.world=new World({gravity:new Vec3(0,0,-45),allowSleep:false,solver});
  this.world.addContactMaterial(new ContactMaterial(this.dieMaterial,this.wood,{friction:.55,restitution:.17,contactEquationStiffness:1e8,contactEquationRelaxation:4}));
  this.world.addContactMaterial(new ContactMaterial(this.dieMaterial,this.dieMaterial,{friction:.4,restitution:.25}));
  const floor=new Body({mass:0,shape:new Plane(),material:this.wood,collisionFilterGroup:1});this.world.addBody(floor);this.resize(width,height);
 }
 resize(width:number,height:number){
  this.width=width;this.height=height;this.walls.forEach(w=>this.world.removeBody(w));this.walls=[];
  const w=width/DICE_UNIT,h=height/DICE_UNIT;
  const wall=(x:number,y:number,sx:number,sy:number,group=4)=>{const b=new Body({mass:0,shape:new Box(new Vec3(sx,sy,8)),material:this.wood,position:new Vec3(x,y,7),collisionFilterGroup:group});this.world.addBody(b);this.walls.push(b);};
  wall(-1,h/2,1,h+2);wall(w+1,h/2,1,h+2,8);wall(w/2,-1,w+2,1);wall(w/2,h+1,w+2,1);
 }
 add(id:string,sides:number,size:number,random:()=>number=Math.random,numbering:PhysicalDie['numbering']='regular',index=0):PhysicalDie{
  const mesh=diceMesh(sides);if(!mesh)throw Error('Для этой кости используется обычный генератор.');
  const radius=size/DICE_UNIT,max=Math.max(...mesh.vertices.map(v=>Math.hypot(...v)));
  const localVertices=mesh.vertices.map(v=>new Vec3(...v.map(n=>n/max*radius) as [number,number,number]));
  const shape=new ConvexPolyhedron({vertices:localVertices,faces:mesh.faces.map(f=>f.vertices.slice())});
  const b=new Body({mass:1,shape,material:this.dieMaterial,linearDamping:.13,angularDamping:.28,allowSleep:true,collisionFilterGroup:2,collisionFilterMask:7});
  const angle=(random()-.5)*1.35,speed=16+random()*10;
  b.position.set(this.width/DICE_UNIT+radius+.3,(radius+.2)+(this.height/DICE_UNIT-2*radius-.4)*random(),radius*(1.1+random()*.35));
  // Uniform random orientation determines the physical initial state, never a target result.
  const a=random(),b1=random()*Math.PI*2,c=random()*Math.PI*2;
  b.quaternion.set(Math.sqrt(1-a)*Math.sin(b1),Math.sqrt(1-a)*Math.cos(b1),Math.sqrt(a)*Math.sin(c),Math.sqrt(a)*Math.cos(c));
  b.velocity.set(-Math.cos(angle)*speed,Math.sin(angle)*speed,-.8);
  b.angularVelocity.set(-b.velocity.y/(radius*.8),b.velocity.x/(radius*.8),(random()-.5)*5);
  const die:PhysicalDie={id,sides,numbering,body:b,mesh,size,delay:random()*.14+index*.025,launched:false,entered:false,still:0,settled:false,age:0,lastImpact:0,cocked:0,localVertices};
  b.addEventListener('collide',(event:{contact:{getImpactVelocityAlongNormal:()=>number}})=>{const impact=Math.abs(event.contact.getImpactVelocityAlongNormal());if(impact>2.5)die.lastImpact=Math.max(die.lastImpact,impact);});
  this.dice.push(die);return die;
 }
 remove(id:string){const d=this.dice.find(x=>x.id===id);if(d?.launched)this.world.removeBody(d.body);this.dice=this.dice.filter(x=>x.id!==id);}
 step(dt=1/120){
  this.time+=dt;
  for(const d of this.dice){if(!d.launched){d.delay-=dt;if(d.delay<=0){this.world.addBody(d.body);d.launched=true;}}}
  this.world.step(dt);
  for(const d of this.dice){
   if(!d.launched)continue;if(d.settled){if(d.body.sleepState===Body.SLEEPING||d.body.type===Body.STATIC)continue;d.settled=false;d.value=undefined;d.still=0;}d.age+=dt;
   const b=d.body,r=d.size/DICE_UNIT;
   if(!d.entered&&b.position.x<this.width/DICE_UNIT-r*.6){d.entered=true;b.collisionFilterMask=15;}
   if(!d.entered&&d.age>1&&b.velocity.x>-.5)b.applyImpulse(new Vec3(-3,0,0));
   // Resizing or a very hard impact must not strand a die beyond the walls.
   if(d.entered){b.position.x=Math.max(r,Math.min(this.width/DICE_UNIT-r,b.position.x));b.position.y=Math.max(r,Math.min(this.height/DICE_UNIT-r,b.position.y));}
   const flat=bottomFace(d),slow=b.velocity.length()<.18&&b.angularVelocity.length()<.22;
   const floorHeight=Math.min(...d.localVertices.map(v=>b.quaternion.vmult(v).z+b.position.z));
   const supported=flat.alignment>.9995&&Math.abs(floorHeight)<.035;
   d.still=slow?d.still+dt:0;
   if(d.entered&&supported&&d.still>.35){
    d.settled=true;d.value=readPhysicalDie(d);b.velocity.setZero();b.angularVelocity.setZero();b.sleep();
   }
   d.cocked=!supported&&b.velocity.length()<.7&&b.angularVelocity.length()<1?d.cocked+dt:0;
   if(!d.settled&&d.cocked>1){
    // Roll a cocked die away from neighbours or a wall, retaining its labels.
    let dx=0,dy=0;
    for(const other of this.dice)if(other!==d&&other.launched){const x=b.position.x-other.body.position.x,y=b.position.y-other.body.position.y,dist=Math.hypot(x,y);if(dist<r*3){dx+=x/(dist*dist+.1);dy+=y/(dist*dist+.1);}}
    dx+=1/(b.position.x+.1)-1/(this.width/DICE_UNIT-b.position.x+.1);
    dy+=1/(b.position.y+.1)-1/(this.height/DICE_UNIT-b.position.y+.1);
    const length=Math.hypot(dx,dy);if(length<.01){dx=Math.sin(d.age*3.7);dy=Math.cos(d.age*2.1);}else{dx/=length;dy/=length;}
    b.applyImpulse(new Vec3(dx*5,dy*5,1.5));b.angularVelocity.set(-dy*6/r,dx*6/r,0);d.cocked=0;d.still=0;
   }

  }
 }
}
