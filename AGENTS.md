# Trainelo Agent Rules (read first)

**Full engineering context lives in `CLAUDE.md`** — commands, architecture map, API/frontend conventions, testing standards, and gotchas. Read it before making changes. Order of authority: CLAUDE.md → PROMPT.md (workflow protocol) → docs/*.

## Non-negotiables (apply to every tool/agent)

- `src/lib/core/**` = pure business logic only: no IO, no Supabase, no fetch, deterministic, unit-tested. Integrations/IO live in `api/**` and `src/lib/db/**`.
- UI renders workouts from deterministic templates (`template_ref`). Never rely on LLM-generated workout text.
- The recommendation endpoint always returns deterministic candidates + evidence, even if the LLM is disabled or fails.
- Reason codes are database constants: only add, never rename.
- Every PR: unit tests for core logic added/updated; lint + typecheck + tests green; diffs minimal and scoped.

## Model/tool roles (optional guidance)

- Gemini: specs + UX states (no code)
- Claude Code: reasoning-heavy planning + implementation
- Codex CLI: run commands, fix failures, add/expand tests, small refactors

## Tooling safety

- Always ask before running shell commands (install/build/migrate) and keep diffs minimal.
