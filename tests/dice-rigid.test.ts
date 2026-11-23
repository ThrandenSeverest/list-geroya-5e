import test from 'node:test';
import assert from 'node:assert/strict';
import {DiceTable,bottomFace,readPhysicalDie,faceValues,vertexValue} from '../app/diceRigidPhysics';
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
 assert.equal(die.body.collisionFilterMask&12,12,'the side and entry walls stay solid');
 for(let step=0;step<3600&&!die.settled;step++)table.step();
 assert.ok(die.settled);
 assert.equal(die.rerolls,1);
 assert.equal(die.value,readPhysicalDie(die));
});
