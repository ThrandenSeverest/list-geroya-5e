import colors from './themeColors.json';
import type { ThemePreset } from './interfacePreferences';

type CalmPalette = { bg:string; panel:string; raised:string; text:string; muted:string; border:string; accent:string; onAccent:string };
const palettes:Record<string,CalmPalette> = {
  paper:{bg:'#f5f6f7',panel:'#ffffff',raised:'#eef1f3',text:'#252b31',muted:'#59636d',border:'#cbd2d8',accent:'#456356',onAccent:'#ffffff'},
  graphite:{bg:'#202427',panel:'#292e32',raised:'#343b40',text:'#e6eaed',muted:'#b1bbc3',border:'#525d65',accent:'#aec6b8',onAccent:'#202925'},
  journal:{bg:'#f1eee5',panel:'#faf8f1',raised:'#e9e4d8',text:'#37382f',muted:'#646252',border:'#c9c2b2',accent:'#6e6045',onAccent:'#ffffff'},
};
function preset(id:string,name:string):ThemePreset {
  const p=palettes[id];
  const mapped=Object.fromEntries(colors.map(key=>{
    const [r,g,b]=[0,2,4].map(i=>parseInt(key.slice(i,i+2),16));
    const l=(.2126*r+.7152*g+.0722*b)/255;
    return [key,l<.18?p.bg:l<.32?p.raised:l<.53?p.muted:p.text];
  }));
  return {id,name,base:'classic',colors:mapped,roles:{ink:p.bg,panel:p.panel,'panel-2':p.raised,surface:p.panel,ivory:p.text,muted:p.muted,line:p.border,selection:p.accent,'copper-light':p.accent,copper:p.accent,'accent-text':p.onAccent,teal:p.accent,gold:p.accent,'gold-bright':p.text,'gold-deep':p.accent}};
}
export const calmPresets = [preset('paper','Чистый лист'),preset('graphite','Тихий графит'),preset('journal','Полевой журнал')];
export const designChoices = [
  {id:'classic',name:'Синий с золотом',description:'Тёмный фэнтезийный интерфейс',image:'classic'},
  {id:'parchment',name:'Пергамент',description:'Светлый пергамент и красные акценты',image:'parchment'},
  {id:'paper',name:'Чистый лист',description:'Светлые панели, минимум украшений',image:'paper'},
  {id:'graphite',name:'Тихий графит',description:'Матовый тёмный фон и мягкий контраст',image:'graphite'},
  {id:'journal',name:'Полевой журнал',description:'Тёплая бумага и компактные строки',image:'journal'},
];
export function findDesign(presets:ThemePreset[],id:string) { return presets.find(p=>p.id===id) || calmPresets.find(p=>p.id===id); }
export function isCalmDesign(presets:ThemePreset[],id:string) {
  const p=findDesign(presets,id);
  return Boolean(p && (palettes[p.id] || p.layout && palettes[p.layout]));
}
export function designLayout(presets:ThemePreset[],id:string) {
  const p=findDesign(presets,id);
  return p?.layout || (palettes[id]?id:'');
}
