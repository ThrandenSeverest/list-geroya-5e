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
    await page.locator('#herolist-boot-warning').waitFor({timeout:12000});
    assert.match(await page.locator('#herolist-boot-warning').innerText(), /интерфейс не запустился/);
    assert.notEqual(await page.locator('html').getAttribute('data-herolist-hydrated'), '1');
    await page.unroute('**/assets/*.js');
    await page.reload();
    await page.waitForFunction(() => document.documentElement.getAttribute('data-herolist-hydrated') === '1');
    await page.locator('.mode-signs').getByRole('button',{name:/Приключения/}).tap();
    assert.equal(await page.locator('.library-head h1').innerText(), 'Приключения');
    assert.equal(await page.locator('#herolist-boot-warning').count(), 0);
    console.log('Missing-JS recovery and interactive hydration OK');
    await context.close();
  } finally { await browser.close(); }
})().catch(e => {console.error(e);process.exitCode=1;});
