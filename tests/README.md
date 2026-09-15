# Regression checks

With `tsx` and `playwright` installed in the development environment:

```sh
node --import tsx tests/racial-traits.test.ts
node tests/pdf-layout/check.cjs
```

`PDF_TEST_CHROMIUM` optionally selects a local Chromium executable; `PLAYWRIGHT_MODULE` optionally selects a Playwright module path. The PDF check starts and stops its own Vite fixture server. It checks screen and print geometry, footer clearance, preservation of every resource, and continuation pages for 0–24 resources. The fixture reproduces the reported long-name orc sheet.

The racial checks cover proficiency scaling at levels 1/5/9/13/17, shared racial pools in multiclass characters, spent uses, MPMM versus legacy rest rules, and duplicate trait keys across the variant catalog.
