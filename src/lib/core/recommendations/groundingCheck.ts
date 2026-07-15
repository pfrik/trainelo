/**
 * Deterministic grounding check for LLM coaching explanations.
 *
 * The highest-severity failure mode of the explanation LLM is inventing
 * NUMBERS (a resting-HR value, a made-up count of days) that aren't in the
 * evidence it was given. That class is detectable without another LLM: extract
 * every numeric token from the explanation and confirm each one also appears in
 * the context (the prompt the model saw). Anything left over is ungrounded.
 *
 * Pure: no IO, no LLM. Used by the eval harness AND the production validator in
 * generateExplanation.ts — the same invariant, enforced in code rather than
 * hoped for in a prompt.
 */

/** Distinct numeric tokens (integers or decimals) in appearance order. */
export function extractNumbers(text: string): string[] {
  return text.match(/\d+(?:\.\d+)?/g) ?? [];
}

/**
 * Numbers asserted in `text` that do not appear in `context`.
 * Compares exact numeric tokens (not substrings), so "4" never matches "42".
 * Spelled-out numbers ("three") are intentionally ignored — digit tokens are
 * the tractable, low-false-positive signal.
 */
export function findUngroundedNumbers(text: string, context: string): string[] {
  const grounded = new Set(extractNumbers(context));
  const seen = new Set<string>();
  const ungrounded: string[] = [];
  for (const n of extractNumbers(text)) {
    if (!grounded.has(n) && !seen.has(n)) {
      seen.add(n);
      ungrounded.push(n);
    }
  }
  return ungrounded;
}

/**
 * Named metrics the coach might cite. Deliberately narrow and specific — no
 * idiomatic words ("form", "sleep") that a coach uses conversationally — so the
 * check stays low-false-positive. `markers` are lowercase substrings that, if
 * present anywhere in the context (including reason codes like RHR_ELEVATED),
 * mean the metric IS available to the model and citing it is grounded.
 */
const NAMED_METRICS: ReadonlyArray<{ name: string; mention: RegExp; markers: string[] }> = [
  { name: "resting heart rate", mention: /resting heart rate|resting hr|\brhr\b/i, markers: ["rhr", "resting heart"] },
  { name: "HRV", mention: /\bhrv\b|heart rate variability/i, markers: ["hrv", "heart rate variability"] },
  { name: "training load (TSS)", mention: /\btss\b|training load/i, markers: ["tss", "training load", "load"] },
];

/**
 * Names of metrics the explanation cites that aren't present in the context.
 * Catches the real observed failure mode — e.g. the model narrating a resting
 * heart rate when RHR was never given to it.
 */
export function findUngroundedMetricClaims(text: string, context: string): string[] {
  const ctx = context.toLowerCase();
  const out: string[] = [];
  for (const m of NAMED_METRICS) {
    if (m.mention.test(text) && !m.markers.some((mk) => ctx.includes(mk))) {
      out.push(m.name);
    }
  }
  return out;
}

/**
 * All grounding violations (numbers + metric claims) as human-readable strings.
 * Used by the production validator to decide whether to repair/fall back, and
 * by the eval as a single tripwire.
 */
export function groundingViolations(text: string, context: string): string[] {
  const nums = findUngroundedNumbers(text, context).map((n) => `number ${n}`);
  const metrics = findUngroundedMetricClaims(text, context).map((m) => `metric "${m}"`);
  return [...nums, ...metrics];
}
