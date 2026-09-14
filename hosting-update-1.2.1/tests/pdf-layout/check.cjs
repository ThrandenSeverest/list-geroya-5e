const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {spawn}=require('node:child_process');
const http=require('node:http');
const path=require('node:path');

function waitForServer(url, server, timeout=30000) {
 return new Promise((resolve,reject)=>{
  const started=Date.now();
  let settled=false;
  const finish=(error)=>{
   if(settled)return;
   settled=true;
   error?reject(error):resolve();
  };
  server.once('error',finish);
  server.once('exit',code=>finish(new Error('Vite exited before readiness with code '+code)));
  const attempt=()=>{
   if(settled)return;
   const request=http.get(url,response=>{
    response.resume();
    if(response.statusCode && response.statusCode<500)finish();
    else retry();
   });
   request.setTimeout(1000,()=>request.destroy());
   request.on('error',retry);
  };
  const retry=()=>{
   if(settled)return;
   if(Date.now()-started>=timeout)return finish(new Error('Timed out waiting for PDF fixture server'));
   setTimeout(attempt,250);
  };
  attempt();
 });
}

(async()=>{
 const server=spawn('./node_modules/.bin/vite',['--config','tests/pdf-layout/vite.config.mjs'],{
  cwd:path.resolve(__dirname,'../..'),
  stdio:['ignore','pipe','pipe'],
 });
 server.stdout.on('data',data=>process.stdout.write(data));
 server.stderr.on('data',data=>process.stderr.write(data));
 try {
  await waitForServer('http://127.0.0.1:5174/tests/pdf-layout/index.html',server);
  const browser=await chromium.launch({headless:true,executablePath:process.env.PDF_TEST_CHROMIUM,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-zygote']});
  try {
   const page=await browser.newPage({viewport:{width:1100,height:1400}});
   page.on('pageerror',error=>console.log('ERROR',error.message));
   for(const count of [0,1,2,3,5,6,12,24]) {
    await page.goto('http://127.0.0.1:5174/tests/pdf-layout/index.html?resources='+count);
    await page.locator('.pdf-primary-grid').waitFor();
    await page.evaluate(()=>document.fonts.ready);
    for(const media of ['screen','print']){
     await page.emulateMedia({media});
     await page.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));
     const result=await page.evaluate(()=>{
      const rect=element=>{const value=element.getBoundingClientRect();return {top:value.top,bottom:value.bottom,left:value.left,right:value.right,height:value.height}};
      const grid=document.querySelector('.pdf-primary-grid'),resources=document.querySelector('.pdf-resources'),inventory=document.querySelector('.pdf-inventory'),footer=document.querySelector('.pdf-primary-page footer');
      return {grid:rect(grid),resources:rect(resources),inventory:rect(inventory),footer:rect(footer),zoom:document.querySelector('.pdf-primary-content').style.zoom,pages:document.querySelectorAll('.pdf-page').length,count:document.querySelectorAll('.pdf-resource').length,overflow:[...document.querySelectorAll('.pdf-resource-page-grid')].map(element=>rect(element).bottom>rect(element.parentElement.querySelector('footer')).top)};
     });
     if(result.resources.bottom>result.inventory.top+.5 || result.grid.bottom>result.footer.top-2 || result.overflow.some(Boolean) || result.count!==count)throw Error(JSON.stringify({count,media,result}));
     console.log(JSON.stringify({count,media,zoom:result.zoom,pages:result.pages}));
    }
   }
  } finally {
   await browser.close();
  }
 } finally {
  server.kill();
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
