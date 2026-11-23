import { assetUrl } from './assetUrl';
let context:AudioContext|undefined,buffer:AudioBuffer|undefined,loading:Promise<void>|undefined,last=-1;
/** Called within a user's click so browsers permit later collision sounds. */
export function unlockDiceAudio(){
 if(typeof window==='undefined')return;
 try{
  context??=new AudioContext();void context.resume().catch(()=>{});
  loading??=fetch(assetUrl('/audio/dice-wood.mp3')).then(r=>{if(!r.ok)throw Error('audio');return r.arrayBuffer();}).then(bytes=>context!.decodeAudioData(bytes)).then(decoded=>{buffer=decoded;}).catch(()=>{loading=undefined;});
 }catch{/* Sound must never block a roll. */}
}
export function playDiceAudio(volume=.5,strength=1){
 if(!buffer&&loading){void loading.then(()=>{if(buffer)playDiceAudio(volume,strength);});return;}
 if(!context||!buffer||context.state!=='running')return;
 const now=context.currentTime;if(now-last<.10)return;last=now;
 const node=context.createBufferSource(),gain=context.createGain();node.buffer=buffer;node.playbackRate.value=.94+Math.random()*.12;
 gain.gain.value=Math.max(0,Math.min(1,volume))*Math.min(1,strength)*.7;node.connect(gain);gain.connect(context.destination);node.start();node.onended=()=>{node.disconnect();gain.disconnect();};
}
