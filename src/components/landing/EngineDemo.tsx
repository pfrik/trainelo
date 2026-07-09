/**
 * Interactive landing-page demo that runs the REAL production calibration
 * engine (src/lib/core/checkin/calibrator.ts) in the browser. Visitors move
 * the morning check-in controls and watch the recommendation recalibrate —
 * the same pure function the cron pipeline executes every morning.
 */

import { useMemo, useState } from "react";
import {
  Ban,
  CircleCheckBig,
  CircleDot,
  TrendingUp,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { RecoveryRing } from "@/components/landing/RecoveryRing";
import {
  calibrateSession,
  type CalibratorInput,
  type Mood5,
} from "@/lib/core/checkin/calibrator";
import { WAITLIST_URL } from "@/lib/landing/invite";

/** Fixed wearable baseline for the demo: a decent night. */
const DEMO_WEARABLE = {
  readiness: "green" as const,
  readiness_score: 72,
  fatigue_score: 38,
};

const MOODS: Array<{ value: Mood5; label: string; emoji: string }> = [
  { value: "drained", label: "Drained", emoji: "🥵" },
  { value: "tired", label: "Tired", emoji: "😮‍💨" },
  { value: "okay", label: "Okay", emoji: "😐" },
  { value: "good", label: "Good", emoji: "🙂" },
  { value: "great", label: "Great", emoji: "😁" },
];

const LEVEL_STYLES: Record<string, { badge: string; icon: LucideIcon; label: string }> = {
  red: {
    badge: "bg-red-500/10 text-red-400 border-red-500/30",
    icon: Ban,
    label: "Rest / Recovery",
  },
  amber: {
    badge: "bg-orange-500/10 text-orange-400 border-orange-500/30",
    icon: CircleDot,
    label: "Modified",
  },
  green: {
    badge: "bg-green-500/10 text-green-400 border-green-500/30",
    icon: CircleCheckBig,
    label: "As Planned",
  },
  upgrade: {
    badge: "bg-green-500/10 text-green-400 border-green-500/30",
    icon: TrendingUp,
    label: "Push Today",
  },
};

export function EngineDemo() {
  const [mood, setMood] = useState<Mood5>("okay");
  const [soreness, setSoreness] = useState(3);
  const [illness, setIllness] = useState(false);

  const result = useMemo(() => {
    const input: CalibratorInput = {
      morning_checkin: {
        mood,
        soreness,
        illness_flag: illness,
        rpe: null,
        pain_flag: false,
      },
      wearable_signals: DEMO_WEARABLE,
      planned_session: { planned_duration_minutes: 42, planned_intensity: null },
    };
    return calibrateSession(input);
  }, [mood, soreness, illness]);

  const blended =
    result.signal_contribution.final_score ?? DEMO_WEARABLE.readiness_score;
  const level = LEVEL_STYLES[result.level] ?? LEVEL_STYLES.green;
  const intensityPct = Math.round(result.intensity_multiplier * 100);
  const durationMin = Math.round(42 * result.duration_multiplier);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
      {/* Controls — light, "the real world" side */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
        <div className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-6">
          Your morning check-in
        </div>

        <div className="mb-8">
          <div className="text-sm font-semibold text-slate-900 mb-3">How do you feel?</div>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Mood">
            {MOODS.map((m) => (
              <button
                key={m.value}
                role="radio"
                aria-checked={mood === m.value}
                onClick={() => setMood(m.value)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                  mood === m.value
                    ? "bg-primary/10 border-primary-ink/60 text-primary-ink"
                    : "bg-white border-slate-200 text-slate-600 hover:border-slate-400"
                }`}
              >
                <span aria-hidden>{m.emoji}</span>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-slate-900">Muscle soreness</span>
            <span className="text-sm font-bold text-slate-900 tabular-nums">{soreness}/10</span>
          </div>
          <Slider
            value={[soreness]}
            onValueChange={([v]) => setSoreness(v)}
            min={0}
            max={10}
            step={1}
            aria-label="Muscle soreness"
          />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-900">Feeling ill</span>
          <Switch checked={illness} onCheckedChange={setIllness} aria-label="Feeling ill" />
        </div>

        <p className="text-xs text-slate-500 mt-8 leading-relaxed">
          For this demo, the night is fixed: decent sleep, readiness 72.
          You're the variable.
        </p>
      </div>

      {/* Live output — dark, "the product answers" side */}
      <div className="bg-dark-base rounded-2xl border border-slate-700/60 shadow-2xl p-6 sm:p-8 flex flex-col">
        <div className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-6">
          Today's calibrated session
        </div>

        <div className="flex items-center gap-6 mb-6">
          <RecoveryRing score={blended} size={104} />
          <div className="min-w-0">
            <span
              className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded border uppercase mb-2 ${level.badge}`}
            >
              <level.icon className="w-3.5 h-3.5" aria-hidden />
              {level.label}
            </span>
            <div className="text-lg font-bold text-white leading-snug">
              {result.headline}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="bg-slate-800/60 rounded-xl p-4">
            <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Intensity</div>
            <div className="text-xl font-bold text-white tabular-nums">
              {intensityPct}%
              <span className="text-sm font-normal text-slate-500"> of plan</span>
            </div>
          </div>
          <div className="bg-slate-800/60 rounded-xl p-4">
            <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Duration</div>
            <div className="text-xl font-bold text-white tabular-nums">
              {durationMin}
              <span className="text-sm font-normal text-slate-500"> min</span>
            </div>
          </div>
        </div>

        <p className="text-sm text-slate-400 leading-relaxed">{result.rationale}</p>

        {result.signal_contribution.conflict_flag && (
          <div className="mt-4 flex items-start gap-2 bg-orange-500/10 border border-orange-500/30 rounded-lg p-3">
            <TriangleAlert className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" aria-hidden />
            <p className="text-xs text-orange-200">
              <span className="font-semibold text-orange-400">Signals disagree. </span>
              The engine stays conservative and says so, out loud.
            </p>
          </div>
        )}

        <p className="text-xs text-slate-500 mt-auto pt-6">
          Want this running on your own mornings?{" "}
          <a
            href={WAITLIST_URL}
            className="text-slate-300 underline underline-offset-4 hover:text-white transition-colors"
          >
            Join the waitlist
          </a>
        </p>
      </div>
    </div>
  );
}
