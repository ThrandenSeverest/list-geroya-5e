import test from 'node:test';
import assert from 'node:assert/strict';
import {DiceTable,bottomFace,readPhysicalDie,faceValues,vertexValue,launchManualDie} from '../app/diceRigidPhysics';
import {resolvePhysicalAction} from '../app/diceSource';
import {rollDice,rollD20} from '../app/adventure';
function rng(seed:number){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
for(const width of [370,1260])test(`Physical dice settle on faces at width ${width}`,()=>{
 for(let seed=1;seed<=8;seed++){
  const random=rng(seed),table=new DiceTable(width,640);
  const dice=[4,6,8,10,12,20,6,6,6,4,4,6].map((s,i)=>table.add('die'+i,s,width<700?30:40,random,'regular',i));
  assert.ok(dice.every(d=>d.value===undefined));
  for(let t=0;t<3600&&!dice.every(d=>d.settled);t++)table.step();
  assert.ok(dice.every(d=>d.settled),JSON.stringify(dice.filter(d=>!d.settled).map(d=>({sides:d.sides,flat:bottomFace(d),pos:d.body.position,vel:d.body.velocity,spin:d.body.angularVelocity}))));
  for(const d of dice){assert.ok(bottomFace(d).alignment>.9995);assert.equal(d.value,readPhysicalDie(d));assert.ok(d.value!>=1&&d.value!<=d.sides);
   if(d.sides===4){const upper=d.mesh.vertices.map((v,i)=>({i,z:d.body.quaternion.vmult({x:v[0],y:v[1],z:v[2]} as any).z})).sort((a,b)=>b.z-a.z)[0];assert.equal(d.value,vertexValue(d,upper.i));}
  }
  const before=dice.map(d=>[d.body.position.toArray(),d.body.quaternion.toArray(),d.value]);
  for(let t=0;t<120;t++)table.step();
  assert.deepEqual(dice.map(d=>[d.body.position.toArray(),d.body.quaternion.toArray(),d.value]),before);
 }
});
test('All labels are permanently numbered',()=>{for(const n of [4,6,8,10,12,20])assert.deepEqual(faceValues(n).sort((a,b)=>a-b),Array.from({length:n},(_,i)=>i+1));});
test('Outcome waits for physical dice; critical damage depends on the landed d20',async()=>{
 const requests:{sides:number[];resolve:(v:number[])=>void}[]=[];let done=false;
 const task=resolvePhysicalAction(()=>{const attack=rollD20(3);return {attack,damage:rollDice('1d6+2',undefined,attack.critical)};},sides=>new Promise(resolve=>requests.push({sides,resolve}))).then(r=>{done=true;return r;});
 assert.deepEqual(requests[0].sides,[20]);assert.equal(done,false);requests[0].resolve([20]);await new Promise(r=>setImmediate(r));
 assert.deepEqual(requests[1].sides,[6,6]);assert.equal(done,false);requests[1].resolve([2,5]);const result=await task;assert.equal(result.attack.natural,20);assert.equal(result.damage.total,9);
});
test('Mixed signed dice are requested together and keep their actual values',async()=>{
 const result=await resolvePhysicalAction(()=>rollDice('2d6-1d4+3'),async sides=>{assert.deepEqual(sides,[6,6,4]);return [2,6,4];});assert.deepEqual(result.rolls,[2,6,4]);assert.equal(result.total,7);
});
test('Overlapping throws cannot be trapped outside the entry or in a corner',()=>{
 for(const width of [370,1260])for(const seed of [6,11,12,21,24,36,49]){
  const table=new DiceTable(width,640),random=rng(seed),size=width<700?36:45;
  const first=Array.from({length:12},(_,i)=>table.add('a'+i,6,size,random,'regular',i));let second:typeof first=[];
  for(let frame=0;frame<3600;frame++){
   if(frame===45)second=Array.from({length:3},(_,i)=>table.add('b'+i,6,size,random,'regular',i));
   table.step();
   for(const group of [first,second])if(group.length&&group.every(d=>d.settled))for(const d of group){d.body.type=2;d.body.mass=0;d.body.updateMassProperties();}
   if(second.length&&table.dice.every(d=>d.settled))break;
  }
  assert.ok(table.dice.every(d=>d.settled),`width ${width}, seed ${seed}`);
 }
});
test('A die balanced on another die rolls away and lands without a rethrow',()=>{
 const table=new DiceTable(370,640),random=()=>.5;
 const base=table.add('base',6,36,random);
 for(let step=0;step<1800&&!base.settled;step++)table.step();
 assert.ok(base.settled);
 const top=table.add('top',6,36,random);
 for(let step=0;step<100&&!top.launched;step++)table.step();
 assert.ok(top.launched);
 top.body.position.copy(base.body.position);
 top.body.position.z+=1.8;
 top.body.velocity.setZero();top.body.angularVelocity.setZero();top.body.aabbNeedsUpdate=true;
 for(let step=0;step<1000&&!top.settled;step++)table.step();
 assert.ok(top.settled,'upper die must roll off the lower die and reach the table');
 assert.equal(top.rerolls,0,'collision resolution must avoid restarting the throw');
 assert.ok(Math.hypot(top.body.position.x-base.body.position.x,top.body.position.y-base.body.position.y)>.8);
 assert.equal(top.value,readPhysicalDie(top));
});
test('A fast die rebounds inward from the edge and still lands on the table',()=>{
 const table=new DiceTable(370,640),die=table.add('rim',6,36,()=>.5);
 for(let step=0;step<100&&!die.entered;step++)table.step();
 assert.ok(die.entered);
 die.body.position.set(table.width/40-1.2,8,1.1);
 die.body.velocity.set(9,0,0);die.body.angularVelocity.setZero();die.body.aabbNeedsUpdate=true;
 let rebound=0;
 for(let step=0;step<40;step++){table.step();if(die.body.velocity.x<0){rebound=die.body.velocity.x;break;}}
 assert.ok(rebound< -2.5,`edge rebound must carry die inward, got ${rebound}`);
 for(let step=0;step<1800&&!die.settled;step++)table.step();
 assert.ok(die.settled);assert.equal(die.value,readPhysicalDie(die));
});
test('A rolling die touching the wall reverses direction, and touching dice repel',()=>{
 const table=new DiceTable(370,640),random=rng(42);
 const a=table.add('wall',6,40,random),b=table.add('neighbor',6,40,random);
 for(let step=0;step<150&&(!a.entered||!b.entered);step++)table.step();
 assert.ok(a.entered&&b.entered);
 a.age=b.age=1.1;
 a.body.position.set(.75,8,1);b.body.position.set(5,8,1);
 a.body.velocity.set(-4,0,0);a.body.angularVelocity.set(0,-3,0);b.body.velocity.setZero();
 table.solvePlanarContacts();
 assert.ok(a.body.velocity.x>1,'wall contact must send the die back into the table');
 assert.ok(a.body.angularVelocity.y>0,'spin must turn away from the wall');
 assert.ok(a.body.position.x>=.98,'die stays clear of the wall');
 a.body.position.set(3,8,1);b.body.position.set(4.2,8,1);
 a.body.velocity.set(4,0,0);b.body.velocity.setZero();
 table.solvePlanarContacts();
 assert.ok(Math.hypot(a.body.position.x-b.body.position.x,a.body.position.y-b.body.position.y)>=1.95);
 assert.ok(b.body.velocity.x>0,'collision transfers motion to the other die');
 assert.ok(a.body.velocity.x<b.body.velocity.x,'incoming die does not keep pushing through');
});
test('A hand-thrown die carries the release velocity and settles on a real face',()=>{
 const table=new DiceTable(370,640),die=table.add('hand',20,36,rng(27));
 launchManualDie(die,{x:160,y:320,vx:760,vy:-240,spin:5},370,640,0);
 assert.ok(die.entered);
 assert.ok(die.body.velocity.x>15&&die.body.velocity.y< -4);
 const start=die.body.position.x;
 for(let t=0;t<12;t++)table.step();
 assert.ok(die.body.position.x>start+.4,'the manual throw must move in the release direction');
 for(let t=0;t<3600&&!die.settled;t++)table.step();
 assert.ok(die.settled);
 assert.equal(die.value,readPhysicalDie(die));
});
test('First rethrow ignores other dice while keeping wood and walls',()=>{
 const table=new DiceTable(370,640),random=rng(7);
 const die=table.add('cocked',4,30,random);
 for(let step=0;step<30&&!die.launched;step++)table.step();
 assert.ok(die.launched);
 die.age=10;
 table.step();
 assert.equal(die.rerolls,1);
 assert.equal(die.body.collisionFilterMask&2,0,'other dice are intangible');
 assert.equal(die.body.collisionFilterMask&1,1,'the wooden table stays solid');
 assert.equal(die.body.collisionFilterMask&12,0,'rethrow cannot become wedged against a wall');
 assert.ok(die.body.position.x>table.width/40,'rethrow starts at the right edge');
 for(let step=0;step<3600&&!die.settled;step++)table.step();
 assert.ok(die.settled);
 assert.equal(die.rerolls,1);
 assert.equal(die.value,readPhysicalDie(die));
});

test('Eight large mobile dice cannot share horizontal space after one second',()=>{
 for(let seed=1;seed<=12;seed++){
  const table=new DiceTable(370,640),random=rng(seed);
  const dice=Array.from({length:8},(_,i)=>table.add('large'+i,6,48,random,'regular',i));
  for(let frame=0;frame<1800;frame++){
   table.step();
   const active=dice.filter(d=>d.entered&&d.launched&&d.age>=1);
   for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++){
    const a=active[i],b=active[j];
    assert.ok(Math.hypot(a.body.position.x-b.body.position.x,a.body.position.y-b.body.position.y)>=(a.size+b.size)/40*.98-.01,`overlap seed ${seed} frame ${frame}`);
   }
   if(dice.every(d=>d.settled))break;
  }
  assert.ok(dice.every(d=>d.settled));
 }
});
