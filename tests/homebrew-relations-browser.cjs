const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {spawn}=require('node:child_process');
const base=process.env.HEROLIST_URL||'http://127.0.0.1:3997';
const make=(type,name,id)=>({id:`hb:test:${type}:${id}`,type,name,description:'',schemaVersion:2,updatedAt:'2026-10-05T00:00:00Z',effects:[],resources:[],attacks:[],actions:[],choices:[]});
(async()=>{
 const server=process.env.HEROLIST_URL?null:spawn(process.execPath,['node_modules/vinext/dist/cli.js','start','--port','3997'],{stdio:'ignore'});
 const browser=await chromium.launch({headless:true,executablePath:process.env.HB_TEST_CHROMIUM,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  for(let n=0;n<40;n++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,500));}
  for(const width of [1440,390])for(const type of ['feat','race','background','subclass','subrace','ability','item','spell']){
   const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage();page.setDefaultTimeout(10000);
   const root=make(type,'Источник '+type,'root'),body=make('ability','Тело','body'),dependent=make('ability','Улучшение тела','dependent');
   if(type==='subclass')root.parentClassId='official:class:fighter';
   root.choices=[{id:'hb:test:ability:choice',name:'Сакральный фокус',type:'ability',count:1,from:[body.id,dependent.id],level:1}];
   const errors=[];page.on('pageerror',error=>errors.push(error.message));
   await page.route('**/api/account',route=>route.fulfill({json:{authenticated:false}}));
   await page.addInitScript(({root,body,dependent})=>{if(!localStorage.getItem('herolist-homebrew-local-v2'))localStorage.setItem('herolist-homebrew-local-v2',JSON.stringify({version:2,schemaVersion:2,elements:[root,body,dependent]}));}, {root,body,dependent});
   const openWorkshop=async()=>{await page.getByRole('button',{name:'Мои персонажи',exact:false}).first().click();const hb=page.getByRole('button',{name:'Моё хоумбрю',exact:true});try{await hb.waitFor({state:'visible',timeout:5000});}catch{await page.getByRole('button',{name:'Мои персонажи',exact:false}).first().click();await hb.waitFor({state:'visible'});}await hb.click();};
   const openChoices=async()=>{if(type==='subclass'){await page.getByRole('button',{name:'Развитие и способности',exact:true}).click();await page.getByRole('button',{name:/^Уровень 1:/}).click();}else await page.getByRole('button',{name:'Механика',exact:true}).click();};
   await page.goto(base);await openWorkshop();
   await page.locator('.hb-sidebar-package > button').filter({hasText:root.name}).click();await openChoices();
   const choice=page.locator('.hb-unified-choice').first();
   await choice.getByRole('button',{name:'+ Создать вариант здесь',exact:true}).click();
   await choice.getByLabel('Название нового варианта',{exact:true}).fill('Дух');await choice.getByRole('button',{name:'Создать и добавить в выбор',exact:true}).click();
   await page.getByRole('button',{name:'Отменить',exact:true}).click();assert.equal(await choice.getByRole('button',{name:'Дух',exact:true}).count(),0);
   await page.getByRole('button',{name:'Повторить',exact:true}).click();await choice.getByLabel('Описание варианта',{exact:true}).fill('Новый вариант с постоянным бонусом.');
   await choice.getByText('Эффекты, ресурсы, атаки и вложенные выборы варианта',{exact:true}).click();
   await choice.getByRole('button',{name:/Изменить показатели/}).click();await choice.getByRole('button',{name:'+ Эффект',exact:true}).click();await choice.getByLabel('Тип эффекта',{exact:true}).selectOption('ac_bonus');
   await choice.locator('.hb-relation-modes').getByRole('button',{name:'Открывает другую способность',exact:true}).click();
   await choice.locator('.hb-relation-add .hb-named-reference > button').click();await choice.locator('.hb-relation-add').getByRole('button',{name:'Улучшение тела',exact:true}).click();
   assert.match(await choice.locator('.hb-relationships').first().innerText(),/Улучшение тела/);
   await choice.getByRole('button',{name:'Карта связей выбора',exact:true}).click();assert.ok(await choice.locator('.hb-relations-map').isVisible());
   await page.locator('.hb-editor').screenshot({path:`/tmp/hb-relations-${type}-${width}.png`});
   assert.ok(await page.locator('.hb-editor').evaluate(element=>element.scrollWidth<=element.clientWidth+1));
   // Reload before saving: every edited/new dependency must survive with its root.
   await page.reload();await openWorkshop();await openChoices();
   const restored=page.locator('.hb-unified-choice').first();await restored.locator('.hb-option-tabs').getByRole('button',{name:'Дух',exact:true}).click();
   assert.equal(await restored.getByLabel('Описание варианта',{exact:true}).inputValue(),'Новый вариант с постоянным бонусом.');
   await page.getByRole('button',{name:'Сохранить изменения',exact:true}).click();await page.getByRole('button',{name:'Сохранено',exact:true}).waitFor();
   const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('herolist-homebrew-local-v2'))),savedRoot=saved.elements.find(row=>row.id===root.id),newOption=saved.elements.find(row=>row.name==='Дух'),savedDependent=saved.elements.find(row=>row.id===dependent.id);
   assert.ok(savedRoot.choices[0].from.includes(newOption.id));assert.equal(newOption.effects[0].type,'ac_bonus');assert.equal(savedDependent.requirements[0].id,newOption.id);assert.equal(savedRoot.schemaVersion,2);
   assert.deepEqual(errors,[]);console.log(`Unified choices ${type} ${width}: passed`);await context.close();
  }
 }finally{await browser.close();if(server)server.kill();}
})().catch(error=>{console.error(error);process.exitCode=1});
