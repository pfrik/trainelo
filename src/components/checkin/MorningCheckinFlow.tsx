import { useState, useCallback } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Mood = "drained" | "tired" | "okay" | "good" | "great";
type ReasonBucket = "sick" | "hurt" | "fried";
type RecoveryType = "full_rest" | "active_recovery";

interface CheckinPayload {
  mood: Mood;
  rpe?: number;
  soreness?: number;
  pain_flag?: boolean;
  illness_flag?: boolean;
  notes?: string;
  reason_bucket?: string;
  pain_severity?: number;
  pain_locations?: string[];
  time_constraint_minutes?: number;
  reason_tags?: string[];
  payload?: Record<string, unknown>;
}

interface MorningCheckinFlowProps {
  onSubmit: (payload: CheckinPayload) => Promise<void>;
  /** Wearable readiness from evidence, for "great" upgrade warning */
  wearableReadiness?: "red" | "yellow" | "green" | null;
}

type Step = "mood" | "protocol";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MOOD_CONFIG: {
  value: Mood;
  label: string;
  icon: string;
  color: string;
  activeClass: string;
}[] = [
  { value: "drained", label: "Drained", icon: "battery_alert", color: "text-red-400", activeClass: "border-red-500 bg-red-500/20" },
  { value: "tired", label: "Tired", icon: "sentiment_dissatisfied", color: "text-orange-400", activeClass: "border-orange-500 bg-orange-500/20" },
  { value: "okay", label: "Okay", icon: "sentiment_neutral", color: "text-yellow-400", activeClass: "border-yellow-500 bg-yellow-500/20" },
  { value: "good", label: "Good", icon: "sentiment_satisfied", color: "text-emerald-400", activeClass: "border-emerald-500 bg-emerald-500/20" },
  { value: "great", label: "Great", icon: "sentiment_very_satisfied", color: "text-green-400", activeClass: "border-green-500 bg-green-500/20" },
];

const BUCKET_CARDS: {
  value: ReasonBucket;
  title: string;
  description: string;
  icon: string;
  tags: string[];
}[] = [
  {
    value: "sick",
    title: "I'm Sick",
    description: "Dealing with an illness or fighting something off.",
    icon: "sick",
    tags: ["FEVER", "FLU", "STOMACH BUG"],
  },
  {
    value: "hurt",
    title: "I'm Hurt",
    description: "Acute pain or physical limitations affecting movement.",
    icon: "personal_injury",
    tags: ["ACUTE PAIN", "INJURY", "STRAIN"],
  },
  {
    value: "fried",
    title: "Just Fried",
    description: "Systemic fatigue, burnout, or severely compromised recovery.",
    icon: "electric_bolt",
    tags: ["BURNOUT", "BAD SLEEP", "LIFE STRESS"],
  },
];

const PAIN_LOCATIONS = [
  { id: "foot_ankle", label: "Foot/Ankle", icon: "do_not_step" },
  { id: "knee", label: "Knee", icon: "airline_seat_legroom_normal" },
  { id: "hip_glute", label: "Hip/Glute", icon: "directions_walk" },
  { id: "back", label: "Back", icon: "straighten" },
  { id: "shoulder", label: "Shoulder", icon: "back_hand" },
  { id: "other", label: "Other", icon: "add" },
];

const SICK_TAGS = [
  { id: "fever", label: "Fever" },
  { id: "flu", label: "Flu" },
  { id: "stomach_bug", label: "Stomach Bug" },
  { id: "other", label: "Other" },
];

const FRIED_TAGS = [
  { id: "burnout", label: "Burnout" },
  { id: "bad_sleep", label: "Bad Sleep" },
  { id: "life_stress", label: "Life Stress" },
];

const TIRED_REASON_TAGS = ["sleep", "stress", "soreness", "meh"];

const SORENESS_OPTIONS = [
  { label: "Mild (1-3)", value: 2 },
  { label: "Moderate (4-6)", value: 5 },
  { label: "Severe (7-10)", value: 8 },
];

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function MorningCheckinFlow({ onSubmit, wearableReadiness }: MorningCheckinFlowProps) {
  const [step, setStep] = useState<Step>("mood");
  const [mood, setMood] = useState<Mood | null>(null);

  // Red protocol state
  const [redStep, setRedStep] = useState<1 | 2>(1);
  const [reasonBucket, setReasonBucket] = useState<ReasonBucket | null>(null);

  // Red: hurt fields
  const [painSeverity, setPainSeverity] = useState<number | null>(null);
  const [painLocations, setPainLocations] = useState<string[]>([]);
  const [hurtSoreness, setHurtSoreness] = useState<number | null>(null);

  // Red: sick fields
  const [sickTags, setSickTags] = useState<string[]>([]);

  // Red: fried fields
  const [friedTags, setFriedTags] = useState<string[]>([]);
  const [recoveryType, setRecoveryType] = useState<RecoveryType | null>(null);

  // Red: shared optional
  const [timeConstraint, setTimeConstraint] = useState<number | null>(null);
  const [customTime, setCustomTime] = useState("");
  const [redNotes, setRedNotes] = useState("");
  const [redErrors, setRedErrors] = useState<Record<string, string>>({});

  // Non-drained protocol fields
  const [reasonTags, setReasonTags] = useState<string[]>([]);
  const [nonRedTimeConstraint, setNonRedTimeConstraint] = useState("");
  const [niggle, setNiggle] = useState<boolean | null>(null);
  const [niggleLocation, setNiggleLocation] = useState("");
  const [upgradeIntent, setUpgradeIntent] = useState<boolean | null>(null);

  // Optional fields (non-drained)
  const [rpe, setRpe] = useState("");
  const [soreness, setSoreness] = useState("");
  const [notes, setNotes] = useState("");

  // Submit state
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleMoodSelect = useCallback((m: Mood) => {
    setMood(m);
    setReasonBucket(null);
    setPainSeverity(null);
    setPainLocations([]);
    setHurtSoreness(null);
    setSickTags([]);
    setFriedTags([]);
    setRecoveryType(null);
    setTimeConstraint(null);
    setCustomTime("");
    setRedNotes("");
    setRedErrors({});
    setRedStep(1);
    setReasonTags([]);
    setNonRedTimeConstraint("");
    setNiggle(null);
    setNiggleLocation("");
    setUpgradeIntent(null);
    setStep("protocol");
  }, []);

  const handleRedStep1Next = useCallback(() => {
    if (!reasonBucket) {
      setRedErrors({ bucket: "Please choose one option to continue." });
      return;
    }
    setRedErrors({});
    setRedStep(2);
  }, [reasonBucket]);

  const handleRedBack = useCallback(() => {
    setRedErrors({});
    setRedStep(1);
  }, []);

  const handleRedClose = useCallback(() => {
    setStep("mood");
    setRedErrors({});
  }, []);

  const handleSkip = useCallback(() => {
    setSkipped(true);
  }, []);

  const togglePainLocation = useCallback((loc: string) => {
    setPainLocations((prev) =>
      prev.includes(loc) ? prev.filter((l) => l !== loc) : [...prev, loc],
    );
  }, []);

  const toggleArrayItem = useCallback(
    (setter: React.Dispatch<React.SetStateAction<string[]>>, item: string) => {
      setter((prev) =>
        prev.includes(item) ? prev.filter((t) => t !== item) : [...prev, item],
      );
    },
    [],
  );

  const toggleReasonTag = useCallback((tag: string) => {
    setReasonTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }, []);

  // Red protocol submit
  const handleRedSubmit = useCallback(async () => {
    if (!mood || mood !== "drained" || !reasonBucket) return;

    if (reasonBucket === "hurt") {
      const errors: Record<string, string> = {};
      if (painSeverity === null || painSeverity < 1) {
        errors.pain_severity = "Select pain severity.";
      }
      if (painLocations.length === 0) {
        errors.pain_locations = "Select at least one pain location.";
      }
      if (Object.keys(errors).length > 0) {
        setRedErrors(errors);
        return;
      }
    }

    setRedErrors({});
    setSaving(true);
    setSaveError(null);

    const p: CheckinPayload = { mood: "drained", reason_bucket: reasonBucket };

    const effectiveTime =
      timeConstraint === -1 ? parseInt(customTime, 10) || null : timeConstraint;
    if (effectiveTime && effectiveTime > 0) {
      p.time_constraint_minutes = effectiveTime;
    }
    if (redNotes.trim()) p.notes = redNotes.trim();

    if (reasonBucket === "sick") {
      p.illness_flag = true;
      if (sickTags.length > 0) p.reason_tags = sickTags;
    } else if (reasonBucket === "hurt") {
      p.pain_flag = true;
      p.pain_severity = painSeverity!;
      p.pain_locations = painLocations;
      if (hurtSoreness !== null) p.soreness = hurtSoreness;
    } else if (reasonBucket === "fried") {
      if (friedTags.length > 0) p.reason_tags = friedTags;
      if (recoveryType) p.payload = { recovery_type: recoveryType };
    }

    try {
      await onSubmit(p);
      setSaved(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [
    mood, reasonBucket, painSeverity, painLocations, hurtSoreness,
    sickTags, friedTags, recoveryType, timeConstraint, customTime,
    redNotes, onSubmit,
  ]);

  // Non-drained submit
  const handleNonRedSubmit = useCallback(async () => {
    if (!mood || mood === "drained") return;
    setSaving(true);
    setSaveError(null);

    const p: CheckinPayload = { mood };

    if (mood === "good" && niggle) p.pain_flag = true;

    const tc = parseInt(nonRedTimeConstraint, 10);
    if (tc > 0) p.time_constraint_minutes = tc;

    if ((mood === "tired" || mood === "okay") && reasonTags.length > 0) {
      p.reason_tags = reasonTags;
    }

    const rpeNum = parseInt(rpe, 10);
    if (rpeNum >= 1 && rpeNum <= 10) p.rpe = rpeNum;
    const soreNum = parseInt(soreness, 10);
    if (soreNum >= 0 && soreNum <= 10) p.soreness = soreNum;
    if (notes.trim()) p.notes = notes.trim();

    try {
      await onSubmit(p);
      setSaved(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [mood, niggle, nonRedTimeConstraint, reasonTags, rpe, soreness, notes, onSubmit]);

  // ---------------------------------------------------------------------------
  // Render: Saved
  // ---------------------------------------------------------------------------

  if (saved) {
    return (
      <div className="flex items-center gap-2 py-2">
        <span className="material-symbols-outlined text-green-400 text-xl" style={{ fontVariationSettings: '"FILL" 1' }}>check_circle</span>
        <span className="text-green-400 text-sm font-medium">Check-in saved</span>
        <span className="text-slate-500 text-sm capitalize">({mood})</span>
      </div>
    );
  }

  if (skipped) {
    return (
      <div className="flex items-center gap-2 py-2">
        <span className="material-symbols-outlined text-slate-500 text-xl" style={{ fontVariationSettings: '"FILL" 1' }}>skip_next</span>
        <span className="text-slate-400 text-sm font-medium">Check-in skipped for now</span>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Mood selection
  // ---------------------------------------------------------------------------

  if (step === "mood") {
    return (
      <div className="grid grid-cols-5 gap-2 sm:gap-3">
        {MOOD_CONFIG.map((m) => (
          <button
            key={m.value}
            onClick={() => handleMoodSelect(m.value)}
            className={`flex flex-col items-center justify-center p-2 sm:p-3 rounded-xl bg-slate-800/50 hover:bg-opacity-20 border border-slate-700 hover:border-opacity-100 transition-all group active:scale-95 ${
              mood === m.value ? m.activeClass : ""
            }`}
          >
            <span
              className={`material-symbols-outlined ${m.color} mb-1 group-hover:scale-110 transition-transform text-2xl`}
              style={{ fontVariationSettings: '"FILL" 1' }}
            >
              {m.icon}
            </span>
            <span className="text-[10px] sm:text-xs font-medium text-slate-300 group-hover:text-white">
              {m.label}
            </span>
          </button>
        ))}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Red Protocol (mood === "drained")
  // ---------------------------------------------------------------------------

  if (mood === "drained") {
    return (
      <div className="space-y-4">
        {/* Header bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
            <span className="text-xs font-bold text-red-400 uppercase tracking-wider">
              Red Protocol
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">Step {redStep} of 2</span>
            <button
              onClick={handleRedClose}
              className="text-slate-500 hover:text-slate-300 transition-colors"
              aria-label="Close red protocol"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        {/* ---- Step 1: Choose bucket ---- */}
        {redStep === 1 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-bold text-white">
                Oh no. What&apos;s going on?
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-slate-400">
                  Identify the issue so we can calibrate your load.
                </span>
                <span className="text-[10px] font-bold text-red-400 border border-red-500/40 px-1.5 py-0.5 rounded uppercase">
                  Required
                </span>
              </div>
            </div>

            <div className="space-y-3" role="radiogroup" aria-label="Issue type">
              {BUCKET_CARDS.map((card) => {
                const sel = reasonBucket === card.value;
                return (
                  <button
                    key={card.value}
                    onClick={() => {
                      setReasonBucket(card.value);
                      setRedErrors({});
                    }}
                    role="radio"
                    aria-checked={sel}
                    tabIndex={0}
                    className={`w-full text-left rounded-xl p-4 border transition-all ${
                      sel
                        ? "border-red-500/60 bg-red-500/10"
                        : "border-slate-700 bg-slate-800/50 hover:border-slate-500"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                          sel ? "bg-red-500/20" : "bg-slate-700/50"
                        }`}
                      >
                        <span
                          className={`material-symbols-outlined text-lg ${sel ? "text-red-400" : "text-slate-400"}`}
                          style={{ fontVariationSettings: '"FILL" 1' }}
                        >
                          {card.icon}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white text-sm">
                            {card.title}
                          </span>
                          <div
                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                              sel ? "border-red-400" : "border-slate-600"
                            }`}
                          >
                            {sel && (
                              <div className="w-2 h-2 rounded-full bg-red-400" />
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {card.description}
                        </p>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {card.tags.map((tag) => (
                            <span
                              key={tag}
                              className="text-[10px] font-medium text-slate-500 bg-slate-700/50 px-2 py-0.5 rounded uppercase tracking-wide"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {redErrors.bucket && (
              <p className="text-xs text-red-400 flex items-center gap-1">
                <span
                  className="material-symbols-outlined text-sm"
                  style={{ fontVariationSettings: '"FILL" 1' }}
                >
                  error
                </span>
                {redErrors.bucket}
              </p>
            )}

            <div className="flex items-center justify-between pt-1">
              <button
                onClick={handleSkip}
                className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
              >
                Skip for now
              </button>
              <button
                onClick={handleRedStep1Next}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-green-500 hover:bg-green-400 text-slate-900 transition-all flex items-center gap-2"
              >
                Next
                <span className="material-symbols-outlined text-base">
                  arrow_forward
                </span>
              </button>
            </div>
          </div>
        )}

        {/* ---- Step 2: Branch forms ---- */}
        {redStep === 2 && reasonBucket === "hurt" && (
          <HurtForm
            painSeverity={painSeverity}
            setPainSeverity={setPainSeverity}
            painLocations={painLocations}
            togglePainLocation={togglePainLocation}
            hurtSoreness={hurtSoreness}
            setHurtSoreness={setHurtSoreness}
            timeConstraint={timeConstraint}
            setTimeConstraint={setTimeConstraint}
            customTime={customTime}
            setCustomTime={setCustomTime}
            notes={redNotes}
            setNotes={setRedNotes}
            errors={redErrors}
            saving={saving}
            saveError={saveError}
            onBack={handleRedBack}
            onSubmit={handleRedSubmit}
            onSkip={handleSkip}
          />
        )}
        {redStep === 2 && reasonBucket === "sick" && (
          <SickForm
            tags={sickTags}
            toggleTag={(tag) => toggleArrayItem(setSickTags, tag)}
            timeConstraint={timeConstraint}
            setTimeConstraint={setTimeConstraint}
            customTime={customTime}
            setCustomTime={setCustomTime}
            notes={redNotes}
            setNotes={setRedNotes}
            saving={saving}
            saveError={saveError}
            onBack={handleRedBack}
            onSubmit={handleRedSubmit}
            onSkip={handleSkip}
          />
        )}
        {redStep === 2 && reasonBucket === "fried" && (
          <FriedForm
            recoveryType={recoveryType}
            setRecoveryType={setRecoveryType}
            tags={friedTags}
            toggleTag={(tag) => toggleArrayItem(setFriedTags, tag)}
            notes={redNotes}
            setNotes={setRedNotes}
            saving={saving}
            saveError={saveError}
            onBack={handleRedBack}
            onSubmit={handleRedSubmit}
            onSkip={handleSkip}
          />
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Non-drained protocol (tired / okay / good / great)
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-4">
      {mood && (
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs text-slate-500 uppercase tracking-wide">Mood:</span>
          <span className="text-sm text-white font-medium capitalize">{mood}</span>
          <button
            onClick={() => {
              setStep("mood");
              setSaved(false);
              setSaveError(null);
            }}
            className="text-xs text-slate-500 hover:text-slate-300 underline"
          >
            change
          </button>
        </div>
      )}

      <div className="space-y-3">
        {/* Tired / Okay */}
        {(mood === "tired" || mood === "okay") && (
          <div className="space-y-3">
            <div className="text-xs text-slate-400 uppercase tracking-wide">
              Any specific reasons? (optional)
            </div>
            <div className="flex flex-wrap gap-2">
              {TIRED_REASON_TAGS.map((tag) => (
                <button
                  key={tag}
                  onClick={() => toggleReasonTag(tag)}
                  tabIndex={0}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    reasonTags.includes(tag)
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                      : "bg-slate-800/50 text-slate-400 border border-slate-700 hover:text-slate-200"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">
                Time constraint (minutes, optional)
              </label>
              <input
                type="number"
                min={1}
                placeholder="e.g. 30"
                value={nonRedTimeConstraint}
                onChange={(e) => setNonRedTimeConstraint(e.target.value)}
                className="w-24 bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-slate-500"
              />
            </div>
          </div>
        )}

        {/* Good */}
        {mood === "good" && (
          <div className="space-y-3">
            <div className="text-xs text-slate-400 uppercase tracking-wide">
              Any niggle today?
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setNiggle(false)}
                tabIndex={0}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  niggle === false
                    ? "bg-green-500/20 text-green-300 border border-green-500/40"
                    : "bg-slate-800/50 text-slate-400 border border-slate-700 hover:text-slate-200"
                }`}
              >
                No
              </button>
              <button
                onClick={() => setNiggle(true)}
                tabIndex={0}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  niggle === true
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                    : "bg-slate-800/50 text-slate-400 border border-slate-700 hover:text-slate-200"
                }`}
              >
                Yes
              </button>
            </div>
            {niggle && (
              <div>
                <label className="text-xs text-slate-400 block mb-1">
                  Where? (optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. left knee"
                  value={niggleLocation}
                  onChange={(e) => setNiggleLocation(e.target.value)}
                  className="w-48 bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-slate-500"
                />
              </div>
            )}
            <div>
              <label className="text-xs text-slate-400 block mb-1">
                Time constraint (minutes, optional)
              </label>
              <input
                type="number"
                min={1}
                placeholder="e.g. 30"
                value={nonRedTimeConstraint}
                onChange={(e) => setNonRedTimeConstraint(e.target.value)}
                className="w-24 bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-slate-500"
              />
            </div>
          </div>
        )}

        {/* Great */}
        {mood === "great" && (
          <div className="space-y-3">
            <div className="text-xs text-slate-400 uppercase tracking-wide">
              Push harder today?
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setUpgradeIntent(true)}
                tabIndex={0}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  upgradeIntent === true
                    ? "bg-green-500/20 text-green-300 border border-green-500/40"
                    : "bg-slate-800/50 text-slate-400 border border-slate-700 hover:text-slate-200"
                }`}
              >
                Yes, upgrade
              </button>
              <button
                onClick={() => setUpgradeIntent(false)}
                tabIndex={0}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  upgradeIntent === false
                    ? "bg-slate-600/30 text-slate-300 border border-slate-500/40"
                    : "bg-slate-800/50 text-slate-400 border border-slate-700 hover:text-slate-200"
                }`}
              >
                Stick to plan
              </button>
            </div>
            {upgradeIntent && wearableReadiness === "red" && (
              <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                <span
                  className="material-symbols-outlined text-amber-400 text-lg flex-shrink-0"
                  style={{ fontVariationSettings: '"FILL" 1' }}
                >
                  warning
                </span>
                <span className="text-xs text-amber-300 leading-relaxed">
                  Wearable data shows low recovery. Upgrade intent noted, but
                  intensity will be capped for safety.
                </span>
              </div>
            )}
          </div>
        )}

        {/* Optional fields */}
        <OptionalFields
          rpe={rpe}
          setRpe={setRpe}
          soreness={soreness}
          setSoreness={setSoreness}
          notes={notes}
          setNotes={setNotes}
        />

        {/* Submit */}
        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={handleNonRedSubmit}
            disabled={saving}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              !saving
                ? "bg-primary hover:bg-primary-hover text-slate-900"
                : "bg-slate-700 text-slate-500 cursor-not-allowed"
            }`}
          >
            {saving ? "Saving..." : "Save check-in"}
          </button>
          {saveError && (
            <span className="text-xs text-red-400">{saveError}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Red Protocol: Hurt Form (Step 2)
// ---------------------------------------------------------------------------

function HurtForm({
  painSeverity,
  setPainSeverity,
  painLocations,
  togglePainLocation,
  hurtSoreness,
  setHurtSoreness,
  timeConstraint,
  setTimeConstraint,
  customTime,
  setCustomTime,
  notes,
  setNotes,
  errors,
  saving,
  saveError,
  onBack,
  onSubmit,
  onSkip,
}: {
  painSeverity: number | null;
  setPainSeverity: (v: number) => void;
  painLocations: string[];
  togglePainLocation: (loc: string) => void;
  hurtSoreness: number | null;
  setHurtSoreness: (v: number | null) => void;
  timeConstraint: number | null;
  setTimeConstraint: (v: number | null) => void;
  customTime: string;
  setCustomTime: (v: string) => void;
  notes: string;
  setNotes: (v: string) => void;
  errors: Record<string, string>;
  saving: boolean;
  saveError: string | null;
  onBack: () => void;
  onSubmit: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-bold text-white">Injury Report</h3>
        <p className="text-sm text-slate-400 mt-0.5">
          Details help us adjust your training load.
        </p>
      </div>

      {/* Pain Severity */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-bold text-slate-300 uppercase tracking-wide">
            Pain Severity
          </label>
          <span
            className={`text-lg font-bold ${painSeverity !== null ? "text-green-400" : "text-slate-600"}`}
          >
            {painSeverity !== null ? painSeverity : "\u2014"}
            <span className="text-xs text-slate-500 font-normal ml-0.5">
              /10
            </span>
          </span>
        </div>
        <div className="flex gap-1.5" role="radiogroup" aria-label="Pain severity from 1 to 10">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => {
            const sel = painSeverity === v;
            return (
              <button
                key={v}
                onClick={() => setPainSeverity(v)}
                role="radio"
                aria-checked={sel}
                tabIndex={0}
                className={`w-8 h-8 rounded-lg text-xs font-bold transition-all flex-shrink-0 ${
                  sel
                    ? v <= 3
                      ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/50"
                      : v <= 6
                        ? "bg-orange-500/20 text-orange-300 border border-orange-500/50"
                        : "bg-red-500/20 text-red-300 border border-red-500/50"
                    : "bg-slate-800/50 text-slate-500 border border-slate-700 hover:border-slate-500 hover:text-slate-300"
                }`}
              >
                {v}
              </button>
            );
          })}
        </div>
        <div className="flex justify-between text-[10px] text-slate-500 mt-1 px-1">
          <span>Mild</span>
          <span>Moderate</span>
          <span>Severe</span>
        </div>
        {errors.pain_severity && (
          <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
            <span
              className="material-symbols-outlined text-sm"
              style={{ fontVariationSettings: '"FILL" 1' }}
            >
              error
            </span>
            {errors.pain_severity}
          </p>
        )}
      </div>

      {/* Pain Location */}
      <div>
        <label className="text-xs font-bold text-slate-300 uppercase tracking-wide">
          Pain Location{" "}
          <span className="font-normal text-slate-500 normal-case">
            (Select all that apply)
          </span>
        </label>
        <div className="grid grid-cols-3 gap-2 mt-2">
          {PAIN_LOCATIONS.map((loc) => {
            const sel = painLocations.includes(loc.id);
            return (
              <button
                key={loc.id}
                onClick={() => togglePainLocation(loc.id)}
                role="checkbox"
                aria-checked={sel}
                tabIndex={0}
                className={`flex flex-col items-center justify-center py-3 px-2 rounded-lg border transition-all ${
                  sel
                    ? "border-green-500/50 bg-green-500/10 text-white"
                    : "border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-500"
                }`}
              >
                <span
                  className={`material-symbols-outlined text-xl mb-1 ${sel ? "text-green-400" : "text-slate-500"}`}
                  style={{ fontVariationSettings: '"FILL" 1' }}
                >
                  {loc.icon}
                </span>
                <span className="text-xs font-medium">{loc.label}</span>
              </button>
            );
          })}
        </div>
        {errors.pain_locations && (
          <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
            <span
              className="material-symbols-outlined text-sm"
              style={{ fontVariationSettings: '"FILL" 1' }}
            >
              error
            </span>
            {errors.pain_locations}
          </p>
        )}
      </div>

      {/* RPE / Soreness + Time Constraint */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-bold text-slate-300 uppercase tracking-wide block mb-2">
            RPE / Soreness
          </label>
          <select
            value={hurtSoreness ?? ""}
            onChange={(e) =>
              setHurtSoreness(e.target.value ? parseInt(e.target.value, 10) : null)
            }
            className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-slate-500"
          >
            <option value="">Select...</option>
            {SORENESS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <TimeConstraintSelector
          value={timeConstraint}
          onChange={setTimeConstraint}
          customTime={customTime}
          onCustomChange={setCustomTime}
        />
      </div>

      {/* Notes */}
      <div>
        <label className="text-xs font-bold text-slate-300 uppercase tracking-wide block mb-2">
          Notes
        </label>
        <textarea
          rows={3}
          maxLength={500}
          placeholder="Describe the pain type (sharp, dull, throbbing) or specific movements that trigger it..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-slate-500 resize-none"
        />
      </div>

      <RedFormFooter
        saving={saving}
        saveError={saveError}
        onBack={onBack}
        onSubmit={onSubmit}
        onSkip={onSkip}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Red Protocol: Sick Form (Step 2)
// ---------------------------------------------------------------------------

function SickForm({
  tags,
  toggleTag,
  timeConstraint,
  setTimeConstraint,
  customTime,
  setCustomTime,
  notes,
  setNotes,
  saving,
  saveError,
  onBack,
  onSubmit,
  onSkip,
}: {
  tags: string[];
  toggleTag: (tag: string) => void;
  timeConstraint: number | null;
  setTimeConstraint: (v: number | null) => void;
  customTime: string;
  setCustomTime: (v: string) => void;
  notes: string;
  setNotes: (v: string) => void;
  saving: boolean;
  saveError: string | null;
  onBack: () => void;
  onSubmit: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-bold text-white">Sickness Details</h3>
        <p className="text-sm text-slate-400 mt-0.5">
          Help us understand what you&apos;re dealing with.
        </p>
      </div>

      {/* Symptom tags */}
      <div>
        <label className="text-xs font-bold text-slate-300 uppercase tracking-wide block mb-2">
          Symptoms (optional)
        </label>
        <div className="flex flex-wrap gap-2">
          {SICK_TAGS.map((t) => {
            const sel = tags.includes(t.id);
            return (
              <button
                key={t.id}
                onClick={() => toggleTag(t.id)}
                role="checkbox"
                aria-checked={sel}
                tabIndex={0}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  sel
                    ? "bg-red-500/20 text-red-300 border border-red-500/40"
                    : "bg-slate-800/50 text-slate-400 border border-slate-700 hover:text-slate-200"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Time constraint */}
      <TimeConstraintSelector
        value={timeConstraint}
        onChange={setTimeConstraint}
        customTime={customTime}
        onCustomChange={setCustomTime}
        showAsPlanned
      />

      {/* Notes */}
      <div>
        <label className="text-xs font-bold text-slate-300 uppercase tracking-wide block mb-2">
          Notes (optional)
        </label>
        <textarea
          rows={3}
          maxLength={500}
          placeholder="Any additional details about how you're feeling..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-slate-500 resize-none"
        />
      </div>

      <RedFormFooter
        saving={saving}
        saveError={saveError}
        onBack={onBack}
        onSubmit={onSubmit}
        onSkip={onSkip}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Red Protocol: Fried Form (Step 2)
// ---------------------------------------------------------------------------

function FriedForm({
  recoveryType,
  setRecoveryType,
  tags,
  toggleTag,
  notes,
  setNotes,
  saving,
  saveError,
  onBack,
  onSubmit,
  onSkip,
}: {
  recoveryType: RecoveryType | null;
  setRecoveryType: (v: RecoveryType) => void;
  tags: string[];
  toggleTag: (tag: string) => void;
  notes: string;
  setNotes: (v: string) => void;
  saving: boolean;
  saveError: string | null;
  onBack: () => void;
  onSubmit: () => void;
  onSkip: () => void;
}) {
  const RECOVERY_OPTIONS: {
    value: RecoveryType;
    label: string;
    icon: string;
    desc: string;
  }[] = [
    {
      value: "full_rest",
      label: "Full Rest",
      icon: "hotel",
      desc: "Complete cessation of activity. Focus on sleep & hydration.",
    },
    {
      value: "active_recovery",
      label: "Active Recovery",
      icon: "directions_walk",
      desc: "Low intensity movement to stimulate blood flow.",
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-bold text-white">Burnout Options</h3>
        <p className="text-sm text-slate-400 mt-0.5">
          Select your recovery path for today.
        </p>
      </div>

      {/* Recovery type */}
      <div>
        <label className="text-xs font-bold text-slate-300 uppercase tracking-wide block mb-2">
          Select Recovery Type
        </label>
        <div className="grid grid-cols-2 gap-3">
          {RECOVERY_OPTIONS.map((opt) => {
            const sel = recoveryType === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setRecoveryType(opt.value)}
                role="radio"
                aria-checked={sel}
                tabIndex={0}
                className={`flex flex-col items-center text-center p-4 rounded-xl border transition-all ${
                  sel
                    ? "border-green-500/50 bg-green-500/10"
                    : "border-slate-700 bg-slate-800/50 hover:border-slate-500"
                }`}
              >
                <span
                  className={`material-symbols-outlined text-2xl mb-2 ${sel ? "text-green-400" : "text-slate-500"}`}
                  style={{ fontVariationSettings: '"FILL" 1' }}
                >
                  {opt.icon}
                </span>
                <span
                  className={`text-sm font-bold ${sel ? "text-white" : "text-slate-300"}`}
                >
                  {opt.label}
                </span>
                <span className="text-[11px] text-slate-500 mt-1 leading-snug">
                  {opt.desc}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tags */}
      <div>
        <label className="text-xs font-bold text-slate-300 uppercase tracking-wide block mb-2">
          Contributing Factors (optional)
        </label>
        <div className="flex flex-wrap gap-2">
          {FRIED_TAGS.map((t) => {
            const sel = tags.includes(t.id);
            return (
              <button
                key={t.id}
                onClick={() => toggleTag(t.id)}
                role="checkbox"
                aria-checked={sel}
                tabIndex={0}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  sel
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                    : "bg-slate-800/50 text-slate-400 border border-slate-700 hover:text-slate-200"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="text-xs font-bold text-slate-300 uppercase tracking-wide block mb-2">
          Notes (optional)
        </label>
        <textarea
          rows={3}
          maxLength={500}
          placeholder="Add any details about your fatigue levels, sleep quality, or specific areas of soreness..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-slate-500 resize-none"
        />
      </div>

      <RedFormFooter
        saving={saving}
        saveError={saveError}
        onBack={onBack}
        onSubmit={onSubmit}
        onSkip={onSkip}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared: Time Constraint Selector
// ---------------------------------------------------------------------------

function TimeConstraintSelector({
  value,
  onChange,
  customTime,
  onCustomChange,
  showAsPlanned,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  customTime: string;
  onCustomChange: (v: string) => void;
  showAsPlanned?: boolean;
}) {
  const isCustom = value === -1;
  return (
    <div>
      <label className="text-xs font-bold text-slate-300 uppercase tracking-wide block mb-2">
        Time Constraint
      </label>
      <div className="flex flex-wrap gap-2">
        {showAsPlanned && (
          <button
            onClick={() => onChange(null)}
            tabIndex={0}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              value === null
                ? "bg-green-500/20 text-green-300 border border-green-500/40"
                : "bg-slate-800/50 text-slate-400 border border-slate-700 hover:text-slate-200"
            }`}
          >
            As planned
          </button>
        )}
        {[30, 45].map((mins) => (
          <button
            key={mins}
            onClick={() => onChange(mins)}
            tabIndex={0}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              value === mins
                ? "bg-green-500/20 text-green-300 border border-green-500/40"
                : "bg-slate-800/50 text-slate-400 border border-slate-700 hover:text-slate-200"
            }`}
          >
            {mins}m
          </button>
        ))}
        <button
          onClick={() => onChange(-1)}
          tabIndex={0}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
            isCustom
              ? "bg-green-500/20 text-green-300 border border-green-500/40"
              : "bg-slate-800/50 text-slate-400 border border-slate-700 hover:text-slate-200"
          }`}
        >
          Custom
        </button>
      </div>
      {isCustom && (
        <input
          type="number"
          min={1}
          placeholder="Minutes"
          value={customTime}
          onChange={(e) => onCustomChange(e.target.value)}
          className="mt-2 w-24 bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-slate-500"
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared: Red Protocol Form Footer
// ---------------------------------------------------------------------------

function RedFormFooter({
  saving,
  saveError,
  onBack,
  onSubmit,
  onSkip,
}: {
  saving: boolean;
  saveError: string | null;
  onBack: () => void;
  onSubmit: () => void;
  onSkip?: () => void;
}) {
  return (
    <div className="space-y-2 pt-2">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          disabled={saving}
          className="text-sm text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Back
        </button>
        <div className="flex items-center gap-3">
          {saveError && (
            <span className="text-xs text-red-400">{saveError}</span>
          )}
          <button
            onClick={onSubmit}
            disabled={saving}
            className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
              saving
                ? "bg-green-500/50 text-slate-900 cursor-not-allowed"
                : "bg-green-500 hover:bg-green-400 text-slate-900"
            }`}
          >
            {saving ? "Saving..." : "Confirm Check-in"}
            {!saving && (
              <span className="material-symbols-outlined text-base">check</span>
            )}
          </button>
        </div>
      </div>
      {onSkip && (
        <div className="flex justify-center">
          <button
            onClick={onSkip}
            disabled={saving}
            className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
          >
            Skip for now
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Optional fields sub-component (non-drained moods)
// ---------------------------------------------------------------------------

function OptionalFields({
  rpe,
  setRpe,
  soreness,
  setSoreness,
  notes,
  setNotes,
}: {
  rpe: string;
  setRpe: (v: string) => void;
  soreness: string;
  setSoreness: (v: string) => void;
  notes: string;
  setNotes: (v: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
      >
        <span
          className="material-symbols-outlined text-sm"
          style={{ fontVariationSettings: '"FILL" 1' }}
        >
          {expanded ? "expand_less" : "expand_more"}
        </span>
        Optional: RPE, soreness, notes
      </button>
      {expanded && (
        <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-slate-400 block mb-1">
              RPE (1-10)
            </label>
            <input
              type="number"
              min={1}
              max={10}
              placeholder="\u2014"
              value={rpe}
              onChange={(e) => setRpe(e.target.value)}
              className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-slate-500"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">
              Soreness (0-10)
            </label>
            <input
              type="number"
              min={0}
              max={10}
              placeholder="\u2014"
              value={soreness}
              onChange={(e) => setSoreness(e.target.value)}
              className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-slate-500"
            />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="text-xs text-slate-400 block mb-1">Notes</label>
            <input
              type="text"
              maxLength={200}
              placeholder="Anything else..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-slate-500"
            />
          </div>
        </div>
      )}
    </div>
  );
}
