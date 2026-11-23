const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=(process.env.HEROLIST_URL||'http://127.0.0.1:3997/list-geroya-5e/dice-preview/').replace(/\/?$/,'/');
(async()=>{const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});try{
 for(const [width,height,dpr] of [[1280,800,1],[390,740,3]]){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:dpr,isMobile:width<700});const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(root+'dice-lab/',{waitUntil:'networkidle'});
  const canvas=page.locator('canvas.hero-screen-dice'),history=page.getByTestId('dice-history-result');
  const settings=async()=>page.getByRole('button',{name:'Настройки кубиков',exact:true}).click();
  const close=async()=>page.getByRole('button',{name:'Закрыть настройки кубиков'}).click();
  await settings();await page.getByLabel('Время исчезновения кубиков').selectOption('30');await close();
  await page.getByRole('button',{name:'12d6',exact:true}).click();
  await page.waitForFunction(()=>JSON.parse(document.querySelector('canvas.hero-screen-dice')?.dataset.diceState||'[]').length===12);
  assert.equal(await history.count(),0,'No result before landing');
  const read=()=>canvas.evaluate(n=>JSON.parse(n.dataset.diceState||'[]'));
  const initial=await read();assert.ok(initial.some(d=>!d.settled&&d.value===undefined));
  assert.equal(await canvas.getAttribute('data-dice-engine'),'physical-outcome-v9');
  await page.getByRole('button',{name:'3d6',exact:true}).click();
  await page.waitForFunction(()=>{const d=JSON.parse(document.querySelector('canvas.hero-screen-dice')?.dataset.diceState||'[]');return d.length===15&&d.every(x=>x.settled);},undefined,{timeout:45000});
  const landed=await read();assert.equal(await history.count(),2);for(const d of landed){assert.ok(d.flat>.9995);assert.ok(d.value>=1&&d.value<=d.sides);assert.ok(d.x>=0&&d.x<=width&&d.y>=0&&d.y<=height);}
  for(const d of initial)assert.deepEqual(landed.find(x=>x.id===d.id).labels,d.labels);
  await page.waitForTimeout(300);assert.deepEqual((await read()).map(d=>[d.orientation,d.value,d.x,d.y]),landed.map(d=>[d.orientation,d.value,d.x,d.y]),'No rollback after settling');
  const results=await history.evaluateAll(nodes=>nodes.map(n=>JSON.parse(n.dataset.result)));
  for(const r of results){const count=r.rolls.length,group=landed.filter(d=>landed.filter(x=>x.id.split(':')[0]===d.id.split(':')[0]).length===count);assert.deepEqual(group.map(d=>d.value),r.rolls);}
  assert.equal((await page.request.get(root+'audio/dice-wood.mp3')).status(),200);
  await page.getByRole('button',{name:'Очистить кубики'}).click();
  await page.getByRole('button',{name:'1d4+1d6+1d8+1d10+1d12+1d20',exact:true}).click();
  await page.waitForFunction(()=>{const d=JSON.parse(document.querySelector('canvas.hero-screen-dice')?.dataset.diceState||'[]');return d.length===6&&d.every(x=>x.settled);},undefined,{timeout:45000});
  assert.ok((await read()).every(d=>d.flat>.9995));
  await settings();await page.getByLabel('Стиль чисел на кубиках').selectOption('modern');await page.getByLabel('Цвет чисел на кубиках').fill('#11ccff');await page.getByLabel('Отображение к4').selectOption('face');await page.getByLabel('Размер кубиков',{exact:true}).fill('120');await page.getByLabel('Звук броска',{exact:true}).uncheck();await page.getByLabel('Анимация бросков',{exact:true}).uncheck();await close();
  await page.waitForFunction(()=>JSON.parse(document.querySelector('canvas.hero-screen-dice')?.dataset.diceState||'[]').length===0);
  const before=await history.count();await page.getByRole('button',{name:'1d4',exact:true}).click();assert.equal(await history.count(),before+1);assert.equal((await read()).length,0);
  await page.reload({waitUntil:'networkidle'});await settings();assert.equal(await page.getByLabel('Отображение к4').inputValue(),'face');assert.equal(await page.getByLabel('Размер кубиков',{exact:true}).inputValue(),'120');assert.equal(await page.getByLabel('Анимация бросков',{exact:true}).isChecked(),false);await close();
  assert.deepEqual(errors,[]);console.log('Dice physics, outcomes, settings and audio verified',width,height);await context.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
