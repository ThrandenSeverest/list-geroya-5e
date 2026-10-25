const assert=require('node:assert/strict');const fs=require('fs');const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');// Synthetic test data only. No real character saves or account details are used.
require('tsx/cjs');
const {createAdventureCharacter}=require('../app/adventure.ts');
const character={name:'Тест мобильной верстки',playerName:'',className:'fighter',startingClassId:'fighter',level:4,classes:[{classId:'fighter',level:4,acquiredAtCharacterLevel:1}],race:'human',raceVariant:'standard',background:'sage',classSkills:[],backgroundSkills:[],spells:[],abilities:{str:15,dex:14,con:14,int:10,wis:10,cha:8},alignment:'',personality:{traits:'',ideals:'',bonds:'',flaws:''},currency:{gp:123456,sp:1500,cp:20000,pp:0},inventoryOverride:'Кольчуга\nЩит\nДлинный меч\nНабор путешественника',classChoices:{'fighting-style':['defense']},currentHitPoints:0,rulesetId:'5e-2014'};
const fixture={character,adventure:createAdventureCharacter(character,'synthetic-source','2026-01-01','Тест интерфейса')};
(async()=>{const browser=await chromium.launch({executablePath:process.env.HB_TEST_CHROMIUM,headless:true,args:JSON.parse(process.env.HB_TEST_CHROMIUM_ARGS || '["--no-sandbox","--disable-dev-shm-usage"]')});
try{for(const width of [320,390,430,1440]){
const context=await browser.newContext({viewport:{width,height:900},isMobile:width<500,deviceScaleFactor:1});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/api/account',r=>r.fulfill({json:{authenticated:false}}));
await page.addInitScript(()=>{if(!localStorage.getItem('list-geroya-interface-v1'))localStorage.setItem('list-geroya-interface-v1',JSON.stringify({rememberDesign:true,activePreset:'paper'}));});
await page.addInitScript(({character,adventure})=>{localStorage.setItem('list-geroya-character-vault-v1',JSON.stringify({version:1,capacity:5,activeId:'play',folders:[],slots:[{id:'original',updatedAt:'2026-10-24',character},{id:'play',updatedAt:'2026-10-24',character:adventure}]}));},fixture);
await page.goto(process.env.HEROLIST_URL || 'http://127.0.0.1:3998/');await page.getByRole('button',{name:'Лист Героя — главная',exact:true}).waitFor();
async function fits(label){const out=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,wide:[...document.querySelectorAll('body *')].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.right>window.visualViewport.width+2&&getComputedStyle(el).position!=='fixed';}).slice(0,8).map(el=>el.className)}));assert.ok(out.scroll<=width+1,label+JSON.stringify(out));console.log(width,label,out.scroll);}
await fits('home');
await page.waitForFunction(()=>document.querySelector('.home-art-selected')?.getAttribute('src')?.includes('hero-universal'));
const art=await page.locator('.home-art-selected').evaluate(async image=>{
 await image.decode();const r=image.getBoundingClientRect(),c=document.querySelector('.home-hero-copy').getBoundingClientRect();
 return {ratio:r.width/r.height,natural:image.naturalWidth/image.naturalHeight,overlap:r.left<c.right-1&&r.right>c.left+1&&r.top<c.bottom-1&&r.bottom>c.top+1};
});
assert.ok(Math.abs(art.ratio-art.natural)<.01,'Complete artwork keeps its original aspect ratio');
assert.equal(art.overlap,false,'Text must not cover the left-hand characters');
await page.getByRole('button',{name:'Продолжить текущего персонажа',exact:true}).click();await page.locator('.play-shell').waitFor();await fits('adventure');
const nav=page.locator(width<500?'.play-mobile-nav':'.play-desktop-nav');await nav.getByRole('button',{name:'Рюкзак',exact:true}).click();await page.locator('.inventory-heading').waitFor();await fits('inventory');const title=await page.locator('.inventory-heading h2').boundingBox();assert.ok(title.width>100);await page.locator('.inventory-pack > summary').click();assert.equal(await page.getByLabel('Количество: Рацион',{exact:true}).inputValue(),'10');await page.getByRole('button',{name:'Использовать 1',exact:true}).first().click();assert.equal(await page.getByLabel('Количество: Рацион',{exact:true}).inputValue(),'9');await fits('pack');

await page.getByRole('button',{name:'Настройки игрового режима',exact:true}).click();await page.getByLabel('Навигация на телефоне',{exact:true}).selectOption('top');await fits('settings');await page.getByLabel('Навигация на телефоне',{exact:true}).selectOption('bottom');await page.getByRole('button',{name:'Закрыть настройки',exact:true}).click();
await nav.getByRole('button',{name:'Магия',exact:true}).click();await fits('magic');
await nav.getByRole('button',{name:'Герой',exact:true}).click();await page.getByText('Ручные значения и завершение приключения',{exact:true}).click();await page.getByLabel('Текущие HP вручную',{exact:true}).fill('0');await page.getByRole('button',{name:'Длинный отдых',exact:true}).click();const finish=page.getByRole('button',{name:'Завершить отдых',exact:true});assert.ok(await finish.isDisabled());await page.getByLabel('Персонаж в сознании?',{exact:true}).check();await finish.click();assert.match(await page.locator('.play-hp strong').innerText(),/36.*36/);

await page.getByRole('button',{name:'Изменить героя',exact:true}).click();await page.locator('nav.steps button').filter({hasText:'Итог'}).click();await page.locator('.pdf-document').waitFor();await fits('final');
if(width<500){const panels=await page.locator('.pdf-primary-grid > *').evaluateAll(els=>els.map(el=>({width:el.clientWidth,scroll:el.scrollWidth,right:el.getBoundingClientRect().right})));assert.ok(panels.every(p=>p.scroll<=p.width+1&&p.right<=width),JSON.stringify(panels));}

await page.locator('nav.steps button').filter({hasText:'Снаряжение'}).click();await page.locator('.currency-editor').waitFor();await fits('coins');
await page.locator('nav.steps button').filter({hasText:'Уровень'}).click();await page.getByRole('button',{name:/Увеличение характеристик.*\+2/}).click();await page.locator('.asi-picker').waitFor();const placement=await page.evaluate(()=>{const button=document.querySelector('.asi-option-grid');const picker=document.querySelector('.asi-stack');return {button:button.getBoundingClientRect().bottom,picker:picker.getBoundingClientRect().top,following:button.nextElementSibling===picker};});assert.ok(placement.following,JSON.stringify(placement));await fits('asi');
assert.deepEqual(errors,[]);}
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
