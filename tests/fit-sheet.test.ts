import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fitSheet,optimalSheetSizes,sheetPanelIds} from '../app/fitSheet';

test('global fit places saves and proficiencies independently without overlaps',()=>{
  for(const multiplier of [0.7,1,1.6]){
    const fit=fitSheet((id,span)=>({skills:250,core:210,attacks:460,inventory:190,features:230,saves:90,proficiencies:100}[id])*multiplier*8/span,900);
    assert.deepEqual(fit.placements.map(p=>p.id).sort(),[...sheetPanelIds].sort());
    for(let i=0;i<fit.placements.length;i++)for(let j=i+1;j<fit.placements.length;j++){
      const a=fit.placements[i],b=fit.placements[j];
      assert.ok(!(a.start<b.start+b.span&&b.start<a.start+a.span&&a.top<b.top+b.height&&b.top<a.top+a.height));
    }
  }
});
test('optimal settings adjust all text groups, use available space, and preserve the size limits',()=>{
  const sizes={skills:70,inventory:160,features:80,attacks:150};
  const height=(next:typeof sizes)=>Object.values(next).reduce((sum,n)=>sum+n*2,0);
  const result=optimalSheetSizes(sizes,height,1050);
  assert.notDeepEqual(result,sizes);
  assert.ok(height(result)<=1050);
  assert.ok(Object.values(result).every(n=>n>=70&&n<=160));
  assert.ok(Object.values(result).some(n=>n>=130));
  assert.deepEqual(sizes,{skills:70,inventory:160,features:80,attacks:150});
});
