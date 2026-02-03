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

- **Database FK convention**: All user-owned tables use `user_id UUID REFERENCES auth.users(id)` directly. Do not reference `public.profiles(id)` for user ownership—this ensures consistent RLS policies (`auth.uid() = user_id`) and simpler query patterns. The `profiles` table exists for extended user metadata but is not used as a FK target for data ownership.

## Cron Jobs

### Daily Recommendations (`/api/cron/daily-recommendations`)

Runs daily at 05:00 UTC via Vercel Cron. Computes and upserts training recommendations for all users with data.

**Authentication:**
- `Authorization: Bearer <CRON_SECRET>` header (Vercel Cron standard)

**Query Parameters:**
- `dryRun=1` - Preview recommendations without writing to database
- `date=YYYY-MM-DD` - Override target date (defaults to today UTC)

**Response:**
```json
{
  "ok": true,
  "target_date": "2024-01-15",
  "users_processed": 10,
  "upserts_ok": 10,
  "upserts_failed": 0,
  "dry_run": false,
  "duration_ms": 1234
}
```

**Required Environment Variables:**
| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL (e.g., `https://xxx.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for server-side DB access (never expose to client) |
| `CRON_SECRET` | Secret for cron authentication (generate with `openssl rand -hex 32`) |

**Testing (Production):**
```bash
# Ping endpoint - verify functions are routed correctly (should return JSON, not HTML)
curl.exe -i https://trainelo.vercel.app/api/ping

# Cron endpoint with auth (dry run)
curl.exe -i -H "Authorization: Bearer $CRON_SECRET" "https://trainelo.vercel.app/api/cron/daily-recommendations?dryRun=1"
```

**Testing (Local):**
```bash
# Local ping
curl -i http://localhost:3001/api/ping

# Local dry run (no DB writes)
curl -i -H "Authorization: Bearer $CRON_SECRET" "http://localhost:3001/api/cron/daily-recommendations?dryRun=1"
```
