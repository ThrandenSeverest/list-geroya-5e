import assert from 'node:assert/strict';
import test from 'node:test';
import { diceMotionAt, diceSafeArea, diceRenderPixelRatio } from '../app/diceScreenMotion';

test('even extreme dice trajectories remain inside the screen and clear mobile UI', () => {
  for (const [width,height,radius] of [
    [320,568,82],[390,650,96],[430,930,96],
    [768,900,132],[1280,720,132],[1920,1080,132]
  ]) {
    const safe=diceSafeArea(width,height,radius);
    assert.ok(safe.left>=radius);
    assert.ok(safe.right<=width-radius);
    assert.ok(safe.top>=radius);
    assert.ok(safe.bottom<=height-radius);
    for(let seed=0;seed<=1.001;seed+=.1){
      for(let x=0;x<=1.001;x+=.2)for(let y=0;y<=1.001;y+=.2){
        for(let ms=0;ms<=1600;ms+=47){
          const p=diceMotionAt({seed,x,y},width,height,radius,ms);
          assert.ok(p.x>=safe.left-1e-6&&p.x<=safe.right+1e-6,JSON.stringify({width,height,seed,x,y,ms,p}));
          assert.ok(p.y>=safe.top-1e-6&&p.y<=safe.bottom+1e-6,JSON.stringify({width,height,seed,x,y,ms,p}));
        }
      }
    }
  }
});
test('landing position remains identical after the flight, independent of elapsed time',()=>{
  const die={seed:.478,x:.93,y:.05};
  for(const [width,height,radius] of [[390,650,96],[1920,1080,132]]){
    const settled=diceMotionAt(die,width,height,radius,1320);
    for(const elapsed of [1350,2000,9000,30000]){
      assert.deepEqual(diceMotionAt(die,width,height,radius,elapsed),settled);
    }
  }
});
test('screen-aligned canvas uses supersampling on ordinary and high density screens',()=>{
  assert.ok(diceRenderPixelRatio(1280,720,1)>=2.5);
  assert.ok(diceRenderPixelRatio(390,850,3)>=3);
  assert.ok(diceRenderPixelRatio(3840,2160,3)<=Math.sqrt(12_000_000/(3840*2160))+.00001);
});
