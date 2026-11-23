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
