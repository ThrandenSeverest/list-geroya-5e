const assert = require('node:assert/strict');
const { chromium, webkit } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
// Synthetic profile only. No real user storage is read or changed.
const character = {
  name: 'Проверка касаний', playerName: '', className: 'fighter',
  startingClassId: 'fighter', level: 1, race: 'human', raceVariant: 'standard',
  background: 'sage', abilities: {str: 15, dex: 14, con: 14, int: 10, wis: 10, cha: 8},
  classSkills: [], backgroundSkills: [], spells: [], currentHitPoints: 12,
  currency: {gp: 0, sp: 0, cp: 0, pp: 0},
  personality: {traits:'', ideals:'', bonds:'', flaws:''}, inventoryOverride: ''
};
const url = new URL('adventure/', process.env.HEROLIST_URL || 'http://127.0.0.1:3998/');
(async () => {
  const browser = process.env.HB_TEST_BROWSER === 'webkit'
    ? await webkit.launch({headless:true})
    : await chromium.launch({
        executablePath: process.env.HB_TEST_CHROMIUM,
        headless: true,
        args: JSON.parse(process.env.HB_TEST_CHROMIUM_ARGS || '["--no-sandbox","--disable-dev-shm-usage"]')
      });
  try {
    for (const width of [320, 360, 390, 430]) {
      const context = await browser.newContext({
        viewport: {width, height: 850}, isMobile: true, hasTouch: true, deviceScaleFactor: width === 320 ? 2 : width === 390 ? 3 : 4
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.route('**/api/**', route => route.fulfill({json: {authenticated:false}}));
      await page.addInitScript(character => {
        localStorage.setItem('list-geroya-interface-v1', JSON.stringify({rememberDesign:true}));
        localStorage.setItem('list-geroya-character-vault-v1', JSON.stringify({
          version: 1, capacity: 5, activeId: 'touch-test', folders: [],
          slots: [{id:'touch-test', updatedAt:'2026-10-25T12:00:00.000Z', character}]
        }));
      }, character);
      await page.goto(url.href);
      const cards = page.locator('.character-grid article');
      await cards.first().waitFor();
      assert.equal(await page.locator('html').getAttribute('data-herolist-hydrated'), '1', 'React did not hydrate');
      const modes = page.locator('.mode-signs');
      await modes.getByRole('button', {name:/Приключения/}).tap();
      assert.equal(await page.locator('.library-head h1').innerText(), 'Приключения');
      await modes.getByRole('button', {name:/Таверна/}).tap();
      assert.equal(await page.locator('.library-head h1').innerText(), 'Таверна');
      await page.locator('.folder-actions').getByRole('button', {name:'+ Новая папка'}).tap();
      const folderDialog = page.getByRole('dialog', {name:'Новая папка'});
      await folderDialog.getByLabel('Имя папки').fill('Тест касаний');
      await folderDialog.getByRole('button', {name:'Сохранить'}).tap();
      assert.ok(await page.locator('.folder-list').getByRole('button', {name:/Тест касаний/}).isVisible());
      await page.locator('.folder-list').getByRole('button', {name:/Все/}).tap();
      const actions = cards.first().locator('.character-card-actions');
      const hitTargets = await actions.locator('button').evaluateAll(buttons => buttons.map(button => {
        const rect = button.getBoundingClientRect();
        const x = Math.max(1, Math.min(innerWidth - 1, rect.left + rect.width / 2));
        const y = rect.top + rect.height / 2;
        return {label: button.textContent.trim(), width: rect.width,
          height: rect.height, overlap: rect.top >= 0 && rect.bottom <= innerHeight
            ? !(button === document.elementFromPoint(x,y) || button.contains(document.elementFromPoint(x,y)))
            : null};
      }));
      assert.ok(hitTargets.every(button => button.width > 80 && button.height >= 44),
        'Small/clipped touch target '+width+': '+JSON.stringify(hitTargets));
      assert.ok(hitTargets.filter(x => x.overlap !== null).every(x => !x.overlap),
        'A layer covers a button '+width+': '+JSON.stringify(hitTargets));

      await actions.getByRole('button', {name:'Экспорт'}).tap();
      await page.getByRole('dialog', {name:'Выберите формат экспорта'}).waitFor();
      await page.getByRole('button', {name:'Отмена'}).tap();

      await actions.getByRole('button', {name:'Отправить в приключение'}).tap();
      await page.getByRole('dialog', {name:'Название приключения'}).waitFor();
      await page.getByRole('button', {name:'Отмена'}).tap();

      await cards.first().locator('.character-move-menu summary').tap();
      assert.ok(await cards.first().locator('.character-move-menu select').isVisible());
      await cards.first().locator('.character-move-menu summary').tap();

      await cards.first().locator('.character-select input').check();
      assert.match(await page.locator('.bulk-character-actions').innerText(), /Выбрано: 1/);
      await page.locator('.bulk-character-actions').getByRole('checkbox', {name:'Выбрать всех показанных'}).uncheck();
      assert.match(await page.locator('.bulk-character-actions').innerText(), /Выбрано: 0/);

      await actions.getByRole('button', {name:'Копировать'}).tap();
      await page.waitForFunction(() => document.querySelectorAll('.character-grid article').length === 2);
      await cards.first().getByRole('button', {name:'Открыть'}).tap();
      await page.locator('nav.steps').waitFor();
      assert.deepEqual(errors, [], 'Browser JS errors at '+width);
      console.log('mobile Tavern touch targets: '+width+'px OK');
      await context.close();
    }
    // A fresh phone has no remembered theme and opens its design chooser.
    // Check Safari/WebKit as well as Chromium: invisible native dialogs can
    // block *all* taps, including the otherwise native hamburger <summary>.
    const firstContext = await browser.newContext({
      viewport: {width:390,height:850}, isMobile:true, hasTouch:true, deviceScaleFactor:3
    });
    const firstPage = await firstContext.newPage();
    const firstErrors = [];
    firstPage.on('pageerror',e=>firstErrors.push(e.message));
    await firstPage.route('**/api/**', route => route.fulfill({json:{authenticated:false}}));
    await firstPage.goto(url.href);
    await firstPage.waitForFunction(() => document.documentElement.getAttribute('data-herolist-hydrated')==='1');
    const modal = firstPage.locator('dialog.interface-settings[open]');
    await modal.waitFor({state:'visible'});
    const frame = await modal.boundingBox();
    assert.ok(frame && frame.width>150 && frame.x>=0 && frame.x+frame.width<=390,'Design chooser visible on physical mobile viewport');
    await modal.getByRole('button',{name:'Использовать выбранный дизайн'}).tap();
    assert.equal(await firstPage.locator('dialog.interface-settings[open]').count(),0,'Modal closes and releases touch lock');
    const hamburger = firstPage.locator('.mobile-top-menu summary');
    await hamburger.tap();
    assert.equal(await firstPage.locator('.mobile-top-menu').getAttribute('open'),'');
    await hamburger.tap();
    await firstPage.locator('.mode-signs').getByRole('button',{name:/Приключения/}).tap();
    assert.equal(await firstPage.locator('.library-head h1').innerText(),'Приключения');
    assert.deepEqual(firstErrors,[],'First-run mobile JS errors');
    await firstContext.close();
  } finally { await browser.close(); }
})().catch(error => {console.error(error);process.exitCode = 1;});
