/**
 * Morning check-in v3.2 — one calm screen, always saveable.
 *
 * Instrument design (informed by athlete-monitoring research: Hooper Index /
 * McLean wellness questionnaire; Saw et al. 2016 on subjective measures):
 * - Fixed core items every day (mood + soreness) so answers are baselineable.
 * - Exception-based detail: "anything below normal" chips expand a short
 *   verbal severity that maps to the engine's real 1-5 scale deltas.
 * - Verbal anchors instead of sliders; 0-10 NRS kept for pain only (the
 *   validated pain instrument).
 * - Red-flag triage (illness / pain) is the only true branching.
 * - Every question traces to a calibrator input; log-only fields say so.
 *
 * The legacy flow is kept for comparison at /dashboard?checkin=legacy.
 */

import { useMemo, useState } from "react";
import type { CheckinPayload } from "@/components/checkin/MorningCheckinFlow";
import type { CalibrationResult } from "@/lib/core/checkin/calibrator";

type Mood = "drained" | "tired" | "okay" | "good" | "great";

export interface CheckinSubmitResult {
  calibration: CalibrationResult | null;
}

interface MorningCheckinProps {
  onSubmit: (payload: CheckinPayload) => Promise<CheckinSubmitResult | void>;
  /** Objective wearable readiness band, for the "great" upgrade note. */
  wearableReadiness?: "red" | "yellow" | "green" | null;
  /** If today's check-in already exists, show the saved state. */
  existingMood?: Mood | null;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

const MOODS: { value: Mood; label: string; icon: string }[] = [
  { value: "drained", label: "Drained", icon: "battery_alert" },
  { value: "tired", label: "Tired", icon: "sentiment_dissatisfied" },
  { value: "okay", label: "Okay", icon: "sentiment_neutral" },
  { value: "good", label: "Good", icon: "sentiment_satisfied" },
  { value: "great", label: "Great", icon: "sentiment_very_satisfied" },
];

/** Verbal rating scale for soreness; values chosen so "Heavy"+ crosses the
 * engine's >=7 threshold (fatigue delta + intensity cap). */
const SORENESS_LEVELS: { label: string; value: number }[] = [
  { label: "None", value: 0 },
  { label: "Light", value: 2 },
  { label: "Moderate", value: 5 },
  { label: "Heavy", value: 7 },
  { label: "Severe", value: 9 },
];

/**
 * Exception-reporting chips. Each id is a calibrator driver (duration bias +
 * compound caps); scaled chips also feed the 1-5 wellness scale deltas via
 * three verbal severity levels. "life_stress" uses the engine's inverted
 * scale (higher = worse), hence its ascending severity values.
 */
interface DragOption {
  id: string;
  label: string;
  scaleField?: "sleep_quality" | "perceived_energy" | "motivation" | "life_stress";
  /** Scale values for severity levels [a little, noticeably, a lot]. */
  severityValues?: [number, number, number];
}

const DRAG_OPTIONS: DragOption[] = [
  { id: "poor_sleep", label: "Slept badly", scaleField: "sleep_quality", severityValues: [3, 2, 1] },
  { id: "low_energy", label: "Low energy", scaleField: "perceived_energy", severityValues: [3, 2, 1] },
  { id: "life_stress", label: "Stressed", scaleField: "life_stress", severityValues: [3, 4, 5] },
  { id: "motivation", label: "Low motivation", scaleField: "motivation", severityValues: [3, 2, 1] },
  // Only RPE >= 8 changes anything in the engine, so yesterday's effort is
  // one honest chip instead of a four-option placebo row.
  { id: "hard_yesterday", label: "Yesterday was brutal" },
];

const SEVERITY_LABELS = ["A little", "Noticeably", "A lot"] as const;

const DRAINED_REASONS: { value: "sick" | "hurt" | "fried"; label: string; icon: string }[] = [
  { value: "sick", label: "I'm sick", icon: "sick" },
  { value: "hurt", label: "Something hurts", icon: "personal_injury" },
  { value: "fried", label: "Just worn out", icon: "battery_alert" },
];

const PAIN_LOCATIONS = [
  { id: "foot_ankle", label: "Foot/Ankle" },
  { id: "knee", label: "Knee" },
  { id: "hip_glute", label: "Hip/Glute" },
  { id: "back", label: "Back" },
  { id: "shoulder", label: "Shoulder" },
  { id: "other", label: "Other" },
];

const TIME_OPTIONS: { label: string; minutes: number }[] = [
  { label: "30 min", minutes: 30 },
  { label: "45 min", minutes: 45 },
  { label: "60 min", minutes: 60 },
];

const LEVEL_BADGES: Record<string, { cls: string; label: string }> = {
  red: { cls: "bg-red-500/10 text-red-400 border-red-500/30", label: "Recovery" },
  amber: { cls: "bg-orange-500/10 text-orange-400 border-orange-500/30", label: "Modified" },
  green: { cls: "bg-green-500/10 text-green-400 border-green-500/30", label: "As planned" },
  upgrade: { cls: "bg-green-500/10 text-green-400 border-green-500/30", label: "Push day" },
};

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------

function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between mb-2">
      <span className="text-sm font-semibold text-slate-200">{children}</span>
      {hint && <span className="text-xs text-slate-500">{hint}</span>}
    </div>
  );
}

function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`px-3 py-2 rounded-lg text-sm font-semibold border transition-colors ${
        selected
          ? "bg-primary/15 border-primary/60 text-primary"
          : "bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200"
      }`}
    >
      {children}
    </button>
  );
}

/** Full-width segmented control with verbal anchors. */
function Segments({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { label: string; value: number }[];
  value: number;
  onChange: (v: number) => void;
  ariaLabel: string;
}) {
  return (
    <div
      className="grid gap-1 p-1 bg-slate-800/50 rounded-lg border border-slate-700"
      style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}
      role="radiogroup"
      aria-label={ariaLabel}
    >
      {options.map((o) => (
        <button
          key={o.label}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`py-2 rounded-md text-xs font-semibold transition-colors ${
            value === o.value
              ? "bg-primary text-slate-900"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Collapsible row for the quiet, optional tier. */
function Disclosure({
  open,
  onToggle,
  label,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex items-center gap-1.5 text-sm font-semibold text-slate-400 hover:text-white transition-colors py-1"
      >
        <span className="material-symbols-outlined text-lg" aria-hidden>
          {open ? "expand_less" : "expand_more"}
        </span>
        {label}
      </button>
      {open && <div className="mt-3 space-y-4 border-l-2 border-slate-700 pl-4">{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MorningCheckin({
  onSubmit,
  wearableReadiness,
  existingMood,
}: MorningCheckinProps) {
  const [mood, setMood] = useState<Mood | null>(null);
  const [soreness, setSoreness] = useState(0);
  const [dragTags, setDragTags] = useState<string[]>([]);
  /** Severity index (0-2) per selected drag tag; null = tag only. */
  const [dragSeverity, setDragSeverity] = useState<Record<string, number | null>>({});
  const [drainedReason, setDrainedReason] = useState<"sick" | "hurt" | "fried" | null>(null);
  const [painOpen, setPainOpen] = useState(false);
  const [painSeverity, setPainSeverity] = useState<number | null>(null);
  const [painLocations, setPainLocations] = useState<string[]>([]);
  const [timeOpen, setTimeOpen] = useState(false);
  const [timeMinutes, setTimeMinutes] = useState<number | null>(null);
  const [upgradeType, setUpgradeType] = useState<"intensity" | "volume" | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const [notes, setNotes] = useState("");

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [result, setResult] = useState<CalibrationResult | null>(null);
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState(false);

  // Pain details are required whenever pain is reported (severity drives the
  // hard-stop rule; locations drive the swap suggestion).
  const painActive = painOpen || drainedReason === "hurt";

  // The exception chips are the same instrument every day for non-drained
  // moods; drained has its own triage and the engine skips driver rules there.
  const showDragChips = mood != null && mood !== "drained";

  const canSave = useMemo(() => {
    if (!mood || saving) return false;
    if (mood === "drained" && !drainedReason) return false;
    if (painActive && (painSeverity == null || painLocations.length === 0)) return false;
    return true;
  }, [mood, saving, drainedReason, painActive, painSeverity, painLocations]);

  const selectMood = (m: Mood) => {
    setMood(m);
    setValidationError(null);
    // Reset mood-specific answers; keep core items (soreness) and logistics.
    setDrainedReason(null);
    setUpgradeType(null);
    if (m === "drained") {
      setDragTags([]);
      setDragSeverity({});
    } else {
      setPainOpen(false);
    }
  };

  const toggleTag = (id: string) => {
    setDragTags((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
    setDragSeverity((prev) => ({ ...prev, [id]: null }));
  };

  const toggleLocation = (id: string) => {
    setPainLocations((prev) =>
      prev.includes(id) ? prev.filter((l) => l !== id) : [...prev, id],
    );
  };

  const handleSave = async () => {
    if (!mood) return;
    if (mood === "drained" && !drainedReason) {
      setValidationError("Tell us what's behind it — sick, hurt, or worn out.");
      return;
    }
    if (painActive && (painSeverity == null || painLocations.length === 0)) {
      setValidationError("For pain, pick where it is and how bad it feels.");
      return;
    }

    setValidationError(null);
    setSaving(true);
    setSaveError(null);

    const p: CheckinPayload = { mood };
    if (soreness > 0) p.soreness = soreness;
    if (timeMinutes != null) p.time_constraint_minutes = timeMinutes;
    if (notes.trim()) p.notes = notes.trim();

    if (mood === "drained" && drainedReason) {
      p.reason_bucket = drainedReason;
      if (drainedReason === "sick") p.illness_flag = true;
    }

    if (dragTags.length > 0) {
      p.reason_tags = dragTags;
      // Scaled chips: map chosen verbal severity onto the engine's 1-5 scales.
      const scales: Record<string, unknown> = {};
      for (const opt of DRAG_OPTIONS) {
        if (!dragTags.includes(opt.id)) continue;
        if (opt.id === "hard_yesterday") {
          p.rpe = 8;
          continue;
        }
        const sevIdx = dragSeverity[opt.id];
        if (opt.scaleField && opt.severityValues && sevIdx != null) {
          scales[opt.scaleField] = opt.severityValues[sevIdx];
        }
      }
      if (Object.keys(scales).length > 0) {
        p.payload = { ...(p.payload ?? {}), ...scales };
      }
    }

    if (painActive && painSeverity != null) {
      p.pain_flag = true;
      p.pain_severity = painSeverity;
      p.pain_locations = painLocations;
    }
    if (mood === "great" && upgradeType) {
      p.payload = { ...(p.payload ?? {}), upgrade_type: upgradeType };
    }

    try {
      const res = await onSubmit(p);
      setResult(
        res && "calibration" in (res as CheckinSubmitResult)
          ? (res as CheckinSubmitResult).calibration
          : null,
      );
      setSaved(true);
      setEditing(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  // ---- Saved state --------------------------------------------------------

  const effectiveMood = saved ? mood : existingMood;
  if (effectiveMood && !editing) {
    const badge = result ? LEVEL_BADGES[result.level] : null;
    return (
      <div>
        <div className="flex items-center gap-2 py-1">
          <span
            className="material-symbols-outlined text-green-400 text-xl"
            style={{ fontVariationSettings: '"FILL" 1' }}
            aria-hidden
          >
            check_circle
          </span>
          <span className="text-green-400 text-sm font-medium">Check-in saved</span>
          <span className="text-slate-500 text-sm capitalize">({effectiveMood})</span>
          <button
            onClick={() => setEditing(true)}
            className="ml-auto text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            Update
          </button>
        </div>

        {/* Inline calibration result — the payoff for checking in */}
        {result && badge && (
          <div className="mt-3 bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded border uppercase ${badge.cls}`}
              >
                {badge.label}
              </span>
              <span className="text-sm font-semibold text-white">{result.headline}</span>
            </div>
            <div className="flex gap-4 text-xs text-slate-400 mb-2 tabular-nums">
              <span>
                Intensity{" "}
                <span className="font-bold text-slate-200">
                  {Math.round(result.intensity_multiplier * 100)}%
                </span>
              </span>
              <span>
                Duration{" "}
                <span className="font-bold text-slate-200">
                  {Math.round(result.duration_multiplier * 100)}%
                </span>
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">{result.rationale}</p>
            {result.signal_contribution.conflict_flag &&
              result.signal_contribution.conflict_description && (
                <p className="text-xs text-orange-300/90 leading-relaxed mt-2">
                  {result.signal_contribution.conflict_description}
                </p>
              )}
          </div>
        )}
      </div>
    );
  }

  // ---- Form ----------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Mood — core item 1 */}
      <div>
        <div className="grid grid-cols-5 gap-2 sm:gap-3" role="radiogroup" aria-label="Mood">
          {MOODS.map((m) => {
            const sel = mood === m.value;
            return (
              <button
                key={m.value}
                role="radio"
                aria-checked={sel}
                onClick={() => selectMood(m.value)}
                className={`flex flex-col items-center justify-center p-2 sm:p-3 rounded-xl border transition-colors active:scale-95 ${
                  sel
                    ? "bg-primary/15 border-primary/60"
                    : "bg-slate-800/50 border-slate-700 hover:border-slate-500"
                }`}
              >
                <span
                  className={`material-symbols-outlined mb-1 text-2xl ${
                    sel ? "text-primary" : "text-slate-400"
                  }`}
                  style={{ fontVariationSettings: '"FILL" 1' }}
                  aria-hidden
                >
                  {m.icon}
                </span>
                <span
                  className={`text-[10px] sm:text-xs font-medium ${
                    sel ? "text-white" : "text-slate-300"
                  }`}
                >
                  {m.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {mood && (
        <>
          {/* Drained: red-flag triage (required by the engine) */}
          {mood === "drained" && (
            <div>
              <FieldLabel>What's behind it?</FieldLabel>
              <div className="grid grid-cols-3 gap-2">
                {DRAINED_REASONS.map((r) => {
                  const sel = drainedReason === r.value;
                  return (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => {
                        setDrainedReason(r.value);
                        setValidationError(null);
                        if (r.value === "hurt") setPainOpen(true);
                      }}
                      aria-pressed={sel}
                      className={`flex flex-col items-center gap-1 px-2 py-3 rounded-xl border text-xs font-semibold transition-colors ${
                        sel
                          ? "bg-primary/15 border-primary/60 text-white"
                          : "bg-slate-800/50 border-slate-700 text-slate-300 hover:border-slate-500"
                      }`}
                    >
                      <span
                        className={`material-symbols-outlined text-xl ${
                          sel ? "text-primary" : "text-slate-400"
                        }`}
                        aria-hidden
                      >
                        {r.icon}
                      </span>
                      {r.label}
                    </button>
                  );
                })}
              </div>
              {drainedReason === "sick" && (
                <p className="text-xs text-slate-400 mt-2">
                  Training pauses while you're sick — today will be a rest recommendation.
                </p>
              )}
            </div>
          )}

          {/* Great: optional upgrade preference */}
          {mood === "great" && (
            <div>
              <FieldLabel hint="optional">If today gets upgraded, push…</FieldLabel>
              <div className="flex gap-2">
                <Chip
                  selected={upgradeType === "intensity"}
                  onClick={() =>
                    setUpgradeType(upgradeType === "intensity" ? null : "intensity")
                  }
                >
                  Intensity
                </Chip>
                <Chip
                  selected={upgradeType === "volume"}
                  onClick={() => setUpgradeType(upgradeType === "volume" ? null : "volume")}
                >
                  Duration
                </Chip>
              </div>
              {wearableReadiness === "red" && (
                <p className="text-xs text-slate-400 mt-2">
                  Heads up: overnight data shows low recovery, so the engine may keep
                  today at plan even though you feel great.
                </p>
              )}
            </div>
          )}

          {/* Soreness — core item 2, verbal rating scale */}
          <div>
            <FieldLabel>Muscle soreness</FieldLabel>
            <Segments
              options={SORENESS_LEVELS}
              value={soreness}
              onChange={setSoreness}
              ariaLabel="Muscle soreness"
            />
          </div>

          {/* Exception chips — same instrument every day */}
          {showDragChips && (
            <div>
              <FieldLabel hint="optional">Anything below normal?</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {DRAG_OPTIONS.map((t) => (
                  <Chip
                    key={t.id}
                    selected={dragTags.includes(t.id)}
                    onClick={() => toggleTag(t.id)}
                  >
                    {t.label}
                  </Chip>
                ))}
              </div>

              {/* Inline severity per selected scaled chip */}
              {DRAG_OPTIONS.filter(
                (t) => dragTags.includes(t.id) && t.severityValues,
              ).map((t) => (
                <div key={t.id} className="mt-3 flex items-center gap-3">
                  <span className="text-xs text-slate-400 w-28 shrink-0">
                    {t.label} — how much?
                  </span>
                  <div className="flex gap-1.5 flex-1">
                    {SEVERITY_LABELS.map((label, idx) => (
                      <button
                        key={label}
                        type="button"
                        aria-pressed={dragSeverity[t.id] === idx}
                        onClick={() =>
                          setDragSeverity((prev) => ({
                            ...prev,
                            [t.id]: prev[t.id] === idx ? null : idx,
                          }))
                        }
                        className={`flex-1 py-1.5 rounded-md text-xs font-semibold border transition-colors ${
                          dragSeverity[t.id] === idx
                            ? "bg-primary text-slate-900 border-primary"
                            : "bg-slate-800/50 border-slate-700 text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Quiet tier: pain, time, notes */}
          <div className="space-y-2 pt-1">
            <Disclosure
              open={painActive}
              onToggle={() => {
                if (drainedReason === "hurt") return; // required, can't dismiss
                setPainOpen(!painOpen);
                if (painOpen) {
                  setPainSeverity(null);
                  setPainLocations([]);
                }
              }}
              label={painActive ? "Pain or injury" : "Pain or injury?"}
            >
              <div>
                <FieldLabel hint="pick all that apply">Where?</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {PAIN_LOCATIONS.map((loc) => (
                    <Chip
                      key={loc.id}
                      selected={painLocations.includes(loc.id)}
                      onClick={() => {
                        toggleLocation(loc.id);
                        setValidationError(null);
                      }}
                    >
                      {loc.label}
                    </Chip>
                  ))}
                </div>
              </div>
              <div>
                <FieldLabel
                  hint={painSeverity != null ? `${painSeverity}/10` : "1 mild — 10 severe"}
                >
                  How bad?
                </FieldLabel>
                <div
                  className="flex gap-1.5 flex-wrap"
                  role="radiogroup"
                  aria-label="Pain severity"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => (
                    <button
                      key={v}
                      role="radio"
                      aria-checked={painSeverity === v}
                      onClick={() => {
                        setPainSeverity(v);
                        setValidationError(null);
                      }}
                      className={`w-10 h-10 rounded-lg text-sm font-bold transition-colors ${
                        painSeverity === v
                          ? "bg-primary text-slate-900"
                          : "bg-slate-800/50 text-slate-400 border border-slate-700 hover:border-slate-500"
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
                {painSeverity != null && painSeverity >= 7 && (
                  <p className="text-xs text-orange-300/90 mt-2">
                    At this level the engine will recommend injury-safe movement only.
                  </p>
                )}
              </div>
            </Disclosure>

            <Disclosure
              open={timeOpen}
              onToggle={() => {
                setTimeOpen(!timeOpen);
                if (timeOpen) setTimeMinutes(null);
              }}
              label="Short on time?"
            >
              <div className="flex flex-wrap gap-2">
                {TIME_OPTIONS.map((o) => (
                  <Chip
                    key={o.label}
                    selected={timeMinutes === o.minutes}
                    onClick={() =>
                      setTimeMinutes(timeMinutes === o.minutes ? null : o.minutes)
                    }
                  >
                    {o.label}
                  </Chip>
                ))}
              </div>
            </Disclosure>

            <Disclosure
              open={notesOpen}
              onToggle={() => setNotesOpen(!notesOpen)}
              label="Add a note"
            >
              <div>
                <input
                  type="text"
                  maxLength={500}
                  placeholder="Anything else worth knowing…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary"
                />
                <p className="text-xs text-slate-500 mt-1.5">
                  For your log — doesn't change today's session.
                </p>
              </div>
            </Disclosure>
          </div>

          {/* Save */}
          <div className="pt-1">
            <button
              onClick={handleSave}
              disabled={!canSave}
              className={`w-full sm:w-auto px-8 py-3 rounded-lg text-sm font-bold transition-colors active:scale-[0.98] ${
                canSave
                  ? "bg-primary hover:bg-primary-hover text-slate-900"
                  : "bg-slate-700/60 text-slate-500 cursor-not-allowed"
              }`}
            >
              {saving ? "Saving…" : "Save check-in"}
            </button>
            {(validationError || saveError) && (
              <p className="text-xs text-red-400 mt-2">{validationError ?? saveError}</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
