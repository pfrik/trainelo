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
  type SwapSuggestion,
} from "@/lib/core/checkin/calibrator";
import { WAITLIST_URL } from "@/lib/landing/invite";
import { useAnimatedNumber } from "@/hooks/useAnimatedNumber";

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

/** Human labels for the engine's session-type suggestion. */
const SWAP_LABELS: Record<SwapSuggestion, string> = {
  rest: "Full rest",
  recovery: "Recovery session",
  easy: "Easy session",
  mobility: "Mobility",
  cross_train: "Cross-training",
  injury_safe: "Injury-safe session",
  as_planned: "As planned",
  harder_variant: "Push harder",
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
  const sc = result.signal_contribution;
  const animIntensity = Math.round(useAnimatedNumber(intensityPct));
  const animDuration = Math.round(useAnimatedNumber(durationMin));
  const animFinal = Math.round(useAnimatedNumber(sc.final_score ?? blended));

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
            className="[&>span:first-child]:bg-slate-200 [&>span:first-child>span]:bg-primary-ink [&_[role=slider]]:border-primary-ink [&_[role=slider]]:bg-white"
          />
          <div className="flex justify-between text-[10px] text-slate-400 mt-1.5">
            <span>None</span>
            <span>Severe</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <label
            htmlFor="demo-illness"
            className="text-sm font-semibold text-slate-900 cursor-pointer"
          >
            Feeling ill
          </label>
          <div className="flex items-center gap-2.5">
            <span
              className={`text-sm font-semibold tabular-nums w-7 text-right ${
                illness ? "text-primary-ink" : "text-slate-400"
              }`}
            >
              {illness ? "Yes" : "No"}
            </span>
            <Switch
              id="demo-illness"
              checked={illness}
              onCheckedChange={setIllness}
              aria-label="Feeling ill"
              className="border-slate-300 data-[state=unchecked]:bg-slate-200 data-[state=checked]:bg-primary-ink [&>span]:bg-white [&>span]:border [&>span]:border-slate-300 focus-visible:ring-slate-900 focus-visible:ring-offset-white"
            />
          </div>
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

        <div className="flex items-center gap-6 mb-4">
          <div role="img" aria-label={`Readiness ${Math.round(blended)} out of 100`}>
            <RecoveryRing score={blended} size={104} animated />
          </div>
          <div className="min-w-0">
            <span
              key={result.level}
              className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded border uppercase mb-2 animate-in fade-in-0 duration-300 motion-reduce:animate-none ${level.badge}`}
            >
              <level.icon className="w-3.5 h-3.5" aria-hidden />
              {level.label}
            </span>
            <div
              key={result.headline}
              className="text-lg font-bold text-white leading-snug min-h-[2lh] animate-in fade-in-0 duration-300 motion-reduce:animate-none"
            >
              {result.headline}
            </div>
          </div>
        </div>

        {/* Show the work: what the watch saw + what you reported = today */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 mb-4">
          <span>
            Baseline{" "}
            <span className="text-slate-300 font-semibold tabular-nums">
              {sc.objective_score ?? "—"}
            </span>
          </span>
          <span aria-hidden>·</span>
          <span>
            your check-in{" "}
            <span
              className={`font-semibold tabular-nums ${
                sc.subjective_delta >= 0 ? "text-primary" : "text-orange-400"
              }`}
            >
              {sc.subjective_delta >= 0
                ? `+${sc.subjective_delta}`
                : `−${Math.abs(sc.subjective_delta)}`}
            </span>
          </span>
          <span aria-hidden>&rarr;</span>
          <span className="text-white font-semibold tabular-nums">
            {animFinal} today
          </span>
        </div>

        {/* Session type — keeps the red states coherent */}
        <div className="text-sm text-slate-400 mb-5">
          Session ·{" "}
          <span
            key={result.swap_to}
            className="text-white font-semibold inline-block animate-in fade-in-0 duration-300 motion-reduce:animate-none"
          >
            {SWAP_LABELS[result.swap_to]}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="bg-slate-800/60 rounded-xl p-4">
            <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Intensity</div>
            <div className="text-xl font-bold text-white tabular-nums">
              {animIntensity}%
              <span className="text-sm font-normal text-slate-500"> of plan</span>
            </div>
          </div>
          <div className="bg-slate-800/60 rounded-xl p-4">
            <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Duration</div>
            <div className="text-xl font-bold text-white tabular-nums">
              {animDuration}
              <span className="text-sm font-normal text-slate-500"> min</span>
            </div>
          </div>
        </div>

        <p
          key={result.rationale}
          className="text-sm text-slate-400 leading-relaxed min-h-[3lh] animate-in fade-in-0 duration-300 motion-reduce:animate-none"
        >
          {result.rationale}
        </p>

        {/* Conflict slot: always reserved, faded in only when signals disagree */}
        <div
          className={`mt-4 flex items-start gap-2 bg-orange-500/10 border border-orange-500/30 rounded-lg p-3 transition-opacity duration-200 motion-reduce:transition-none ${
            result.signal_contribution.conflict_flag
              ? "opacity-100"
              : "opacity-0 invisible"
          }`}
          aria-hidden={!result.signal_contribution.conflict_flag}
        >
          <TriangleAlert className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" aria-hidden />
          <p className="text-xs text-orange-200">
            <span className="font-semibold text-orange-400">Signals disagree. </span>
            The engine stays conservative and says so, out loud.
          </p>
        </div>

        {/* Screen-reader announcement of each recalculated result */}
        <div className="sr-only" aria-live="polite">
          {`${level.label}. ${SWAP_LABELS[result.swap_to]}. ${intensityPct} percent intensity, ${durationMin} minutes.`}
        </div>

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
