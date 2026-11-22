/** Viewport-bounded trajectories. Coordinates are CSS px, independent of canvas DPR. */
export type DiceMotionSeed = { x: number; y: number; seed: number };
export type DiceMotion = { x: number; y: number; progress: number };
const unit = (n:number) => Math.min(1,Math.max(0,Number.isFinite(n)?n:0));
const range = (a:number,b:number,t:number) => a+(b-a)*t;
const ease = (t:number) => 1-Math.pow(1-t,3);

export function diceSafeArea(width:number,height:number,radius:number) {
  const w = Math.max(1,width), h = Math.max(1,height);
  const padX = Math.max(14,radius+10);
  const top = Math.max(20,radius+16);
  const bottom = Math.max(20,radius+(w<700?112:28));
  // Degenerate tiny viewports still produce a visible stable center.
  return {
    left: Math.min(padX,w/2), right:Math.max(w-padX,w/2),
    top:Math.min(top,h/2), bottom:Math.max(h-bottom,h/2)
  };
}

export function diceMotionAt(
  die:DiceMotionSeed,
  width:number,height:number,radius:number,
  elapsed:number,flight=1320
):DiceMotion {
  const bounds=diceSafeArea(width,height,radius);
  const t=unit(elapsed/flight);
  const sx=range(bounds.left,bounds.right,.22+unit(die.seed)*.56);
  const sy=range(bounds.top,bounds.bottom,.36+unit(die.seed)*.18);
  const endX=range(bounds.left,bounds.right,unit(die.x));
  const endY=range(bounds.top,bounds.bottom,.18+unit(die.y)*.64);
  const travel=ease(t);
  // The arc is zero at both ends. A single small impact precedes the stop.
  const arc=Math.sin(Math.PI*t)*Math.min(52,height*.095)*(1-t*.35);
  const bounce=t>.78?Math.sin(Math.PI*(t-.78)/.22)*Math.pow((1-t)/.22,1.5)*8:0;
  const x=range(sx,endX,travel);
  const y=range(sy,endY,travel)-arc-bounce;
  return {
    x:Math.min(bounds.right,Math.max(bounds.left,x)),
    y:Math.min(bounds.bottom,Math.max(bounds.top,y)),
    progress:t
  };
}

export function diceRenderPixelRatio(width:number,height:number,devicePixelRatio:number) {
  // Supersampled sharp small face lettering, bounded to ~12M pixels to protect phones.
  const budget=Math.sqrt(12_000_000/Math.max(1,width*height));
  return Math.max(1,Math.min(4,Math.max(1,devicePixelRatio)*1.25,budget));
}
