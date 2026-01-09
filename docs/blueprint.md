Full details: docs/references/Trainelo V1 Blueprint_ Full - Non Consolidated.docx

This file is the *enforceable summary*. If anything conflicts, PROMPT.md wins.

# Trainelo V1 Blueprint (Lite-first / Full-ready)

## 0) Non-negotiables (must always be true)
- UI never breaks from LLM output
- Always show why: reason codes + evidence
- Threshold changes are auditable: append-only events + undo + lock
- Least intervention: keep plan unless strong evidence

## 1) Core recommendation contract (deterministic)
- Output 3–6 candidates (templates only)
- Candidate fields: candidate_id, template_ref, restrictions[], reason_codes[], computed_evidence_summary
- LLM cannot invent workouts; UI renders templates, not LLM workout text

## 2) Safety & policy
### Hard guardrails
- Injury/pain flagged: no intensity / no hills / no sprints. Only REST or EASY.
- Illness suspected (fever/illness flag): REST or EASY only; block intensity.
- High fatigue / low readiness (confidence high): cap intensity; prefer EASY/REST.
- Volume clamp: avoid large sudden increases; keep changes incremental (least intervention).
### Policy (least intervention)
- evidence requirements: confidence + trivial band + persistence + corroboration

## 3) LLM narrator (optional) + resilience (required)
### Allowed responsibilities
### Forbidden actions
### Resilience algorithm
- validate -> repair once -> fallback
- log raw output + validation errors

## 4) Data layer & provenance
- Canonical entities (workouts, daily_metrics, sleep, hrv, user_flags, …)
- Required provenance fields on every record
- Raw payload storage rule + key format
- Idempotency keys (high level)

## 5) Calibration trust model
- user_thresholds vs calibration_events
- undo / lock / cooldown rules
- required fields stored in calibration_events

## 6) Feedback loop (what we log; what it can affect)
## 7) Upgrade path (what comes later; why V1 seams make it easy)
