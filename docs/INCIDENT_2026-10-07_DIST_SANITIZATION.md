# Vinext committed dist: security and reproducibility

Production `dist/` is compiled and committed to `main`; only production
Node.js dependencies are necessary on the hosting server. The runtime start
script in `deployment/start-frontend.mjs` must rotate temporary Vinext
draft/prerender secrets for each startup.

## Incident on 2026-10-07

The emergency dist rebuild at `c59dd36` correctly sanitized the build
**before** its smoke test. But that test called `npm start` inside the same
workspace. The runtime script replaced the placeholder secrets, after which
the workflow committed `dist/` without re-sanitizing. The values committed
were ephemeral test-run values, not backend `.env`, Telegram credentials
or database passwords. A hosting launch regenerates them.

## Prevention

- Before publishing, run `python3 scripts/sanitize-committed-dist.py`.
- Always check `python3 scripts/check-sanitized-dist.py` on the **committed**
  `dist/` before `npm start` mutates any files.
- In workflows that test a built runtime and then commit dist, sanitize and
  check the build **again after** the runtime smoke test.
- `npm run build` + `Verify HeroList` + Pages browser checks must be green.
- When comparing dist and sources, `scripts/normalize-dist-for-compare.py`
  explicitly normalizes certain generated values. Therefore passing that
  check alone is insufficient proof that compiled dist is sanitized.

Startup-generated secrets are only valid for a given runtime. Never copy the
running host's mutated `dist/server/` back into GitHub. Protect backend data,
`.env`, uploads and the existing DB when updating frontend-only files.
