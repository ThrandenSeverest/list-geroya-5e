const assert=require('node:assert/strict');
const { chromium }=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root=(process.env.HEROLIST_URL || 'http://127.0.0.1:3997/list-geroya-5e/dice-preview/').replace(/\/?$/,'/');
(async()=>{
  const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  try{
    for(const [width,height,dpr] of [[1280,800,1],[390,740,3]]){
      const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:dpr,isMobile:width<700});
      const page=await context.newPage();
      const errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      page.on('response',response=>{
        if(response.status()>=400 && !response.url().endsWith('/favicon.ico') && new URL(response.url()).origin===new URL(root).origin) {
          errors.push(response.status()+' '+response.url());
        }
      });
      await page.goto(root+'dice-lab/',{waitUntil:'networkidle',timeout:90000});
      await page.getByRole('heading',{name:'Лаборатория кубиков'}).waitFor({timeout:20000});
      const canvas=page.locator('canvas.hero-screen-dice');
      await canvas.waitFor({state:'attached'});
      const build=await page.getByTestId('dice-build').innerText();
      assert.match(build,/dice-preview build|Локальная сборка/);
      const button=page.getByRole('button',{name:'12d6',exact:true});
      await button.click();
      await page.waitForFunction(()=>document.querySelector('canvas.hero-screen-dice')?.dataset.diceEngine==='independent-random-trajectories-v5');
      await page.waitForFunction(()=>{
        const data=document.querySelector('canvas.hero-screen-dice')?.dataset.diceState;
        try{return JSON.parse(data||'[]').length===12;}catch{return false;}
      },undefined,{timeout:5000});
      const dimensions=await canvas.evaluate(node=>({
        canvasWidth:node.getBoundingClientRect().width,
        canvasHeight:node.getBoundingClientRect().height,
        innerWidth:window.innerWidth,
        visualWidth:window.visualViewport?.width,
        clientWidth:document.documentElement.clientWidth
      }));
      assert.ok(dimensions.canvasWidth<=Math.min(dimensions.innerWidth,dimensions.visualWidth||Infinity)+1,
        'Canvas must fit the visible viewport: '+JSON.stringify(dimensions));
      let items=await canvas.evaluate(node=>JSON.parse(node.dataset.diceState||'[]'));
      assert.equal(items.length,12);
      assert.ok(items.every(d=>d.modelSize>=30&&d.modelSize<=45),'Moderate-size dice: '+JSON.stringify(items));
      const angles=items.map(d=>Math.atan2(d.vy,-d.vx));
      assert.ok(Math.max(...angles)-Math.min(...angles)>.5,
        'The dice must not share a synchronized leftward path: '+JSON.stringify(items));
      // The spawn side is checked in deterministic physics tests; browser polling is too late to observe one exact launch frame.
      // Launch a second throw before the first has expired.
      await page.getByRole('button',{name:'3d6',exact:true}).click();
      await page.waitForFunction(()=>{
        const data=document.querySelector('canvas.hero-screen-dice')?.dataset.diceState;
        try{return JSON.parse(data||'[]').length===15;}catch{return false;}
      },{timeout:5000});
      await page.waitForFunction(()=>{
        const items=JSON.parse(document.querySelector('canvas.hero-screen-dice')?.dataset.diceState||'[]');
        return items.length===15 && items.every(d=>d.entered);
      },undefined,{timeout:12000});
      await page.waitForTimeout(1100);
      items=await canvas.evaluate(node=>JSON.parse(node.dataset.diceState||'[]'));
      assert.equal(items.length,15);
      assert.ok(items.every(d=>d.entered));
      for(const item of items){
        assert.ok(item.x-item.radius>=-1&&item.x+item.radius<=width+1,
          'horizontal boundary '+width+'x'+height+': '+JSON.stringify(item));
        assert.ok(item.y-item.radius>=-1&&item.y+item.radius<=height+1,
          'vertical boundary '+width+'x'+height+': '+JSON.stringify(item));
      }
      for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){
        const a=items[i],b=items[j];
        const dist=Math.hypot(a.x-b.x,a.y-b.y);
        assert.ok(dist+2>=a.radius+b.radius,
          'overlapping dice '+a.id+'/'+b.id+': '+dist+' required '+(a.radius+b.radius));
      }
      assert.deepEqual(errors,[], 'no JS or HTTP errors');
      await page.screenshot({path:'/tmp/dice-lab-'+width+'.png'});
      console.log('PASS dice lab',width,height,dpr,'build:',build,'dice:',items.length);
      await context.close();
    }
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});