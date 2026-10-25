# Regression checks

With `tsx` and `playwright` installed in the development environment:

```sh
node --import tsx tests/racial-traits.test.ts
node tests/pdf-layout/check.cjs
```

`PDF_TEST_CHROMIUM` optionally selects a local Chromium executable; `PLAYWRIGHT_MODULE` optionally selects a Playwright module path. The PDF check starts and stops its own Vite fixture server. It checks screen and print geometry, footer clearance, preservation of every resource, and continuation pages for 0–24 resources. The fixture reproduces the reported long-name orc sheet.

The racial checks cover proficiency scaling at levels 1/5/9/13/17, shared racial pools in multiclass characters, spent uses, MPMM versus legacy rest rules, and duplicate trait keys across the variant catalog.

The mobile regression test uses synthetic characters and an already running site:

```sh
HEROLIST_URL=http://127.0.0.1:3998/ node tests/mobile-layout.cjs
```

It checks 320, 390, 430 and 1440 px layouts, inventory and coin fields, the complete final sheet, immediate ASI controls, individual rations inside collapsible packs, layout settings, and consciousness confirmation for a long rest at zero HP. `HB_TEST_CHROMIUM` selects a local browser; `HB_TEST_CHROMIUM_ARGS` accepts a JSON array of launch arguments. The same test runs before GitHub Pages publication.

The play-interface regression checks cover quick damage/healing and undo,
concentration, independent attack editing/formula/roll actions, saved view
preferences, and the landing illustration in all five built-in designs:

```sh
node --import tsx --test tests/play-redesign.test.ts
HEROLIST_URL=http://127.0.0.1:3998/ node tests/play-redesign-browser.cjs
```

The browser check uses synthetic local characters at 320, 360, 390, 768, 1024,
1280 and 1920 px, plus 125–200% magnification on tablet/desktop widths. It also
checks native JSON round trips in the rules suite. `HB_TEST_CHROMIUM` and
`PLAYWRIGHT_MODULE` select the local browser and Playwright installation.
