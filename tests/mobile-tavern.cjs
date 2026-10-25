const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
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
  const browser = await chromium.launch({
    executablePath: process.env.HB_TEST_CHROMIUM,
    headless: true,
    args: JSON.parse(process.env.HB_TEST_CHROMIUM_ARGS || '["--no-sandbox","--disable-dev-shm-usage"]')
  });
  try {
    for (const width of [320, 360, 390, 430]) {
      const context = await browser.newContext({
        viewport: {width, height: 850}, isMobile: true, hasTouch: true, deviceScaleFactor: 1
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
  } finally { await browser.close(); }
})().catch(error => {console.error(error);process.exitCode = 1;});
