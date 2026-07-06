---
name: preflight
description: Pre-push validation gate for Trainelo — serverless function count vs the Vercel Hobby 12-function cap, dev-route registry coverage, typecheck, tests, and lint, with a pass/fail summary. Run before every push/deploy.
---

# Preflight

Run all five gates, even if an early one fails (collect everything), then report a single pass/fail summary table. Recommend fixes for failures; don't apply them unless asked.

## Gate 1 — Serverless function count

Vercel Hobby caps deployments at **12 functions**. Every non-test `.ts` under `api/` counts (`.vercelignore` excludes `api/**/*.test.ts`):

```powershell
Get-ChildItem api -Recurse -Filter *.ts | Where-Object { $_.Name -notlike "*.test.ts" } | ForEach-Object { $_.FullName }
```

- FAIL if count > 12 (the Vercel build will reject the deployment). List the files so the user can pick what to cut or merge.
- WARN if count == 12 (at the cap — the next endpoint breaks the build).

## Gate 2 — Dev route registry coverage

Every handler must be registered in `scripts/dev/apiRoutes.ts` or it 404s in local dev. Compare the file list from Gate 1 against the `handler:` entries in the registry:

- FAIL for any handler file with no registry entry (cron endpoints `api/cron/*` may be intentionally unregistered — WARN only for those).
- WARN for registry entries pointing at handler files that no longer exist (stale routes).

## Gate 3 — Typecheck

`npm run typecheck` (covers both tsconfig.app.json and strict tsconfig.api.json).

## Gate 4 — Tests

`npm run test` (Vitest, single run).

## Gate 5 — Lint

`npm run lint`.

## Report format

| Gate | Result | Detail |
|---|---|---|
| Function count | ✅ / ⚠️ / ❌ | n/12 |
| Dev routes | ✅ / ⚠️ / ❌ | missing/stale entries |
| Typecheck | ✅ / ❌ | error count |
| Tests | ✅ / ❌ | passed/failed counts |
| Lint | ✅ / ❌ | error/warning counts |

End with a one-line verdict: safe to push, or what must be fixed first.
