/**
 * Public landing page — shown at "/" for logged-out visitors.
 *
 * Light, editorial canvas (warm white, slate ink, Trainelo green as the
 * accent) with the product shown as phone-framed dark screens — the app is
 * dark-first, so product visuals stay true while popping off the page.
 * Copy is deliberately plain-language; the technical story lives on
 * /engineering. The engine demo runs the real calibration function.
 */

import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { EngineDemo } from "@/components/landing/EngineDemo";
import { AppWindow } from "@/components/landing/AppWindow";
import {
  PhoneFrame,
  TodayPhoneScreen,
  CheckinPhoneScreen,
  EvidencePhoneScreen,
  TrendsPhoneScreen,
} from "@/components/landing/PhoneScreens";
import { useInView } from "@/hooks/useInView";
import { DEMO_HRV_WEEK, DEMO_HRV_BASELINE } from "@/lib/landing/demoData";

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

/** Single-series sparkline: 7 nights of HRV with a dashed baseline. */
function HrvSparkline() {
  const w = 108;
  const h = 34;
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

/** Hero visual: phone with the Today screen + floating live chips. */
function HeroPhone() {
  return (
    <div className="relative inline-block">
      {/* Soft green glow lifting the dark phone off the light canvas */}
      <div
        className="absolute -inset-10 rounded-[4rem] bg-primary/15 blur-3xl"
        aria-hidden
      />
      <PhoneFrame className="relative">
        <TodayPhoneScreen />
      </PhoneFrame>

      {/* Floating sync chip */}
      <div className="absolute -right-8 top-14 sm:-right-20 bg-dark-surface rounded-xl border border-slate-700/60 shadow-xl px-3 py-2 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-primary" aria-hidden />
        <span className="text-[11px] font-semibold text-slate-300 whitespace-nowrap">
          Synced while you slept
        </span>
      </div>

      {/* Floating HRV chip */}
      <div className="absolute -left-6 bottom-16 sm:-left-20 bg-dark-surface rounded-xl border border-slate-700/60 shadow-xl px-3 py-2.5">
        <div className="text-[9px] font-bold uppercase tracking-wide text-slate-500 mb-1">
          HRV · 7 nights
        </div>
        <HrvSparkline />
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

/** Phone screen + caption for the app showcase. */
function ScreenCard({
  title,
  body,
  delay,
  children,
}: {
  title: string;
  body: string;
  delay: number;
  children: ReactNode;
}) {
  return (
    <Reveal delay={delay} className="flex flex-col items-center">
      <PhoneFrame className="mb-6">
        {/* Equal screen heights so the three captions align */}
        <div className="min-h-[372px]">{children}</div>
      </PhoneFrame>
      <h3 className="text-lg font-bold text-slate-900 mb-1.5 text-center">{title}</h3>
      <p className="text-sm text-slate-600 leading-relaxed text-center max-w-[260px]">
        {body}
      </p>
    </Reveal>
  );
}

/** Roadmap card with a status pill. */
function RoadmapCard({
  title,
  body,
  status,
}: {
  title: string;
  body: string;
  status: "In development" | "Planned";
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <div className="flex items-center justify-between gap-3 mb-2">
        <h3 className="text-lg font-bold text-slate-900">{title}</h3>
        <span
          className={`shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full border ${
            status === "In development"
              ? "bg-primary/10 border-green-600/40 text-green-700"
              : "bg-slate-50 border-slate-200 text-slate-500"
          }`}
        >
          {status}
        </span>
      </div>
      <p className="text-sm text-slate-600 leading-relaxed">{body}</p>
    </div>
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
      <nav className="sticky top-4 z-40 max-w-6xl mx-auto px-4">
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

      {/* Hero — split: words left, product right */}
      <header className="relative max-w-6xl mx-auto px-6 pt-12 sm:pt-16 pb-20 grid grid-cols-1 lg:grid-cols-2 gap-14 lg:gap-8 items-center">
        <div className="text-center lg:text-left">
          <span className="inline-flex items-center gap-1.5 bg-white border border-slate-200 text-slate-600 text-xs font-semibold px-3 py-1.5 rounded-full mb-7 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" aria-hidden />
            Your morning training coach
          </span>
          <h1 className="font-headline text-5xl sm:text-6xl font-bold tracking-tight leading-[1.05] mb-6">
            The right workout for today.{" "}
            <span className="text-green-600 block">Backed by evidence.</span>
          </h1>
          <p className="text-lg sm:text-xl text-slate-600 leading-relaxed mb-8 max-w-xl mx-auto lg:mx-0">
            Trainelo reads your night — sleep, recovery, training load — asks
            how you feel, and hands you one clear session. Push when you're
            ready. Back off when you're not.
          </p>
          <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 mb-7">
            <a
              href="#try-it"
              className="px-7 py-3.5 rounded-full font-semibold bg-primary hover:bg-primary-hover text-slate-900 transition-colors shadow-sm"
            >
              Try the live demo
            </a>
            <Link
              to="/auth"
              className="px-7 py-3.5 rounded-full font-semibold text-slate-700 bg-white border border-slate-200 hover:border-slate-400 transition-colors"
            >
              Sign in
            </Link>
          </div>
          <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2">
            <span className="text-xs text-slate-500 mr-1">Works with</span>
            {["Garmin", "Polar", "Suunto", "COROS"].map((brand) => (
              <span
                key={brand}
                className="inline-flex items-center gap-1.5 bg-white border border-slate-200 text-slate-600 text-xs font-semibold px-2.5 py-1 rounded-full"
              >
                <span
                  className="material-symbols-outlined text-sm text-green-700"
                  aria-hidden
                >
                  watch
                </span>
                {brand}
              </span>
            ))}
          </div>
        </div>

        <div className="flex justify-center lg:justify-end lg:pr-14">
          <HeroPhone />
        </div>
      </header>

      {/* Stat band — real numbers from real use */}
      <section className="border-y border-slate-200 bg-white">
        <div className="max-w-5xl mx-auto px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            ["1,150+", "activities synced"],
            ["2+ years", "of training history"],
            ["60 sec", "morning check-in"],
            ["1", "clear answer, every day"],
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
          <Eyebrow n="01">How it works</Eyebrow>
          <h2 className="font-headline text-3xl sm:text-4xl font-bold tracking-tight mb-3">
            One clear answer, every morning
          </h2>
          <p className="text-slate-600 max-w-2xl mb-10">
            No feeds, no streaks, no noise. Trainelo answers a single question
            well:{" "}
            <span className="text-slate-900 font-semibold">
              what should I do today?
            </span>
          </p>
        </Reveal>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Reveal delay={0}>
            <StepCard
              step="01"
              icon="bedtime"
              title="While you sleep"
              body="Your watch tracks sleep, heart rate and recovery — and syncs on its own. Nothing to upload, nothing to remember."
            />
          </Reveal>
          <Reveal delay={120}>
            <StepCard
              step="02"
              icon="edit_note"
              title="When you wake"
              body="Three quick questions: how you feel, how sore you are, how hard yesterday was. Your body gets a vote."
            />
          </Reveal>
          <Reveal delay={240}>
            <StepCard
              step="03"
              icon="task_alt"
              title="Before you train"
              body="Trainelo blends both into today's session — what to do, how hard, and for how long. Confirm and go."
            />
          </Reveal>
        </div>
      </section>

      {/* 02 — App screens showcase */}
      <section className="border-y border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <Reveal>
            <Eyebrow n="02">The app</Eyebrow>
            <h2 className="font-headline text-3xl sm:text-4xl font-bold tracking-tight mb-3">
              Your morning, in three screens
            </h2>
            <p className="text-slate-600 max-w-2xl mb-14">
              Everything happens before your first coffee — and nothing is
              hidden behind a score you have to take on faith.
            </p>
          </Reveal>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-6">
            <ScreenCard
              title="Check in"
              body="Five taps from bed. Mood, soreness, illness — done in about a minute."
              delay={0}
            >
              <CheckinPhoneScreen />
            </ScreenCard>
            <ScreenCard
              title="Get today's session"
              body="One workout, sized to the morning you actually had. Confirm and go train."
              delay={120}
            >
              <TodayPhoneScreen />
            </ScreenCard>
            <ScreenCard
              title="See the why"
              body="Every recommendation traces back to your own numbers. No black box."
              delay={240}
            >
              <EvidencePhoneScreen />
            </ScreenCard>
          </div>
        </div>
      </section>

      {/* 03 — Interactive engine demo */}
      <section id="try-it" className="max-w-5xl mx-auto px-6 py-24 scroll-mt-8">
        <Reveal>
          <Eyebrow n="03">Try it yourself</Eyebrow>
          <h2 className="font-headline text-3xl sm:text-4xl font-bold tracking-tight mb-3">
            Tell it how you feel.{" "}
            <span className="text-green-600">Watch it think.</span>
          </h2>
          <p className="text-slate-600 max-w-2xl mb-10">
            No account needed — this is the real Trainelo engine, running in
            your browser. Change how the morning feels and watch today's
            workout adapt.
          </p>
        </Reveal>
        <Reveal delay={120}>
          <EngineDemo />
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
            <Eyebrow n="04">Safety first</Eyebrow>
            <h2 className="font-headline text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Calm under caution
            </h2>
            <p className="text-slate-600 leading-relaxed max-w-lg">
              When your body waves a flag — a rough night, too many hard days
              in a row — Trainelo doesn't shout at you. It eases today's
              session and tells you exactly why.{" "}
              <span className="text-slate-900 font-semibold">
                The plan holds unless real evidence says otherwise.
              </span>
            </p>
          </Reveal>
        </div>
      </section>

      {/* 05 — What's next */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <Reveal>
          <Eyebrow n="05">What's next</Eyebrow>
          <h2 className="font-headline text-3xl sm:text-4xl font-bold tracking-tight mb-3">
            Where Trainelo is heading
          </h2>
          <p className="text-slate-600 max-w-2xl mb-14">
            Trainelo is used — and built — every day. This is what's on the
            bench right now.
          </p>
        </Reveal>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
          <Reveal delay={120} className="flex flex-col items-center">
            <div className="relative">
              <PhoneFrame>
                <TrendsPhoneScreen />
              </PhoneFrame>
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary/10 border border-green-600/40 text-green-700 text-[11px] font-bold px-3 py-1 rounded-full whitespace-nowrap backdrop-blur">
                In development
              </span>
            </div>
            <p className="text-sm text-slate-600 text-center max-w-[280px] mt-6">
              <span className="font-bold text-slate-900">Fitness you can see.</span>{" "}
              Fitness, fatigue and form charted over months — watch a training
              block actually work.
            </p>
          </Reveal>
          <Reveal className="space-y-5">
            <RoadmapCard
              title="Plans that aim at a goal"
              body="Pick a race or a target. Trainelo lays out the weeks that get you there — and adjusts them as you go."
              status="In development"
            />
            <RoadmapCard
              title="Daily load targets"
              body="Not just how ready you are — how much today's training should hold, in one number."
              status="Planned"
            />
            <RoadmapCard
              title="A plan that adapts to life"
              body="Missed a week? Snuck in an unplanned ride? The plan reroutes itself instead of guilt-tripping you."
              status="Planned"
            />
          </Reveal>
        </div>
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
              Connect your watch once. Check in for a minute. Train with the
              evidence on your side.
            </p>
            <Link
              to="/auth"
              className="relative inline-block px-8 py-3.5 rounded-full font-semibold bg-primary hover:bg-primary-hover text-slate-900 transition-colors"
            >
              Get started
            </Link>
            <p className="relative text-sm text-slate-500 mt-6">
              Curious how it works under the hood?{" "}
              <Link
                to="/engineering"
                className="text-slate-300 underline underline-offset-4 hover:text-white transition-colors"
              >
                Read the engineering story
              </Link>
            </p>
          </div>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Wordmark />
          <div className="flex items-center gap-6 text-xs text-slate-500">
            <Link to="/engineering" className="hover:text-slate-900 transition-colors">
              Engineering
            </Link>
            <Link to="/auth" className="hover:text-slate-900 transition-colors">
              Sign in
            </Link>
            <span>Built by Pascal · © {new Date().getFullYear()} Trainelo</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
