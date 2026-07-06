# Trainelo

Deterministic daily training-recommendation engine: Garmin/intervals.icu wellness data + morning check-in + AI reasoning → today's calibrated workout, always with an evidence trail. Stack: Vite + React + TypeScript, Vercel serverless functions (`api/`), Supabase (Postgres + auth), intervals.icu sync, Anthropic SDK for optional explanation text.

## Commands

- `npm run dev:full` — local dev (Vite on 127.0.0.1:8080 + Express API server on :3001; Vite proxies `/api/*`). **Never use `vercel dev`** — a Windows MIME-type bug breaks Vite module loading (see CONTRIBUTING.md).
- `npm run typecheck` — `tsc` over both `tsconfig.app.json` (frontend, non-strict) and `tsconfig.api.json` (api/, strict).
- `npm run test` / `test:watch` — Vitest, default config (no vitest.config file).
- `npm run lint` — ESLint.
- Backfills: see `/backfill` skill (`scripts/intervals-backfill.ts`, `scripts/backfill-ewma.ts`).

## Architecture

Authority order for docs: **CLAUDE.md → docs/**. `AGENTS.md` (cross-tool entry point) and `PROMPT.md` (protocol details) defer to this file.

- `api/**` — Vercel serverless functions, **integration only** (DB, vendor APIs, LLM calls). ⚠️ **Vercel Hobby plan caps deployments at 12 functions and we are at exactly 12.** Every non-test `.ts` file under `api/` becomes a function (`.vercelignore` excludes `api/**/*.test.ts`). Before adding one, use the `/new-endpoint` skill — it checks the cap.
- `src/lib/core/**` — **pure business logic: no Supabase, no fetch, no React, no IO.** Deterministic and unit-tested. This boundary is strict.
- `src/lib/db/` — server-side data access (service-role Supabase). `src/lib/api/resolveUser.ts` — canonical JWT→userId auth helper.
- `src/lib/core/contracts/` — Zod schemas + types (`ReasonCode`, `SchemaVersion`, `CautionLevel`). **Reason codes are DB constants: append-only, never rename.** Frontend validates API responses against these schemas.
- `src/lib/sync/intervalsSync.ts` — intervals.icu wellness ingest (raw JSON stored to blob via `src/lib/db/blobStore.ts` *before* parsing; tolerant parsing, never reject unknown fields).

Recommendation pipeline (all pure, under `src/lib/core/`), wired together by `api/recommendation/today.ts` and reused by `api/cron/daily-recommendations.ts`:
scoring (`recommendations/computeReadinessAndFatigue.ts`) → anomaly detection (`safety/anomaly.ts` + escalation) → candidate generation (`recommendations/generateDailyRecommendation.ts`) → session calibration (`checkin/calibrator.ts`) → anomaly restrictions → templates (`templates/resolveTemplate.ts`) → evidence → optional LLM explanation (`recommendations/generateExplanation.ts`, non-fatal, enriches rationale only).

## API handler conventions

- Default-export `handler(req: VercelRequest, res: VercelResponse)` from `@vercel/node`; gate methods with `res.status(405)`.
- **`.js` extensions on relative TS imports** (NodeNext ESM), e.g. `import { x } from "../../src/lib/db/queries.js"`.
- Auth: `Bearer <supabase JWT>` → `resolveUserId()` from `src/lib/api/resolveUser.ts`. Cron endpoints instead use `Bearer <CRON_SECRET>`.
- Treat env vars as dirty: read through `cleanEnvValue()` (values may carry quotes/control characters).
- Logging: `createLogger(route, generateRequestId())` from `src/lib/core/observability/log.js`; log a completion line with `timing_ms`.
- Non-fatal error pattern: downgrade non-critical failures (LLM, EWMA persist, anomaly persist) to `log.warn` and continue — the recommendation endpoint must always return deterministic candidates + evidence.
- **Register every new handler in `scripts/dev/apiRoutes.ts`** or it 404s in local dev (prod is unaffected).

## Frontend conventions

- Data hooks (`src/hooks/`) are hand-rolled `useState`/`useEffect`/`fetch` with the `Authorization` header from `useAuth()`. **react-query is provided in App.tsx but NOT used for data fetching** — don't model new hooks on it.
- Validate API responses with the contract Zod schemas (`safeParse`).
- Routing: react-router v6 in `src/App.tsx` with `ProtectedRoute`/`AuthRoute` wrappers.
- shadcn/ui in `src/components/ui/` (49 components), `cn()` from `src/lib/utils.ts`, CVA for variants, Lucide icons, Recharts, Sonner toasts. Alias `@` → `src/`.
- Browser Supabase client (`src/integrations/supabase/client.ts`) is intentionally untyped (`as any`, TODO to restore typed DB).

## Testing

- Vitest, colocated `*.test.ts` next to source. Core modules (`src/lib/core/**`) always get unit tests; API route tests only if trivial or requested.
- Mock IO with `vi.mock()` for db modules and `@supabase/supabase-js`; fake Vercel req/res via hand-rolled `makeReq()`/`makeRes()`.
- Write behavioral assertions ("fatigue decays faster than fitness"), not magic numbers. Required cases: cold start (empty DB), missing data, low confidence, persistence gating.

## Naming traps & gotchas

- `src/lib/core/recommendation/` (singular) = response builders; `src/lib/core/recommendations/` (plural) = the pipeline.
- `src/lib/core/checkin/calibrator.ts` = per-session calibration from the morning check-in; `src/lib/core/calibration/` = passive personal-threshold detection (HR max, resting HR, HRV baseline). Two unrelated "calibration" concepts.
- LLM never invents workouts: it selects candidates by ID; UI renders deterministic `template_ref` templates, never LLM text. LLM output: validate → repair once → fallback to template.
- Strict TypeScript in api/ and core: no `any`, explicit return types on core functions.
- Repo is Vite (PROMPT.md's Next.js mention is historical) — do not introduce Next.js folders.

## Design Context (condensed — full version in `.impeccable.md`)

- **Brand:** Precise, Calm, Trusted. The quiet coach with data to back every call. Morning emotional goal: calm and trust, never anxiety.
- **Visual:** dark-first, data-rich but visually quiet; clean cards, generous whitespace. Green `#22C55E` = primary/positive, orange `#f97316` = accent, red = caution only.
- **Type:** Inter (body/UI), Space Grotesk (brand moments).
- **Principles:** calm confidence over hype (purposeful motion only); show the why (evidence panels, reason codes, confidence are core UX); least intervention (stable, predictable layouts); data-rich, visually quiet; mobile-first, morning-first (today's recommendation reachable with minimal scrolling).
- **Accessibility:** WCAG AA; 4.5:1 contrast (3:1 large text); keyboard nav + visible focus in both themes; color never the sole state indicator; respect `prefers-reduced-motion`.
- **Component conventions:** shadcn/ui + Radix, `cn()` composition, CVA variants, skeleton loaders with `animate-pulse`, 4px spacing rhythm (cards p-3/p-4/p-6), radius via `--radius` (8/6/4px).
