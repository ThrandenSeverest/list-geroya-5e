export const sheetPanelIds=['skills','core','attacks','inventory','features','saves','proficiencies'] as const;
export type SheetPanelId=typeof sheetPanelIds[number];
export type SheetPlacement={id:SheetPanelId;start:number;span:number;top:number;height:number};
export type SheetFit={placements:SheetPlacement[];height:number;score:number};
type Candidate={placements:SheetPlacement[];bottoms:number[];area:number;score:number};
export const sheetColumns=24;
const gap=8;
const widths=[6,7,8,9,10,11,12,14,16];
/** All dimensions are measured at the requested font sizes, in CSS pixels.
 * A beam search compares whole-page layouts, rather than resizing the clicked card.
 * The three summary columns stay at the top; the other four panels fill their gaps.
 */
export function fitSheet(measure:(id:SheetPanelId,span:number)=>number,availableHeight:number):SheetFit {
  const score=(bottoms:number[],area:number)=>{
    const height=Math.max(...bottoms);
    const overflow=Math.max(0,height-availableHeight);
    return overflow*overflow*100+height*30+(height*sheetColumns-area)*.04;
  };
  function place(state:Candidate,id:SheetPanelId,start:number,span:number):Candidate {
    const top=Math.max(...state.bottoms.slice(start,start+span));
    const height=Math.ceil(measure(id,span));
    const bottoms=state.bottoms.slice();
    for(let i=start;i<start+span;i++)bottoms[i]=top+height+gap;
    const area=state.area+span*height;
    return {bottoms,area,placements:[...state.placements,{id,start,span,top,height}],score:score(bottoms,area)};
  }
  let beam:Candidate[]=[];
  for(const skills of [7,8,9,10,11])for(const core of [6,7,8]){
    const attacks=sheetColumns-skills-core;
    if(attacks<7)continue;
    let state:Candidate={bottoms:Array(sheetColumns).fill(0),placements:[],area:0,score:0};
    state=place(state,'skills',0,skills);
    state=place(state,'core',skills,core);
    state=place(state,'attacks',skills+core,attacks);
    beam.push(state);
  }
  for(const id of ['inventory','features','saves','proficiencies'] as const){
    const next:Candidate[]=[];
    for(const state of beam)for(const span of widths){
      // Only start at the left edge or an existing column boundary. This avoids
      // ragged one-cell gutters while still comparing both sides of every gap.
      const starts=new Set([0,sheetColumns-span]);
      for(let i=1;i<sheetColumns;i++)if(state.bottoms[i]!==state.bottoms[i-1]){starts.add(i);starts.add(i-span);}
      for(const start of starts)if(start>=0&&start+span<=sheetColumns)next.push(place(state,id,start,span));
    }
    next.sort((a,b)=>a.score-b.score);
    beam=next.slice(0,36);
  }
  const best=beam[0];
  return {placements:best.placements,height:Math.max(...best.placements.map(p=>p.top+p.height)),score:best.score};
}

export function optimalSheetSizes<T extends Record<string,number>>(initial:T,evaluate:(sizes:T)=>number,availableHeight:number):T {
  const groups=Object.keys(initial);
  const uniform=(size:number)=>Object.fromEntries(groups.map(key=>[key,size])) as T;
  let sizes=uniform(100);
  // Find a common readable size first; then spend the remaining room on
  // individual groups. No attack, item, or rules text is removed to make it fit.
  while(evaluate(sizes)>availableHeight&&Math.min(...Object.values(sizes))>70)sizes=uniform(sizes[groups[0]]-10);
  while(sizes[groups[0]]<160){const next=uniform(sizes[groups[0]]+10);if(evaluate(next)>availableHeight)break;sizes=next;}
  for(let pass=0;pass<16;pass++){
    let best:T|undefined,bestHeight=-1;
    const smallest=Math.min(...Object.values(sizes));
    for(const group of groups){
      if(sizes[group]>=160||sizes[group]>smallest+20)continue;
      const next={...sizes,[group]:sizes[group]+10};
      const height=evaluate(next);
      if(height<=availableHeight&&height>bestHeight){best=next;bestHeight=height;}
    }
    if(!best)break;
    sizes=best;
  }
  return sizes;
}
