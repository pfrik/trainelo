
Below is the updated single source of truth checklist, fully mapped to Next.js (App Router) + Vercel + Supabase, with Claude Code prompts included.

# Trainelo MVP Implementation Checklist (Vite + Vercel Functions + Supabase) — One Truth List

Folder mapping (final)

Core logic: src/lib/core/**

Data access: src/lib/db/**

Garmin integration: src/lib/integrations/garmin/**

API routes: api/**

Cron routes (Vercel Cron triggers): api/cron/**

UI (Vite/React): src/pages/** + src/components/** (React Router)

Tests: src/**/*.test.ts (or /tests if you prefer)

SQL migrations: supabase/migrations/** (or Prisma if you use Prisma)

Local development (Windows)

- Do NOT rely on `vercel dev` on Windows: it can serve incorrect MIME types for Vite modules (e.g. /@vite/client returning text/html), which breaks the frontend.

- Use the supported local workflow instead:

  - `npm run dev` → Vite frontend on http://127.0.0.1:8080

  - `npm run dev:api` → local Express wrapper for Vercel serverless functions on http://127.0.0.1:3001

  - `npm run dev:full` → runs both (recommended)

- When you add a new `/api/**` endpoint, register it in `scripts/dev/apiRoutes.ts` so it’s available in local `dev:api`.

## 0) Project guardrails (do first)

Enable strict TypeScript, ESLint, Prettier

Add test runner (Vitest recommended)

Create shared enums/types early in src/lib/core/contracts/**:

ReasonCode enum

CandidateId enum

CautionLevel enum

SchemaVersion constants

Add feature flags via env:

ENABLE_LLM

ENABLE_CALIBRATION_AUTO_APPLY

ENABLE_EVIDENCE_PANEL

Add server-only env validation (Zod) in src/lib/env.ts

Claude Code prompt

“In my Next.js App Router project, set up strict TS, ESLint/Prettier, Vitest, and create src/lib/core/contracts with enums for ReasonCodes, CandidateIds, and shared response types. Add env validation with Zod.”

## 1) Supabase schema (canonical time-series + trust layer)

### 1.1 Required tables (MVP minimal but correct shape)

workouts

daily_metrics

sleep_sessions

hrv_nights

user_flags (RPE, soreness, pain, illness symptoms)

user_preferences

user_thresholds (current truth used by engine)

calibration_events (append-only audit log)

recommendation_events (what you recommended + user choice + outcomes)

integration_connections (garmin tokens, scopes, status)

sync_state (per user per source: last_sync_at, cursor/page tokens if needed)

### 1.2 Required columns on canonical rows

source (e.g., garmin, user, inferred)

source_ref (blob key / external id pointer)

schema_version

created_at, updated_at

### 1.3 Idempotency constraints (must-have)

Workouts: unique (user_id, source, external_activity_id)

Daily metrics: unique (user_id, source, date, metric_type)

Sleep: unique (user_id, source, sleep_date)

HRV: unique (user_id, source, date)

### 1.4 Calibration trust behaviors

calibration_events is append-only (enforced in code; optional DB policy)

Undo writes a reversal event (never delete)

Support lock_until and cooldown_until for each threshold parameter (store in user_thresholds)

Claude Code prompt

“Create Supabase SQL migrations for the tables listed (including idempotency constraints, indexes for recent lookups, and RLS-friendly structure). Include user_thresholds and calibration_events with fields for effective_from/applied_at, reason_codes, evidence pointers, undo/lock/cooldown.”

## 2) Cold raw payload storage (Supabase Storage or S3)

### 2.1 Storage decision (MVP: Supabase Storage bucket is easiest)

Create bucket: raw-payloads

Implement helper: src/lib/db/blobStore.ts

putRawPayload({ userId, source, externalId, payload }): Promise<sourceRef>

key format: raw/garmin/{userId}/{yyyy-mm-dd}/{externalId}_{hash}.json

Store only source_ref in DB rows

Claude Code prompt

“Implement putRawPayload for Supabase Storage with deterministic key naming and hashing. Return the key as source_ref. Add tests for key generation + stable hashing.”

## 3) Garmin integration (connector + canonical transforms)

### 3.1 Connector module

src/lib/integrations/garmin/client.ts (API client wrapper)

src/lib/integrations/garmin/sync.ts (sync orchestration, batching)

src/lib/integrations/garmin/transformers/*.ts

activity → workouts

daily summary → daily_metrics

sleep → sleep_sessions

HRV → hrv_nights

### 3.2 Sync state + dedupe

Read sync_state (last_sync_at)

Fetch incremental updates

Dump raw payloads to blob storage

Upsert canonical records using idempotency keys

Update sync_state

Claude Code prompt

“Build Garmin connector + transformers to canonical tables. Include reading/writing sync_state, idempotent upserts, raw payload blob storage, and structured logging.”

## 4) Ingestion execution on Vercel (Cron + batching + timeouts)

### 4.1 Cron API route(s)

Create cron endpoints:

api/cron/garmin-sync.ts

Note (local dev): register this endpoint in `scripts/dev/apiRoutes.ts` so it’s available via `npm run dev:api`.

Secure cron endpoints:

require Authorization: Bearer <CRON_SECRET>

block public invocation

### 4.2 Batching strategy (to respect Vercel timeouts)

Pick one MVP strategy:

Option A (simple, recommended):

Each cron run processes N users max (e.g., 5–20)

Each user sync processes M records max (page size)

Store cursors in sync_state

Cron runs frequently (every minute / every 5 minutes)

Option B (slightly more robust):

Add sync_jobs table (queue-lite)

Cron enqueues jobs, then processes a limited number per run

Claude Code prompt

“Implement api/cron/garmin-sync that processes users in batches to stay under Vercel timeout. Add CRON_SECRET auth. Persist per-user cursors in sync_state so work continues next run.”

## 5) Math Core (NO AI): validity, confidence, baseline modes, trends/SWC

Put this in src/lib/core/math/**.

### 5.1 Validity + confidence (per metric)

Functions to compute:

valid boolean + confidence 0..1

data-quality reason codes (e.g., HR_LOW_CONFIDENCE, SLEEP_STAGE_LOW_CONF)

### 5.2 Baseline Manager (Cold start Mode A/B/C)

Mode A (0–7): wide bands, conservative, subjective-weighted

Mode B (8–21): short baseline 7–14d

Mode C (22+): robust baseline 28–42d

Expose: getBaselineMode(historyDays)

### 5.3 Trivial-band / SWC gating + persistence + trend state

Metric-specific trivial bands (config per metric)

Persistence rules (e.g., 2 of last 3 days)

Trend labels (e.g., down_3of4, stable_5of7)

Output a normalized “token set” the planner can use (structured, not free text)

Claude Code prompt

“Implement math core modules for validity/confidence, baseline mode selection A/B/C, and trivial-band/SWC gating with persistence and trend_state. Add unit tests for cold-start and noisy data edge cases.”

## 6) Training load + EWMA fitness/fatigue readiness

Put in src/lib/core/modeling/**.

Define a V1 training load computation (simple but consistent)

Implement EWMA:

fatigue τ ~ 7d

fitness τ ~ 42d

Output readiness + (optional) simple uncertainty bounds

Claude Code prompt

“Implement EWMA fitness/fatigue readiness from workout load. Provide a pure function with tests verifying decay behavior.”

## 7) Dissociation / anomaly detector (confidence-gated, multi-signal, persistent)

Put in src/lib/core/safety/anomaly.ts.

Rules must be:

confidence-gated

multi-signal (not single metric)

persistent (not one-off)

Output:

caution_level

reason_codes[]

restrictions[] (e.g., intensity block)

optional question_key (not user-visible text)

Claude Code prompt

“Build anomaly/dissociation detector producing caution_level + restrictions using confidence gating and persistence. Include tests that prevent false positives when HR confidence is low or zones are uncertain.”

## 8) Deterministic candidate generator + hard safety + least intervention

Put in src/lib/core/planning/**.

### 8.1 Candidate IDs and templates

Candidate IDs: KEEP_PLANNED, REDUCE_INTENSITY, REDUCE_DURATION, SWAP_TO_EASY, REST_OR_MOBILITY, OPTIONAL_TEST

Candidates reference deterministic templates (template_ref) rendered by UI (not LLM)

### 8.2 Guardrails + policy

Injury/pain rules → ban intensity/hills/sprints as needed

Illness cluster → rest/easy only

Volume caps + intensity caps

Least-intervention: default keep; intervene only with strong evidence

### 8.3 Required output fields (for fallback + explainability)

Each candidate output includes:

candidate_id, template_ref

restrictions[]

reason_codes[]

computed_evidence_summary (numbers computed in code)

Claude Code prompt

“Implement deterministic candidate generation with hard guardrails and least-intervention policy. Ensure outputs include reason_codes + computed_evidence_summary for explainability and fallback. Add tests for injury, illness, low readiness, and normal scenarios.”

## 9) LLM Narrator (strict JSON) + Resilience Layer (validate/repair/fallback)

Put in src/lib/core/llm/**.

### 9.1 Narrator schema (Zod)

Create NarratorOutputSchema (small surface):

schema_version

ranked_candidate_ids[]

summary (1–2 sentences)

optional detail_bullets[]

optional clarifying_question (max 1)

### 9.2 Resilience layer (required)

Implement validateOrRepairOrFallback():

Parse + validate with Zod

If fail → one repair call to LLM (“return corrected JSON only”)

If still fail → deterministic fallback explainer:

uses reason codes + evidence summary + restrictions

Log raw output + validation error (never shown to user)

### 9.3 Deterministic fallback templates

Create template map keyed by reason codes (keep it small at first)

Always produces a coherent explanation even with LLM disabled

Claude Code prompt

“Implement LLM narrator with strict JSON schema validation via Zod. Add resilience: validate → repair once → fallback templates. Log raw LLM output and validation errors. Add tests for malformed JSON, extra prose, missing fields.”

## 10) API routes (Next.js App Router)

### 10.1 Stable recommendation contract

POST api/recommendation/today.ts

loads canonical history

runs math core + EWMA + anomaly detector

generates candidates (always)

if ENABLE_LLM: narrator + resilience

returns: candidates + explanation + evidence panel payload

### 10.2 Logging + feedback endpoints

POST api/recommendation/choice.ts

POST api/user-flags/route.ts

### 10.3 Calibration endpoints

POST api/calibration/undo/route.ts

POST api/calibration/lock/route.ts

Claude Code prompt

“Create API routes for recommendation/today, recommendation/choice, user-flags, calibration/undo, calibration/lock. Ensure recommendation always returns candidates even if LLM fails. Use typed request/response models.”

## 11) UI (App Router)

### 11.1 Today view

Show planned workout + 3–6 candidates

Render candidate text from deterministic templates (template_ref)

Show explanation + reason labels

“Show evidence” panel (numbers + confidence indicators)

### 11.2 Feedback UX

“How did it feel?” next day prompt (fast, low friction)

Accept/reject logging

### 11.3 Calibration UX (trust-first)

Show “Zones refined” notifications with:

what changed

effective date

why (evidence summary)

Undo + Lock actions

Claude Code prompt

“Implement Today page rendering deterministic candidates and evidence panel. Add calibration change banner with Undo/Lock. Ensure the workout details come from templates, not the LLM.”

## 12) Passive calibration engine (confidence-based + audit trail + undo/lock/cooldown)

Put in src/lib/core/calibration/**.

### 12.1 Passive estimators (MVP)

Detect plausible new max HR only with high confidence + context

Infer CP/FTP/threshold cautiously (confidence-scored)

If confidence low: do not auto-apply; optionally suggest in Accuracy mode

### 12.2 Apply rules

Auto-apply only if:

confidence >= threshold

parameter not locked

not in cooldown (after undo)

evidence not flagged as anomalous

### 12.3 Trust layer outputs (must)

On any change:

update user_thresholds

append calibration_events with:

old→new, effective_from, applied_at

reason codes

evidence pointers (canonical IDs + source_ref)

confidence

create user-facing notification payload

Undo:

append reversal event

restore prior value

set cooldown window

Lock:

set lock_until for that parameter

Claude Code prompt

“Implement passive calibration with confidence gating, append-only calibration_events, and undo/lock/cooldown behavior. Include evidence pointers and tests to avoid spikes and prevent ‘fight the user’ loops.”

## 13) Observability + debugging (lightweight but essential)

Structured logs for:

cron sync batches (counts, timings, failures)

readiness output + baseline mode A/B/C

reason codes triggered

LLM validation fails + repair outcomes

calibration changes + undo/locks

Minimal internal debug endpoint/page (optional but huge value):

show reason codes + evidence + confidence + provenance pointers (source_ref)

Claude Code prompt

“Add structured logging for sync, recommendation generation, LLM resilience outcomes, and calibration. Create a minimal debug endpoint that returns reason codes, evidence summary, confidence, and provenance pointers for a given recommendation.”

## 14) “Seams” to keep full architecture easy later (do now, cheap)

All core logic stays in src/lib/core/** as pure functions where possible

Ingestion writes canonical rows + blob refs only (no coupling to planning)

Recommendation endpoint is the stable contract; internals can evolve

Idempotency keys and timestamps are present from day 1

Notes for Claude Code usage (make it work like a senior dev)

When you ask Claude:

constrain scope (“only edit src/lib/core/math/*”)

require unit tests

require typed interfaces

ask explicitly for cold-start + low-confidence edge cases

insist on “no TODO-only placeholders”
