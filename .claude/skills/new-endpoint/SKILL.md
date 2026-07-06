---
name: new-endpoint
description: Scaffold a new Vercel API endpoint following Trainelo house patterns — checks the 12-function Hobby cap first, generates the handler with auth/logging/error conventions, registers the local dev route, and typechecks. Use when adding any new file under api/.
---

# New API Endpoint

Scaffold a new serverless function under `api/` the Trainelo way. Follow these steps in order.

## Step 1 — Check the function cap (BLOCKING)

Vercel Hobby allows **at most 12 serverless functions**. Every non-test `.ts` file under `api/` becomes one (`.vercelignore` already excludes `api/**/*.test.ts`). Count:

```powershell
(Get-ChildItem api -Recurse -Filter *.ts | Where-Object { $_.Name -notlike "*.test.ts" }).Count
```

- If the count is already **12**, STOP. Tell the user the new endpoint will break the Vercel build and present options: delete/merge an existing endpoint (check `api/debug/recommendation.ts` first — it's the most expendable), fold the new route into an existing handler via `?action=` multiplexing (see `api/goals/index.ts`), or consolidate everything into a catch-all router (bigger refactor).
- If the count is 11 or fewer, proceed — and report the new total.

## Step 2 — Write the handler

Model on an existing handler (`api/sync/refresh.ts` is a clean recent example). House rules:

- Default export: `export default async function handler(req: VercelRequest, res: VercelResponse)` from `@vercel/node`.
- Gate methods first: `if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });`
- **Relative TS imports use `.js` extensions** (NodeNext ESM): `import { getDailyUserState } from "../../src/lib/db/queries.js"`.
- Auth: user endpoints resolve `Bearer <supabase JWT>` via `resolveUserId()` from `src/lib/api/resolveUser.js`. Cron endpoints instead check `Authorization === "Bearer " + cleanEnvValue(process.env.CRON_SECRET)`.
- Read all env vars through `cleanEnvValue()` (values may carry quotes/control chars).
- Logging: `const log = createLogger("<route-name>", generateRequestId());` from `src/lib/core/observability/log.js`; log a completion line including `timing_ms`.
- Non-fatal pattern: wrap non-critical steps in try/catch, `log.warn` and continue. Business logic goes in `src/lib/core/**` (pure, no IO) — the handler only wires IO to core.
- Strict TS (tsconfig.api.json): no `any`, explicit types.

## Step 3 — Register the local dev route (REQUIRED)

Add an entry to `scripts/dev/apiRoutes.ts` (path, method, handler as `../api/<path>.js`, description). Without this the endpoint 404s in local dev (`npm run dev:full`) even though it works in prod.

## Step 4 — Verify

1. `npm run typecheck`
2. If the endpoint contains logic worth testing, the logic belongs in `src/lib/core/**` with a colocated `*.test.ts` (behavioral assertions; cold start / missing data cases). Route-level tests only if trivial or requested.
3. Offer to smoke-test locally: `npm run dev:full`, then curl the route on `http://localhost:3001`.
