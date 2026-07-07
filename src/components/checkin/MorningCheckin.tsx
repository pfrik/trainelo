/**
 * Morning check-in v3 — one calm screen, always saveable.
 *
 * Design principles (vs. the legacy MorningCheckinFlow, kept for comparison
 * at /dashboard?checkin=legacy):
 * - Every path persists the mood: there is no "skip" that silently discards
 *   what the user already told us.
 * - Progressive disclosure only where it changes the engine's answer:
 *   drained requires a reason (API contract), pain requires severity.
 * - Plain, calm language — no protocols, no diagnosis, no alarms.
 * - After saving, the calibration result is shown right here: what changed
 *   and why.
 */

import { useMemo, useState } from "react";
import { Slider } from "@/components/ui/slider";
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

const EFFORT_OPTIONS: { label: string; rpe: number | null }[] = [
  { label: "Rest day", rpe: null },
  { label: "Easy", rpe: 3 },
  { label: "Moderate", rpe: 6 },
  { label: "Hard", rpe: 8 },
];

const TIME_OPTIONS: { label: string; minutes: number | null }[] = [
  { label: "As planned", minutes: null },
  { label: "30 min", minutes: 30 },
  { label: "45 min", minutes: 45 },
  { label: "60 min", minutes: 60 },
];

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

/** Optional "what's dragging" tags — map to calibrator driver rules. */
const DRAG_TAGS: Record<"tired" | "okay", { id: string; label: string }[]> = {
  tired: [
    { id: "poor_sleep", label: "Poor sleep" },
    { id: "heavy_legs", label: "Heavy legs" },
    { id: "low_energy", label: "Low energy" },
    { id: "mental_fog", label: "Mental fog" },
  ],
  okay: [
    { id: "life_stress", label: "Life stress" },
    { id: "motivation", label: "Low motivation" },
    { id: "minor_stiffness", label: "A bit stiff" },
    { id: "low_energy", label: "Low energy" },
  ],
};

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
  const [effortLabel, setEffortLabel] = useState<string | null>(null);
  const [timeMinutes, setTimeMinutes] = useState<number | null>(null);
  const [dragTags, setDragTags] = useState<string[]>([]);
  const [drainedReason, setDrainedReason] = useState<"sick" | "hurt" | "fried" | null>(null);
  const [painOpen, setPainOpen] = useState(false);
  const [painSeverity, setPainSeverity] = useState<number | null>(null);
  const [painLocations, setPainLocations] = useState<string[]>([]);
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

  const dragOptions = mood === "tired" || mood === "okay" ? DRAG_TAGS[mood] : null;

  const canSave = useMemo(() => {
    if (!mood || saving) return false;
    if (mood === "drained" && !drainedReason) return false;
    if (painActive && (painSeverity == null || painLocations.length === 0)) return false;
    return true;
  }, [mood, saving, drainedReason, painActive, painSeverity, painLocations]);

  const selectMood = (m: Mood) => {
    setMood(m);
    setValidationError(null);
    // Reset mood-specific answers; keep logistics (soreness/effort/time).
    setDrainedReason(null);
    setDragTags([]);
    setUpgradeType(null);
    if (m !== "drained") setPainOpen(false);
  };

  const toggleTag = (id: string) => {
    setDragTags((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
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
      setValidationError("For pain, pick a severity and at least one location.");
      return;
    }

    setValidationError(null);
    setSaving(true);
    setSaveError(null);

    const p: CheckinPayload = { mood };
    if (soreness > 0) p.soreness = soreness;
    const effortRpe = EFFORT_OPTIONS.find((o) => o.label === effortLabel)?.rpe ?? null;
    if (effortRpe != null) p.rpe = effortRpe;
    if (timeMinutes != null) p.time_constraint_minutes = timeMinutes;
    if (notes.trim()) p.notes = notes.trim();

    if (mood === "drained" && drainedReason) {
      p.reason_bucket = drainedReason;
      if (drainedReason === "sick") p.illness_flag = true;
    }
    if (dragTags.length > 0) p.reason_tags = dragTags;
    if (painActive && painSeverity != null) {
      p.pain_flag = true;
      p.pain_severity = painSeverity;
      p.pain_locations = painLocations;
    }
    if (mood === "great" && upgradeType) {
      p.payload = { upgrade_type: upgradeType };
    }

    try {
      const res = await onSubmit(p);
      setResult(res && "calibration" in (res as CheckinSubmitResult) ? (res as CheckinSubmitResult).calibration : null);
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
      {/* Mood */}
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
          {/* Drained: what's behind it (required by the engine) */}
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

          {/* Optional drag tags for tired / okay */}
          {dragOptions && (
            <div>
              <FieldLabel hint="optional">Anything dragging?</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {dragOptions.map((t) => (
                  <Chip key={t.id} selected={dragTags.includes(t.id)} onClick={() => toggleTag(t.id)}>
                    {t.label}
                  </Chip>
                ))}
              </div>
            </div>
          )}

          {/* Soreness */}
          <div>
            <FieldLabel hint={soreness > 0 ? `${soreness}/10` : "0 — none"}>
              Muscle soreness
            </FieldLabel>
            <Slider
              value={[soreness]}
              onValueChange={([v]) => setSoreness(v)}
              min={0}
              max={10}
              step={1}
              aria-label="Muscle soreness"
            />
          </div>

          {/* Yesterday's effort */}
          <div>
            <FieldLabel hint="optional">Yesterday's effort</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {EFFORT_OPTIONS.map((o) => (
                <Chip
                  key={o.label}
                  selected={effortLabel === o.label}
                  onClick={() => setEffortLabel(effortLabel === o.label ? null : o.label)}
                >
                  {o.label}
                </Chip>
              ))}
            </div>
          </div>

          {/* Time available */}
          <div>
            <FieldLabel>Time today</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {TIME_OPTIONS.map((o) => (
                <Chip
                  key={o.label}
                  selected={timeMinutes === o.minutes}
                  onClick={() => setTimeMinutes(o.minutes)}
                >
                  {o.label}
                </Chip>
              ))}
            </div>
          </div>

          {/* Pain (available in every mood; required details when open) */}
          <div>
            <button
              type="button"
              onClick={() => {
                if (drainedReason === "hurt") return; // required, can't dismiss
                setPainOpen(!painOpen);
                if (painOpen) {
                  setPainSeverity(null);
                  setPainLocations([]);
                }
              }}
              className="flex items-center gap-1.5 text-sm font-semibold text-slate-300 hover:text-white transition-colors"
              aria-expanded={painActive}
            >
              <span className="material-symbols-outlined text-lg text-slate-400" aria-hidden>
                {painActive ? "expand_less" : "expand_more"}
              </span>
              {painActive ? "Pain or injury" : "Pain or injury?"}
            </button>

            {painActive && (
              <div className="mt-3 space-y-4 border-l-2 border-slate-700 pl-4">
                <div>
                  <FieldLabel
                    hint={painSeverity != null ? `${painSeverity}/10` : "1 mild — 10 severe"}
                  >
                    How bad?
                  </FieldLabel>
                  <div className="flex gap-1.5 flex-wrap" role="radiogroup" aria-label="Pain severity">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => (
                      <button
                        key={v}
                        role="radio"
                        aria-checked={painSeverity === v}
                        onClick={() => {
                          setPainSeverity(v);
                          setValidationError(null);
                        }}
                        className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${
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
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            {!notesOpen ? (
              <button
                type="button"
                onClick={() => setNotesOpen(true)}
                className="flex items-center gap-1.5 text-sm font-semibold text-slate-400 hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined text-lg" aria-hidden>
                  add
                </span>
                Add a note
              </button>
            ) : (
              <input
                type="text"
                maxLength={500}
                autoFocus
                placeholder="Anything else worth knowing…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary"
              />
            )}
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
