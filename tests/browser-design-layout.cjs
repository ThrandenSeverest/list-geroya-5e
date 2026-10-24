const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url=process.env.HEROLIST_URL || 'http://127.0.0.1:3998';
const character={schemaVersion:4,rulesetId:'5e-2014',name:'Аденон Мислав Регулус Эденбургский',playerName:'',className:'wizard',startingClassId:'wizard',level:5,classes:[{classId:'wizard',level:5,subclassId:'bladesinging',acquiredAtCharacterLevel:1}],subclass:'bladesinging',race:'dhampir',raceVariant:'',background:'sage',abilities:{str:8,dex:16,con:14,int:18,wis:8,cha:12},currentHitPoints:32,spells:['firebolt','ray-of-frost','magic-missile','shield'],classSkills:['Магия','История'],backgroundSkills:[],inventoryOverride:'Кинжал\nКнига заклинаний\nНабор путешественника\nВерёвка\nЗелье лечения',currency:{gp:25,sp:0,cp:0,pp:0},personality:{traits:'',ideals:'',bonds:'',flaws:''}};
const key='list-geroya-character-vault-v1';
(async()=>{
 const launch=()=>chromium.launch({executablePath:process.env.HB_TEST_CHROMIUM,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--single-process']});
 const screenshots=process.env.HEROLIST_SHOTS || '/tmp/herolist-design-checks';fs.mkdirSync(screenshots,{recursive:true});
 try {
  for(const width of [1440,390,320]){
   const browser=await launch();const context=await browser.newContext({viewport:{width,height:1100},deviceScaleFactor:1});const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
   await page.route('**/api/**',r=>r.fulfill({json:{authenticated:false}}));
   await page.addInitScript(({character,key})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({version:1,capacity:5,activeId:'test',folders:[],slots:[{id:'test',updatedAt:'2026-10-24',character}]}));},{character,key});
   await page.goto(url);const dialog=page.locator('dialog[open]');await dialog.waitFor();assert.equal(await dialog.locator('.design-preview').count(),5);
   const before=JSON.parse(await page.evaluate(key=>localStorage.getItem(key),key)).slots[0].character;
   for(const name of ['Чистый лист','Полевой журнал','Тихий графит']){
    await dialog.getByRole('button',{name:new RegExp(name)}).click();
    assert.equal(await dialog.locator('img').evaluateAll(imgs=>imgs.filter(img=>!img.complete||!img.naturalWidth).length),0);
    const colors=await page.locator('.app-shell').evaluate(el=>({text:getComputedStyle(el).color,bg:getComputedStyle(el).backgroundColor}));assert.notEqual(colors.text,colors.bg);
   }
   await dialog.getByRole('button',{name:/Чистый лист/}).click();await dialog.getByRole('checkbox',{name:/Запомнить выбор/}).check();
   await page.screenshot({path:`${screenshots}/chooser-${width}.png`,fullPage:true});
   await dialog.getByRole('button',{name:'Использовать выбранный дизайн'}).click();
   await page.getByRole('button',{name:'Продолжить текущего персонажа',exact:true}).click();
   await page.locator('nav.steps button').filter({hasText:'Итог'}).click();await page.locator('.pdf-primary-page').waitFor();await page.evaluate(()=>document.fonts.ready);
   const sheet=page.locator('.pdf-document');
   await sheet.getByRole('button',{name:'Увеличить шрифт: навыки и владения',exact:true}).click();assert.equal(await sheet.getByLabel('Размер шрифта: навыки и владения',{exact:true}).innerText(),'110%');
   await sheet.getByRole('button',{name:'Уменьшить шрифт: навыки и владения',exact:true}).click();
   const inventory=sheet.locator('.pdf-inventory');const small=await inventory.locator('.pdf-inventory-list p').first().evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
   for(let i=0;i<3;i++)await inventory.getByRole('button',{name:'Увеличить шрифт: инвентарь',exact:true}).click();
   const large=await inventory.locator('.pdf-inventory-list p').first().evaluate(el=>parseFloat(getComputedStyle(el).fontSize));assert.ok(large>small);
   await sheet.getByRole('button',{name:'Настройки оружия и заклинаний',exact:true}).click();const attackSettings=page.locator('.pdf-display-settings[open]');
   await attackSettings.getByRole('checkbox',{name:'Урон',exact:true}).uncheck();assert.equal(await sheet.locator('.pdf-attacks article code').count(),0);
   await attackSettings.getByRole('checkbox',{name:'Описания и примечания',exact:true}).uncheck();
   await attackSettings.getByRole('checkbox',{name:'Оружие',exact:true}).uncheck();assert.equal(await sheet.locator('.pdf-attacks article').filter({hasText:'Кинжал'}).count(),0);
   await attackSettings.getByRole('button',{name:'Готово',exact:true}).click();
   await page.screenshot({path:`${screenshots}/sheet-${width}.png`,fullPage:true});
   await page.locator('.pdf-primary-page').screenshot({path:`${screenshots}/primary-${width}.png`});
   if(width>760){
    const positions=await sheet.locator('.pdf-primary-grid > *').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};}));
    for(let i=0;i<positions.length;i++)for(let j=i+1;j<positions.length;j++){const a=positions[i],b=positions[j];assert.ok(!(a.x<b.x+b.w-1&&b.x<a.x+a.w-1&&a.y<b.y+b.h-1&&b.y<a.y+a.h-1),'Panels must not overlap');}
    const gap=positions[3].y-(positions[1].y+positions[1].h);assert.ok(Number.isFinite(gap));
    await page.emulateMedia({media:'print'});await page.evaluate(()=>dispatchEvent(new Event('beforeprint')));
    assert.equal(await sheet.getByRole('button',{name:'Увеличить шрифт: инвентарь',exact:true}).isVisible(),false);
    await page.pdf({path:`${screenshots}/sheet.pdf`,preferCSSPageSize:true,printBackground:true});await page.emulateMedia({media:'screen'});
   } else assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow');
   await page.reload();await page.locator('.home-topbar').waitFor();await page.locator('.calm-design').waitFor();assert.equal(await page.locator('.design-gallery-dialog[open]').count(),0);
   assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('list-geroya-sheet-layout-v1')).sizes.inventory),130);
   if(width===1440){
    await page.getByRole('button',{name:'Дизайн',exact:true}).click();
    const gallery=page.locator('.design-gallery-dialog[open]');await gallery.getByRole('button',{name:'Создать свой дизайн',exact:true}).click();
    const editor=page.locator('.interface-settings[open]');await editor.getByLabel('Название темы',{exact:true}).fill('Своя спокойная тема');
    await editor.getByLabel('Основной текст',{exact:true}).fill('#172b24');await page.keyboard.press('Escape');
    await page.reload();await page.locator('.home-topbar').waitFor();await page.locator('.calm-design').waitFor();
    const preferences=await page.evaluate(()=>JSON.parse(localStorage.getItem('list-geroya-interface-v1')));assert.equal(preferences.presets[0].layout,'paper');assert.equal(preferences.presets[0].name,'Своя спокойная тема');
   }
   const after=JSON.parse(await page.evaluate(key=>localStorage.getItem(key),key)).slots[0].character;assert.deepEqual(after,before,'Display preferences must never change the character');
   assert.deepEqual(errors,[]);console.log('designs and sheet layout:',width,'OK');await browser.close();
  }
 }finally{}
})().catch(error=>{console.error(error);process.exit(1);});
