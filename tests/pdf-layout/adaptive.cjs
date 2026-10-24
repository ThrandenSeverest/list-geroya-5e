const assert=require('node:assert/strict');
const fs=require('node:fs');
const {spawn}=require('node:child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const out='/tmp/herolist-a4-review';fs.mkdirSync(out,{recursive:true});
const base='http://127.0.0.1:5174/tests/pdf-layout/index.html';
async function metrics(page){return page.evaluate(()=>{
 const rect=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};};
 const p=document.querySelector('.pdf-primary-page'),c=document.querySelector('.pdf-primary-content');
 return {page:rect(p),footer:rect(p.querySelector('footer')),scale:Number(c.dataset.fitScale),cards:[...p.querySelector('.pdf-primary-grid').children].map(el=>({id:el.dataset.sheetPanel,...rect(el),scroll:el.scrollWidth,client:el.clientWidth})),saves:document.querySelectorAll('.pdf-saving-throws .pdf-save-row>span').length};
});}
async function valid(page,label){const m=await metrics(page);
 assert.ok(Math.abs(m.page.w/m.page.h-210/297)<.002,label+' A4 ratio '+JSON.stringify(m));
 assert.equal(m.saves,6);
 for(const c of m.cards){assert.ok(c.x>=m.page.x&&c.right<=m.page.right+1&&c.bottom<=m.footer.y-2,label+' bounds '+JSON.stringify(c));assert.ok(c.scroll<=c.client+1,label+' horizontal overflow '+JSON.stringify(c));}
 for(let i=0;i<m.cards.length;i++)for(let j=i+1;j<m.cards.length;j++){const a=m.cards[i],b=m.cards[j];assert.ok(!(a.x<b.right-1&&b.x<a.right-1&&a.y<b.bottom-1&&b.y<a.bottom-1),label+' overlap '+a.id+' '+b.id);}
 return m;
}
(async()=>{
 const server=spawn('./node_modules/.bin/vite',['--config','tests/pdf-layout/vite.config.mjs'],{stdio:'ignore'});
 let browser;
 try{
  for(let i=0;i<60;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,300));}
  browser=await chromium.launch({headless:true,executablePath:process.env.HB_TEST_CHROMIUM,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:1100,height:1400}});page.setDefaultTimeout(60000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const edition of ['2014','2024'])for(const count of [0,3,24]){
   await page.goto(base+'?resources='+count+'&edition='+edition+'&scenario=adenon');await page.locator('[data-fitted=true]').waitFor();await page.evaluate(()=>document.fonts.ready);
   const before=await valid(page,'default');
   if(count===3){
    const savesBefore=await page.locator('.pdf-saving-throws .pdf-save-row').evaluate(el=>getComputedStyle(el).fontSize);
    await page.getByRole('button',{name:'Увеличить шрифт: навыки и владения',exact:true}).click();
    const after=await valid(page,'manual adjustment');
    const otherMoved=after.cards.some(c=>c.id!=='skills'&&JSON.stringify(c)!==JSON.stringify(before.cards.find(b=>b.id===c.id)));
    assert.ok(otherMoved,'A manual font change must reflow other panels');
    assert.notEqual(await page.locator('.pdf-saving-throws .pdf-save-row').evaluate(el=>getComputedStyle(el).fontSize),savesBefore,'Saving throws share the font adjustment');
   }
   await page.getByRole('button',{name:'Оптимальные настройки',exact:true}).click();
   await valid(page,'optimal');
   const sizes=await page.evaluate(()=>JSON.parse(localStorage.getItem('list-geroya-sheet-layout-v1')).sizes);
   assert.ok(Object.values(sizes).every(n=>n>=70&&n<=160));
   await page.locator('.pdf-primary-page').screenshot({path:out+`/a4-${edition}-${count}.png`});
   await page.emulateMedia({media:'print'});await page.evaluate(()=>dispatchEvent(new Event('beforeprint')));await valid(page,'print');
   assert.equal(await page.getByRole('button',{name:'Оптимальные настройки',exact:true}).isVisible(),false);
   if(count===3&&edition==='2014')await page.pdf({path:out+'/a4.pdf',preferCSSPageSize:true,printBackground:true});
   await page.emulateMedia({media:'screen'});await page.evaluate(()=>dispatchEvent(new Event('afterprint')));
   console.log(edition,count,'A4 + global reflow + optimal + print OK',sizes);
   await page.evaluate(()=>localStorage.clear());
  }
  for(const sizes of [{skills:70,inventory:70,features:70,attacks:70},{skills:160,inventory:160,features:160,attacks:160},{skills:160,inventory:70,features:110,attacks:130}]){
   await page.evaluate(sizes=>localStorage.setItem('list-geroya-sheet-layout-v1',JSON.stringify({sizes})),sizes);
   await page.goto(base+'?resources=3&scenario=adenon');await page.locator('[data-fitted=true]').waitFor();
   await page.waitForFunction(size=>document.querySelector('[aria-label="Размер шрифта: навыки и владения"]').textContent===size+'%',sizes.skills);
   await valid(page,'font limits');
   await page.emulateMedia({media:'print'});await page.evaluate(()=>dispatchEvent(new Event('beforeprint')));await valid(page,'print font limits');await page.emulateMedia({media:'screen'});
   console.log('extreme sizes OK',sizes);
  }
  await page.setViewportSize({width:390,height:900});await page.goto(base+'?scenario=adenon');await page.locator('[data-fitted=true]').waitFor();await valid(page,'phone');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assert.deepEqual(errors,[]);
 }finally{if(browser)await browser.close();server.kill();}
})().catch(e=>{console.error(e);process.exit(1);});
