/**
 * Public landing page — shown at "/" for logged-out visitors.
 *
 * The product visuals are the real components (EvidencePanel, recovery
 * ring) fed with demo data from src/lib/landing/demoData.ts, so the page
 * always matches the shipped product.
 */

import { useState } from "react";
import { Link } from "react-router-dom";
import { EvidencePanel } from "@/components/dashboard/EvidencePanel";
import { RecoveryRing } from "@/components/landing/RecoveryRing";
import {
  DEMO_EVIDENCE,
  DEMO_HRV_WEEK,
  DEMO_HRV_BASELINE,
  DEMO_RECOMMENDATION,
} from "@/lib/landing/demoData";

// ---------------------------------------------------------------------------
// Small pieces
// ---------------------------------------------------------------------------

function Wordmark() {
  return (
    <span className="font-headline text-xl font-bold tracking-tight text-white">
      Trainelo<span className="text-primary">.</span>
    </span>
  );
}

/** Single-series sparkline: 7 nights of HRV with a dashed baseline. */
function HrvSparkline() {
  const w = 132;
  const h = 40;
  const pad = 4;
  const min = Math.min(...DEMO_HRV_WEEK, DEMO_HRV_BASELINE) - 4;
  const max = Math.max(...DEMO_HRV_WEEK, DEMO_HRV_BASELINE) + 4;
  const x = (i: number) => pad + (i * (w - pad * 2)) / (DEMO_HRV_WEEK.length - 1);
  const y = (v: number) => h - pad - ((v - min) * (h - pad * 2)) / (max - min);
  const points = DEMO_HRV_WEEK.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const last = DEMO_HRV_WEEK[DEMO_HRV_WEEK.length - 1];

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className="shrink-0">
      <line
        x1={pad}
        x2={w - pad}
        y1={y(DEMO_HRV_BASELINE)}
        y2={y(DEMO_HRV_BASELINE)}
        stroke="#475569"
        strokeWidth="1"
        strokeDasharray="3 3"
      />
      <polyline
        points={points}
        fill="none"
        stroke="#94a3b8"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={x(DEMO_HRV_WEEK.length - 1)} cy={y(last)} r="3.5" fill="#22c55e" />
    </svg>
  );
}

/** The hero product mock: real recommendation-card styling + demo data. */
function HeroProductCard() {
  return (
    <div className="relative w-full max-w-md">
      {/* Soft glow behind the composition */}
      <div
        className="absolute -inset-8 rounded-[2.5rem] bg-primary/10 blur-3xl"
        aria-hidden
      />

      {/* Recommendation card */}
      <div className="relative w-full bg-dark-surface rounded-2xl border border-slate-700/60 shadow-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="bg-primary text-slate-900 text-xs font-black px-2.5 py-1 rounded uppercase tracking-wide">
            Today's Focus
          </span>
          <span className="bg-orange-500/15 text-orange-400 border border-orange-500/30 text-xs font-bold px-2 py-0.5 rounded uppercase">
            {DEMO_RECOMMENDATION.badge}
          </span>
        </div>

        <h3 className="text-xl font-bold text-white mb-2">{DEMO_RECOMMENDATION.title}</h3>
        <p className="text-sm text-slate-300 leading-relaxed mb-4">
          {DEMO_RECOMMENDATION.rationale}
        </p>

        <div className="flex flex-wrap gap-1.5 mb-5">
          {DEMO_RECOMMENDATION.reasons.map((reason) => (
            <span
              key={reason}
              className="bg-slate-700/50 text-slate-400 text-xs px-2 py-0.5 rounded"
            >
              {reason}
            </span>
          ))}
        </div>

        <div className="space-y-2 mb-4">
          {DEMO_RECOMMENDATION.segments.map((seg) => (
            <div
              key={seg.label}
              className="flex items-center justify-between bg-slate-800/60 rounded-lg px-3 py-2"
            >
              <span className="text-sm font-semibold text-slate-200">{seg.label}</span>
              <span className="text-xs text-slate-400">{seg.detail}</span>
            </div>
          ))}
        </div>

        {/* Quiet signal context row */}
        <div className="flex items-center justify-between border-t border-slate-700/50 pt-3 mb-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
              HRV · 7 nights
            </div>
            <div className="text-xs text-slate-400">
              49 ms <span className="text-slate-500">· baseline 51</span>
            </div>
          </div>
          <HrvSparkline />
        </div>

        <Link
          to="/auth"
          className="flex items-center justify-center gap-2 w-full px-5 py-2.5 rounded-lg font-semibold bg-primary hover:bg-primary-hover text-slate-900 transition-colors"
        >
          <span
            className="material-symbols-outlined text-lg"
            style={{ fontVariationSettings: '"FILL" 1' }}
            aria-hidden
          >
            check_circle
          </span>
          Confirm session
        </Link>
      </div>

      {/* Floating recovery ring chip — overlaps the card's empty top-right corner */}
      <div className="absolute -right-3 -top-12 sm:-right-8 bg-dark-surface rounded-2xl border border-slate-700/60 shadow-xl p-3">
        <RecoveryRing score={64} size={88} />
      </div>
    </div>
  );
}

interface StepCardProps {
  step: string;
  icon: string;
  title: string;
  body: string;
}

function StepCard({ step, icon, title, body }: StepCardProps) {
  return (
    <div className="bg-dark-surface rounded-2xl border border-slate-700/50 p-6">
      <div className="flex items-center justify-between mb-4">
        <span
          className="material-symbols-outlined text-2xl text-primary"
          style={{ fontVariationSettings: '"FILL" 1' }}
          aria-hidden
        >
          {icon}
        </span>
        <span className="font-headline text-sm font-bold text-slate-600">{step}</span>
      </div>
      <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
      <p className="text-sm text-slate-400 leading-relaxed">{body}</p>
    </div>
  );
}

/** The real EvidencePanel, expanded, on a product-styled card. */
function EvidenceShowcase() {
  const [expanded, setExpanded] = useState(true);
  // Stable demo timestamps: this morning
  const morning = new Date();
  morning.setHours(7, 4, 0, 0);
  const sync = new Date();
  sync.setHours(6, 51, 0, 0);

  return (
    <div className="bg-dark-surface rounded-2xl border border-slate-700/60 shadow-2xl p-6">
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function Landing() {
  return (
    <div className="dark min-h-screen overflow-x-clip bg-dark-base text-slate-200 font-sans antialiased">
      {/* Nav */}
      <nav className="max-w-6xl mx-auto flex items-center justify-between px-6 py-6">
        <Wordmark />
        <Link
          to="/auth"
          className="text-sm font-semibold text-slate-300 hover:text-white border border-slate-700 hover:border-slate-500 rounded-lg px-4 py-2 transition-colors"
        >
          Sign in
        </Link>
      </nav>

      {/* Hero */}
      <header className="max-w-6xl mx-auto px-6 pt-10 pb-24 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        <div>
          <span className="inline-flex items-center gap-1.5 bg-slate-800/80 border border-slate-700 text-slate-300 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" aria-hidden />
            Deterministic, evidence-based training
          </span>
          <h1 className="font-headline text-4xl sm:text-5xl font-bold tracking-tight text-white leading-[1.1] mb-6">
            The right workout for today.
            <br />
            <span className="text-primary">Backed by evidence.</span>
          </h1>
          <p className="text-lg text-slate-400 leading-relaxed mb-8 max-w-xl">
            Trainelo fuses overnight HRV, sleep and training load with a 60-second
            morning check-in — and turns them into today's session, with the
            reasoning attached.
          </p>
          <div className="flex flex-wrap items-center gap-3 mb-8">
            <a
              href="#how-it-works"
              className="px-6 py-3 rounded-lg font-semibold bg-primary hover:bg-primary-hover text-slate-900 transition-colors"
            >
              See how it works
            </a>
            <Link
              to="/auth"
              className="px-6 py-3 rounded-lg font-semibold text-slate-300 hover:text-white border border-slate-700 hover:border-slate-500 transition-colors"
            >
              Sign in
            </Link>
          </div>
          <p className="text-xs text-slate-500">
            Works with Garmin, Polar, Suunto &amp; Coros — synced server-side via intervals.icu
          </p>
        </div>

        <div className="pt-10 lg:pt-0 flex justify-center lg:justify-end min-w-0">
          <HeroProductCard />
        </div>
      </header>

      {/* The morning loop */}
      <section id="how-it-works" className="max-w-6xl mx-auto px-6 py-20 scroll-mt-8">
        <h2 className="font-headline text-3xl font-bold text-white tracking-tight mb-3">
          One calm decision, every morning
        </h2>
        <p className="text-slate-400 max-w-2xl mb-10">
          No feeds, no streaks, no noise. Trainelo exists to answer a single
          question well: <span className="text-slate-200">what should I do today?</span>
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <StepCard
            step="01"
            icon="bedtime"
            title="While you sleep"
            body="Your watch records HRV, sleep and resting heart rate. It syncs server-side — the data is waiting before you're awake."
          />
          <StepCard
            step="02"
            icon="edit_note"
            title="When you wake"
            body="A 60-second check-in: mood, soreness, yesterday's effort. Your body gets a vote the sensors can't cast."
          />
          <StepCard
            step="03"
            icon="task_alt"
            title="Before you train"
            body="A deterministic engine blends both into one calibrated session — never changing more than the evidence supports."
          />
        </div>
      </section>

      {/* Show the why */}
      <section className="border-y border-slate-800/80 bg-slate-900/40">
        <div className="max-w-6xl mx-auto px-6 py-20 grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
          <div>
            <h2 className="font-headline text-3xl font-bold text-white tracking-tight mb-4">
              Every recommendation
              <br />
              shows its why
            </h2>
            <p className="text-slate-400 leading-relaxed mb-6 max-w-lg">
              No black box. Readiness traces back to each signal — what the
              wearable said, what you said, and how much each was allowed to move
              the plan. Confidence is scored, capped inputs are labeled, and when
              signals disagree, Trainelo says so.
            </p>
            <ul className="space-y-3 text-sm text-slate-300">
              {[
                "Per-signal breakdown: sleep, HRV, recovery, training load",
                "Subjective input is capped — wearable data sets the baseline",
                "Session calibration with explicit intensity & duration changes",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span
                    className="material-symbols-outlined text-lg text-primary mt-[-1px]"
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

      {/* Calm under caution */}
      <section className="max-w-6xl mx-auto px-6 py-20 grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
        <div className="order-2 lg:order-1">
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 flex items-start gap-3 max-w-md">
            <span
              className="material-symbols-outlined text-orange-400 text-xl mt-0.5"
              style={{ fontVariationSettings: '"FILL" 1' }}
              aria-hidden
            >
              warning
            </span>
            <div>
              <span className="text-sm font-bold text-orange-400 uppercase">
                Moderate caution
              </span>
              <div className="flex flex-wrap gap-1.5 mt-2 mb-2">
                <span className="bg-orange-500/10 text-orange-400 text-xs font-semibold px-2 py-0.5 rounded">
                  HRV low
                </span>
                <span className="bg-orange-500/10 text-orange-400 text-xs font-semibold px-2 py-0.5 rounded">
                  Elevated resting HR
                </span>
              </div>
              <span className="bg-slate-700/50 text-slate-300 text-xs px-2 py-0.5 rounded inline-flex items-center gap-1">
                <span
                  className="material-symbols-outlined text-xs"
                  style={{ fontVariationSettings: '"FILL" 1' }}
                  aria-hidden
                >
                  speed
                </span>
                Intensity capped
              </span>
            </div>
          </div>
        </div>
        <div className="order-1 lg:order-2">
          <h2 className="font-headline text-3xl font-bold text-white tracking-tight mb-4">
            Calm under caution
          </h2>
          <p className="text-slate-400 leading-relaxed max-w-lg">
            When HRV drops or load spikes, Trainelo doesn't shout. It caps
            intensity, suggests rest when warranted, and names the exact signal
            that tripped — following one principle:{" "}
            <span className="text-slate-200">
              keep the plan unless strong evidence says otherwise.
            </span>
          </p>
        </div>
      </section>

      {/* Under the hood */}
      <section className="border-t border-slate-800/80">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <h2 className="font-headline text-xl font-bold text-white tracking-tight mb-8">
            Under the hood
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-8">
            {[
              ["Deterministic engine", "same inputs, same answer — fully auditable"],
              ["700+ automated tests", "the scoring core is pure and testable"],
              ["Multi-signal fusion", "objective data capped against subjective input"],
              ["TypeScript, end to end", "React · Supabase · Vercel"],
            ].map(([title, sub]) => (
              <div key={title} className="bg-dark-surface/60 rounded-xl border border-slate-800 p-4">
                <div className="text-sm font-bold text-white mb-1">{title}</div>
                <div className="text-xs text-slate-500 leading-relaxed">{sub}</div>
              </div>
            ))}
          </div>
          <p className="text-sm text-slate-500">
            Designed and built end-to-end by one engineer — from data pipeline to pixels.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800/80">
        <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Wordmark />
          <p className="text-xs text-slate-500">
            Built by Pascal · © {new Date().getFullYear()} Trainelo
          </p>
        </div>
      </footer>
    </div>
  );
}
