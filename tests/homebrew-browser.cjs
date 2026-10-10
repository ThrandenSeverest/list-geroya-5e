const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const { spawn } = require("node:child_process");
const shaman = require("../app/shamanExample.json").entities;
const table = {
  id: "hb:test:table:sample",
  schemaVersion: 2,
  type: "table",
  name: "Таблица проверки",
  description: "Таблица для печати",
  updatedAt: "2026-09-26T00:00:00Z",
  table: {
    columns: ["Уровень", "Бонус"],
    rows: Array.from({ length: 20 }, (_, i) => [
      String(i + 1),
      "Тест " + (i + 1),
    ]),
  },
};
(async () => {
  const server = process.env.HEROLIST_URL
    ? null
    : spawn(
        process.execPath,
        ["node_modules/vinext/dist/cli.js", "start", "--port", "3997"],
        { stdio: "ignore" },
      );
  if (server)
    for (let i = 0; i < 60; i++) {
      try {
        if ((await fetch("http://127.0.0.1:3997")).ok) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 500));
    }
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.HB_TEST_CHROMIUM,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    for (const width of [1440, 390]) {
      const context = await browser.newContext({
        viewport: { width, height: 1000 },
      });
      const page = await context.newPage();
      page.setDefaultTimeout(10000);
      page.setDefaultNavigationTimeout(15000);
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route("**/api/account", (r) =>
        r.fulfill({ json: { authenticated: false } }),
      );
      await page.addInitScript(
        ({ shaman, table }) => {
          localStorage.setItem(
            "herolist-homebrew-local-v2",
            JSON.stringify({
              version: 2,
              schemaVersion: 2,
              elements: [...shaman, table],
            }),
          );
        },
        { shaman, table },
      );
      await page.goto(process.env.HEROLIST_URL || "http://127.0.0.1:3997");
      const myCharacters = page
          .getByRole("button", { name: "Мои персонажи", exact: false })
          .first(),
        homebrewButton = page.getByRole("button", {
          name: "Моё хоумбрю",
          exact: true,
        });
      await myCharacters.click();
      try {
        await homebrewButton.waitFor({ state: "visible", timeout: 5000 });
      } catch {
        await myCharacters.click();
        await homebrewButton.waitFor({ state: "visible", timeout: 10000 });
      }
      await homebrewButton.click();
      assert.ok(await page.locator(".hb-workspace-sidebar").isVisible());
      await page
        .locator(".hb-sidebar-package > button")
        .filter({ hasText: "Шаман" })
        .first()
        .click();
      await page
        .getByRole("button", { name: "Развитие и способности", exact: true })
        .click();
      const sacredFocusChoice = page
        .locator(".hb-choice-progression-card")
        .filter({
          has: page
            .locator("summary > span")
            .filter({ hasText: /^Сакральный фокус$/ }),
        })
        .first();
      assert.ok(await sacredFocusChoice.isVisible());
      assert.match(
        (await sacredFocusChoice.textContent()) || "",
        /Сакральный фокус: Тело/,
      );
      const totemChoice = page
        .locator(".hb-choice-progression-card")
        .filter({
          has: page
            .locator("summary > span")
            .filter({ hasText: /^Тотемы$/ }),
        })
        .first();
      assert.match(
        (await totemChoice.textContent()) || "",
        /Прогрессия этой способности/,
      );
      assert.equal(
        await page
          .locator(".hb-package-contents")
          .getByText("Способность ·", { exact: false })
          .count(),
        0,
      );
      await page.getByRole("button", { name: "Закрыть", exact: true }).click();
      await page
        .locator(".hb-quick-create button")
        .filter({ hasText: "Заклинание" })
        .click();
      await page.getByLabel("Название Homebrew").fill("Карточка проверки");
      assert.match(
        await page.locator(".hb-spell-preview .pdf-spell-card").innerText(),
        /Карточка проверки/,
      );
      assert.match(
        await page.locator(".hb-spell-preview .pdf-spell-card").innerText(),
        /Заговор/i,
      );
      await page
        .locator(".hb-spell-preview")
        .screenshot({ path: `/tmp/herolist-spell-preview-${width}.png` });
      assert.equal(
        await page
          .locator(".hb-tabs button")
          .filter({ hasText: "Прогрессия" })
          .count(),
        0,
      );
      await page.getByRole("button", { name: "Механика", exact: true }).click();
      await page
        .getByRole("button", { name: "+ Добавить бросок урона", exact: true })
        .click();
      assert.ok(
        await page.getByLabel("Бросок урона", { exact: true }).isVisible(),
      );
      await page
        .getByRole("button", { name: "+ Ступень развития", exact: true })
        .click();
      assert.equal(
        await page.getByLabel("Уровень развития заговора").inputValue(),
        "5",
      );
      assert.ok(
        await page
          .locator(".hb-workspace-sidebar")
          .evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
      );
      page.once("dialog", (dialog) => dialog.accept());
      await page.getByRole("button", { name: "Закрыть", exact: true }).click();
      await page
        .locator(".hb-toolbar summary")
        .filter({ hasText: "+ Создать" })
        .click();
      await page.getByRole("button", { name: "Подкласс", exact: true }).click();
      await page
        .getByLabel("Родительский класс", { exact: true })
        .selectOption("official:class:fighter");
      assert.match(
        await page.locator(".hb-editor").innerText(),
        /3, 7, 10, 15, 18/,
      );
      await page.getByLabel("Название Homebrew").fill("Проверочный подкласс");
      await page
        .getByRole("button", { name: "Сохранить изменения", exact: true })
        .click();
      assert.ok(await page.getByRole("button", { name: "Сохранено", exact: true }).isDisabled());
      await page
        .locator(".hb-document-menu")
        .getByText("Ещё", { exact: true })
        .click();
      assert.ok(
        await page
          .getByRole("button", { name: "Удалить Homebrew", exact: true })
          .isVisible(),
      );
      await page
        .locator(".hb-document-menu")
        .getByText("Ещё", { exact: true })
        .click();
      {
        if (
          !(await page
            .getByRole("button", { name: "Класс", exact: true })
            .isVisible())
        )
          await page
            .locator(".hb-toolbar summary")
            .filter({ hasText: "+ Создать" })
            .click();
        await page.getByRole("button", { name: "Класс", exact: true }).click();
        await page.getByLabel("Название Homebrew").fill("Класс браузера");
        await page.getByText("Владения и мультикласс", {exact:true}).click();
        await page.getByRole("button", { name: "Простое оружие", exact: true }).click();
        assert.equal(await page.getByRole("button", { name: "Простое оружие", exact: true }).getAttribute("aria-pressed"), "true");
        await page.getByRole("button", { name: "Мультикласс: Сила 13", exact: true }).click();
        await page.getByRole("button", { name: "Лёгкие доспехи при мультиклассе", exact: true }).click();
        assert.equal(await page.getByRole("button", { name: "Лёгкие доспехи при мультиклассе", exact: true }).getAttribute("aria-pressed"), "true");
        await page.getByRole("button", { name: "Развитие и способности", exact: true }).click();
        await page.getByRole("button", { name: "Уровень 4: 0 записей", exact: true }).click();
        await page.getByRole("button", { name: "+ Повышение характеристик / черта", exact: true }).click();
        assert.equal(await page.getByRole("button", { name: "✓ Повышение характеристик / черта", exact: true }).getAttribute("aria-pressed"), "true");
        assert.equal(await page.locator(".hb-level-picker button").count(), 20);
        await page
          .getByRole("button", { name: "+ Способность на 4 уровне", exact: true })
          .click();
        await page
          .locator(".hb-feature-list input:not([type=number])")
          .first()
          .fill("Браузерная способность");
        const featureDescription = page.getByLabel("Описание способности Браузерная способность", { exact: true });
        await featureDescription.fill("Урон: @dam");
        assert.ok(await page.getByRole("listbox", { name: "Команды: Описание способности Браузерная способность" }).isVisible());
        await page.keyboard.press("Enter");
        assert.match(await featureDescription.inputValue(), /\[\[damage formula=/);
        await page.getByRole("button", { name: /Добавить действие/ }).click();
        await page.getByRole("button", { name: "+ Действие", exact: true }).click();
        await page.getByLabel("Название действия").fill("Особое действие");
        await featureDescription.fill("Урон: @dam");
        await page.keyboard.press("Escape");
        await featureDescription.locator("..").getByRole("button", { name: "@ Команды и примеры", exact: true }).click();
        await page.getByLabel("Группа команд: Описание способности Браузерная способность").selectOption("Кнопки в описании");
        await page.getByLabel("Поиск команд: Описание способности Браузерная способность").fill("лечен");
        await featureDescription.locator("..").locator(".hb-command-browser button").click();
        assert.match(await featureDescription.inputValue(), /\[\[heal formula=/);
        assert.ok(await page.locator(".hb-development").evaluate(e => e.scrollWidth <= e.clientWidth + 1));
        await page
          .getByRole("button", { name: "Заклинания", exact: true })
          .click();
        if (!(await page.getByLabel("Прогрессия магии").isVisible())) await page.getByText("Редактировать магию, ячейки и список заклинаний", { exact: true }).click();
        await page.getByLabel("Прогрессия магии").selectOption("full");
        const druidList = page
          .locator(".hb-spell-source-grid button")
          .filter({ hasText: "Друид" });
        await druidList.click();
        assert.equal(await druidList.getAttribute("aria-pressed"), "true");
        assert.match(await page.locator(".hb-spell-source-grid").innerText(), /заклинаний/);
        await page
          .getByLabel("Найти заклинание для класса")
          .fill("Огненный шар");
        await page
          .locator(".hb-toolbar button")
          .filter({ hasText: "Огненный шар" })
          .first()
          .click();
        await page
          .getByRole("button", { name: "Сохранить изменения", exact: true })
          .click();
        const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("herolist-homebrew-local-v2")));
        const savedClass = saved.elements.find(e => e.name === "Класс браузера");
        assert.equal(savedClass.schemaVersion, 2);
        assert.equal(savedClass.features[0].level, 4);
        assert.equal(savedClass.features[0].name, "Браузерная способность");
        assert.match(savedClass.features[0].description, /\[\[heal formula=/);
        assert.equal(savedClass.features[0].actions[0].name, "Особое действие");
        assert.deepEqual(savedClass.advancement[4], [{ type: "asi_or_feat" }]);
        assert.equal(savedClass.spellcasting.mode, "full");
        assert.ok(savedClass.effects.some(e => e.type === "weapon_group_proficiency" && e.group === "simple"));
        await page.getByRole("button", { name: "Закрыть", exact: true }).click();
        await page.getByLabel("Поиск в боковой библиотеке").fill("Класс браузера");
        assert.equal(
          await page.locator(".hb-browser-results article").count(),
          1,
        );
        const savedCard = page.locator(".hb-browser-results article").first();
        assert.ok(
          await savedCard
            .getByRole("button", { name: "Удалить Homebrew", exact: true })
            .isVisible(),
        );
        await savedCard.locator('input[type="checkbox"]').check();
        assert.ok(await page.getByRole("button", { name: "Удалить выбранные (1)", exact: true }).isEnabled());
        await savedCard.locator('input[type="checkbox"]').uncheck();
        await page.getByLabel("Фильтр Homebrew").selectOption("spell");
        assert.equal(
          await page.locator(".hb-browser-results article").count(),
          0,
        );
        await page.getByLabel("Фильтр Homebrew").selectOption("all");
        await page.getByLabel("Поиск в боковой библиотеке").fill("");
      }
      await page.getByLabel("Поиск в боковой библиотеке").fill("Шаман");
      const card = page
        .locator(".hb-browser-results article")
        .filter({
          has: page.getByRole("heading", { name: "Шаман", exact: true }),
        });
      page.once("dialog", (d) => d.accept());
      await card
        .getByRole("button", { name: "Выбрать класс", exact: true })
        .click();
      await page.getByLabel("Поиск в боковой библиотеке").fill("Таблица проверки");
      await page
        .locator(".hb-browser-results article")
        .getByRole("button", { name: "Использовать", exact: true })
        .click();
      await page.getByRole("button", { name: "Назад", exact: true }).click();
      await page
        .locator("nav.steps button")
        .filter({ hasText: "Снаряжение" })
        .click();
      assert.equal(await page.locator(".equipment-group").count(), 3);
      assert.match(await page.locator(".equipment-builder").innerText(), /Основное оружие/);
      assert.match(await page.locator(".equipment-builder").innerText(), /Дальнобойное снаряжение/);
      assert.match(await page.locator(".equipment-builder").innerText(), /Набор/);
      await page
        .locator("nav.steps button")
        .filter({ hasText: "Итог" })
        .click();
      await page.locator(".pdf-document").waitFor({ state: "attached" });
      assert.ok(
        (await page.locator(".pdf-document").innerText()).includes(
          "Таблица проверки",
        ),
      );
      assert.ok((await page.locator(".pdf-document table").count()) >= 1);
      assert.equal(await page.locator(".pdf-document table").first().locator("tbody tr").count(), 20);
      const dialog = page.waitForEvent("dialog");
      const click = page
        .getByRole("button", { name: "Long Story Short JSON", exact: true })
        .click();
      const warning = await dialog;
      assert.match(warning.message(), /Внимание, персонаж содержит Homebrew/);
      assert.match(warning.message(), /Класс: Шаман/);
      await warning.dismiss();
      await click;
      await page.locator(".hb-on-sheet").scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `/tmp/herolist-homebrew-${width}.png`,
        fullPage: false,
      });
      assert.deepEqual(errors, []);
      console.log(`Homebrew UI ${width}: passed`);
      await context.close();
    }
  } finally {
    await browser.close();
    server?.kill();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
