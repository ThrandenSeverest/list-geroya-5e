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
        assert.equal(await page.locator('.session-panel').getAttribute('open'),null);
        await page.locator('.session-panel > summary').click();
        await page.getByLabel('Количество',{exact:true}).fill('4');
        await page.getByRole('button',{name:'Получить урон',exact:true}).click();
        await page.waitForFunction(key=>{const v=JSON.parse(localStorage.getItem(key));return v.slots.find(s=>s.id===v.activeId).character.currentHitPoints===23;},key);
        const gameVault=await saved(page);
        assert.equal(gameVault.slots.find(s=>s.id==='hp-active').character.currentHitPoints,27,'Original stays unchanged');
        assert.equal(gameVault.slots.length,3);
        assert.equal(gameVault.slots.find(s=>s.id===gameVault.activeId).character.adventure.sourceId,'hp-active');
        await page.reload();
        await page.locator('.play-shell').waitFor();
        await page.getByRole('button',{name:/^Отменить действие/}).click();
        await page.waitForFunction(key=>{const v=JSON.parse(localStorage.getItem(key));return v.slots.find(s=>s.id===v.activeId).character.currentHitPoints===27;},key);
        assert.match(page.url(), /\/adventure\/?\?play=/);
        await page.reload();
        await page.locator('.play-shell').waitFor();
        await page.getByRole('button',{name:'← Таверна',exact:true}).click();
        await page.getByRole('heading',{name:'Приключения',exact:true}).waitFor();
        assert.equal(await page.locator('.character-grid article').count(),1);
        await page.getByRole('navigation',{name:'Таверна и приключения'}).getByRole('button',{name:/^Таверна\s+\d+\s+героев$/}).click();
        assert.equal(await page.locator('.character-grid article').count(),2);
        assert.deepEqual(errors,[]);
        const gameUrl=await page.evaluate(()=>{const v=JSON.parse(localStorage.getItem('list-geroya-character-vault-v1'));const slot=v.slots.find(s=>s.id===v.activeId);const c=slot.character;c.className='wizard';c.startingClassId='wizard';c.level=5;c.subclass='';c.classes=[{classId:'wizard',level:5,acquiredAtCharacterLevel:1}];c.levelHistory=Array.from({length:5},(_,i)=>({characterLevel:i+1,classId:'wizard',classLevelAfter:i+1,hpMode:'average'}));c.abilities={str:10,dex:14,con:12,int:16,wis:12,cha:10};c.race='human';c.raceVariant='standard';c.spells=['firebolt','fireball','scorching-ray'];c.spellGrants=c.spells.map(spellId=>({spellId,sourceType:'class',sourceId:'wizard',classId:'wizard',mode:'prepared'}));c.preparationVersion=1;c.preparedSpellsByClass={wizard:c.spells};c.preparedSpells=c.spells;c.spellSlotsUsed=[];c.adventure.inventory=[];localStorage.setItem('list-geroya-character-vault-v1',JSON.stringify(v));localStorage.setItem('list-geroya-site-theme','parchment');return location.href.split('?')[0]+'?play='+slot.id;});
        await page.goto(gameUrl);await page.locator('.play-shell').waitFor();
        assert.equal(await page.locator('.play-shell').getAttribute('data-site-theme'),'parchment');
        if(width<=700) await page.getByRole('button',{name:'Открыть кубы',exact:true}).click();
        const tray=page.getByRole('complementary',{name:'Постоянная панель кубов'});
        assert.equal(await tray.isVisible(),true);
        await tray.getByRole('button',{name:'Выбрать d6',exact:true}).click();
        await tray.getByLabel('Количество кубов',{exact:true}).fill('3');
        await tray.getByLabel('Модификатор',{exact:true}).fill('2');
        for(let i=0;i<3;i++) await tray.getByRole('button',{name:'Бросить 3d6+2',exact:true}).click();
        const values=await tray.locator('.die-result b').allTextContents();assert.equal(values.length,3);
        assert.equal(Number(await tray.locator('.dice-total strong').innerText()),values.reduce((sum,n)=>sum+Number(n),2));
        assert.equal(await tray.locator('.dice-history article').count(),3);
        if(width<=700) await page.getByRole('button',{name:'Закрыть кубы',exact:true}).click();
        await page.getByRole('button',{name:'Рюкзак',exact:true}).click();
        await page.getByRole('button',{name:'+ Свой предмет',exact:true}).click();
        const itemEditor=page.getByRole('dialog',{name:'Редактор предмета'});
        await itemEditor.getByLabel('Название предмета',{exact:true}).fill('Фокусировка +2');
        await itemEditor.getByLabel('Тип предмета',{exact:true}).selectOption('focus');
        await itemEditor.getByRole('button',{name:'+2',exact:true}).click();
        await itemEditor.getByLabel('Надет / в руках',{exact:true}).check();
        await itemEditor.getByRole('button',{name:'Сохранить предмет',exact:true}).click();
        await page.getByRole('button',{name:'+ Свой предмет',exact:true}).click();
        await itemEditor.getByLabel('Название предмета',{exact:true}).fill('Рапира +1');
        await itemEditor.getByLabel('Тип предмета',{exact:true}).selectOption('weapon');
        await itemEditor.getByLabel('Базовое оружие',{exact:true}).selectOption('Рапира');
        await itemEditor.getByRole('button',{name:'+1',exact:true}).click();
        await itemEditor.getByLabel('Надет / в руках',{exact:true}).check();
        await itemEditor.getByRole('button',{name:'Сохранить предмет',exact:true}).click();
        const rapier=page.locator('.inventory-item').filter({has:page.getByRole('heading',{name:'Рапира +1',exact:true})});
        assert.equal(await rapier.getByRole('button',{name:'Использовать 1',exact:true}).count(),0);
        // Somatic-only spells require a free hand: stow the rapier, keep the focus equipped.
        await rapier.getByRole('button',{name:'Надето / в руках',exact:true}).click();
        await page.getByRole('button',{name:'Магия',exact:true}).click();
        const bolt=page.locator('.play-card').filter({has:page.getByRole('heading',{name:'Огненный снаряд',exact:true})});
        assert.match(await bolt.innerText(),/Атака заклинанием \+8/);
        await bolt.getByRole('button',{name:'Сотворить',exact:true}).click();
        const resolution=page.getByRole('region',{name:/^Результат заклинания:/});
        await resolution.waitFor();assert.match(await resolution.innerText(),/Попадание/);
        assert.match(await resolution.innerText(),/Урон/);
        assert.equal(await resolution.getByRole('button',{name:'Бросить урон',exact:true}).count(),0);
        await resolution.getByRole('button',{name:'Закрыть результат',exact:true}).click();
        const fireball=page.locator('.play-card').filter({has:page.getByRole('heading',{name:'Огненный шар',exact:true})});
        assert.match(await fireball.innerText(),/Сл 16/);
        await fireball.getByRole('button',{name:'Сотворить',exact:true}).scrollIntoViewIfNeeded();
        const beforeCastScroll=await page.evaluate(()=>scrollY);
        await fireball.getByRole('button',{name:'Сотворить',exact:true}).click();
        await resolution.waitFor();assert.match(await resolution.innerText(),/Сл 16/);
        assert.ok(await page.evaluate(()=>scrollY)>=beforeCastScroll-24,'Casting does not force a jump upwards to the result');
        assert.equal(await resolution.getByRole('button',{name:'Критический урон',exact:true}).count(),0);
        assert.equal(await resolution.getByRole('button',{name:/^Атака /}).count(),0);
        assert.match(await resolution.innerText(),/8d6/);
        await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).slots.some(s=>s.character.spellSlotsUsed?.[2]===1),key);
        const beforeUpcast=(await saved(page)).slots.find(s=>s.id===gameVault.activeId).character.spellSlotsUsed;
        await resolution.getByRole('button',{name:'Закрыть результат',exact:true}).click();
        assert.equal(await fireball.getByRole('button',{name:'Броски',exact:true}).count(),0);
        // Third-level slots are enough for this level-five fixture: one click spends one more.
        await fireball.getByRole('button',{name:'Сотворить',exact:true}).click();
        await resolution.waitFor();
        await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).slots.some(s=>s.character.adventure?.journal[0]?.formula==='8d6'&&s.character.spellSlotsUsed?.[2]===2),key);
        const afterUpcast=(await saved(page)).slots.find(s=>s.id===gameVault.activeId).character;
        assert.equal(afterUpcast.spellSlotsUsed[2],(beforeUpcast[2]||0)+1,'One cast spends exactly one slot');
        assert.equal(afterUpcast.adventure.journal[0].rolls.length,8);
        assert.equal(await resolution.getByRole('button',{name:'Бросить урон',exact:true}).count(),0);
        await page.getByRole('button',{name:/^Отменить действие/}).click();
        await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).slots.some(s=>s.character.spellSlotsUsed?.[2]===1),key);
        assert.equal(await page.locator('.play-shell').evaluate(e=>e.scrollWidth>innerWidth),false);
        assert.deepEqual(errors,[]);
        // Integrated session controls remain available while viewing magic.
        assert.equal(await page.getByRole('button',{name:'Получить урон',exact:true}).isVisible(),false);
        await page.locator('.session-panel > summary').click();
        assert.equal(await page.getByRole('button',{name:'Получить урон',exact:true}).isVisible(),true);
        await fireball.getByRole('button',{name:'Закрепить заклинание: Огненный шар',exact:true}).click();
        await page.getByRole('button',{name:'Действия',exact:true}).click();
        const quickSpell=page.locator('.session-quick .play-spell-card').filter({has:page.getByRole('heading',{name:'Огненный шар',exact:true})});
        await quickSpell.waitFor();
        assert.equal(await page.getByLabel('Поиск быстрых действий',{exact:true}).count(),0,'Actions search has been removed');
        assert.equal(await page.locator('.session-quick .play-spell-card').count(),1);
        await page.locator('.session-panel > summary').click();
        await page.locator('.session-resources > summary').click();
        await page.getByText('Добавить свой ресурс',{exact:true}).click();
        await page.getByLabel('Название ресурса',{exact:true}).fill('Запас решимости');
        await page.getByLabel('Максимум ресурса',{exact:true}).fill('2');
        await page.getByRole('button',{name:'Добавить ресурс',exact:true}).click();
        await page.getByRole('button',{name:'Потратить ресурс: Запас решимости',exact:true}).click();
        await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).slots.some(s=>s.character.adventure?.customResources?.some(r=>r.name==='Запас решимости'&&r.current===1)),key);
        await page.reload();await page.locator('.play-shell').waitFor();
        assert.equal(await page.locator('.session-quick .play-spell-card').filter({has:page.getByRole('heading',{name:'Огненный шар',exact:true})}).count(),1,'Pinned magic survives reload');
        // Re-equip the rapier after somatic spell tests: an unequipped weapon
        // must not appear in the integrated attack action list.
        await page.getByRole('button',{name:'Рюкзак',exact:true}).click();
        const savedRapier=page.locator('.inventory-item').filter({has:page.getByRole('heading',{name:'Рапира +1',exact:true})});
        await savedRapier.getByRole('button',{name:'Надеть / взять',exact:true}).click();
        await page.getByRole('button',{name:'Действия',exact:true}).click();
        await page.getByRole('button',{name:'Атаковать',exact:true}).first().waitFor();
        assert.equal(await page.getByRole('button',{name:'Атаковать',exact:true}).count()>0,true,'Equipped weapons have an integrated action');
        await page.getByRole('button',{name:'Атаковать',exact:true}).first().click();
        await page.getByRole('region',{name:'Результат атаки',exact:true}).waitFor();
        assert.match(await page.getByRole('region',{name:'Результат атаки',exact:true}).innerText(),/Попадание|Урон/);
        assert.equal(await page.locator('.play-shell').evaluate(e=>e.scrollWidth>innerWidth),false);
        assert.deepEqual(errors,[]);
        assert.equal(await page.locator('.play-shell input[type=number]').count(),0,'Game uses sliders and exact text entry without spin buttons');
        await page.locator('.session-panel > summary').click();
        const hpControl=page.getByRole('slider',{name:'Текущие HP: ползунок',exact:true});
        await hpControl.focus();
        const sliderBefore=await saved(page);
        const activeBefore=sliderBefore.slots.find(s=>s.id===sliderBefore.activeId).character;
        const hpBefore=activeBefore.currentHitPoints;
        await hpControl.press('ArrowLeft');
        await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).slots.some(s=>s.character.currentHitPoints===26),key);
        const sliderAfter=await saved(page),activeAfter=sliderAfter.slots.find(s=>s.id===sliderAfter.activeId).character;
        assert.equal(activeAfter.currentHitPoints,hpBefore-1);
        assert.equal(activeAfter.adventure.undo.length,Math.min(20,activeBefore.adventure.undo.length+1));
        // Add through inventory; the four quick potion buttons only consume stock.
        await page.getByRole('button',{name:'Рюкзак',exact:true}).click();
        await page.getByRole('button',{name:'+ Расходник',exact:true}).click();
        await itemEditor.getByLabel('Название предмета',{exact:true}).fill('Зелье лечения');
        await itemEditor.getByLabel('Формула лечения при выпивании',{exact:true}).fill('2d4+2');
        await itemEditor.getByRole('button',{name:'Сохранить предмет',exact:true}).click();
        await page.getByRole('button',{name:'Действия',exact:true}).click();
        await page.getByRole('button',{name:'Выпить: Зелье лечения, 1 шт.',exact:true}).first().click();
        await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).slots.some(s=>s.character.adventure?.inventoryTrash?.some(i=>i.name==='Зелье лечения'&&i.quantity===0)),key);
        const potionVault=await saved(page),potionHero=potionVault.slots.find(s=>s.id===potionVault.activeId).character;
        assert.ok(potionHero.currentHitPoints>activeAfter.currentHitPoints,'Potion restores HP automatically');
        assert.equal(await page.getByRole('button',{name:'Выпить: Зелье лечения, 0 шт.',exact:true}).first().isDisabled(),true);
        await page.getByRole('button',{name:'Рюкзак',exact:true}).click();
        assert.equal(await page.locator('.inventory-item').filter({has:page.getByRole('heading',{name:'Зелье лечения',exact:true})}).count(),0);
        await page.locator('.inventory-trash > summary').click();
        await page.getByRole('button',{name:'Вернуть из корзины: Зелье лечения',exact:true}).click();
        await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).slots.some(s=>s.character.adventure?.inventory?.some(i=>i.name==='Зелье лечения'&&i.quantity===1)),key);
        await page.reload();await page.locator('.play-shell').waitFor();
        await page.getByRole('button',{name:'Герой',exact:true}).click();
        assert.equal(await page.getByRole('button',{name:'Получить урон',exact:true}).isVisible(),true);
        await page.locator('.session-panel > summary').click();
        assert.equal(await page.getByRole('button',{name:'Получить урон',exact:true}).isVisible(),false);
        await page.getByRole('button',{name:'Магия',exact:true}).click();
        assert.equal(await page.getByRole('button',{name:'Получить урон',exact:true}).isVisible(),false);
        assert.equal(await page.locator('.play-shell').evaluate(e=>e.scrollWidth>innerWidth),false);
        assert.deepEqual(errors,[]);
        console.log(JSON.stringify({width,result:'passed',scenarios:['desktop HP','legacy average','responsive game','independent adventure','undo','reload','preserved vault']}));
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1});
