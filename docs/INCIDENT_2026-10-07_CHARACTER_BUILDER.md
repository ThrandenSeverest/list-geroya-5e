# Incident 2026-10-07: character builder unavailable on the characteristics step

## Exact cause

Commit `c7ceb255eda5` ("Fix racial spellcasting across character sheets") introduced
`racialSpellChoiceGroups.length` in the `step === 2` JSX of `app/page.tsx`.
Only `racialChoiceGroups` was declared. JavaScript evaluated the missing
identifier at render time and raised `ReferenceError: racialSpellChoiceGroups is not defined`.
`BuilderErrorBoundary` displayed "Не удалось обновить лист персонажа".
Any race could trigger it: the undefined variable was evaluated before a race check.

## How this got into main

1. The TSX change was pushed to `main` without a blocking TypeScript semantic
   check. `vinext build` transpiled it without catching the undefined name.
2. Existing pre-publish tests did not enter the characteristics stage of
   character creation on desktop and mobile. Browser tests for the new runtime
   were restricted to pull requests in `.github/workflows/verify.yml`, so a direct
   `main` push did not exercise the UI.
3. The first hotfix changed source and tests while the previous `dist` was
   still committed; independent `Verify HeroList` temporarily failed on the
   committed-`dist` comparison even as the separate rebuild succeeded.
4. The publish workflow previously used `cancel-in-progress: true`; an
   unrelated skipped workflow_run cancelled the valid, ongoing Pages publish.

## Fixes

- `a12b973`: use `racialChoiceGroups.length`; add exact regression check and
  browser-sheet test of the characteristics stage.
- `c59dd36`: rebuild and sanitize deployable `dist`.
- `0129c11`: make Pages publishing non-cancellable by skipped sibling runs.
- Add a semantic TypeScript check for undeclared references (`TS2304`/`TS2552`)
  in `app/page.tsx`, as a mandatory `npm run test:rules` test. Unlike a
  string-only test, this catches future variable-name mistakes.

## Mandatory release protocol

1. Before any `main` change, run `npm run test:rules` and `npm run build`.
   Run the desktop/mobile creation browser check through the characteristics
   step (prefer a PR so the full browser workflow runs before merge).
2. Commit source changes and their newly compiled, sanitized `dist` together
   for hosting; never present an outdated dist as release-ready.
3. Confirm the `Verify HeroList` workflow succeeded, then require the Pages
   publish workflow, actual deployment, and `BUILD_INFO.json` to match.
4. Do not alter production DB, user data, auth secrets or uploads when fixing
   frontend assets. Do not claim `herolist.superaistory.fun` was updated merely
   because GitHub Pages was published.

The mere success of `vinext build` does **not** prove that the React UI has
no runtime ReferenceErrors. Each newly added UI path needs browser coverage.
