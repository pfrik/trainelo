# Trainelo Architecture (V1 Lite → Full-ready)

This doc is the high-level pipeline + invariants. For detailed reference see:
- docs/references/Trainelo - Architecture.docx
- docs/references/Trainelo V1 Blueprint_ Full - Non Consolidated.docx

```text
┌───────────────────────────────────────────────────────────────────────────────┐
│                                 INPUT SOURCES                                │
├──────────────────────────┬──────────────────────────────┬─────────────────────┤
│ Garmin (now) + others     │ User input (App/Chat)        │ Plan/Goals (DB)     │
│ later (wearables/apps)    │ RPE, soreness, pain,         │ race date, phase,   │
│                           │ illness symptoms, constraints │ prefs, availability │
└───────────────┬──────────┴───────────────┬───────────────┴───────────┬─────────┘
                │                          │                           │
                ▼                          ▼                           ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│                      CONSENT + IDENTITY + PROVENANCE                          │
│ user_id↔vendor_id • scopes • source tagging • schema_version                  │
└───────────────────────────────────────────┬───────────────────────────────────┘
                                            │
                                            ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│                          SIMPLE INGESTION (V1 LITE)                           │
│ poll/webhook • idempotency/dedupe • backfill-lite                             │
│ dump raw payloads → cold blob storage (no indexing)                            │
└───────────────────────────────────────────┬───────────────────────────────────┘
                                            │
                                            ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│                     CANONICAL TIME-SERIES DATA LAYER                          │
│ workouts • daily_metrics • sleep_sessions • hrv_nights • user_flags • prefs   │
│ + thresholds: user_thresholds (current) + calibration_events (history)        │
└───────────────────────────────────────────┬───────────────────────────────────┘
                                            │
                                            ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│                   DATA INTEGRITY + UNCERTAINTY (MATH)                         │
│ validity checks • per-metric confidence • missingness/outliers                │
│ baseline manager (Mode A/B/C) • trivial-band/SWC gating • trend states        │
└───────────────────────────────────────────┬───────────────────────────────────┘
                                            │
                                            ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│                PHYSIOLOGICAL MODELING (EWMA FITNESS/FATIGUE)                  │
│ training load → fitness(τ~42d) + fatigue(τ~7d) → readiness (+ uncertainty)     │
└───────────────────────────────────────────┬───────────────────────────────────┘
                                            │
                                            ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│              DISSOCIATION / ANOMALY DETECTOR (SAFETY SIGNALS)                 │
│ confidence-gated • multi-signal • persistence                                  │
│ outputs: caution_level + reason_codes + restrictions                           │
└───────────────────────────────────────────┬───────────────────────────────────┘
                                            │
                                            ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│          DETERMINISTIC CANDIDATE GENERATOR + HARD SAFETY + POLICY             │
│ 3–6 allowed options: Keep / Reduce / Swap / Rest / Optional Test              │
│ guardrails + volume/intensity caps + least-intervention default               │
│ outputs: candidates + reason_codes + computed evidence summary                │
└───────────────────────────────────────────┬───────────────────────────────────┘
                                            │
                                            ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│                  LLM NARRATOR (STRICT JSON ONLY, NO INVENTION)                │
│ ranks candidate IDs • writes short explanation • max 1 question               │
└───────────────────────────────────────────┬───────────────────────────────────┘
                                            │
                                            ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│                 LLM OUTPUT RESILIENCE LAYER (REQUIRED)                        │
│ parse+validate (Zod/Pydantic) → if fail: repair once → else fallback template │
│ log raw output + validation errors (never shown to user)                      │
└───────────────────────────────────────────┬───────────────────────────────────┘
                                            │
                                            ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│                                OUTPUTS + UI                                   │
│ render deterministic workout templates • explanation + reason codes + evidence │
│ calibration notifications include undo/lock                                    │
└───────────────────────────────────────────┬───────────────────────────────────┘
                                            │
                                            ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│                           FEEDBACK LOOP (LEARNING)                            │
│ accept/reject • completion • next-day feel → slow personalization              │
└───────────────────────────────────────────┬───────────────────────────────────┘
                                            │
                                            ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│                 PASSIVE CALIBRATION ENGINE (TRUST-FIRST)                      │
│ confidence-based silent updates + audit trail (calibration_events)            │
│ undo + lock + cooldown • optional tests only in Accuracy/Race Prep mode       │
└───────────────────────────────────────────────────────────────────────────────┘

```

(Optional later “Full” infra)

- queues/DLQ, replay/backfills, multi-source conflict resolution, deeper observability

Implementation notes (current repo)

- Frontend is a Vite React SPA (React Router).

- Backend integration edge is Vercel serverless functions under `api/**`.

- Windows local dev: run `npm run dev:full` (Vite on :8080 + local Express wrapper for `/api/**` on :3001). Avoid `vercel dev` due to MIME type issues with Vite modules.

- Raw vendor payloads should be written to Supabase Storage (e.g. bucket `raw-payloads`) before parsing (tolerant parsing).
