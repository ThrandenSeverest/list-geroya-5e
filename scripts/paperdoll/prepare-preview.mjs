import fs from 'node:fs';
import path from 'node:path';

// A separate URL under /assets survives the main publisher's assets retention.
const base = '/list-geroya-5e/assets/paperdoll';
const root = 'dist/client';
const isolation = `<script>(()=>{const prefix='herolist-paperdoll-v1:';for(const name of ['localStorage','sessionStorage']){const raw=window[name];const keys=()=>Array.from({length:raw.length},(_,i)=>raw.key(i)).filter(k=>k&&k.startsWith(prefix));const scoped={getItem:k=>raw.getItem(prefix+k),setItem:(k,v)=>raw.setItem(prefix+k,v),removeItem:k=>raw.removeItem(prefix+k),clear:()=>keys().forEach(k=>raw.removeItem(k)),key:i=>keys()[i]?.slice(prefix.length)??null};Object.defineProperty(scoped,'length',{get:()=>keys().length});Object.defineProperty(window,name,{value:scoped,configurable:true});}})();</script>`;
function walk(dir) {
  for (const item of fs.readdirSync(dir, {withFileTypes:true})) {
    const file = path.join(dir,item.name);
    if (item.isDirectory()) walk(file);
    else if (/\.(html|css|js)$/.test(file)) {
      let value = fs.readFileSync(file,'utf8');
      value = value.replaceAll('href="/assets/_vinext_fonts',`href="${base}/assets/_vinext_fonts`)
        .replaceAll('url(/assets/_vinext_fonts',`url(${base}/assets/_vinext_fonts`);
      if (file.endsWith('.html')) value = value.replace(/<head(?:\s[^>]*)?>/i, match=>match+isolation);
      fs.writeFileSync(file,value);
    }
  }
}
walk(root);
fs.writeFileSync(`${root}/.nojekyll`,'');
fs.writeFileSync(`${root}/PAPERDOLL_BUILD.json`,JSON.stringify({variant:'paperdoll',base,storagePrefix:'herolist-paperdoll-v1:',source:process.env.GITHUB_SHA || 'local',builtAt:new Date().toISOString()},null,2)+'\n');
console.log(`Prepared isolated Paperdoll preview at ${base}/`);
