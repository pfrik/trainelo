/**
 * Public landing page — shown at "/" for logged-out visitors.
 *
 * Light, editorial canvas (warm white, slate ink, Trainelo green as the
 * accent) with the product shown as dark app windows — the app is
 * dark-first, so product visuals stay true while popping off the page.
 * Product visuals are real components (EvidencePanel, recovery ring,
 * the production calibration engine in EngineDemo) fed with demo data.
 */

import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { EvidencePanel } from "@/components/dashboard/EvidencePanel";
import { RecoveryRing } from "@/components/landing/RecoveryRing";
import { EngineDemo } from "@/components/landing/EngineDemo";
import { useInView } from "@/hooks/useInView";
import { useCountUp } from "@/hooks/useCountUp";
import {
  DEMO_EVIDENCE,
  DEMO_HRV_WEEK,
  DEMO_HRV_BASELINE,
  DEMO_RECOMMENDATION,
} from "@/lib/landing/demoData";

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

/** Fade-up reveal once scrolled into view; instant with reduced motion. */
function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-700 ease-out motion-reduce:transition-none ${
        inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
      } ${className}`}
    >
      {children}
    </div>
  );
}

function Wordmark({ light = false }: { light?: boolean }) {
  return (
    <span
      className={`font-headline text-xl font-bold tracking-tight ${
        light ? "text-white" : "text-slate-900"
      }`}
    >
      Trainelo
    </span>
  );
}

/** Small numbered eyebrow label above section headings. */
function Eyebrow({ n, children }: { n: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-green-700 mb-4">
      <span>{n}</span>
      <span className="w-6 h-px bg-green-700/40" aria-hidden />
      <span>{children}</span>
    </div>
  );
}

/** Hero ring that draws itself and counts up on load. */
function HeroRing() {
  const value = useCountUp(64);
  return <RecoveryRing score={value} size={88} />;
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

/** The hero product visual: dark recommendation card + floating ring chip. */
function HeroProductCard() {
  return (
    <div className="relative w-full max-w-md">
      {/* Soft green glow lifting the dark card off the light canvas */}
      <div
        className="absolute -inset-10 rounded-[3rem] bg-primary/15 blur-3xl"
        aria-hidden
      />

      {/* Recommendation card — the real product, dark */}
      <div className="relative w-full bg-dark-surface rounded-2xl border border-slate-700/60 shadow-2xl p-6 text-left">
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

      {/* Floating recovery ring chip */}
      <div className="absolute -right-3 -top-12 sm:-right-10 bg-dark-surface rounded-2xl border border-slate-700/60 shadow-xl p-3">
        <HeroRing />
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
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 h-full">
      <div className="flex items-center justify-between mb-5">
        <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10">
          <span
            className="material-symbols-outlined text-2xl text-green-700"
            style={{ fontVariationSettings: '"FILL" 1' }}
            aria-hidden
          >
            {icon}
          </span>
        </span>
        <span className="font-headline text-sm font-bold text-slate-300">{step}</span>
      </div>
      <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
      <p className="text-sm text-slate-600 leading-relaxed">{body}</p>
    </div>
  );
}

/** Dark app-window frame for real product components on the light canvas. */
function AppWindow({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="bg-dark-base rounded-2xl border border-slate-700/60 shadow-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800 bg-dark-surface/60">
        <span className="flex gap-1.5" aria-hidden>
          <span className="w-2.5 h-2.5 rounded-full bg-slate-700" />
          <span className="w-2.5 h-2.5 rounded-full bg-slate-700" />
          <span className="w-2.5 h-2.5 rounded-full bg-slate-700" />
        </span>
        <span className="text-xs text-slate-500 font-medium mx-auto pr-8">{title}</span>
      </div>
      <div className="p-5">{children}</div>
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

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function Landing() {
  return (
    <div className="min-h-screen overflow-x-clip bg-[#fafaf9] text-slate-900 font-sans antialiased">
      {/* Soft green wash at the top of the canvas */}
      <div
        className="absolute inset-x-0 top-0 h-[720px] pointer-events-none bg-[radial-gradient(70%_60%_at_50%_0%,rgba(34,197,94,0.10),rgba(34,197,94,0.03)_55%,transparent_80%)]"
        aria-hidden
      />

      {/* Floating pill nav */}
      <nav className="sticky top-4 z-40 max-w-5xl mx-auto px-4">
        <div className="flex items-center justify-between bg-white/80 backdrop-blur border border-slate-200 rounded-full pl-6 pr-2 py-2 shadow-sm">
          <Wordmark />
          <Link
            to="/auth"
            className="text-sm font-semibold bg-primary hover:bg-primary-hover text-slate-900 rounded-full px-5 py-2 transition-colors"
          >
            Sign in
          </Link>
        </div>
      </nav>

      {/* Hero — centered, editorial */}
      <header className="relative max-w-5xl mx-auto px-6 pt-16 sm:pt-20 pb-16 text-center">
        <span className="inline-flex items-center gap-1.5 bg-white border border-slate-200 text-slate-600 text-xs font-semibold px-3 py-1.5 rounded-full mb-8 shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-primary" aria-hidden />
          Deterministic, evidence-based training
        </span>
        <h1 className="font-headline text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] mb-6 max-w-4xl mx-auto">
          The right workout for today.
          <br />
          <span className="text-green-600">Backed by evidence.</span>
        </h1>
        <p className="text-lg sm:text-xl text-slate-600 leading-relaxed mb-9 max-w-2xl mx-auto">
          Trainelo fuses overnight HRV, sleep and training load with a 60-second
          morning check-in — and turns them into today's session, with the
          reasoning attached.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
          <a
            href="#try-it"
            className="px-7 py-3.5 rounded-full font-semibold bg-primary hover:bg-primary-hover text-slate-900 transition-colors shadow-sm"
          >
            Try the engine
          </a>
          <Link
            to="/auth"
            className="px-7 py-3.5 rounded-full font-semibold text-slate-700 bg-white border border-slate-200 hover:border-slate-400 transition-colors"
          >
            Sign in
          </Link>
        </div>
        <p className="text-xs text-slate-500 mb-16">
          Works with Garmin, Polar, Suunto &amp; Coros — synced server-side via intervals.icu
        </p>

        {/* Product visual, centered */}
        <div className="flex justify-center">
          <HeroProductCard />
        </div>
      </header>

      {/* Stat band */}
      <section className="border-y border-slate-200 bg-white">
        <div className="max-w-5xl mx-auto px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            ["60 sec", "morning check-in"],
            ["4 signals", "fused every morning"],
            ["1 answer", "today's session"],
            ["700+", "automated tests"],
          ].map(([n, label]) => (
            <div key={label} className="text-center md:text-left">
              <div className="font-headline text-3xl font-bold text-slate-900">{n}</div>
              <div className="text-sm text-slate-500 mt-1">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 01 — The morning loop */}
      <section id="how-it-works" className="max-w-5xl mx-auto px-6 py-24 scroll-mt-8">
        <Reveal>
          <Eyebrow n="01">The morning loop</Eyebrow>
          <h2 className="font-headline text-3xl sm:text-4xl font-bold tracking-tight mb-3">
            One calm decision, every morning
          </h2>
          <p className="text-slate-600 max-w-2xl mb-10">
            No feeds, no streaks, no noise. Trainelo exists to answer a single
            question well: <span className="text-slate-900 font-semibold">what should I do today?</span>
          </p>
        </Reveal>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Reveal delay={0}>
            <StepCard
              step="01"
              icon="bedtime"
              title="While you sleep"
              body="Your watch records HRV, sleep and resting heart rate. It syncs server-side — the data is waiting before you're awake."
            />
          </Reveal>
          <Reveal delay={120}>
            <StepCard
              step="02"
              icon="edit_note"
              title="When you wake"
              body="A 60-second check-in: mood, soreness, yesterday's effort. Your body gets a vote the sensors can't cast."
            />
          </Reveal>
          <Reveal delay={240}>
            <StepCard
              step="03"
              icon="task_alt"
              title="Before you train"
              body="A deterministic engine blends both into one calibrated session — never changing more than the evidence supports."
            />
          </Reveal>
        </div>
      </section>

      {/* 02 — Interactive engine demo */}
      <section id="try-it" className="border-y border-slate-200 bg-white scroll-mt-8">
        <div className="max-w-5xl mx-auto px-6 py-24">
          <Reveal>
            <Eyebrow n="02">Try it yourself</Eyebrow>
            <h2 className="font-headline text-3xl sm:text-4xl font-bold tracking-tight mb-3">
              Tell it how you feel.{" "}
              <span className="text-green-600">Watch it think.</span>
            </h2>
            <p className="text-slate-600 max-w-2xl mb-10">
              No account, no mock-up — this demo runs Trainelo's production
              calibration engine in your browser. Move the check-in and watch
              today's session recalibrate.
            </p>
          </Reveal>
          <Reveal delay={120}>
            <EngineDemo />
          </Reveal>
        </div>
      </section>

      {/* 03 — Show the why */}
      <section className="max-w-5xl mx-auto px-6 py-24 grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
        <Reveal>
          <Eyebrow n="03">Transparency</Eyebrow>
          <h2 className="font-headline text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Every recommendation shows its why
          </h2>
          <p className="text-slate-600 leading-relaxed mb-6 max-w-lg">
            No black box. Readiness traces back to each signal — what the
            wearable said, what you said, and how much each was allowed to move
            the plan. Confidence is scored, capped inputs are labeled, and when
            signals disagree, Trainelo says so.
          </p>
          <ul className="space-y-3 text-sm text-slate-700">
            {[
              "Per-signal breakdown: sleep, HRV, recovery, training load",
              "Subjective input is capped — wearable data sets the baseline",
              "Session calibration with explicit intensity & duration changes",
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
        </Reveal>
        <Reveal delay={120}>
          <EvidenceShowcase />
        </Reveal>
      </section>

      {/* 04 — Calm under caution */}
      <section className="border-y border-slate-200 bg-white">
        <div className="max-w-5xl mx-auto px-6 py-24 grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
          <Reveal delay={120} className="order-2 lg:order-1">
            <AppWindow title="Trainelo — Safety check">
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 flex items-start gap-3">
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
            </AppWindow>
          </Reveal>
          <Reveal className="order-1 lg:order-2">
            <Eyebrow n="04">Safety</Eyebrow>
            <h2 className="font-headline text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Calm under caution
            </h2>
            <p className="text-slate-600 leading-relaxed max-w-lg">
              When HRV drops or load spikes, Trainelo doesn't shout. It caps
              intensity, suggests rest when warranted, and names the exact signal
              that tripped — following one principle:{" "}
              <span className="text-slate-900 font-semibold">
                keep the plan unless strong evidence says otherwise.
              </span>
            </p>
          </Reveal>
        </div>
      </section>

      {/* Under the hood */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <Reveal>
          <h2 className="font-headline text-xl font-bold tracking-tight mb-8">
            Under the hood
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {[
              ["Deterministic engine", "same inputs, same answer — fully auditable"],
              ["700+ automated tests", "the scoring core is pure and testable"],
              ["Multi-signal fusion", "objective data capped against subjective input"],
              ["TypeScript, end to end", "React · Supabase · Vercel"],
            ].map(([title, sub]) => (
              <div key={title} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <div className="text-sm font-bold text-slate-900 mb-1">{title}</div>
                <div className="text-xs text-slate-500 leading-relaxed">{sub}</div>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* Closing CTA band */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <Reveal>
          <div className="relative overflow-hidden bg-dark-base rounded-3xl px-8 py-14 text-center shadow-2xl">
            <div
              className="absolute inset-x-0 -top-24 h-48 bg-primary/20 blur-3xl pointer-events-none"
              aria-hidden
            />
            <h2 className="relative font-headline text-3xl sm:text-4xl font-bold tracking-tight text-white mb-4">
              Tomorrow morning, know exactly what to do.
            </h2>
            <p className="relative text-slate-400 mb-8 max-w-xl mx-auto">
              Connect your watch once. Check in for 60 seconds. Train with the
              evidence on your side.
            </p>
            <Link
              to="/auth"
              className="relative inline-block px-8 py-3.5 rounded-full font-semibold bg-primary hover:bg-primary-hover text-slate-900 transition-colors"
            >
              Get started
            </Link>
          </div>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-5xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Wordmark />
          <p className="text-xs text-slate-500">
            Built by Pascal · © {new Date().getFullYear()} Trainelo
          </p>
        </div>
      </footer>
    </div>
  );
}
