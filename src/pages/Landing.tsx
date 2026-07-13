/**
 * Public landing page — shown at "/" for logged-out visitors.
 *
 * Light, editorial canvas (warm white, slate ink, Trainelo green as the
 * accent) with the product shown as phone-framed dark screens — the app is
 * dark-first, so product visuals stay true while popping off the page.
 * Copy is deliberately plain-language; the technical story lives on
 * /engineering. The engine demo runs the real calibration function.
 */

import { Fragment, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  Gauge,
  LineChart,
  TriangleAlert,
  Watch,
} from "lucide-react";
import { EngineDemo } from "@/components/landing/EngineDemo";
import { AppWindow } from "@/components/landing/AppWindow";
import { ConfluenceBand } from "@/components/landing/ConfluenceBand";
import {
  DeviceFrame,
  TodayPhoneScreen,
  CheckinPhoneScreen,
  EvidencePhoneScreen,
  TrendsPhoneScreen,
} from "@/components/landing/PhoneScreens";
import { useInView } from "@/hooks/useInView";
import { DEMO_HRV_WEEK, DEMO_HRV_BASELINE } from "@/lib/landing/demoData";
import { WAITLIST_URL } from "@/lib/landing/invite";

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

/** Single-series sparkline: 7 nights of HRV with a dashed baseline. */
function HrvSparkline({ w = 108, h = 34 }: { w?: number; h?: number }) {
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

/** Hero visual: tilted device with the Today screen + floating live chips. */
function HeroPhone() {
  return (
    <div className="relative inline-block">
      {/* Soft green glow lifting the dark phone off the light canvas */}
      <div
        className="absolute -inset-10 rounded-[4rem] bg-primary/15 blur-3xl"
        aria-hidden
      />
      <DeviceFrame className="relative" tilt>
        <TodayPhoneScreen />
      </DeviceFrame>

      {/* Floating sync chip */}
      <div className="absolute -right-8 top-24 sm:-right-20 bg-dark-surface rounded-xl border border-slate-700/60 shadow-xl px-3 py-2 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-primary" aria-hidden />
        <span className="text-[11px] font-semibold text-slate-300 whitespace-nowrap">
          Synced while you slept
        </span>
      </div>

      {/* Floating HRV chip */}
      <div className="absolute -left-6 bottom-28 sm:-left-20 bg-dark-surface rounded-xl border border-slate-700/60 shadow-xl px-3 py-2.5">
        <div className="text-[9px] font-bold uppercase tracking-wide text-slate-500 mb-1">
          HRV · 7 nights
        </div>
        <HrvSparkline />
      </div>
    </div>
  );
}

/** One overnight signal: dark UI visual on top, benefit copy below. */
function SignalBlock({
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
    <Reveal
      delay={delay}
      className="h-full md:grid md:grid-rows-subgrid md:row-span-3"
    >
      <div className="bg-dark-base rounded-2xl border border-slate-700/60 shadow-xl p-5 mb-5 flex flex-col">
        {children}
      </div>
      <h3 className="text-lg font-bold text-slate-900 mb-1.5">{title}</h3>
      <p className="text-sm text-slate-600 leading-relaxed">{body}</p>
    </Reveal>
  );
}

/** Sleep visual: score + stages bar, app-styled. */
function SleepVisual() {
  const stages = [
    { label: "Deep", pct: 22, cls: "bg-primary" },
    { label: "REM", pct: 21, cls: "bg-primary/50" },
    { label: "Light", pct: 47, cls: "bg-slate-600" },
    { label: "Awake", pct: 10, cls: "bg-slate-800" },
  ];
  return (
    <div className="h-full flex flex-col justify-between">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
          Sleep
        </span>
        <span className="text-[11px] text-slate-400">7 h 32 m</span>
      </div>
      <div className="text-3xl font-black text-white tabular-nums mb-4">
        81<span className="text-base font-bold text-slate-500">/100</span>
      </div>
      <div className="flex h-2.5 rounded-full overflow-hidden gap-[2px] mb-2">
        {stages.map((s) => (
          <span key={s.label} className={`${s.cls} h-full`} style={{ width: `${s.pct}%` }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {stages.map((s) => (
          <span key={s.label} className="flex items-center gap-1 text-[10px] text-slate-400">
            <span className={`w-1.5 h-1.5 rounded-full ${s.cls}`} aria-hidden />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** HRV visual: overnight rMSSD vs 28-day baseline. */
function HrvVisual() {
  return (
    <div className="h-full flex flex-col justify-between">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
          HRV · overnight
        </span>
        <span className="text-[11px] text-slate-400">7 nights</span>
      </div>
      <div className="text-3xl font-black text-white tabular-nums mb-4">
        49<span className="text-base font-bold text-slate-500"> ms</span>
      </div>
      <HrvSparkline w={196} h={48} />
      <div className="text-[10px] text-slate-400 mt-2">
        2 ms under your 28-day baseline. Worth a gentler day.
      </div>
    </div>
  );
}

/** Training-load visual: fitness vs fatigue bars. */
function LoadVisual() {
  return (
    <div className="h-full flex flex-col justify-between">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
          Training load
        </span>
        <span className="text-[11px] text-slate-400">42-day model</span>
      </div>
      <div className="space-y-3 mb-4">
        {[
          { label: "Fitness", value: 58, cls: "bg-primary" },
          { label: "Fatigue", value: 42, cls: "bg-orange-400" },
        ].map((row) => (
          <div key={row.label}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-semibold text-slate-300">{row.label}</span>
              <span className="text-[11px] font-bold text-slate-200 tabular-nums">
                {row.value}
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-700/70">
              <div
                className={`h-full rounded-full ${row.cls}`}
                style={{ width: `${row.value}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="text-[10px] text-slate-400">
        Fresh enough to absorb quality work. 2 days since rest.
      </div>
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
      <DeviceFrame className="mb-7">{children}</DeviceFrame>
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
              ? "bg-primary/10 border-primary-ink/40 text-primary-ink"
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
          <div className="flex items-center gap-1">
            <Link
              to="/auth"
              className="text-sm font-semibold text-slate-600 hover:text-slate-900 px-3 py-2 transition-colors"
            >
              Sign in
            </Link>
            <a
              href={WAITLIST_URL}
              className="text-sm font-semibold bg-primary hover:bg-primary-hover text-slate-900 rounded-full px-5 py-2 transition-colors"
            >
              Join the waitlist
            </a>
          </div>
        </div>
      </nav>

      {/* Hero — split: words left, product right */}
      <header className="relative max-w-6xl mx-auto px-6 pt-12 sm:pt-16 pb-20 grid grid-cols-1 lg:grid-cols-2 gap-14 lg:gap-8 items-center">
        <div className="text-center lg:text-left">
          <h1 className="font-headline text-5xl sm:text-6xl font-bold tracking-tight leading-[1.05] mb-6">
            The right workout for today.{" "}
            <span className="text-primary-ink block">Just show up.</span>
          </h1>
          <p className="text-lg sm:text-xl text-slate-600 leading-relaxed mb-8 max-w-xl mx-auto lg:mx-0">
            For runners, cyclists, and triathletes. It weighs your recovery,
            your training load, and how you actually feel, so every session
            fits your body today. And it always shows you why.
          </p>
          <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 mb-4">
            <a
              href="#try-it"
              className="px-7 py-3.5 rounded-full font-semibold bg-primary hover:bg-primary-hover text-slate-900 transition-colors shadow-sm"
            >
              Try the live demo
            </a>
            <a
              href={WAITLIST_URL}
              className="px-7 py-3.5 rounded-full font-semibold text-slate-700 bg-white border border-slate-200 hover:border-slate-400 transition-colors"
            >
              Join the waitlist
            </a>
          </div>
          <p className="text-xs text-slate-500 mb-7">
            Join the waitlist and we'll email you when a spot opens. Already
            in?{" "}
            <Link
              to="/auth"
              className="underline underline-offset-4 hover:text-slate-900 transition-colors"
            >
              Sign in
            </Link>
          </p>
          <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2">
            <span className="text-xs text-slate-500 mr-1">Works with</span>
            {[
              { name: "Garmin", Icon: Watch },
              { name: "Polar", Icon: Watch },
              { name: "Strava", Icon: Activity },
              { name: "intervals.icu", Icon: LineChart },
            ].map(({ name, Icon }) => (
              <span
                key={name}
                className="inline-flex items-center gap-1.5 bg-white border border-slate-200 text-slate-600 text-xs font-semibold px-2.5 py-1 rounded-full"
              >
                <Icon className="w-3.5 h-3.5 text-primary-ink" aria-hidden />
                {name}
              </span>
            ))}
          </div>
        </div>

        <div className="flex justify-center lg:justify-end lg:pr-14">
          <HeroPhone />
        </div>
      </header>

      {/* Confluence band — watch data + check-in flow into one decision */}
      <ConfluenceBand />

      {/* Overnight signals */}
      <section id="how-it-works" className="max-w-6xl mx-auto px-6 py-14 sm:py-24 scroll-mt-8">
        <Reveal>
          <h2 className="font-headline text-3xl sm:text-4xl font-bold tracking-tight mb-3">
            Start the day knowing
          </h2>
          <p className="text-slate-600 max-w-2xl mb-12">
            Trainelo scores the three signals that decide what today should
            look like, then asks you the one thing sensors can't measure:{" "}
            <span className="text-slate-900 font-semibold">how you feel.</span>
          </p>
        </Reveal>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-x-6 md:gap-y-0 md:grid-rows-[auto_auto_auto] mb-14">
          <SignalBlock
            title="Where your recovery happens"
            body="Sleep duration and quality, weighed against your own norm rather than a population average."
            delay={0}
          >
            <SleepVisual />
          </SignalBlock>
          <SignalBlock
            title="Your nervous system gets a vote"
            body="Overnight HRV against your 28-day baseline. It's the earliest signal that today should be easier."
            delay={120}
          >
            <HrvVisual />
          </SignalBlock>
          <SignalBlock
            title="The training you've already banked"
            body="Fitness builds slowly, fatigue fades fast. Trainelo tracks both, so hard days land when you can absorb them."
            delay={240}
          >
            <LoadVisual />
          </SignalBlock>
        </div>
        <Reveal>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 text-sm font-semibold text-slate-700">
            {["Synced while you sleep", "60-second check-in", "One calibrated session"].map(
              (label, i) => (
                <Fragment key={label}>
                  {i > 0 && (
                    <ArrowRight
                      className="w-5 h-5 shrink-0 text-slate-300 rotate-90 sm:rotate-0"
                      aria-hidden
                    />
                  )}
                  <span className="bg-white border border-slate-200 rounded-full px-4 py-2 shadow-sm">
                    {label}
                  </span>
                </Fragment>
              ),
            )}
          </div>
        </Reveal>
      </section>

      {/* App screens showcase */}
      <section className="border-y border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-14 sm:py-24">
          <Reveal>
            <h2 className="font-headline text-3xl sm:text-4xl font-bold tracking-tight mb-3">
              Your morning, in three screens
            </h2>
            <p className="text-slate-600 max-w-2xl mb-14">
              Everything happens before your first coffee, and nothing is
              hidden behind a score you have to take on faith.
            </p>
          </Reveal>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-6">
            <ScreenCard
              title="Check in"
              body="Five taps from bed. Mood, soreness, illness. Done in about a minute."
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

      {/* Interactive engine demo */}
      <section id="try-it" className="max-w-5xl mx-auto px-6 py-14 sm:py-24 scroll-mt-8">
        <Reveal>
          <h2 className="font-headline text-3xl sm:text-4xl font-bold tracking-tight mb-3">
            Tell it how you feel.{" "}
            <span className="text-primary-ink">Watch it think.</span>
          </h2>
          <p className="text-slate-600 max-w-2xl mb-10">
            No account needed. This is the real Trainelo engine, running in
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
        <div className="max-w-5xl mx-auto px-6 py-14 sm:py-24 grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
          <Reveal delay={120} className="order-2 lg:order-1">
            <AppWindow title="Trainelo · Safety check">
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 flex items-start gap-3">
                <TriangleAlert
                  className="w-5 h-5 text-orange-400 mt-0.5 shrink-0"
                  aria-hidden
                />
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
                    <Gauge className="w-3 h-3" aria-hidden />
                    Intensity capped
                  </span>
                </div>
              </div>
            </AppWindow>
          </Reveal>
          <Reveal className="order-1 lg:order-2">
            <h2 className="font-headline text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Calm under caution
            </h2>
            <p className="text-slate-600 leading-relaxed max-w-lg">
              When your body waves a flag after a rough night or too many hard
              days in a row, Trainelo doesn't shout at you. It eases today's
              session and tells you exactly why.{" "}
              <span className="text-slate-900 font-semibold">
                The plan holds unless real evidence says otherwise.
              </span>
            </p>
          </Reveal>
        </div>
      </section>

      {/* What's next */}
      <section className="max-w-6xl mx-auto px-6 py-14 sm:py-24">
        <Reveal>
          <h2 className="font-headline text-3xl sm:text-4xl font-bold tracking-tight mb-3">
            Where Trainelo is heading
          </h2>
          <p className="text-slate-600 max-w-2xl mb-14">
            Trainelo is built and used every day. This is what's on the bench
            right now.
          </p>
        </Reveal>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center lg:pb-20">
          <Reveal delay={120} className="relative flex flex-col items-center">
            <div className="relative">
              <DeviceFrame>
                <TrendsPhoneScreen />
              </DeviceFrame>
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 z-10 bg-white border border-primary-ink/40 text-primary-ink text-[11px] font-bold px-3 py-1 rounded-full whitespace-nowrap shadow-sm">
                Just shipped
              </span>
            </div>
            <p className="text-sm text-slate-600 text-center max-w-[280px] mt-6 lg:absolute lg:top-full lg:left-0 lg:right-0 lg:mx-auto lg:mt-0 lg:pt-6">
              <span className="font-bold text-slate-900">Fitness you can see.</span>{" "}
              Fitness, fatigue and form charted over months, live in the app
              with 15 months of history.
            </p>
          </Reveal>
          <Reveal className="space-y-5">
            <RoadmapCard
              title="Plans that aim at a goal"
              body="Pick a race or a target. Trainelo lays out the weeks that get you there and adjusts them as you go."
              status="In development"
            />
            <RoadmapCard
              title="Daily load targets"
              body="Not just how ready you are: how much today's training should hold, in one number."
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
      <section className="max-w-5xl mx-auto px-6 pb-14 sm:pb-24">
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
              evidence on your side. Trainelo is in private beta, and the
              waitlist is open.
            </p>
            <a
              href={WAITLIST_URL}
              className="relative inline-block px-8 py-3.5 rounded-full font-semibold bg-primary hover:bg-primary-hover text-slate-900 transition-colors"
            >
              Join the waitlist
            </a>
            <p className="relative text-sm text-slate-500 mt-6">
              Already have access?{" "}
              <Link
                to="/auth"
                className="text-slate-300 underline underline-offset-4 hover:text-white transition-colors"
              >
                Sign in
              </Link>
              {" "}· Curious how it works under the hood?{" "}
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
