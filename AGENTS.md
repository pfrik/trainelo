# Trainelo Agent Rules (read first)
Order of authority:
1) PROMPT.md
2) AGENTS.md
3) docs/*

## Architecture boundaries
- src/lib/core/** = pure business logic only (no IO, no Supabase, no fetch, deterministic, unit-testable)
- Integrations/IO live outside core (db, network, storage)
- UI renders workouts from deterministic templates (template_ref). Never rely on LLM-generated workout text.

## Definition of Done (every PR)
- Unit tests added/updated for core logic
- Lint + typecheck + tests are green
- Recommendation endpoint always returns deterministic candidates + evidence (even if LLM is disabled/fails)
- Changes are minimal and scoped to the task

## Model/tool roles (optional guidance)
- Gemini: specs + UX states (no code)
- Claude Code: reasoning-heavy planning + implementation
- Codex CLI: run commands, fix failures, add/expand tests, small refactors

## Repo status note
- Repo currently uses Vite. Implement APIs in a Vite-compatible way for now; migrate to Next.js app/api/** later if/when we switch frameworks.
- Do not introduce Next.js-specific folders unless the repo has migrated.

## Tooling safety
- Always ask before running shell commands (install/build/migrate) and keep diffs minimal.
