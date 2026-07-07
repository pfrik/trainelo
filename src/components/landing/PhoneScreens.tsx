/**
 * Phone-framed product screens for the landing page.
 *
 * These are presentational React renders of Trainelo screens (dark theme,
 * real design tokens) inside a CSS phone bezel — bevel.health-style product
 * imagery without resorting to static screenshots. The trends screen is a
 * preview of the in-development fitness chart.
 */

import { type ReactNode } from "react";
import { RecoveryRing } from "@/components/landing/RecoveryRing";
import { DEMO_RECOMMENDATION } from "@/lib/landing/demoData";

// ---------------------------------------------------------------------------
// Frame
// ---------------------------------------------------------------------------

/** CSS phone bezel with status bar; children render as the dark screen. */
export function PhoneFrame({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`w-[270px] rounded-[2.6rem] bg-slate-900 p-[9px] shadow-2xl ring-1 ring-slate-900/10 ${className}`}
    >
      <div className="relative rounded-[2rem] bg-dark-base overflow-hidden">
        {/* Dynamic-island notch */}
        <div
          className="absolute top-2.5 left-1/2 -translate-x-1/2 w-20 h-5 rounded-full bg-slate-900 z-10"
          aria-hidden
        />
        {/* Status bar */}
        <div className="flex items-center justify-between px-6 pt-3 pb-1 text-[10px] font-semibold text-slate-400">
          <span className="tabular-nums">07:04</span>
          <span className="flex items-center gap-1" aria-hidden>
            <span className="material-symbols-outlined text-[12px]">signal_cellular_alt</span>
            <span className="material-symbols-outlined text-[12px]">wifi</span>
            <span className="material-symbols-outlined text-[12px]">battery_full</span>
          </span>
        </div>
        <div className="px-4 pb-5 pt-2">{children}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Screens
// ---------------------------------------------------------------------------

/** Today screen: greeting, readiness ring, the prescribed session. */
export function TodayPhoneScreen() {
  return (
    <div>
      <div className="text-[11px] text-slate-500 mb-0.5">Tuesday, Jul 7</div>
      <div className="text-base font-bold text-white mb-4">Good morning 👋</div>

      <div className="flex items-center gap-4 bg-dark-surface rounded-2xl border border-slate-700/50 p-3.5 mb-3">
        <RecoveryRing score={64} size={64} />
        <div className="min-w-0">
          <span className="inline-block bg-orange-500/15 text-orange-400 border border-orange-500/30 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase mb-1">
            Modified
          </span>
          <div className="text-[11px] text-slate-400 leading-snug">
            A little worn — today builds you up, not down.
          </div>
        </div>
      </div>

      <div className="bg-dark-surface rounded-2xl border border-slate-700/50 p-3.5">
        <div className="text-[9px] font-black uppercase tracking-wide text-primary mb-1.5">
          Today's focus
        </div>
        <div className="text-sm font-bold text-white mb-2.5">
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
      </div>
    </div>
  );
}

/** Morning check-in screen: mood, soreness, illness — static render. */
export function CheckinPhoneScreen() {
  const moods = ["🥵", "😮‍💨", "😐", "🙂", "😤"];
  const selected = 3; // "good"
  return (
    <div>
      <div className="text-[11px] text-slate-500 mb-0.5">Morning check-in</div>
      <div className="text-base font-bold text-white mb-4">How do you feel?</div>

      <div className="flex justify-between gap-1.5 mb-5">
        {moods.map((emoji, i) => (
          <span
            key={emoji}
            className={`flex items-center justify-center w-10 h-10 rounded-xl text-lg border ${
              i === selected
                ? "bg-primary/15 border-primary/60"
                : "bg-dark-surface border-slate-700/50"
            }`}
          >
            {emoji}
          </span>
        ))}
      </div>

      <div className="bg-dark-surface rounded-2xl border border-slate-700/50 p-3.5 mb-3">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-xs font-semibold text-slate-200">Muscle soreness</span>
          <span className="text-xs font-bold text-white tabular-nums">3/10</span>
        </div>
        <div className="relative h-1.5 rounded-full bg-slate-700">
          <div className="absolute inset-y-0 left-0 w-[30%] rounded-full bg-primary" />
          <div className="absolute top-1/2 left-[30%] -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white shadow" />
        </div>
      </div>

      <div className="flex items-center justify-between bg-dark-surface rounded-2xl border border-slate-700/50 p-3.5 mb-4">
        <span className="text-xs font-semibold text-slate-200">Feeling ill?</span>
        <span className="relative inline-block w-9 h-5 rounded-full bg-slate-700" aria-hidden>
          <span className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-slate-400" />
        </span>
      </div>

      <div className="flex items-center justify-center w-full py-2.5 rounded-lg font-semibold bg-primary text-slate-900 text-xs">
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
    <div>
      <div className="text-[11px] text-slate-500 mb-0.5">Today's evidence</div>
      <div className="text-base font-bold text-white mb-4">Why this session?</div>

      <div className="bg-dark-surface rounded-2xl border border-slate-700/50 p-3.5 mb-3">
        <div className="flex items-baseline justify-between mb-1">
          <span className="text-xs text-slate-400">Readiness</span>
          <span className="text-sm font-bold text-white tabular-nums">
            72 <span className="text-slate-500 font-normal">wearable</span>{" "}
            <span className="text-orange-400">→ 64</span>{" "}
            <span className="text-slate-500 font-normal">after check-in</span>
          </span>
        </div>
        <div className="text-[10px] text-slate-500">
          Your soreness moved the number — capped at what the data supports.
        </div>
      </div>

      <div className="bg-dark-surface rounded-2xl border border-slate-700/50 p-3.5 mb-3 space-y-2.5">
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
      </div>

      <div className="flex items-center justify-between bg-dark-surface rounded-2xl border border-slate-700/50 px-3.5 py-2.5">
        <span className="text-[11px] text-slate-400">Confidence</span>
        <span className="text-[11px] font-bold text-primary tabular-nums">85%</span>
      </div>
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
  const h = 118;
  const padL = 6;
  const plotR = 190; // leave room for direct labels on the right
  const lo = 28;
  const hi = 70;
  const x = (i: number) => padL + (i * (plotR - padL)) / (fitness.length - 1);
  const y = (v: number) => h - 8 - ((v - lo) * (h - 16)) / (hi - lo);
  const line = (vals: number[]) => vals.map((v, i) => `${x(i)},${y(v)}`).join(" ");

  return (
    <div>
      <div className="text-[11px] text-slate-500 mb-0.5">Trends</div>
      <div className="text-base font-bold text-white mb-3">Last 16 weeks</div>

      {/* Legend */}
      <div className="flex items-center gap-3 mb-2 text-[10px] font-semibold text-slate-400">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-primary" aria-hidden /> Fitness
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-orange-400" aria-hidden /> Fatigue
        </span>
      </div>

      <div className="bg-dark-surface rounded-2xl border border-slate-700/50 p-3 mb-3">
        <svg width="100%" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Fitness rising and fatigue falling over a 16-week block">
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
      </div>

      <div className="flex items-center justify-between bg-dark-surface rounded-2xl border border-slate-700/50 px-3.5 py-2.5">
        <span className="text-[11px] text-slate-400">Form today</span>
        <span className="text-[11px] font-bold text-primary">Fresh — ready to peak</span>
      </div>
    </div>
  );
}
