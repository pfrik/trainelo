/**
 * Public engineering deep-dive — the technical story behind Trainelo.
 *
 * The landing page speaks plain language; this page is for the reader who
 * wants to know how it actually works: the data flow, the deterministic
 * recommendation pipeline, the evidence trail, and the stack. Linked from
 * the landing footer and shareable on its own (job applications, reviews).
 */

import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { EvidencePanel } from "@/components/dashboard/EvidencePanel";
import { AppWindow } from "@/components/landing/AppWindow";
import { DEMO_EVIDENCE, DEMO_RECOMMENDATION } from "@/lib/landing/demoData";
import { WAITLIST_URL } from "@/lib/landing/invite";

function Wordmark() {
  return (
    <span className="font-headline text-xl font-bold tracking-tight text-slate-900">
      Trainelo
    </span>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-green-700 mb-4">
      <span className="w-6 h-px bg-green-700/40" aria-hidden />
      <span>{children}</span>
    </div>
  );
}

/** One stage in the data-flow strip. */
function FlowChip({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 shadow-sm text-center">
      <div className="text-sm font-bold text-slate-900 whitespace-nowrap">{label}</div>
      {sub && <div className="text-[10px] text-slate-500 whitespace-nowrap">{sub}</div>}
    </div>
  );
}

function FlowArrow() {
  return (
    <span
      className="material-symbols-outlined text-base text-slate-300 shrink-0 rotate-90 sm:rotate-0"
      aria-hidden
    >
      arrow_forward
    </span>
  );
}

/** Numbered pipeline stage card. */
function StageCard({
  n,
  title,
  body,
}: {
  n: string;
  title: string;
  body: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <div className="font-headline text-sm font-bold text-green-700 mb-3">{n}</div>
      <h3 className="text-base font-bold text-slate-900 mb-2">{title}</h3>
      <p className="text-sm text-slate-600 leading-relaxed">{body}</p>
    </div>
  );
}

/** The real EvidencePanel, expanded, inside an app window. */
function EvidenceShowcase() {
  const [expanded, setExpanded] = useState(true);
  const morning = new Date();
  morning.setHours(7, 4, 0, 0);
  const sync = new Date();
  sync.setHours(6, 51, 0, 0);

  return (
    <AppWindow title="Trainelo — Today's evidence">
      <div className="flex items-center gap-2">
        <span className="bg-primary/20 text-primary text-xs font-bold px-2 py-0.5 rounded uppercase">
          Prescribed
        </span>
        <span className="text-sm font-bold text-white">{DEMO_RECOMMENDATION.title}</span>
      </div>
      <EvidencePanel
        evidence={DEMO_EVIDENCE}
        generatedAt={morning.toISOString()}
        lastGarminSync={sync.toISOString()}
        expanded={expanded}
        onToggle={() => setExpanded(!expanded)}
      />
    </AppWindow>
  );
}

export default function Engineering() {
  return (
    <div className="min-h-screen overflow-x-clip bg-[#fafaf9] text-slate-900 font-sans antialiased">
      <div
        className="absolute inset-x-0 top-0 h-[520px] pointer-events-none bg-[radial-gradient(70%_60%_at_50%_0%,rgba(34,197,94,0.08),rgba(34,197,94,0.02)_55%,transparent_80%)]"
        aria-hidden
      />

      {/* Floating pill nav */}
      <nav className="sticky top-4 z-40 max-w-5xl mx-auto px-4">
        <div className="flex items-center justify-between bg-white/80 backdrop-blur border border-slate-200 rounded-full pl-6 pr-2 py-2 shadow-sm">
          <Link to="/" aria-label="Back to the Trainelo homepage">
            <Wordmark />
          </Link>
          <a
            href={WAITLIST_URL}
            className="text-sm font-semibold bg-primary hover:bg-primary-hover text-slate-900 rounded-full px-5 py-2 transition-colors"
          >
            Join the waitlist
          </a>
        </div>
      </nav>

      {/* Header */}
      <header className="relative max-w-5xl mx-auto px-6 pt-16 pb-14">
        <Eyebrow>The engineering story</Eyebrow>
        <h1 className="font-headline text-4xl sm:text-5xl font-bold tracking-tight leading-[1.1] mb-6 max-w-3xl">
          A training coach you can <span className="text-green-600">audit</span>
        </h1>
        <p className="text-lg text-slate-600 leading-relaxed max-w-2xl">
          Trainelo's core promise is determinism: same inputs, same
          recommendation — every time, fully traceable. Here's how the data
          flows, how the pipeline decides, and where AI is (and isn't) allowed
          to touch the answer.
        </p>
      </header>

      {/* Data flow */}
      <section className="border-y border-slate-200 bg-white">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <h2 className="font-headline text-2xl font-bold tracking-tight mb-2">
            From wrist to recommendation
          </h2>
          <p className="text-slate-600 max-w-2xl mb-10">
            No manual uploads anywhere in the chain. Wellness data is synced
            server-side overnight; the raw payload is stored before parsing so
            no signal is ever lost to a schema change.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-1.5 flex-wrap">
            <FlowChip label="Watch" sub="HRV · sleep · RHR" />
            <FlowArrow />
            <FlowChip label="intervals.icu" sub="server-side sync" />
            <FlowArrow />
            <FlowChip label="Nightly ingest" sub="raw stored first" />
            <FlowArrow />
            <FlowChip label="Postgres" sub="Supabase + RLS" />
            <FlowArrow />
            <FlowChip label="Pipeline" sub="pure functions" />
            <FlowArrow />
            <FlowChip label="Your morning" sub="one session + evidence" />
          </div>
        </div>
      </section>

      {/* Pipeline */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <h2 className="font-headline text-2xl font-bold tracking-tight mb-2">
          The recommendation pipeline
        </h2>
        <p className="text-slate-600 max-w-2xl mb-10">
          Six deterministic stages, all pure functions with no IO — which is
          what makes them unit-testable and auditable. The same code runs in
          the morning cron and in the landing page's live demo.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <StageCard
            n="01 · Scoring"
            title="Readiness & fatigue"
            body="Sleep, HRV vs. your personal baseline, resting HR and an exponentially-weighted training-load model are fused into readiness and fatigue scores."
          />
          <StageCard
            n="02 · Safety"
            title="Anomaly detection"
            body="Rule-based checks for suppressed HRV, load spikes and overtraining risk. Findings escalate a caution level that can cap everything downstream."
          />
          <StageCard
            n="03 · Candidates"
            title="Session generation"
            body="Deterministic candidate workouts for the day, derived from readiness, recent load and days since rest — never invented free-form."
          />
          <StageCard
            n="04 · Calibration"
            title="The morning check-in"
            body="Your subjective signal adjusts intensity and duration — but it's capped, so a rough mood can't override strong objective data (and vice versa: illness always wins)."
          />
          <StageCard
            n="05 · Templates"
            title="Concrete workouts"
            body="The chosen candidate resolves to a versioned workout template — warm-up, blocks, cool-down — so the UI always renders structured, predictable sessions."
          />
          <StageCard
            n="06 · Evidence"
            title="The paper trail"
            body="Every number that influenced the decision is packaged with the recommendation: per-signal scores, caps applied, confidence, reason codes."
          />
        </div>

        {/* LLM boundary callout */}
        <div className="mt-8 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex items-start gap-4">
          <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 shrink-0">
            <span
              className="material-symbols-outlined text-2xl text-green-700"
              style={{ fontVariationSettings: '"FILL" 1' }}
              aria-hidden
            >
              smart_toy
            </span>
          </span>
          <div>
            <h3 className="text-base font-bold text-slate-900 mb-1">
              AI explains. It never decides.
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed max-w-2xl">
              An LLM may enrich the rationale text or select between
              pre-computed candidates by ID — its output is validated, repaired
              once, and dropped on failure. It cannot invent a workout, change
              a number, or block the recommendation: the deterministic answer
              always ships.
            </p>
          </div>
        </div>
      </section>

      {/* Evidence panel — the real component */}
      <section className="border-y border-slate-200 bg-white">
        <div className="max-w-5xl mx-auto px-6 py-20 grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
          <div>
            <h2 className="font-headline text-2xl font-bold tracking-tight mb-4">
              The evidence panel, live
            </h2>
            <p className="text-slate-600 leading-relaxed mb-6 max-w-lg">
              This is the actual production component, rendered with a
              realistic morning: decent sleep, HRV a touch under baseline, a
              check-in reporting soreness. You can see the wearable score, how
              far the check-in was allowed to move it, and the confidence
              behind the call.
            </p>
            <ul className="space-y-3 text-sm text-slate-700">
              {[
                "Per-signal breakdown: sleep, HRV, recovery, training load",
                "Subjective input is capped — objective data sets the baseline",
                "Confidence scored from data availability, consistency and recency",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span
                    className="material-symbols-outlined text-lg text-green-600 mt-[-1px]"
                    style={{ fontVariationSettings: '"FILL" 1' }}
                    aria-hidden
                  >
                    check_circle
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <EvidenceShowcase />
        </div>
      </section>

      {/* Principles + stack */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <h2 className="font-headline text-2xl font-bold tracking-tight mb-8">
          Built to be trusted
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-12">
          {[
            ["Deterministic engine", "same inputs, same answer — fully auditable"],
            ["Pure core", "business logic with zero IO: no DB, no network, no framework"],
            ["700+ automated tests", "behavioral assertions on the scoring core"],
            ["Tolerant ingest", "raw payloads stored before parsing; unknown fields never rejected"],
          ].map(([title, sub]) => (
            <div
              key={title}
              className="bg-white rounded-xl border border-slate-200 shadow-sm p-4"
            >
              <div className="text-sm font-bold text-slate-900 mb-1">{title}</div>
              <div className="text-xs text-slate-500 leading-relaxed">{sub}</div>
            </div>
          ))}
        </div>

        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-400 mb-4">
          Stack
        </h3>
        <div className="flex flex-wrap gap-2">
          {[
            "TypeScript",
            "React",
            "Vite",
            "Tailwind",
            "Supabase · Postgres",
            "Vercel serverless",
            "Zod contracts",
            "Vitest",
            "Anthropic API",
            "intervals.icu API",
          ].map((item) => (
            <span
              key={item}
              className="bg-white border border-slate-200 text-slate-700 text-sm font-semibold px-3.5 py-1.5 rounded-full shadow-sm"
            >
              {item}
            </span>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div className="relative overflow-hidden bg-dark-base rounded-3xl px-8 py-12 text-center shadow-2xl">
          <div
            className="absolute inset-x-0 -top-24 h-48 bg-primary/20 blur-3xl pointer-events-none"
            aria-hidden
          />
          <h2 className="relative font-headline text-2xl sm:text-3xl font-bold tracking-tight text-white mb-4">
            Don't take the docs' word for it.
          </h2>
          <p className="relative text-slate-400 mb-8 max-w-xl mx-auto">
            The calibration engine runs live on the homepage — same code, your
            inputs.
          </p>
          {/* Plain anchor: a full navigation lets the browser handle the #try-it scroll */}
          <a
            href="/#try-it"
            className="relative inline-block px-8 py-3.5 rounded-full font-semibold bg-primary hover:bg-primary-hover text-slate-900 transition-colors"
          >
            Try the live demo
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-5xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link to="/">
            <Wordmark />
          </Link>
          <p className="text-xs text-slate-500">
            Built by Pascal · © {new Date().getFullYear()} Trainelo
          </p>
        </div>
      </footer>
    </div>
  );
}
