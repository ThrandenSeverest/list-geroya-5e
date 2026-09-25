const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const url = process.env.HEROLIST_URL || 'http://127.0.0.1:3998';
const key = 'list-geroya-character-vault-v1';
const character = {
  schemaVersion: 4, rulesetId: '5e-2014', name: 'Проверка HP', playerName: '',
  className: 'fighter', startingClassId: 'fighter', level: 3, subclass: 'champion',
  classes: [{classId:'fighter',level:3,subclassId:'champion',acquiredAtCharacterLevel:1}],
  race: 'dwarf', raceVariant: 'mountain', background: '',
  abilities: {str:13,dex:12,con:14,int:10,wis:10,cha:10},
  levelHistory: [
    {characterLevel:1,classId:'fighter',classLevelAfter:1},
    {characterLevel:2,classId:'fighter',classLevelAfter:2,hpMode:'roll',hpGain:8},
    {characterLevel:3,classId:'fighter',classLevelAfter:3,hpMode:'roll',hpGain:6,hpGainFormat:'raw-roll-plus-con-v1'},
  ],
  currentHitPoints:30, spells:[], classSkills:[], backgroundSkills:[],
  currency:{gp:0,sp:0,cp:0,pp:0}, personality:{traits:'',ideals:'',bonds:'',flaws:''},
};
async function verifyImages(page) {
  const failures = await page.evaluate(async () => {
    const sources = [...document.images].map(image => image.currentSrc || image.src);
    for (const element of document.querySelectorAll('.experimental-catalog-icon')) {
      const value = getComputedStyle(element).getPropertyValue('--experimental-sheet');
      const match = value.match(/url\(["']?(.*?)["']?\)/);
      if(match) sources.push(new URL(match[1], document.baseURI).href);
    }
    return (await Promise.all([...new Set(sources)].map(async src => {
      const image = new Image(); image.src = src;
      try { await image.decode(); return image.naturalWidth ? null : src; }
      catch { return src; }
    }))).filter(Boolean);
  });
  assert.deepEqual(failures, [], 'Every logo, acknowledgement and catalog image must load');
}
async function openSheet(page) {
  await page.getByRole('button', {name:'Продолжить текущего персонажа',exact:true}).click();
  await page.locator('.experimental-catalog-icon').first().waitFor();
  await verifyImages(page);
  await page.locator('nav.steps button').filter({hasText:'Итог'}).click();
  await page.locator('.pdf-hp strong').waitFor();
}
async function saved(page) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
}
(async () => {
  const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  try {
    for(const width of [1440,390]) {
      const context=await browser.newContext({viewport:{width,height:1000}});
      try {
        const page=await context.newPage();
        const errors=[];
        page.on('pageerror',error=>errors.push(error.message));
        await page.route('**/api/account',route=>route.fulfill({json:{authenticated:false}}));
        await page.addInitScript(({key,character})=>{
          if(localStorage.getItem(key))return;
          const updatedAt='2026-09-24T00:00:00Z';
          localStorage.setItem(key,JSON.stringify({version:1,capacity:5,activeId:'hp-active',folders:[],slots:[
            {id:'hp-active',updatedAt,character},
            {id:'hp-preserved',updatedAt,character:{...character,name:'Неизменяемый сосед'}},
          ]}));
        },{key,character});
        await page.goto(url);
        await page.getByRole('button',{name:'Лист Героя — главная',exact:true}).waitFor();
        await verifyImages(page);
        await openSheet(page);
        assert.equal(await page.locator('.pdf-hp strong').textContent(),'30');
        const editor=page.locator('.desktop-hp-roll-editor .hp-roll-editor');
        await editor.locator('summary').click();
        await editor.getByRole('spinbutton',{name:'Бросок хитов за уровень 3',exact:true}).fill('7');
        await page.waitForFunction(key=>{
          const v=JSON.parse(localStorage.getItem(key));
          return v.slots.find(s=>s.id==='hp-active').character.levelHistory[2].hpGain===7;
        },key);
        assert.equal(await page.locator('.pdf-hp strong').textContent(),'31');
        assert.equal((await saved(page)).slots[0].character.currentHitPoints,30);
        // Legacy values change interpretation only after explicit confirmation.
        assert.equal((await saved(page)).slots[0].character.levelHistory[1].hpGainFormat,undefined);
        await editor.getByRole('button',{name:'Это результат кости: 8',exact:true}).click();
        await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).slots[0].character.levelHistory[1].hpGainFormat==='raw-roll-plus-con-v1',key);
        assert.equal(await page.locator('.pdf-hp strong').textContent(),'34');
        assert.equal((await saved(page)).slots[0].character.currentHitPoints,30);
        assert.equal((await saved(page)).slots[1].character.levelHistory[1].hpGainFormat,undefined);
        // An explicit average action remains available after confirmation.
        await editor.locator('label').filter({hasText:'Уровень 2'}).getByRole('button',{name:'Использовать среднее'}).click();
        await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).slots[0].character.levelHistory[1].hpMode==='average',key);
        assert.equal(await page.locator('.pdf-hp strong').textContent(),'32');
        await page.getByRole('button',{name:/Мобильный лист/}).click();
        const mobile=page.locator('.mobile-character-sheet');
        await mobile.getByRole('button',{name:'Ресурсы',exact:true}).click();
        await mobile.locator('.hp-roll-editor summary').click();
        await mobile.getByRole('spinbutton',{name:'Бросок хитов за уровень 3',exact:true}).fill('2');
        await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).slots[0].character.currentHitPoints===27,key);
        assert.equal(await page.locator('.pdf-hp strong').textContent(),'27');
        await page.reload();
        await openSheet(page);
        assert.equal(await page.locator('.pdf-hp strong').textContent(),'27');
        const vault=await saved(page);
        assert.equal(vault.activeId,'hp-active');
        assert.deepEqual(vault.slots.map(s=>s.id),['hp-active','hp-preserved']);
        assert.equal(vault.slots[0].character.abilities.con,14);
        assert.equal(vault.slots[0].character.currentHitPoints,27);
        assert.equal(vault.slots[1].character.name,'Неизменяемый сосед');
        assert.equal(vault.slots[1].character.levelHistory[1].hpGain,8);
        assert.deepEqual(errors,[]);
        console.log(JSON.stringify({width,result:'passed',scenarios:['desktop HP','legacy average','mobile HP','reload','preserved vault']}));
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1});
