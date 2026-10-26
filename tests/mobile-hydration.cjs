const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url = new URL('adventure/', process.env.HEROLIST_URL || 'http://127.0.0.1:3998/');
(async () => {
  const browser = await chromium.launch({headless:true,executablePath:process.env.HB_TEST_CHROMIUM,args:['--no-sandbox','--disable-dev-shm-usage']});
  try {
    const context = await browser.newContext({viewport:{width:390,height:850},isMobile:true,hasTouch:true});
    const page = await context.newPage();
    await page.addInitScript(() => localStorage.setItem('list-geroya-interface-v1', JSON.stringify({rememberDesign:true})));
    // Reproduce stale HTML whose old hashed JavaScript files were removed.
    await page.route('**/assets/*.js', route => route.abort());
    await page.goto(url.href);
    await page.locator('.mobile-top-menu summary').tap();
    assert.equal(await page.locator('.mobile-top-menu').getAttribute('open'), '');
    await page.locator('#herolist-boot-warning').waitFor({timeout:28000});
    assert.match(await page.locator('#herolist-boot-warning').innerText(), /интерфейс не запустился/);
    assert.notEqual(await page.locator('html').getAttribute('data-herolist-hydrated'), '1');
    assert.equal(await page.locator('#herolist-boot-warning').evaluate(el=>getComputedStyle(el).pointerEvents),'none','warning does not consume taps');
    await page.evaluate(()=>document.documentElement.setAttribute('data-herolist-hydrated','1'));
    await page.locator('#herolist-boot-warning').waitFor({state:'detached'});
    await page.evaluate(()=>document.documentElement.removeAttribute('data-herolist-hydrated'));
    await page.unroute('**/assets/*.js');
    await page.reload();
    await page.waitForFunction(() => document.documentElement.getAttribute('data-herolist-hydrated') === '1');
    await page.locator('.mode-signs').getByRole('button',{name:/Приключения/}).tap();
    assert.equal(await page.locator('.library-head h1').innerText(), 'Приключения');
    assert.equal(await page.locator('#herolist-boot-warning').count(), 0);
    console.log('Missing-JS recovery and interactive hydration OK');
    // Regression: on a fresh Android browser, hidden desktop design controls
    // must not open a top-layer modal that captures Tavern buttons.
    const fresh = await browser.newContext({viewport:{width:390,height:850},isMobile:true,hasTouch:true});
    const blocked = await fresh.newPage();
    const errors = [];
    blocked.on('pageerror', e => errors.push(e.message));
    await blocked.goto(url.href);
    await blocked.waitForFunction(() => document.documentElement.getAttribute('data-herolist-hydrated') === '1');
    await blocked.waitForTimeout(1000);
    assert.equal(await blocked.locator('dialog.interface-settings[open]').count(),0,
      'Hidden desktop design picker must not auto-open and block mobile Tavern taps');
    await blocked.locator('.mobile-top-menu summary').tap();
    assert.equal(await blocked.locator('.mobile-top-menu').getAttribute('open'),'');
    await blocked.locator('.mobile-top-menu summary').tap();
    await blocked.locator('.mode-signs').getByRole('button',{name:/Приключения/}).tap();
    assert.equal(await blocked.locator('.library-head h1').innerText(),'Приключения');
    await blocked.locator('.mode-signs').getByRole('button',{name:/Таверна/}).tap();
    assert.equal(await blocked.locator('.library-head h1').innerText(),'Таверна');
    await blocked.locator('.folder-actions').getByRole('button',{name:'+ Новая папка'}).tap();
    await blocked.getByRole('dialog',{name:'Новая папка'}).waitFor();
    await blocked.getByRole('button',{name:'Отмена'}).tap();
    assert.deepEqual(errors,[]);
    console.log('First-launch Android modal regression and Tavern touch controls OK');
    await fresh.close();
    await context.close();
  } finally { await browser.close(); }
})().catch(e => {console.error(e);process.exitCode=1;});
