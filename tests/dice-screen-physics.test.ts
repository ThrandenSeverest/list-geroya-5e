import assert from 'node:assert/strict';
import test from 'node:test';
import { diceSafeArea } from '../app/diceScreenMotion';
import { spawnScreenDie, screenDieRadius, screenDieSize, stepScreenDice, type DiceBody } from '../app/diceScreenPhysics';

test('dice are visible without returning to oversized original scale',()=>{
  for(const [w,h] of [[320,568],[390,650],[430,930],[1280,720],[1920,1080]]){
    const size=screenDieSize(w,h), radius=screenDieRadius(size);
    assert.ok(size<=45,'too large at '+w+'x'+h+': '+size);
    assert.ok(size>=Math.min(32,w*.085)-.01,'too small at '+w+'x'+h+': '+size);
    assert.ok(size>=12);
    const area=diceSafeArea(w,h,radius);
    assert.ok(area.left>=radius && area.right<=w-radius);
    assert.ok(area.top>=radius && area.bottom<=h-radius);
  }
});
test('every die starts to the right, then stays within the viewport after entry',()=>{
  for(const [width,height] of [[320,568],[390,650],[430,930],[1280,720],[1920,1080]]){
    const radius=screenDieRadius(screenDieSize(width,height));
    for(const [seed,seedY] of [[0,0],[.01,.99],[.5,.5],[.99,.01],[1,1]]){
      const d=spawnScreenDie({id:String(width)+':'+seed+':'+seedY,width,height,radius,seed,seedY});
      assert.ok(d.x-radius>width, 'must arrive from the right edge');
      let entered=false;
      for(let i=0;i<600;i++){
        stepScreenDice([d],width,height,1/90);
        if(d.entered)entered=true;
        if(entered){
          const area=diceSafeArea(width,height,radius);
          assert.ok(d.x>=area.left-1e-6 && d.x<=area.right+1e-6,JSON.stringify(d));
          assert.ok(d.y>=area.top-1e-6 && d.y<=area.bottom+1e-6,JSON.stringify(d));
        }
      }
      assert.ok(entered,'a die must actually enter the screen');
    }
  }
});
test('overlapping landed dice physically separate rather than stack',()=>{
  const radius=24;
  const bodies:DiceBody[]=[
    {id:'a',x:170,y:220,vx:0,vy:0,radius,entered:true,impact:0},
    {id:'b',x:173,y:222,vx:0,vy:0,radius,entered:true,impact:0}
  ];
  for(let i=0;i<6;i++)stepScreenDice(bodies,390,650,1/90);
  assert.ok(Math.hypot(bodies[0].x-bodies[1].x,bodies[0].y-bodies[1].y)>=(radius*2)-.1);
});
test('colliding moving dice exchange impulse and leave no merged objects',()=>{
  const bodies:DiceBody[]=[
    {id:'a',x:164,y:220,vx:540,vy:0,radius:26,entered:true,impact:0},
    {id:'b',x:218,y:220,vx:-540,vy:0,radius:26,entered:true,impact:0},
  ];
  stepScreenDice(bodies,390,650,1/90);
  assert.ok(bodies[0].vx<0 && bodies[1].vx>0,'dice should bounce');
  assert.ok(bodies[0].impact>0 && bodies[1].impact>0);
  assert.ok(bodies[0].x+26<=bodies[1].x-26+.3);
});
test('many simultaneous right-side dice remain on the board and never stack',()=>{
  const width=390,height=650,radius=screenDieRadius(screenDieSize(width,height));
  const bodies=Array.from({length:9},(_,i)=>spawnScreenDie({
    id:'die'+i,width,height,radius,
    seed:(i*.137)%1,seedY:(i*.293+.14)%1,index:i
  }));
  for(let frame=0;frame<420;frame++){
    stepScreenDice(bodies,width,height,1/90);
    for(const die of bodies){
      if(!die.entered)continue;
      const area=diceSafeArea(width,height,die.radius);
      assert.ok(die.x>=area.left-.001 && die.x<=area.right+.001);
      assert.ok(die.y>=area.top-.001 && die.y<=area.bottom+.001);
    }
  }
  assert.ok(bodies.every(d=>d.entered));
  for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++){
    const a=bodies[i],b=bodies[j];
    const dist=Math.hypot(a.x-b.x,a.y-b.y);
    assert.ok(dist+1 >= a.radius+b.radius,
      'overlap '+a.id+'/'+b.id+': '+dist.toFixed(2)+' vs '+(a.radius+b.radius).toFixed(2));
  }
});

test('the right-edge entrance is visible for more than one animation frame',()=>{
  for(const [width,height] of [[390,740],[1280,800]]){
    const radius=screenDieRadius(screenDieSize(width,height));
    const die=spawnScreenDie({id:'slow-in',width,height,radius,seed:.5,seedY:.5});
    // Nine 90 Hz frames = 100 ms, not enough to pass across the entire entry gap.
    for(let i=0;i<9;i++)stepScreenDice([die],width,height,1/90);
    assert.equal(die.entered,false,'entry should still be visible after 100ms');
    for(let i=0;i<90;i++)stepScreenDice([die],width,height,1/90);
    assert.equal(die.entered,true,'die should then visibly enter the board');
  }
});


test('a fast die crosses more than half the board and stays on screen',()=>{
  for(const [width,height] of [[390,740],[1280,800]]){
    const radius=screenDieRadius(screenDieSize(width,height));
    const die=spawnScreenDie({id:'long-flight',width,height,radius,seed:.65,seedY:.5});
    let minX=Infinity;
    for(let frame=0;frame<330;frame++){
      stepScreenDice([die],width,height,1/90);
      if(die.entered)minX=Math.min(minX,die.x);
    }
    assert.ok(minX<width*.47,'die did not travel far enough: '+minX+' / '+width);
    const area=diceSafeArea(width,height,radius);
    assert.ok(die.x>=area.left&&die.x<=area.right);
  }
});


test('a multi-die throw has independent angles, launch delays, speeds and spins',()=>{
  const width=1280,height=800,radius=screenDieRadius(screenDieSize(width,height));
  const bodies=Array.from({length:12},(_,i)=>spawnScreenDie({
    id:'direction-'+i,width,height,radius,index:i,
    seed:(i*0.381+0.13)%1,
    seedY:(i*0.271+0.07)%1,
    seedAngle:(i*0.437+0.05)%1,
    seedDelay:(i*0.193+0.27)%1,
    seedSpin:(i*0.317+0.17)%1
  }));
  const angles=bodies.map(d=>Math.atan2(d.vy,-d.vx));
  assert.ok(Math.max(...angles)-Math.min(...angles)>1,'launch directions should vary by > 1 radian');
  assert.ok(new Set(bodies.map(d=>Math.round(Math.hypot(d.vx,d.vy)/25))).size>=6,'speeds should vary');
  assert.ok(new Set(bodies.map(d=>Math.round((d.launchDelay||0)*1000/40))).size>=5,'launch times should vary');
  assert.ok(bodies.some(d=>(d.spinVelocity||0)<0)&&bodies.some(d=>(d.spinVelocity||0)>0),'both spin directions');
  // Dynamics should not collapse into a shared horizontal velocity.
  for(let frame=0;frame<85;frame++)stepScreenDice(bodies,width,height,1/90);
  assert.ok(bodies.filter(d=>d.entered).length>=6);
  const directions=bodies.filter(d=>d.entered).map(d=>Math.atan2(d.vy,d.vx));
  assert.ok(Math.max(...directions)-Math.min(...directions)>.4,'directions remain different in flight');
  assert.ok(bodies.some(d=>Math.abs(d.spin||0)>.2),'dies tumble independently');
});


test('angular speed follows each die travel speed and decays when it stops',()=>{
  const spec={width:1000,height:740,radius:40,seed:.41,seedY:.43,seedAngle:.46,seedDelay:.3,seedSpin:.78};
  const fast=spawnScreenDie({id:'fast',...spec}), slow=spawnScreenDie({id:'slow',...spec});
  for(const die of [fast,slow]){
    die.x=550;die.y=310;die.entered=true;die.launchDelay=0;die.spinVelocity=0;
    die.surfaceDrag=.03;
  }
  fast.vx=-750;fast.vy=0;
  slow.vx=-145;slow.vy=0;
  for(let i=0;i<18;i++){
    stepScreenDice([fast],1000,740,1/90);
    stepScreenDice([slow],1000,740,1/90);
  }
  assert.ok(Math.abs(fast.spinVelocity||0)>Math.abs(slow.spinVelocity||0)*3,
    'fast die should tumble much faster: '+fast.spinVelocity+' vs '+slow.spinVelocity);
  const before=Math.abs(fast.spinVelocity||0);
  fast.vx=0;fast.vy=0;
  for(let i=0;i<48;i++)stepScreenDice([fast],1000,740,1/90);
  assert.ok(Math.abs(fast.spinVelocity||0)<before*.17,'rotation should wind down when movement ends');
});
test('wood friction stops dice finitely without spontaneous hops',()=>{
  const d:DiceBody={id:'wood',x:500,y:400,vx:300,vy:0,radius:35,entered:true,impact:0};
  let peak=0;
  for(let i=0;i<180;i++){
    stepScreenDice([d],2000,1000,1/120);
    peak=Math.max(peak,d.hopHeight||0);
  }
  assert.equal(peak,0);
  assert.equal(d.vx,0);
  assert.ok(d.x>580&&d.x<590,'finite stop close to v²/(2a)');
  const x=d.x;
  for(let i=0;i<120;i++)stepScreenDice([d],2000,1000,1/120);
  assert.equal(d.x,x,'no creeping after stop');
});
test('slow collisions stay grounded; hard collisions can lift with energy loss',()=>{
  for(const speed of [100,700]){
    const bodies:DiceBody[]=[
      {id:'a',x:500,y:400,vx:speed,vy:0,radius:30,entered:true,impact:0},
      {id:'b',x:561,y:400,vx:-speed,vy:0,radius:30,entered:true,impact:0}
    ];
    stepScreenDice(bodies,2000,1000,1/120);
    const energy=bodies.reduce((sum,d)=>sum+d.vx*d.vx+d.vy*d.vy+(d.hopVelocity||0)**2,0);
    assert.ok(energy<2*speed*speed);
    assert.equal((bodies[0].hopVelocity||0)>0,speed===700);
  }
});
test('rolling axis follows travel, and rotation equals travelled arc',()=>{
  for(const [vx,vy] of [[300,0],[0,300],[-300,0]]){
    const d:DiceBody={id:'axis',x:500,y:400,vx,vy,radius:35,entered:true,impact:0};
    stepScreenDice([d],2000,1000,1/120);
    const [qx,qy,qz,qw]=d.orientation!;
    assert.ok(Math.abs(qz)<1e-9);
    assert.ok(Math.abs(qx*vx+qy*vy)<1e-9,'axis perpendicular to travel');
    const angle=2*Math.acos(qw);
    const distance=Math.hypot(d.x-500,d.y-400);
    assert.ok(Math.abs(angle-distance/((35-2)/1.27*.82))<1e-8);
    assert.ok(Math.sign(qx)==(Math.sign(-vy)||0));
    assert.equal(Math.sign(qy),Math.sign(vx)||0);
  }
});
