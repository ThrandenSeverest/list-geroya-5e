const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async()=>{
 const {spawn}=require('node:child_process');
 const server=spawn('./node_modules/.bin/vite',['--config','tests/pdf-layout/vite.config.mjs'],{cwd:require('node:path').resolve(__dirname,'../..')});
 await new Promise((resolve,reject)=>{server.stdout.on('data',d=>{if(d.toString().includes('Local:')) resolve();});server.on('error',reject);});
 try {
 const browser=await chromium.launch({headless:true,executablePath:process.env.PDF_TEST_CHROMIUM,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-zygote']});
 const page=await browser.newPage({viewport:{width:1100,height:1400}});
 page.on('pageerror',e=>console.log('ERROR',e.message));
 for(const count of [0,1,2,3,5,6,12,24]) {
  await page.goto('http://127.0.0.1:5174/tests/pdf-layout/index.html?resources='+count);
  await page.locator('.pdf-primary-grid').waitFor();
  await page.evaluate(()=>document.fonts.ready);
  for(const media of ['screen','print']){
   await page.emulateMedia({media});
   await page.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));
   const result=await page.evaluate(()=>{
    const rect=e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height}};
    const grid=document.querySelector('.pdf-primary-grid'),res=document.querySelector('.pdf-resources'),inv=document.querySelector('.pdf-inventory'),foot=document.querySelector('.pdf-primary-page footer');
    return {grid:rect(grid),resources:rect(res),inventory:rect(inv),footer:rect(foot),zoom:document.querySelector('.pdf-primary-content').style.zoom,pages:document.querySelectorAll('.pdf-page').length,count:document.querySelectorAll('.pdf-resource').length,overflow:[...document.querySelectorAll('.pdf-resource-page-grid')].map(e=>rect(e).bottom>rect(e.parentElement.querySelector('footer')).top)};
   });
   if(result.resources.bottom>result.inventory.top+.5 || result.grid.bottom>result.footer.top-2 || result.overflow.some(Boolean) || result.count!==count)throw Error(JSON.stringify({count,media,result}));
   console.log(JSON.stringify({count,media,zoom:result.zoom,pages:result.pages}));
  }

 }
 await browser.close();
 } finally {server.kill();}
})();
