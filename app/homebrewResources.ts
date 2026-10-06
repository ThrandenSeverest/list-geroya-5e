import type { HBResource } from './homebrew';

/** Sparse milestones inherit the latest unlocked value; v2 resources stay unchanged. */
export function resourceAtLevel(resource:HBResource,level:number):Pick<HBResource,'max'|'restore'> {
 let max=resource.max,restore=resource.restore;
 for(const step of [...resource.progression||[]].sort((a,b)=>a.level-b.level)){
  if(step.level>level)break;
  if(step.max!==undefined)max=step.max;
  if(step.restore!==undefined)restore=step.restore;
 }
 return {max,restore};
}
