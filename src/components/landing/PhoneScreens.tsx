/**
 * Phone-framed product screens for the landing page.
 *
 * DeviceFrame is a realistic phone mockup (fixed 9:19.5 screen, dynamic
 * island, status bar, side buttons, home indicator) and each screen is a
 * full-height presentational React render of a Trainelo screen in the
 * app's dark theme — bevel.health-style product imagery without static
 * screenshots. The trends screen previews the in-development fitness chart.
 */

import { type ReactNode } from "react";
import { RecoveryRing } from "@/components/landing/RecoveryRing";
import { DEMO_RECOMMENDATION } from "@/lib/landing/demoData";

// ---------------------------------------------------------------------------
// Device frame
// ---------------------------------------------------------------------------

/** Realistic phone mockup; children fill the screen below the status bar. */
export function DeviceFrame({
  children,
  className = "",
  tilt = false,
}: {
  children: ReactNode;
  className?: string;
  /** Subtle 3D tilt for hero placement. */
  tilt?: boolean;
}) {
  return (
    <div
      className={`relative w-[280px] ${className}`}
      style={
        tilt
          ? { transform: "perspective(1400px) rotateY(-7deg) rotateX(1.5deg)" }
          : undefined
      }
    >
      {/* Body */}
      <div className="relative rounded-[3rem] bg-slate-950 p-[10px] shadow-[0_60px_120px_-24px_rgba(2,6,23,0.55),0_24px_48px_-20px_rgba(2,6,23,0.4)]">
        {/* Metallic edge highlight */}
        <div
          className="absolute inset-0 rounded-[3rem] ring-1 ring-inset ring-white/20 pointer-events-none"
          aria-hidden
        />
        <div
          className="absolute inset-[3px] rounded-[2.85rem] ring-1 ring-inset ring-black/60 pointer-events-none"
          aria-hidden
        />
        {/* Side buttons */}
        <div className="absolute -left-[2.5px] top-[104px] h-7 w-[3px] rounded-l-md bg-slate-800" aria-hidden />
        <div className="absolute -left-[2.5px] top-[142px] h-11 w-[3px] rounded-l-md bg-slate-800" aria-hidden />
        <div className="absolute -left-[2.5px] top-[194px] h-11 w-[3px] rounded-l-md bg-slate-800" aria-hidden />
        <div className="absolute -right-[2.5px] top-[160px] h-16 w-[3px] rounded-r-md bg-slate-800" aria-hidden />

        {/* Screen */}
        <div className="relative aspect-[9/19.5] rounded-[2.4rem] bg-dark-base overflow-hidden flex flex-col">
          {/* Dynamic island */}
          <div
            className="absolute left-1/2 top-[11px] -translate-x-1/2 w-[84px] h-[24px] rounded-full bg-black ring-1 ring-slate-900 z-10 flex items-center justify-end pr-2"
            aria-hidden
          >
            <span className="w-[9px] h-[9px] rounded-full bg-slate-900 ring-1 ring-slate-800/80" />
          </div>

          {/* Status bar */}
          <div className="flex items-center justify-between px-7 pt-[15px] pb-1 text-[11px] font-semibold text-slate-200">
            <span className="tabular-nums">07:04</span>
            <span className="flex items-center gap-1 text-slate-300" aria-hidden>
              <span className="material-symbols-outlined text-[13px]">signal_cellular_alt</span>
              <span className="material-symbols-outlined text-[13px]">wifi</span>
              <span
                className="material-symbols-outlined text-[15px] rotate-90"
                style={{ fontVariationSettings: '"FILL" 1' }}
              >
                battery_5_bar
              </span>
            </span>
          </div>

          {/* App content */}
          <div className="flex-1 flex flex-col px-4 pt-2 pb-1 min-h-0">{children}</div>

          {/* Home indicator */}
          <div className="flex justify-center pb-2 pt-1" aria-hidden>
            <span className="w-28 h-1 rounded-full bg-slate-600/80" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

function ScreenHeader({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="mb-3">
      <div className="text-[10px] text-slate-500 mb-0.5">{kicker}</div>
      <div className="text-[17px] font-bold text-white leading-tight">{title}</div>
    </div>
  );
}

function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-dark-surface rounded-2xl border border-slate-700/50 ${className}`}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Screens (each fills the full device height)
// ---------------------------------------------------------------------------

/** Today screen: greeting, readiness, the prescribed session. */
export function TodayPhoneScreen() {
  return (
    <div className="flex flex-col h-full">
      <ScreenHeader kicker="Tuesday, Jul 7" title="Good morning 👋" />

      <Card className="flex items-center gap-3.5 p-3.5 mb-3">
        <RecoveryRing score={64} size={62} />
        <div className="min-w-0">
          <span className="inline-block bg-orange-500/15 text-orange-400 border border-orange-500/30 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase mb-1">
            Modified
          </span>
          <div className="text-[11px] text-slate-400 leading-snug">
            A little worn — today builds you up, not down.
          </div>
        </div>
      </Card>

      <Card className="p-3.5">
        <div className="text-[9px] font-black uppercase tracking-wide text-primary mb-1.5">
          Today's focus
        </div>
        <div className="text-[15px] font-bold text-white mb-2.5">
          {DEMO_RECOMMENDATION.title}
        </div>
        <div className="space-y-1.5 mb-3">
          {DEMO_RECOMMENDATION.segments.map((seg) => (
            <div
              key={seg.label}
              className="flex items-center justify-between bg-slate-800/60 rounded-lg px-2.5 py-1.5"
            >
              <span className="text-[11px] font-semibold text-slate-200">{seg.label}</span>
              <span className="text-[10px] text-slate-400">{seg.detail}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg font-semibold bg-primary text-slate-900 text-xs">
          <span
            className="material-symbols-outlined text-sm"
            style={{ fontVariationSettings: '"FILL" 1' }}
            aria-hidden
          >
            check_circle
          </span>
          Confirm session
        </div>
      </Card>

      <Card className="mt-auto flex items-center justify-between px-3.5 py-2.5">
        <div className="min-w-0">
          <div className="text-[9px] font-bold uppercase tracking-wide text-slate-500">
            HRV overnight
          </div>
          <div className="text-[11px] text-slate-300 font-semibold whitespace-nowrap">
            49 ms <span className="text-slate-500 font-normal">· bl. 51</span>
          </div>
        </div>
        <span className="text-[11px] font-semibold text-primary flex items-center whitespace-nowrap">
          See why
          <span className="material-symbols-outlined text-sm" aria-hidden>
            chevron_right
          </span>
        </span>
      </Card>
    </div>
  );
}

/** Morning check-in screen: mood, soreness, effort, illness. */
export function CheckinPhoneScreen() {
  const moods = ["🥵", "😮‍💨", "😐", "🙂", "😤"];
  const selected = 3; // "good"
  return (
    <div className="flex flex-col h-full">
      <ScreenHeader kicker="Morning check-in · 1 of 1" title="How do you feel?" />

      <div className="grid grid-cols-5 gap-1.5 mb-1.5">
        {moods.map((emoji, i) => (
          <span
            key={emoji}
            className={`flex items-center justify-center h-11 rounded-xl text-lg border ${
              i === selected
                ? "bg-primary/15 border-primary/60"
                : "bg-dark-surface border-slate-700/50"
            }`}
          >
            {emoji}
          </span>
        ))}
      </div>
      <div className="text-center text-[10px] font-semibold text-primary mb-3">Good</div>

      <Card className="p-3.5 mb-2.5">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[11px] font-semibold text-slate-200">Muscle soreness</span>
          <span className="text-[11px] font-bold text-white tabular-nums">3/10</span>
        </div>
        <div className="relative h-1.5 rounded-full bg-slate-700">
          <div className="absolute inset-y-0 left-0 w-[30%] rounded-full bg-primary" />
          <div className="absolute top-1/2 left-[30%] -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white shadow" />
        </div>
        <div className="flex justify-between mt-1.5 text-[9px] text-slate-500">
          <span>Fresh</span>
          <span>Wrecked</span>
        </div>
      </Card>

      <Card className="p-3.5 mb-2.5">
        <div className="text-[11px] font-semibold text-slate-200 mb-2">
          Yesterday's effort
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {["Easy", "Moderate", "Hard"].map((label) => (
            <span
              key={label}
              className={`text-center text-[10px] font-semibold py-1.5 rounded-lg border ${
                label === "Moderate"
                  ? "bg-primary/15 border-primary/60 text-primary"
                  : "bg-slate-800/60 border-slate-700/50 text-slate-400"
              }`}
            >
              {label}
            </span>
          ))}
        </div>
      </Card>

      <Card className="flex items-center justify-between px-3.5 py-2.5">
        <span className="text-[11px] font-semibold text-slate-200">Feeling ill?</span>
        <span className="relative inline-block w-9 h-5 rounded-full bg-slate-700" aria-hidden>
          <span className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-slate-400" />
        </span>
      </Card>

      <div className="mt-auto flex items-center justify-center w-full py-2.5 rounded-lg font-semibold bg-primary text-slate-900 text-xs">
        Done — that took 42 seconds
      </div>
    </div>
  );
}

/** Evidence screen: the why behind today's number, per signal. */
export function EvidencePhoneScreen() {
  const signals: Array<{ label: string; value: string; pct: number; tone: "ok" | "low" }> = [
    { label: "Sleep", value: "81", pct: 81, tone: "ok" },
    { label: "HRV", value: "64", pct: 64, tone: "low" },
    { label: "Recovery", value: "70", pct: 70, tone: "ok" },
    { label: "Training load", value: "-6", pct: 40, tone: "low" },
  ];
  return (
    <div className="flex flex-col h-full">
      <ScreenHeader kicker="Today's evidence" title="Why this session?" />

      <Card className="p-3.5 mb-2.5">
        <div className="flex items-baseline justify-between mb-1">
          <span className="text-[11px] text-slate-400">Readiness</span>
          <span className="text-[12px] font-bold text-white tabular-nums">
            72 <span className="text-slate-500 font-normal">wearable</span>{" "}
            <span className="text-orange-400">→ 64</span>
          </span>
        </div>
        <div className="text-[10px] text-slate-500 leading-snug">
          Your soreness moved the number — capped at what the data supports.
        </div>
      </Card>

      <Card className="p-3.5 mb-2.5 space-y-2.5">
        {signals.map((s) => (
          <div key={s.label}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-semibold text-slate-300">{s.label}</span>
              <span
                className={`text-[11px] font-bold tabular-nums ${
                  s.tone === "ok" ? "text-slate-200" : "text-orange-400"
                }`}
              >
                {s.value}
              </span>
            </div>
            <div className="h-1 rounded-full bg-slate-700/70">
              <div
                className={`h-full rounded-full ${
                  s.tone === "ok" ? "bg-primary" : "bg-orange-400"
                }`}
                style={{ width: `${s.pct}%` }}
              />
            </div>
          </div>
        ))}
      </Card>

      <Card className="p-3.5 mb-2.5">
        <div className="text-[11px] font-semibold text-slate-200 mb-1.5">
          Session calibration
        </div>
        <div className="flex gap-1.5">
          <span className="bg-orange-500/10 text-orange-400 text-[10px] font-semibold px-2 py-0.5 rounded">
            Intensity 85%
          </span>
          <span className="bg-orange-500/10 text-orange-400 text-[10px] font-semibold px-2 py-0.5 rounded">
            Duration 90%
          </span>
        </div>
      </Card>

      <Card className="mt-auto flex items-center justify-between px-3.5 py-2.5">
        <span className="text-[11px] text-slate-400">Confidence</span>
        <span className="text-[11px] font-bold text-primary tabular-nums">85%</span>
      </Card>
    </div>
  );
}

/** In-development fitness trends screen: fitness & fatigue over 16 weeks. */
export function TrendsPhoneScreen() {
  // Illustrative training block: fitness builds steadily; fatigue spikes with
  // hard weeks, then drops through a taper — form turns positive at the end.
  const fitness = [42, 43, 44, 46, 47, 49, 50, 52, 53, 54, 56, 57, 58, 59, 60, 60];
  const fatigue = [40, 50, 45, 56, 48, 60, 52, 58, 64, 54, 62, 55, 46, 40, 36, 34];

  const w = 238;
  const h = 132;
  const padL = 6;
  const plotR = 194; // leave room for direct labels on the right
  const lo = 28;
  const hi = 70;
  const x = (i: number) => padL + (i * (plotR - padL)) / (fitness.length - 1);
  const y = (v: number) => h - 8 - ((v - lo) * (h - 16)) / (hi - lo);
  const line = (vals: number[]) => vals.map((v, i) => `${x(i)},${y(v)}`).join(" ");

  return (
    <div className="flex flex-col h-full">
      <ScreenHeader kicker="Trends" title="Your training block" />

      <div className="flex gap-1.5 mb-3">
        {["4 weeks", "16 weeks", "Year"].map((label) => (
          <span
            key={label}
            className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border ${
              label === "16 weeks"
                ? "bg-primary/15 border-primary/60 text-primary"
                : "bg-dark-surface border-slate-700/50 text-slate-400"
            }`}
          >
            {label}
          </span>
        ))}
      </div>

      <Card className="p-3 mb-2.5">
        {/* Legend */}
        <div className="flex items-center gap-3 mb-2 text-[10px] font-semibold text-slate-400">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-primary" aria-hidden /> Fitness
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-orange-400" aria-hidden /> Fatigue
          </span>
        </div>
        <svg
          width="100%"
          viewBox={`0 0 ${w} ${h}`}
          role="img"
          aria-label="Fitness rising and fatigue falling over a 16-week block"
        >
          {[40, 50, 60].map((v) => (
            <line
              key={v}
              x1={padL}
              x2={plotR}
              y1={y(v)}
              y2={y(v)}
              stroke="#1e293b"
              strokeWidth="1"
            />
          ))}
          <polyline
            points={line(fatigue)}
            fill="none"
            stroke="#fb923c"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <polyline
            points={line(fitness)}
            fill="none"
            stroke="#22c55e"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx={x(fitness.length - 1)} cy={y(60)} r="3" fill="#22c55e" />
          <circle cx={x(fatigue.length - 1)} cy={y(34)} r="3" fill="#fb923c" />
          <text x={plotR + 6} y={y(60) + 3} fill="#e2e8f0" fontSize="9" fontWeight="700">
            60
          </text>
          <text x={plotR + 6} y={y(34) + 3} fill="#e2e8f0" fontSize="9" fontWeight="700">
            34
          </text>
        </svg>
      </Card>

      <Card className="flex items-center justify-between px-3.5 py-2.5 mb-2.5">
        <span className="text-[11px] text-slate-400">Form today</span>
        <span className="text-[11px] font-bold text-primary">Fresh — ready to peak</span>
      </Card>

      <div className="mt-auto grid grid-cols-2 gap-2">
        <Card className="px-3 py-2.5">
          <div className="text-[9px] uppercase tracking-wide text-slate-500 mb-0.5">
            Fitness
          </div>
          <div className="text-sm font-bold text-white tabular-nums">
            60 <span className="text-[10px] font-semibold text-primary">+18</span>
          </div>
        </Card>
        <Card className="px-3 py-2.5">
          <div className="text-[9px] uppercase tracking-wide text-slate-500 mb-0.5">
            Fatigue
          </div>
          <div className="text-sm font-bold text-white tabular-nums">
            34 <span className="text-[10px] font-semibold text-slate-400">taper</span>
          </div>
        </Card>
      </div>
    </div>
  );
}
