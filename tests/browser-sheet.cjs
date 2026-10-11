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
  const summaryIcon=page.locator('.summary .summary-catalog-icon.experimental-catalog-icon');
  await summaryIcon.waitFor({state:'attached'});
  const summaryIconStyle=await summaryIcon.evaluate(element=>{
    const style=getComputedStyle(element);
    return {mask:style.maskImage||style.webkitMaskImage,color:style.color,width:style.width,height:style.height};
  });
  assert.notEqual(summaryIconStyle.mask,'none','Summary uses the same catalog artwork mask');
  assert.notEqual(summaryIconStyle.color,'rgba(0, 0, 0, 0)','Summary catalog artwork remains visible');
  const expectedCatalogIconSize=page.viewportSize().width<=760?'80px':'118px';
  assert.equal(summaryIconStyle.width,expectedCatalogIconSize);
  assert.equal(summaryIconStyle.height,expectedCatalogIconSize);
  const catalogSearch=page.getByPlaceholder('Поиск по каталогу');
  const searchBox=await catalogSearch.locator('..').boundingBox();
  assert.ok(searchBox&&searchBox.width>=Math.min(260,page.viewportSize().width-32));
  await catalogSearch.fill('такого варианта точно нет');
  assert.match(await page.locator('.catalog-meta').innerText(),/^0 вариантов/);
  await catalogSearch.fill('');
  await verifyImages(page);
  // Regression: entering characteristics must not crash the builder while rendering racial spell choices.
  await page.locator('nav.steps button').filter({hasText:'Характеристики'}).click();
  await page.locator('.pointbuy-grid').waitFor({state:'visible'});
  await page.locator('nav.steps button').filter({hasText:'Итог'}).click();
  await page.locator('.pdf-hp strong').waitFor();
}
async function saved(page) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
}
(async () => {
  const browser=await chromium.launch({headless:true,executablePath:process.env.HB_TEST_CHROMIUM,args:['--no-sandbox','--disable-dev-shm-usage']});
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
        await page.getByRole('link',{name:/Войти через Telegram/}).first().waitFor();
        assert.ok(await page.getByRole('link',{name:/Войти через Telegram/}).first().isVisible(),'Telegram login is visible on the main menu');
        await verifyImages(page);
        await openSheet(page);
        if(width<=760) await page.locator('.mobile-top-menu summary').click();
        assert.ok(await page.getByRole('link',{name:/Войти через Telegram/}).first().isVisible(),'Telegram login remains visible in the builder');
        if(width<=760) await page.locator('.mobile-top-menu summary').click();
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
        assert.equal(await page.getByRole('button',{name:/Мобильный лист/}).count(),0);
        await editor.getByRole('spinbutton',{name:'Бросок хитов за уровень 3',exact:true}).fill('2');
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
        if(width>760) {
          await page.getByRole('button',{name:'Главное меню',exact:true}).click();
          await page.getByRole('button',{name:'Настройки интерфейса',exact:true}).click();
          const settings=page.getByRole('dialog');
          await settings.getByLabel('Размер интерфейса на ПК',{exact:true}).fill('150');
          await settings.getByLabel('Размер шрифта',{exact:true}).fill('120');
          const bounds=await settings.evaluate(e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,right:r.right,height:innerHeight,width:innerWidth};});
          assert.ok(bounds.top>=0 && bounds.bottom<=bounds.height && bounds.right<=bounds.width,'Settings stay inside viewport at enlarged UI scale');
          await settings.getByLabel('Цветовая тема').selectOption('parchment');
          await settings.getByRole('button',{name:'Создать свою тему',exact:true}).click();
          await settings.getByLabel('Название темы').fill('Тестовая тема');
          await settings.getByLabel('Фон страницы',{exact:true}).fill('#ddeeff');
          await settings.getByLabel('Основной текст',{exact:true}).fill('#112233');
          await settings.getByLabel('Рамки',{exact:true}).fill('#445566');
          await page.keyboard.press('Escape');
          await page.reload();
          await page.getByRole('button',{name:'Настройки интерфейса',exact:true}).click();
          assert.equal(await settings.getByLabel('Название темы').inputValue(),'Тестовая тема');
          assert.equal(await settings.getByLabel('Размер интерфейса на ПК',{exact:true}).inputValue(),'150');
          assert.equal(await settings.getByLabel('Размер шрифта',{exact:true}).inputValue(),'120');
          const appearance=await page.locator('.app-shell').evaluate(e=>({background:getComputedStyle(e).backgroundColor,text:getComputedStyle(e).getPropertyValue('--ivory').trim(),line:getComputedStyle(e).getPropertyValue('--line').trim()}));
          assert.deepEqual(appearance,{background:'rgb(221, 238, 255)',text:'#112233',line:'#445566'});
          await settings.getByLabel('Цветовая тема').selectOption('parchment');
          await settings.getByRole('button',{name:'Сбросить размеры',exact:true}).click();
          await page.keyboard.press('Escape');
          await openSheet(page);
          await page.getByRole('button',{name:'Бан-листы',exact:true}).click();
          await page.getByText('Источники · блокировка целой книги',{exact:true}).click();
          assert.equal(await page.locator('.ban-source-grid section').evaluateAll(cards=>cards.some(card=>{const bounds=card.getBoundingClientRect();return [...card.querySelectorAll('button')].some(button=>{const b=button.getBoundingClientRect();return b.left<bounds.left-1 || b.right>bounds.right+1;});})),false,'Source buttons remain inside their cards at desktop zoom');
        }
        // The game gets an independent vault slot on both desktop and phone.
        await page.reload();
        await openSheet(page);
        page.once('dialog',dialog=>dialog.accept('Проверка приключения'));
        await page.getByRole('button',{name:'Отправить в приключение',exact:true}).click();
        await page.locator('.play-shell').waitFor();
        assert.equal(await page.locator(width<=700?'.play-mobile-nav':'.play-desktop-nav').isVisible(),true);
        assert.equal(await page.locator('.play-shell').evaluate(e=>e.scrollWidth>innerWidth),false,'Game stays within viewport');
        await page.getByLabel('Количество',{exact:true}).fill('4');
        await page.getByRole('button',{name:'Получить урон',exact:true}).click();
        await page.waitForFunction(key=>{const v=JSON.parse(localStorage.getItem(key));return v.slots.find(s=>s.id===v.activeId).character.currentHitPoints===23;},key);
        const gameVault=await saved(page);
        assert.equal(gameVault.slots.find(s=>s.id==='hp-active').character.currentHitPoints,27,'Original stays unchanged');
        assert.equal(gameVault.slots.length,3);
        assert.equal(gameVault.slots.find(s=>s.id===gameVault.activeId).character.adventure.sourceId,'hp-active');
        await page.getByRole('button',{name:'Отменить действие',exact:true}).click();
        await page.waitForFunction(key=>{const v=JSON.parse(localStorage.getItem(key));return v.slots.find(s=>s.id===v.activeId).character.currentHitPoints===27;},key);
        await page.reload();
        await page.getByRole('button',{name:'Продолжить текущего персонажа',exact:true}).click();
        await page.locator('.play-shell').waitFor();
        await page.getByRole('button',{name:'← Таверна',exact:true}).click();
        await page.getByRole('heading',{name:'Приключения',exact:true}).waitFor();
        assert.equal(await page.locator('.character-grid article').count(),1);
        await page.getByRole('button',{name:/^Таверна ·/}).click();
        assert.equal(await page.locator('.character-grid article').count(),2);
        assert.deepEqual(errors,[]);
        console.log(JSON.stringify({width,result:'passed',scenarios:['desktop HP','legacy average','responsive game','independent adventure','undo','reload','preserved vault']}));
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1});
