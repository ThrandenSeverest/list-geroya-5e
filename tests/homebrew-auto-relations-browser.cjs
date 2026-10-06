const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const entities=require('../app/shamanExample.json').entities;
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.HB_TEST_CHROMIUM,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage();page.setDefaultTimeout(15000);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/api/account',route=>route.fulfill({json:{authenticated:false}}));
  // No manually configured references, including the old Shaman casting workaround.
  await page.addInitScript(entities=>localStorage.setItem('herolist-homebrew-local-v2',JSON.stringify({version:2,schemaVersion:2,elements:entities.map(element=>({...element,references:[]}))})),entities);
  await page.goto(process.env.HEROLIST_URL||'http://127.0.0.1:3998');
  await page.getByRole('button',{name:/^Мой Homebrew/}).click();
  await page.locator('.hb-sidebar-package > button').filter({hasText:'Шаман'}).first().click();
  await page.getByRole('button',{name:'Связи',exact:true}).click();
  const graph=page.locator('.hb-editor > .hb-relations-map').first();
  await graph.locator('.hb-graph-node').filter({hasText:'Сакральный фокус'}).filter({hasText:'Способность'}).first().click();
  assert.equal(await graph.locator('.hb-graph-current strong').innerText(),'Сакральный фокус');
  await graph.locator('.hb-graph-grid > section').last().getByRole('button',{name:/Сакральный фокус/}).click();
  const choice=graph.locator('.hb-unified-choice').first();
  for(const name of ['Тело','Сердце','Разум','Душа'])assert.equal(await choice.locator('.hb-option-tabs').getByRole('button',{name:new RegExp(name)}).count(),1);
  await choice.locator('.hb-option-tabs').getByRole('button',{name:/Сердце/}).click();
  const automatic=choice.locator('.hb-choice-option-editor > .hb-relationships');
  assert.match(await automatic.innerText(),/Разговор с животными|тотем|Тотем/);
  assert.equal(await automatic.getByLabel('Смысл новой связи').isVisible(),false);
  await choice.getByLabel('Описание варианта',{exact:true}).fill('Автоматическая связь сохраняет изменение варианта.');
  await page.getByRole('button',{name:'Сохранить изменения',exact:true}).click();
  await page.getByRole('button',{name:'Сохранено',exact:true}).waitFor();
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('herolist-homebrew-local-v2')));
  const root=saved.elements.find(e=>e.type==='class'),heart=saved.elements.find(e=>e.id==='hb:shaman:ability:focus-heart');
  assert.equal(root.choices.find(c=>c.name==='Сакральный фокус').from.length,4);
  assert.equal(heart.description,'Автоматическая связь сохраняет изменение варианта.');
  assert.deepEqual(root.references,[]);
  await page.screenshot({path:`/tmp/hb-auto-focus-${width}.png`,fullPage:true});
  await page.getByRole('button',{name:'Развитие и способности',exact:true}).click();
  await page.getByRole('button',{name:/^Уровень 2:/}).click();
  await page.getByRole('region',{name:'Магия и заклинания способности'}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Связать с магией класса',exact:true}).count(),0);
  assert.ok(await page.locator('.hb-editor').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
  assert.deepEqual(errors,[]);
  await page.screenshot({path:`/tmp/hb-auto-relations-${width}.png`,fullPage:true});
  console.log(`Automatic relations ${width}: four focus options, dependent rules, inline editing and magic without references OK`);
  await context.close();
 }}finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1)});
