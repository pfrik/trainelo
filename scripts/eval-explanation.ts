/**
 * Eval harness for the LLM coaching explanation (generateExplanation.ts).
 *
 * PM learning artifact. It exercises the real production LLM feature across a
 * fixed test set and scores each output THREE ways:
 *
 *   1. Rule-based format checks (deterministic): the format contract.
 *   2. Deterministic grounding (groundingViolations): invented numbers OR named
 *      metrics (e.g. RHR) absent from the evidence — caught in code, no LLM.
 *      This is the trustworthy metric, and the SAME check the production
 *      validator enforces before any explanation ships.
 *   3. LLM-as-judge (Claude Sonnet 5): semantic grounding / tone / fit, with the
 *      rubric calibrated so reasonable coaching phrasing is NOT counted as a
 *      hallucination.
 *
 * Because generation (temp 0.3) and the judge are both non-deterministic, set
 * EVAL_RUNS>1 to run the whole set N times and report baseline variance — you
 * cannot trust a single n=12 run.
 *
 *   ANTHROPIC_API_KEY via .env.local. Run:
 *     npm run eval:explanation                 # 1 run
 *     EVAL_RUNS=3 npm run eval:explanation      # 3 runs + variance
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import {
  generateExplanation,
  buildUserPrompt,
} from "../src/lib/core/recommendations/generateExplanation.js";
import { groundingViolations } from "../src/lib/core/recommendations/groundingCheck.js";
import type {
  EvidenceSummary,
  RecommendationCandidate,
} from "../src/lib/core/contracts/recommendation.js";

// Pricing per 1M tokens — verify before quoting. Sonnet 5 intro $2/$10 through 2026-08-31.
const PRICE = {
  haiku: { input: 1.0, output: 5.0 },
  sonnet: { input: 3.0, output: 15.0 },
} as const;
const JUDGE_MODEL = "claude-sonnet-5";
const RUNS = Math.max(1, Number(process.env.EVAL_RUNS ?? "1") || 1);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
function evidence(overrides: Partial<EvidenceSummary>): EvidenceSummary {
  return {
    fatigue_score: 40,
    fitness_score: 55,
    hrv_trend: "stable",
    sleep_quality: 75,
    days_since_rest: 2,
    confidence: 0.8,
    ...overrides,
  };
}
function candidate(overrides: Partial<RecommendationCandidate>): RecommendationCandidate {
  return {
    candidate_id: "scheduled",
    template_ref: "tempo_40",
    label: "Tempo · 40 min",
    rationale: "Recovered well enough for quality work.",
    reason_codes: [],
    caution_level: "none",
    ...overrides,
  };
}

interface EvalCase {
  name: string;
  evidence: EvidenceSummary;
  candidate: RecommendationCandidate;
}

const CASES: EvalCase[] = [
  { name: "optimal recovery → scheduled tempo", evidence: evidence({ fatigue_score: 30, sleep_quality: 88, hrv_trend: "rising", checkin_mood: "great" }), candidate: candidate({ reason_codes: ["RECOVERY_OPTIMAL", "SCHEDULED_WORKOUT_EXISTS"] }) },
  { name: "high fatigue → rest", evidence: evidence({ fatigue_score: 88, days_since_rest: 9, sleep_quality: 55 }), candidate: candidate({ candidate_id: "rest_day", template_ref: null, label: "Rest day", caution_level: "moderate", reason_codes: ["FATIGUE_HIGH", "REST_DAY_DUE"] }) },
  { name: "poor sleep → lite alternative", evidence: evidence({ sleep_quality: 38, checkin_mood: "tired" }), candidate: candidate({ candidate_id: "lite_alternative", template_ref: "easy_30", label: "Easy · 30 min", caution_level: "low", reason_codes: ["SLEEP_POOR"] }) },
  { name: "illness flagged → rest", evidence: evidence({ checkin_illness_flag: true, checkin_mood: "drained", fatigue_score: 70 }), candidate: candidate({ candidate_id: "rest_day", template_ref: null, label: "Rest day", caution_level: "high", reason_codes: ["REST_DAY_DUE"] }) },
  { name: "pain flagged → skip", evidence: evidence({ checkin_pain_flag: true, checkin_soreness: 8 }), candidate: candidate({ candidate_id: "rest_day", template_ref: null, label: "Rest day", caution_level: "high" }) },
  { name: "cold start / low confidence", evidence: evidence({ confidence: 0.25, baseline_mode: "cold_start", fatigue_score: null, hrv_trend: null }), candidate: candidate({ reason_codes: ["COLD_START", "INSUFFICIENT_DATA"] }) },
  { name: "HRV declining → lite", evidence: evidence({ hrv_trend: "declining", fatigue_score: 62 }), candidate: candidate({ candidate_id: "lite_alternative", template_ref: "easy_40", label: "Easy · 40 min", caution_level: "low", reason_codes: ["HRV_DECLINING"] }) },
  { name: "taper phase with race goal", evidence: evidence({ goal_title: "Texel 60km Ultra", training_phase: "taper", plan_week_number: 14, days_until_race: 6, ewma_form_score: 12 }), candidate: candidate({ label: "Sharpener · 25 min", reason_codes: ["FORM_POSITIVE", "ADAPTATION_PHASE"] }) },
  { name: "already trained today → recovery focus", evidence: evidence({ workout_completed_today: true, workout_completed_tss: 65 }), candidate: candidate({ candidate_id: "rest_day", template_ref: null, label: "Recovery", caution_level: "low" }) },
  { name: "objective good vs subjective drained (conflict)", evidence: evidence({ fatigue_score: 35, sleep_quality: 82, checkin_mood: "drained", checkin_soreness: 7, signal_contribution: { objective_score: 78, subjective_delta: -20, subjective_delta_raw: -35, final_score: 58, conflict_flag: true, conflict_description: "You feel worse than your numbers suggest." } }), candidate: candidate({ candidate_id: "lite_alternative", template_ref: "easy_30", label: "Easy · 30 min", caution_level: "low" }) },
  { name: "anomaly: overtraining risk", evidence: evidence({ anomaly_caution_level: "moderate", anomaly_restrictions: ["cap_intensity"], anomaly_escalation_note: "HRV suppressed 3 days running", anomaly_streak_days: 3 }), candidate: candidate({ candidate_id: "lite_alternative", template_ref: "easy_45", label: "Easy · 45 min", caution_level: "moderate", reason_codes: ["ANOMALY_OVERTRAINING_RISK"] }) },
  { name: "elevated resting HR → caution", evidence: evidence({ fatigue_score: 68, sleep_quality: 60 }), candidate: candidate({ candidate_id: "lite_alternative", template_ref: "easy_40", label: "Easy · 40 min", caution_level: "low", reason_codes: ["RHR_ELEVATED"] }) },
];

// ---------------------------------------------------------------------------
// Scorers
// ---------------------------------------------------------------------------
const EMOJI = /\p{Extended_Pictographic}/u;
const BANNED_OPENERS = ["based on your data", "looking at your metrics"];

interface RuleResult {
  sentenceCount: boolean;
  noEmoji: boolean;
  noBannedOpener: boolean;
  reasonableLength: boolean;
}
function ruleCheck(text: string): RuleResult {
  const sentences = text.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
  const lower = text.toLowerCase();
  return {
    sentenceCount: sentences.length >= 2 && sentences.length <= 3,
    noEmoji: !EMOJI.test(text),
    noBannedOpener: !BANNED_OPENERS.some((p) => lower.startsWith(p)),
    reasonableLength: text.length > 20 && text.length < 500,
  };
}

// Judge rubric calibrated per Fable: coaching interpretation is fine; only
// unstated facts / invented numbers count as hallucination.
const JUDGE_SYSTEM = `You are a strict QA reviewer for an AI running/cycling coach.
Given the athlete's evidence (JSON) and a coaching explanation, score the explanation.
A "grounded" explanation only references facts present in the evidence and invents no numbers.
IMPORTANT: interpretive coaching phrasing (e.g. "your fatigue is manageable", "you're not fully recovered", "your body is ready") is ACCEPTABLE and is NOT a hallucination. Only count a specific UNSTATED FACT or an INVENTED NUMBER (a metric value not in the evidence) as ungrounded.
Reply with ONLY a JSON object, no prose:
{"grounded": true|false, "hallucinated_facts": ["..."], "tone_calm_1to5": 1-5, "matches_recommendation": true|false, "verdict": "pass"|"fail", "note": "one short sentence"}`;

interface JudgeVerdict {
  grounded: boolean;
  hallucinated_facts: string[];
  tone_calm_1to5: number;
  matches_recommendation: boolean;
  verdict: "pass" | "fail";
  note: string;
}
interface JudgeResult {
  verdict: JudgeVerdict | null;
  inputTokens: number;
  outputTokens: number;
}
async function judge(client: Anthropic, c: EvalCase, explanation: string): Promise<JudgeResult> {
  const input = `EVIDENCE:\n${JSON.stringify(c.evidence, null, 2)}\n\nRECOMMENDATION: ${c.candidate.label} (${c.candidate.candidate_id})\n\nEXPLANATION TO SCORE:\n"${explanation}"`;
  const res = await client.messages.create({
    model: JUDGE_MODEL,
    max_tokens: 400,
    thinking: { type: "disabled" },
    system: JUDGE_SYSTEM,
    messages: [{ role: "user", content: input }],
  });
  const block = res.content.find((b) => b.type === "text");
  const raw = block && block.type === "text" ? block.text : "";
  return { verdict: parseVerdict(raw), inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens };
}
function parseVerdict(raw: string): JudgeVerdict | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as JudgeVerdict;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------
interface CaseOutcome {
  name: string;
  explanation: string | null;
  latencyMs: number;
  rules: RuleResult | null;
  violations: string[];
  verdict: JudgeVerdict | null;
  judgeCostUsd: number;
}
interface RunRates {
  detGrounded: number; // deterministic: no invented numbers
  judgeGrounded: number;
  overallPass: number;
  returnedText: number;
}

async function runOnce(client: Anthropic, runIdx: number): Promise<CaseOutcome[]> {
  const outcomes: CaseOutcome[] = [];
  for (const c of CASES) {
    const t0 = Date.now();
    const explanation = await generateExplanation(c.evidence, c.candidate);
    const latencyMs = Date.now() - t0;
    if (!explanation) {
      outcomes.push({ name: c.name, explanation: null, latencyMs, rules: null, violations: [], verdict: null, judgeCostUsd: 0 });
      console.log(`  [run ${runIdx}] · ${c.name} — null (fallback)`);
      continue;
    }
    const context = buildUserPrompt(c.evidence, c.candidate);
    const violations = groundingViolations(explanation, context);
    const rules = ruleCheck(explanation);
    const j = await judge(client, c, explanation);
    const detFlag = violations.length === 0 ? "✓" : "✗";
    console.log(`  [run ${runIdx}] ${detFlag} ${c.name} — ${latencyMs}ms${violations.length ? ` violations:[${violations.join(", ")}]` : ""}`);
    outcomes.push({ name: c.name, explanation, latencyMs, rules, violations, verdict: j.verdict, judgeCostUsd: judgeCostUsd(j) });
  }
  return outcomes;
}

function ratesFor(outcomes: CaseOutcome[]): RunRates {
  const withText = outcomes.filter((o) => o.explanation !== null);
  const frac = (n: number, d: number) => (d ? n / d : 0);
  return {
    detGrounded: frac(withText.filter((o) => o.violations.length === 0).length, withText.length),
    judgeGrounded: frac(withText.filter((o) => !!o.verdict?.grounded).length, withText.length),
    overallPass: frac(withText.filter((o) => o.verdict?.verdict === "pass").length, withText.length),
    returnedText: frac(withText.length, outcomes.length),
  };
}

function pct(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}
function estGenCostUsd(explanation: string): number {
  return (450 * PRICE.haiku.input + Math.ceil(explanation.length / 4) * PRICE.haiku.output) / 1_000_000;
}
function judgeCostUsd(r: JudgeResult): number {
  return (r.inputTokens * PRICE.sonnet.input + r.outputTokens * PRICE.sonnet.output) / 1_000_000;
}

async function main(): Promise<void> {
  const key = process.env.ANTHROPIC_API_KEY?.replace(/^["']|["']$/g, "").trim();
  if (!key) {
    console.error("ANTHROPIC_API_KEY is not set (checked .env.local). Aborting.");
    process.exit(1);
  }
  const client = new Anthropic({ apiKey: key });

  console.log(`Running ${CASES.length} cases × ${RUNS} run(s) — Haiku generate → Sonnet 5 judge\n`);
  const runs: CaseOutcome[][] = [];
  for (let i = 1; i <= RUNS; i++) {
    runs.push(await runOnce(client, i));
  }
  writeScorecard(runs);
}

// ---------------------------------------------------------------------------
// Scorecard
// ---------------------------------------------------------------------------
function rate(nums: boolean[]): string {
  const pass = nums.filter(Boolean).length;
  const total = nums.length;
  return `${pass}/${total} (${total ? Math.round((pass / total) * 100) : 0}%)`;
}
function fmtPct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

function writeScorecard(runs: CaseOutcome[][]): void {
  const last = runs[runs.length - 1];
  const withText = last.filter((o) => o.explanation !== null);
  const allRates = runs.map(ratesFor);
  const genCost = runs.flat().filter((o) => o.explanation).reduce((s, o) => s + estGenCostUsd(o.explanation!), 0);
  const judgeCost = runs.flat().reduce((s, o) => s + o.judgeCostUsd, 0);
  const latencies = runs.flat().filter((o) => o.explanation).map((o) => o.latencyMs);

  const L: string[] = [];
  L.push(`# Explanation eval scorecard`);
  L.push(``);
  L.push(`*Generated ${new Date().toISOString().slice(0, 10)} · ${CASES.length} cases × ${runs.length} run(s) · Haiku 4.5 generate → Sonnet 5 judge*`);
  L.push(``);

  if (runs.length > 1) {
    L.push(`## Baseline variance (${runs.length} runs) — read this first`);
    L.push(``);
    L.push(`A single n=12 run is too noisy to trust. Spread across runs:`);
    L.push(``);
    L.push(`| Metric | Per-run | Mean | Range |`);
    L.push(`|---|---|---|---|`);
    const row = (label: string, sel: (r: RunRates) => number) => {
      const vals = allRates.map(sel);
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      L.push(`| ${label} | ${vals.map(fmtPct).join(" · ")} | ${fmtPct(mean)} | ${fmtPct(Math.min(...vals))}–${fmtPct(Math.max(...vals))} |`);
    };
    row("**Grounded (numbers + metrics, deterministic)**", (r) => r.detGrounded);
    row("Judge: grounded (semantic)", (r) => r.judgeGrounded);
    row("Judge: overall pass", (r) => r.overallPass);
    row("Returned text (not fallback)", (r) => r.returnedText);
    L.push(``);
    L.push(`> The deterministic grounded-numbers row is the trustworthy signal — it doesn't depend on a non-deterministic judge. Compare *that* across changes, not the judge %.`);
    L.push(``);
  }

  L.push(`## Latest run — detail`);
  L.push(``);
  L.push(`| Check | Pass rate |`);
  L.push(`|---|---|`);
  L.push(`| Format: 2–3 sentences | ${rate(withText.map((o) => !!o.rules?.sentenceCount))} |`);
  L.push(`| Format: no emoji | ${rate(withText.map((o) => !!o.rules?.noEmoji))} |`);
  L.push(`| Format: no banned opener | ${rate(withText.map((o) => !!o.rules?.noBannedOpener))} |`);
  L.push(`| Format: reasonable length | ${rate(withText.map((o) => !!o.rules?.reasonableLength))} |`);
  L.push(`| **Grounded (numbers + metrics, deterministic)** | ${rate(withText.map((o) => o.violations.length === 0))} |`);
  L.push(`| Judge: grounded (semantic) | ${rate(withText.map((o) => !!o.verdict?.grounded))} |`);
  L.push(`| Judge: matches recommendation | ${rate(withText.map((o) => !!o.verdict?.matches_recommendation))} |`);
  L.push(`| Judge: overall pass | ${rate(withText.map((o) => o.verdict?.verdict === "pass"))} |`);
  L.push(`| LLM returned text (not fallback) | ${rate(last.map((o) => o.explanation !== null))} |`);
  const tones = withText.map((o) => o.verdict?.tone_calm_1to5).filter((t): t is number => typeof t === "number");
  L.push(`| Judge: avg calm tone (1–5) | ${tones.length ? (tones.reduce((a, b) => a + b, 0) / tones.length).toFixed(1) : "n/a"} |`);
  L.push(``);
  L.push(`## Latency & cost (all runs)`);
  L.push(``);
  L.push(`| Metric | Value |`);
  L.push(`|---|---|`);
  L.push(`| Generation latency p50 | ${pct(latencies, 50)} ms |`);
  L.push(`| Generation latency p95 | ${pct(latencies, 95)} ms |`);
  L.push(`| Est. generation cost / recommendation (Haiku) | $${(genCost / Math.max(1, latencies.length)).toFixed(5)} |`);
  L.push(`| Est. total generation cost | $${genCost.toFixed(4)} |`);
  L.push(`| Judge cost (Sonnet 5) | $${judgeCost.toFixed(4)} |`);
  L.push(``);
  L.push(`## Grounding violations, latest run`);
  L.push(``);
  const invented = withText.filter((o) => o.violations.length > 0);
  if (invented.length === 0) {
    L.push(`_None — every number and named metric in every explanation is grounded in the evidence (and the production validator now enforces this before any explanation ships)._`);
  } else {
    for (const o of invented) {
      L.push(`- **${o.name}** — ${o.violations.join(", ")}`);
      L.push(`  > ${o.explanation}`);
    }
  }
  L.push(``);
  L.push(`## Method`);
  L.push(``);
  L.push(`Each case feeds a fixed \`EvidenceSummary\` + candidate into the real \`generateExplanation()\`, then scores the output with (1) deterministic format rules, (2) **deterministic grounding** (\`groundingViolations\` — invented numbers + named metrics, the SAME check the production validator now enforces before any explanation ships), and (3) an LLM judge (Sonnet 5, calibrated to allow coaching voice — kept as a noisy secondary signal, not a target). Generation cost is estimated (the production fn doesn't expose token usage); judge cost is measured from \`usage\`.`);

  const out = join(process.cwd(), "AI Learning", "eval-scorecard.md");
  writeFileSync(out, L.join("\n"), "utf8");
  console.log(`\nScorecard written to: ${out}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
