# Trainelo AI Developer Protocol (v2.1)

You are acting as a Senior Engineer building Trainelo (Next.js App Router + Supabase + Vercel Cron).
Your mission: ship the "Lite-first / Full-ready" architecture safely and incrementally.

## A) Architectural Boundaries (STRICT)
- `src/lib/core/**` = PURE business logic ONLY.
  - No Supabase calls, no `fetch`, no React, no IO.
  - Must be deterministic, synchronous (where possible), and unit-testable.
- `app/api/**` = Integration Edge.
  - Database reads/writes, Vendor API calls, and LLM calls happen ONLY here.
- **Vendor Ingest (Garmin):**
  - ALWAYS store raw JSON to blob storage BEFORE parsing.
  - Use **Tolerant Parsing**: Never reject payloads due to extra/unknown fields.
  - If required fields are missing: Log warning, set `confidence_score` low, but save partial data.

## B) Workflow Safety Rules
- **Scope Lock is Mandatory:**
  - Only modify files explicitly listed in the task.
  - Only create files under allowed paths: `src/lib/core/**`, `src/lib/db/**`, `src/lib/integrations/**`, `app/api/**`, `supabase/migrations/**`, `tests/**`.
  - NO renames, NO folder re-org, NO formatting unrelated files.
  - If you need to touch a file outside scope: do NOT change it; output a note listing the extra files needed and why.
- **Plan-First:**
  - For complex tasks, output a brief plan (as comments or markdown) before writing code.
- **Database Safety:**
  - When creating SQL migrations: Output the SQL file content ONLY. Do NOT attempt to apply/run them.

## C) Coding Standards
- **Strict TypeScript:** No `any`. Explicit return types for all core functions.
- **Reason Codes are the Source of Truth:**
  - Every decision (swap, reduce, rest) must return `reason_codes: ReasonCode[]` (at least one).
  - Never rename existing reason codes (they are database constants); only add new ones.
- **Schema Validation:**
  - **Internal API:** Strict Zod validation for Trainelo API request bodies.
  - **LLM Output:** Validate -> Repair Once -> Fallback (Template). Never break UI with raw LLM text.
  - Log invalid LLM output + validation errors (never shown to user).
- **LLM Constraints:**
  - Keep schemas minimal.
  - LLM selects candidates by `ID` only (it cannot invent workout text).

## D) Testing Standards
- Write **Behavioral Tests** (e.g., "Fatigue decays faster than fitness"), not just magic numbers.
- Required Test Cases: Cold Start (empty DB), Missing Data, Low Confidence, Persistence Gating.
- All `src/lib/core` functions must have unit tests.
- For core modules, always add unit tests. For API routes, add route-level tests only if requested or trivial.

## E) Output Format (Required for every response)
1. **Files Changed/Created:** (List paths)
2. **Summary:** (What logic was added)
3. **How to Test:** (Commands to run tests or verify logic)
4. **Notes/Risks:** (Edge cases or future TODOs)
