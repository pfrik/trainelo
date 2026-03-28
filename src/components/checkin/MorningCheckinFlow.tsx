import { useState, useCallback } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Mood = "drained" | "tired" | "okay" | "good" | "great";
type ReasonBucket = "sick" | "hurt" | "fried";
type RecoveryType = "full_rest" | "active_recovery";

export interface CheckinPayload {
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
  /** If today's check-in already exists (from evidence), show saved state */
  existingMood?: Mood | null;
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
    tags: ["Fever", "Flu", "Stomach Bug"],
  },
  {
    value: "hurt",
    title: "I'm Hurt",
    description: "Acute pain or physical limitations affecting movement.",
    icon: "personal_injury",
    tags: ["Acute Pain", "Injury", "Strain"],
  },
  {
    value: "fried",
    title: "Just Fried",
    description: "Systemic fatigue, burnout, or severely compromised recovery.",
    icon: "battery_alert",
    tags: ["Burnout", "Bad Sleep", "Life Stress"],
  },
];

const PAIN_LOCATIONS = [
  { id: "foot_ankle", label: "Foot/Ankle", icon: "footprint" },
  { id: "knee", label: "Knee", icon: "accessibility_new" },
  { id: "hip_glute", label: "Hip/Glute", icon: "airline_seat_legroom_extra" },
  { id: "back", label: "Back", icon: "health_and_safety" },
  { id: "shoulder", label: "Shoulder", icon: "style" },
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

const DRAG_FACTORS: {
  id: string;
  label: string;
  icon: string;
  fullWidth?: boolean;
}[] = [
  { id: "sleep", label: "Sleep", icon: "bedtime" },
  { id: "perceived_energy", label: "Perceived Energy", icon: "bolt" },
  { id: "motivation", label: "Motivation", icon: "rocket_launch" },
  { id: "life_stress", label: "Life Stress", icon: "psychology" },
  { id: "soreness", label: "Muscle Soreness", icon: "fitness_center", fullWidth: true },
];

const TIME_OPTIONS: { label: string; value: number | null }[] = [
  { label: "As Planned", value: null },
  { label: "30m", value: 30 },
  { label: "45m", value: 45 },
];

// Tired flow: fatigue driver definitions with expandable detail sections
type TiredDriverId = "poor_sleep" | "heavy_legs" | "low_energy" | "mental_fog";

interface TiredDriverConfig {
  id: TiredDriverId;
  label: string;
  subtitle: string;
  scaleName: string;
  tags: string[];
  tagsLabel: string;
}

const TIRED_DRIVERS: TiredDriverConfig[] = [
  {
    id: "poor_sleep",
    label: "Poor Sleep",
    subtitle: "Duration or Quality issues",
    scaleName: "Sleep Quality (1-5)",
    tags: ["Too Short", "Restless", "Late Night", "Woke Up Often"],
    tagsLabel: "Issues",
  },
  {
    id: "heavy_legs",
    label: "Heavy Legs",
    subtitle: "Muscle fatigue or physical soreness",
    scaleName: "Soreness Level (1-5)",
    tags: ["Quads", "Calves", "Hamstrings", "Glutes"],
    tagsLabel: "Affected Areas",
  },
  {
    id: "low_energy",
    label: "Low Energy",
    subtitle: "General lack of vitality",
    scaleName: "Energy Level (1-5)",
    tags: ["Physical Fatigue", "Drowsy", "Hungry"],
    tagsLabel: "Feeling...",
  },
  {
    id: "mental_fog",
    label: "Mental Fog",
    subtitle: "Difficulty concentrating",
    scaleName: "Fog Intensity (1-5)",
    tags: ["Stressful day", "Lack of focus", "Headache"],
    tagsLabel: "Context",
  },
];

// Okay flow: baseline check drivers with expandable detail sections
type OkayDriverId = "life_stress" | "motivation" | "minor_stiffness" | "energy_levels";

interface OkayDriverConfig {
  id: OkayDriverId;
  label: string;
  subtitle: string;
  scaleName: string;
  tags: string[];
  tagsLabel: string;
}

const OKAY_DRIVERS: OkayDriverConfig[] = [
  {
    id: "life_stress",
    label: "Life Stress",
    subtitle: "Work, family, or mental load",
    scaleName: "Stress Intensity (1-5)",
    tags: ["Work pressure", "Family life", "Financial"],
    tagsLabel: "Primary Drivers",
  },
  {
    id: "motivation",
    label: "Motivation",
    subtitle: "Feeling a bit 'meh' or uninspired",
    scaleName: "Motivation Level (1-5)",
    tags: ["Uninspired", "Burnt out", "Just meh"],
    tagsLabel: "Feeling...",
  },
  {
    id: "minor_stiffness",
    label: "Minor Stiffness",
    subtitle: "Not injury, just general tightness",
    scaleName: "Stiffness Level (1-5)",
    tags: ["Lower back", "Hamstrings", "Shoulders", "Neck"],
    tagsLabel: "Affected Areas",
  },
  {
    id: "energy_levels",
    label: "Energy Levels",
    subtitle: "Neutral, neither peaking nor drained",
    scaleName: "Energy Level (1-5)",
    tags: ["Neutral", "Peaking", "Drained"],
    tagsLabel: "Feeling...",
  },
];

const SORENESS_OPTIONS = [
  { label: "No Soreness (1)", value: 1 },
  { label: "Light Soreness (2-3)", value: 2 },
  { label: "Moderate Soreness (4-6)", value: 5 },
  { label: "Heavy Soreness (7-8)", value: 7 },
  { label: "Extreme Soreness (9-10)", value: 9 },
];

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function MorningCheckinFlow({ onSubmit, wearableReadiness, existingMood }: MorningCheckinFlowProps) {
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

  // Tired protocol state
  const [tiredDrivers, setTiredDrivers] = useState<Set<TiredDriverId>>(new Set());
  const [tiredDriverScales, setTiredDriverScales] = useState<Record<string, number | null>>({});
  const [tiredDriverTags, setTiredDriverTags] = useState<Record<string, string[]>>({});

  // Okay protocol state
  const [okayDrivers, setOkayDrivers] = useState<Set<OkayDriverId>>(new Set());
  const [okayDriverScales, setOkayDriverScales] = useState<Record<string, number | null>>({});
  const [okayDriverTags, setOkayDriverTags] = useState<Record<string, string[]>>({});

  // Non-drained protocol fields (shared)
  const [reasonTags, setReasonTags] = useState<string[]>([]);
  const [dragFactors, setDragFactors] = useState<string[]>([]);
  const [tiredTimeConstraint, setTiredTimeConstraint] = useState<number | null>(null);
  const [tiredNotes, setTiredNotes] = useState("");
  const [nonRedTimeConstraint, setNonRedTimeConstraint] = useState("");
  const [niggle, setNiggle] = useState<boolean | null>(null);
  const [niggleLocation, setNiggleLocation] = useState("");
  const [goodTimeConstraint, setGoodTimeConstraint] = useState<"all_good" | "short" | null>(null);
  const [upgradeIntent, setUpgradeIntent] = useState<boolean | null>(null);
  const [upgradeType, setUpgradeType] = useState<"intensity" | "volume" | null>(null);

  // Optional fields (non-drained)
  const [rpe, setRpe] = useState("");
  const [soreness, setSoreness] = useState("");
  const [notes, setNotes] = useState("");

  // Submit state
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

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
    setTiredDrivers(new Set());
    setTiredDriverScales({});
    setTiredDriverTags({});
    setOkayDrivers(new Set());
    setOkayDriverScales({});
    setOkayDriverTags({});
    setReasonTags([]);
    setDragFactors([]);
    setTiredTimeConstraint(null);
    setTiredNotes("");
    setNonRedTimeConstraint("");
    setNiggle(null);
    setNiggleLocation("");
    setGoodTimeConstraint(null);
    setUpgradeIntent(null);
    setUpgradeType(null);
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

  const toggleDragFactor = useCallback((id: string) => {
    setDragFactors((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id],
    );
  }, []);

  const toggleTiredDriver = useCallback((id: TiredDriverId) => {
    setTiredDrivers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const setTiredDriverScale = useCallback((driverId: string, value: number | null) => {
    setTiredDriverScales((prev) => ({ ...prev, [driverId]: value }));
  }, []);

  const toggleTiredDriverTag = useCallback((driverId: string, tag: string) => {
    setTiredDriverTags((prev) => {
      const current = prev[driverId] ?? [];
      const next = current.includes(tag)
        ? current.filter((t) => t !== tag)
        : [...current, tag];
      return { ...prev, [driverId]: next };
    });
  }, []);

  const toggleOkayDriver = useCallback((id: OkayDriverId) => {
    setOkayDrivers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }, []);

  const setOkayDriverScale = useCallback((driverId: string, value: number | null) => {
    setOkayDriverScales((prev) => ({ ...prev, [driverId]: value }));
  }, []);

  const toggleOkayDriverTag = useCallback((driverId: string, tag: string) => {
    setOkayDriverTags((prev) => {
      const current = prev[driverId] ?? [];
      const next = current.includes(tag)
        ? current.filter((t) => t !== tag)
        : [...current, tag];
      return { ...prev, [driverId]: next };
    });
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
      setEditing(false);
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

    // Tired: driver-based diagnosis
    if (mood === "tired") {
      const drivers = Array.from(tiredDrivers);
      if (drivers.length > 0) p.reason_tags = drivers;

      // Map driver scales to existing fields where possible
      if (tiredDriverScales.poor_sleep != null) {
        p.payload = { ...p.payload, sleep_quality: tiredDriverScales.poor_sleep };
      }
      if (tiredDriverScales.heavy_legs != null) {
        p.soreness = tiredDriverScales.heavy_legs * 2; // 1-5 → 2-10 range
      }
      if (tiredDriverScales.low_energy != null) {
        p.payload = { ...p.payload, perceived_energy: tiredDriverScales.low_energy };
      }
      if (tiredDriverScales.mental_fog != null) {
        p.payload = { ...p.payload, mental_fog_intensity: tiredDriverScales.mental_fog };
      }

      // Collect all detail tags per driver
      const detailTags: Record<string, string[]> = {};
      for (const d of drivers) {
        const tags = tiredDriverTags[d];
        if (tags && tags.length > 0) detailTags[d] = tags;
      }
      if (Object.keys(detailTags).length > 0) {
        p.payload = { ...p.payload, driver_details: detailTags };
      }
    } else if (mood === "okay") {
      const drivers = Array.from(okayDrivers);
      if (drivers.length > 0) p.reason_tags = drivers;

      if (okayDriverScales.life_stress != null) {
        p.payload = { ...p.payload, life_stress: okayDriverScales.life_stress };
      }
      if (okayDriverScales.motivation != null) {
        p.payload = { ...p.payload, motivation: okayDriverScales.motivation };
      }
      if (okayDriverScales.minor_stiffness != null) {
        p.soreness = okayDriverScales.minor_stiffness * 2; // 1-5 → 2-10
      }
      if (okayDriverScales.energy_levels != null) {
        p.payload = { ...p.payload, perceived_energy: okayDriverScales.energy_levels };
      }

      const detailTags: Record<string, string[]> = {};
      for (const d of drivers) {
        const tags = okayDriverTags[d];
        if (tags && tags.length > 0) detailTags[d] = tags;
      }
      if (Object.keys(detailTags).length > 0) {
        p.payload = { ...p.payload, driver_details: detailTags };
      }
    } else if (mood === "good") {
      if (niggle) p.pain_flag = true;
      if (goodTimeConstraint === "short") p.time_constraint_minutes = 30;
      if (notes.trim()) p.notes = notes.trim();
    } else if (mood === "great") {
      if (upgradeType) {
        p.payload = { upgrade_type: upgradeType };
      }
      if (notes.trim()) p.notes = notes.trim();
    } else {
      const tc = parseInt(nonRedTimeConstraint, 10);
      if (tc > 0) p.time_constraint_minutes = tc;
      if (notes.trim()) p.notes = notes.trim();
    }

    const rpeNum = parseInt(rpe, 10);
    if (rpeNum >= 1 && rpeNum <= 10) p.rpe = rpeNum;
    const soreNum = parseInt(soreness, 10);
    if (soreNum >= 0 && soreNum <= 10) p.soreness = soreNum;

    try {
      await onSubmit(p);
      setSaved(true);
      setEditing(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [mood, niggle, goodTimeConstraint, upgradeType, nonRedTimeConstraint, dragFactors, tiredDrivers, tiredDriverScales, tiredDriverTags, okayDrivers, okayDriverScales, okayDriverTags, tiredTimeConstraint, tiredNotes, reasonTags, rpe, soreness, notes, onSubmit]);

  // ---------------------------------------------------------------------------
  // Render: Saved
  // ---------------------------------------------------------------------------

  const effectiveMood = saved ? mood : existingMood;
  if ((effectiveMood && !editing) || (saved && !editing)) {
    return (
      <div className="flex items-center gap-2 py-2">
        <span className="material-symbols-outlined text-green-400 text-xl" style={{ fontVariationSettings: '"FILL" 1' }}>check_circle</span>
        <span className="text-green-400 text-sm font-medium">Check-in saved</span>
        <span className="text-slate-500 text-sm capitalize">({effectiveMood})</span>
        <button
          onClick={() => setEditing(true)}
          className="ml-auto text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          Update
        </button>
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
    // Dynamic header content
    let headerTitle: string;
    let headerSubtitle: string;
    let showRequired = false;

    if (redStep === 1) {
      headerTitle = "Oh no. What\u2019s going on?";
      headerSubtitle = "Identify the issue so we can calibrate your load.";
      showRequired = true;
    } else if (reasonBucket === "hurt") {
      headerTitle = "Injury Report";
      headerSubtitle = "Details help us adjust your training load.";
    } else if (reasonBucket === "sick") {
      headerTitle = "Sickness Details";
      headerSubtitle = "Help us understand what you\u2019re dealing with.";
    } else {
      headerTitle = "Burnout Options";
      headerSubtitle = "Select your recovery path for today.";
    }

    return (
      <div>
        {/* ---- Shared header ---- */}
        <div className="pb-5 border-b border-slate-700 flex justify-between items-start">
          <div className="w-full">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-red-500">
                  Red Protocol
                </span>
              </div>
              <span className="text-xs font-semibold text-slate-400 bg-slate-700/30 px-2 py-1 rounded">
                Step {redStep} of 2
              </span>
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              {headerTitle}
            </h2>
            <div className="flex items-center justify-between mt-1">
              <p className="text-sm text-slate-400 font-medium">{headerSubtitle}</p>
              {showRequired && (
                <span className="text-[10px] uppercase font-bold text-red-400/80 tracking-wide border border-red-500/20 px-1.5 py-0.5 rounded bg-red-500/5">
                  Required
                </span>
              )}
            </div>
          </div>
          <button
            onClick={handleRedClose}
            className="text-slate-400 hover:text-white transition-colors p-2 rounded-md hover:bg-white/5 -mr-2 ml-4"
            aria-label="Close red protocol"
          >
            <span className="material-symbols-outlined text-2xl">close</span>
          </button>
        </div>

        {/* ---- Step 1: Choose bucket ---- */}
        {redStep === 1 && (
          <div className="pt-6 space-y-4">
            <div className="space-y-4" role="radiogroup" aria-label="Issue type">
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
                    className={`w-full text-left p-5 rounded-xl border transition-all ${
                      sel
                        ? "border-green-500 ring-1 ring-green-500 bg-green-500/5"
                        : "border-slate-700 bg-[#0f1521]/50 hover:bg-[#0f1521]"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className={`p-3 rounded-lg transition-colors ${
                          sel
                            ? "bg-green-500/10 text-green-500"
                            : "bg-slate-700/20 text-slate-400"
                        }`}
                      >
                        <span className="material-symbols-outlined text-3xl">
                          {card.icon}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3
                            className={`text-lg font-bold mb-1 transition-colors ${
                              sel ? "text-green-500" : "text-white"
                            }`}
                          >
                            {card.title}
                          </h3>
                          <div
                            className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 transition-all ${
                              sel
                                ? "border-green-500 bg-green-500"
                                : "border-slate-700"
                            }`}
                          >
                            {sel && (
                              <span className="material-symbols-outlined text-[14px] text-white font-bold">
                                check
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-slate-400 mb-3 leading-relaxed">
                          {card.description}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {card.tags.map((tag) => (
                            <span
                              key={tag}
                              className="px-2 py-1 rounded text-[10px] font-semibold bg-slate-800 border border-slate-700 text-slate-400 uppercase tracking-wider"
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

            <div className="pt-5 border-t border-slate-700 flex justify-between items-center">
              <button
                onClick={handleSkip}
                className="text-sm font-medium text-slate-400 hover:text-white transition-colors"
              >
                Skip for now
              </button>
              <button
                onClick={handleRedStep1Next}
                className="px-8 py-3 rounded-lg bg-green-500 hover:bg-green-600 text-white text-sm font-bold shadow-lg shadow-green-500/20 hover:shadow-green-500/30 transition-all flex items-center gap-2 active:scale-[0.98]"
              >
                Confirm Calibration
                <span className="material-symbols-outlined text-lg leading-none font-bold">
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
            tags={friedTags}
            toggleTag={(tag) => toggleArrayItem(setFriedTags, tag)}
            recoveryType={recoveryType}
            setRecoveryType={setRecoveryType}
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
  // Render: Tired protocol — Fatigue Diagnosis
  // ---------------------------------------------------------------------------

  if (mood === "tired") {
    const hasDrivers = tiredDrivers.size > 0;

    return (
      <div>
        {/* Header */}
        <header className="pb-5 border-b border-slate-600/40 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="text-green-500 flex items-center">
              <span className="material-symbols-outlined text-2xl">bolt</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Tired Calibration</h2>
              <p className="text-[10px] text-slate-400 mt-0.5 font-bold uppercase tracking-wider">Initial Diagnosis</p>
            </div>
          </div>
          <button
            onClick={() => setStep("mood")}
            className="text-slate-400 hover:text-white transition-colors p-1.5 rounded-md hover:bg-white/5"
            aria-label="Back to mood selection"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </header>

        <div className="pt-6 space-y-6">
          {/* Title */}
          <div>
            <h1 className="text-white text-2xl font-bold leading-tight mb-1">Let&apos;s fix the fatigue.</h1>
            <p className="text-slate-400 text-sm font-medium">What&apos;s the main driver?</p>
          </div>

          {/* Driver options with inline expanding details */}
          <div className="space-y-3">
            {TIRED_DRIVERS.map((driver) => {
              const sel = tiredDrivers.has(driver.id);
              const scale = tiredDriverScales[driver.id] ?? null;
              const tags = tiredDriverTags[driver.id] ?? [];

              return (
                <div key={driver.id}>
                  {/* Driver card */}
                  <button
                    type="button"
                    onClick={() => toggleTiredDriver(driver.id)}
                    className={`w-full text-left rounded-lg border transition-all ${
                      sel
                        ? "border-green-500 bg-green-500/5 shadow-[0_0_0_1px_#22C55E] p-4"
                        : hasDrivers && !sel
                          ? "border-slate-600/40 bg-slate-600/20 p-4 opacity-60"
                          : "border-slate-600/40 bg-slate-600/20 p-4 hover:bg-slate-600/30"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-white font-bold text-sm">{driver.label}</span>
                        <span className="text-slate-400 text-xs">{driver.subtitle}</span>
                      </div>
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                        sel
                          ? "bg-green-500 border-green-500"
                          : "border-slate-600/60"
                      }`}>
                        {sel && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                    </div>
                  </button>

                  {/* Expandable detail section */}
                  {sel && (
                    <div className="mt-0 rounded-b-lg border border-t-0 border-green-500 bg-green-500/5 px-4 pb-4 pt-3 space-y-4">
                      <div className="border-t border-slate-600/20 pt-4 space-y-4">
                        {/* Scale 1-5 */}
                        <div className="space-y-3">
                          <p className="text-[11px] font-bold text-green-500 uppercase tracking-wider">
                            {driver.scaleName}
                          </p>
                          <div className="grid grid-cols-5 gap-1 p-1 bg-slate-600/30 rounded-lg border border-slate-600/30">
                            {[1, 2, 3, 4, 5].map((v) => (
                              <button
                                key={v}
                                type="button"
                                onClick={() => setTiredDriverScale(driver.id, scale === v ? null : v)}
                                className={`py-2 rounded-md text-xs font-medium transition-all ${
                                  scale === v
                                    ? "bg-green-500 text-white font-bold shadow-[0_0_20px_-5px_rgba(34,197,94,0.3)]"
                                    : "text-slate-400 hover:bg-white/5"
                                }`}
                              >
                                {v}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Context tags */}
                        <div className="space-y-2">
                          <p className="text-[11px] font-bold text-green-500 uppercase tracking-wider">
                            {driver.tagsLabel}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {driver.tags.map((tag) => {
                              const tagSel = tags.includes(tag);
                              return (
                                <button
                                  key={tag}
                                  type="button"
                                  onClick={() => toggleTiredDriverTag(driver.id, tag)}
                                  className={`px-3 py-1.5 rounded-full border text-[11px] font-bold transition-all ${
                                    tagSel
                                      ? "border-green-500 bg-green-500/10 text-green-500"
                                      : "border-slate-600/20 bg-slate-600/30 text-slate-400 hover:border-green-500/50"
                                  }`}
                                >
                                  {tag}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-5 mt-6 border-t border-slate-600/40 flex flex-col gap-3">
          <button
            onClick={handleNonRedSubmit}
            disabled={saving || !hasDrivers}
            className={`w-full font-bold py-3.5 rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg uppercase tracking-wide text-sm active:scale-[0.98] ${
              saving || !hasDrivers
                ? "bg-green-500/30 text-white/50 cursor-not-allowed shadow-none"
                : "bg-green-500 hover:bg-green-600 text-white shadow-green-500/20"
            }`}
          >
            {saving ? "Saving..." : hasDrivers ? "Complete Analysis" : "Select a driver"}
            {!saving && hasDrivers && (
              <span className="material-symbols-outlined text-lg">check_circle</span>
            )}
          </button>
          <button
            onClick={handleSkip}
            disabled={saving}
            className="w-full text-slate-400 hover:text-white text-[10px] font-bold uppercase tracking-widest py-2 transition-colors"
          >
            I&apos;m not sure, skip diagnosis
          </button>
          {saveError && (
            <p className="text-xs text-red-400 text-center">{saveError}</p>
          )}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Okay protocol — Baseline Check
  // ---------------------------------------------------------------------------

  if (mood === "okay") {
    const hasOkayDrivers = okayDrivers.size > 0;

    return (
      <div>
        {/* Header */}
        <header className="pb-5 border-b border-slate-600/40 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="text-green-500 flex items-center">
              <span className="material-symbols-outlined text-2xl">tune</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight uppercase">Okay Calibration</h2>
              <p className="text-[10px] text-slate-400 mt-0.5 font-bold uppercase tracking-wider">Initial Diagnosis</p>
            </div>
          </div>
          <button
            onClick={() => setStep("mood")}
            className="text-slate-400 hover:text-white transition-colors p-1.5 rounded-md hover:bg-white/5"
            aria-label="Back to mood selection"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </header>

        <div className="pt-6 space-y-6">
          {/* Title */}
          <div>
            <h1 className="text-white text-2xl font-bold leading-tight mb-1">How&apos;s the baseline?</h1>
            <p className="text-slate-400 text-sm font-medium">A quick check to fine-tune today&apos;s session.</p>
          </div>

          {/* Driver options with inline expanding details */}
          <div className="space-y-3">
            {OKAY_DRIVERS.map((driver) => {
              const sel = okayDrivers.has(driver.id);
              const scale = okayDriverScales[driver.id] ?? null;
              const tags = okayDriverTags[driver.id] ?? [];

              return (
                <div key={driver.id}>
                  {/* Driver card */}
                  <button
                    type="button"
                    onClick={() => toggleOkayDriver(driver.id)}
                    className={`w-full text-left rounded-lg border transition-all ${
                      sel
                        ? "border-green-500 bg-green-500/5 shadow-[0_0_0_1px_#22C55E] p-4"
                        : hasOkayDrivers && !sel
                          ? "border-slate-600/40 bg-slate-600/20 p-4 opacity-60"
                          : "border-slate-600/40 bg-slate-600/20 p-4 hover:bg-slate-600/30"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-white font-bold text-sm">{driver.label}</span>
                        <span className="text-slate-400 text-xs">{driver.subtitle}</span>
                      </div>
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                        sel
                          ? "bg-green-500 border-green-500"
                          : "border-slate-600/60"
                      }`}>
                        {sel && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                    </div>
                  </button>

                  {/* Expandable detail section */}
                  {sel && (
                    <div className="mt-0 rounded-b-lg border border-t-0 border-green-500 bg-green-500/5 px-4 pb-4 pt-3 space-y-4">
                      <div className="border-t border-slate-600/20 pt-4 space-y-4">
                        {/* Scale 1-5 */}
                        <div className="space-y-3">
                          <p className="text-[11px] font-bold text-green-500 uppercase tracking-wider">
                            {driver.scaleName}
                          </p>
                          <div className="grid grid-cols-5 gap-1 p-1 bg-slate-600/30 rounded-lg border border-slate-600/30">
                            {[1, 2, 3, 4, 5].map((v) => (
                              <button
                                key={v}
                                type="button"
                                onClick={() => setOkayDriverScale(driver.id, scale === v ? null : v)}
                                className={`py-2 rounded-md text-xs font-medium transition-all ${
                                  scale === v
                                    ? "bg-green-500 text-white font-bold shadow-[0_0_20px_-5px_rgba(34,197,94,0.3)]"
                                    : "text-slate-400 hover:bg-white/5"
                                }`}
                              >
                                {v}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Context tags */}
                        <div className="space-y-2">
                          <p className="text-[11px] font-bold text-green-500 uppercase tracking-wider">
                            {driver.tagsLabel}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {driver.tags.map((tag) => {
                              const tagSel = tags.includes(tag);
                              return (
                                <button
                                  key={tag}
                                  type="button"
                                  onClick={() => toggleOkayDriverTag(driver.id, tag)}
                                  className={`px-3 py-1.5 rounded-full border text-[11px] font-bold transition-all ${
                                    tagSel
                                      ? "border-green-500 bg-green-500/10 text-green-500"
                                      : "border-slate-600/20 bg-slate-600/30 text-slate-400 hover:border-green-500/50"
                                  }`}
                                >
                                  {tag}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-5 mt-6 border-t border-slate-600/40 flex flex-col gap-3">
          <button
            onClick={handleNonRedSubmit}
            disabled={saving}
            className={`w-full font-bold py-3.5 rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg uppercase tracking-wide text-sm active:scale-[0.98] ${
              saving
                ? "bg-green-500/30 text-white/50 cursor-not-allowed shadow-none"
                : "bg-green-500 hover:bg-green-600 text-white shadow-green-500/20"
            }`}
          >
            {saving ? "Saving..." : "Continue to Logistics"}
            {!saving && (
              <span className="material-symbols-outlined text-lg">arrow_forward</span>
            )}
          </button>
          <button
            onClick={handleSkip}
            disabled={saving}
            className="w-full text-slate-400 hover:text-white text-[10px] font-bold uppercase tracking-widest py-2 transition-colors"
          >
            I&apos;m all good, stick to plan
          </button>
          {saveError && (
            <p className="text-xs text-red-400 text-center">{saveError}</p>
          )}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Good protocol — Green Light
  // ---------------------------------------------------------------------------

  if (mood === "good") {
    return (
      <div>
        {/* Header */}
        <div className="pb-5 border-b border-slate-700 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              Feeling Good
            </h2>
            <p className="text-xs text-slate-400 mt-1 font-medium">
              Green Light Protocol &bull; Logistics Check
            </p>
          </div>
          <button
            onClick={() => setStep("mood")}
            className="text-slate-400 hover:text-white transition-colors p-1.5 rounded-md hover:bg-white/5"
            aria-label="Back to mood selection"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <div className="pt-6 space-y-8">
          {/* Step 1: Niggles */}
          <div className="space-y-4">
            <label className="text-sm font-bold text-white">
              Step 1: Any niggles or stiffness?
            </label>
            <div className="grid grid-cols-2 bg-[#0f1521]/50 p-1 rounded-lg border border-slate-700">
              <label className="cursor-pointer relative flex-1">
                <input
                  type="radio"
                  name="niggles"
                  className="peer sr-only"
                  checked={niggle === false}
                  onChange={() => setNiggle(false)}
                />
                <div className="py-2.5 px-4 rounded-md text-center text-sm font-medium text-slate-400 transition-all peer-checked:bg-green-500 peer-checked:text-white peer-checked:shadow-sm">
                  Nope
                </div>
              </label>
              <label className="cursor-pointer relative flex-1">
                <input
                  type="radio"
                  name="niggles"
                  className="peer sr-only"
                  checked={niggle === true}
                  onChange={() => setNiggle(true)}
                />
                <div className="py-2.5 px-4 rounded-md text-center text-sm font-medium text-slate-400 transition-all peer-checked:bg-slate-600 peer-checked:text-white peer-checked:shadow-sm hover:text-white">
                  Yes a little
                </div>
              </label>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-slate-700/50" />

          {/* Step 2: Time constraints */}
          <div className="space-y-4">
            <label className="text-sm font-bold text-white">
              Step 2: Time constraints today?
            </label>
            <div className="grid grid-cols-1 gap-3">
              {/* All good */}
              <label className="cursor-pointer relative group">
                <input
                  type="radio"
                  name="time_constraint_good"
                  className="peer sr-only"
                  checked={goodTimeConstraint === "all_good"}
                  onChange={() => setGoodTimeConstraint("all_good")}
                />
                <div className={`flex items-center justify-between p-4 rounded-lg border transition-all ${
                  goodTimeConstraint === "all_good"
                    ? "border-green-500 ring-1 ring-green-500 bg-green-500/5"
                    : "border-slate-700 bg-[#0f1521]/50 hover:bg-[#0f1521]"
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      goodTimeConstraint === "all_good"
                        ? "bg-green-500/20 text-green-500"
                        : "bg-slate-600/30 text-slate-400"
                    }`}>
                      <span className="material-symbols-outlined text-lg">schedule</span>
                    </div>
                    <div className="flex flex-col">
                      <span className={`text-sm font-bold transition-colors ${
                        goodTimeConstraint === "all_good" ? "text-green-500" : "text-white"
                      }`}>
                        All good
                      </span>
                      <span className="text-xs text-slate-400">Standard schedule available</span>
                    </div>
                  </div>
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                    goodTimeConstraint === "all_good"
                      ? "border-green-500 bg-green-500"
                      : "border-slate-700"
                  }`}>
                    {goodTimeConstraint === "all_good" && (
                      <div className="w-1.5 h-1.5 bg-white rounded-full" />
                    )}
                  </div>
                </div>
              </label>

              {/* Short on time */}
              <label className="cursor-pointer relative group">
                <input
                  type="radio"
                  name="time_constraint_good"
                  className="peer sr-only"
                  checked={goodTimeConstraint === "short"}
                  onChange={() => setGoodTimeConstraint("short")}
                />
                <div className={`flex items-center justify-between p-4 rounded-lg border transition-all ${
                  goodTimeConstraint === "short"
                    ? "border-orange-500 ring-1 ring-orange-500 bg-orange-500/5"
                    : "border-slate-700 bg-[#0f1521]/50 hover:bg-[#0f1521]"
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      goodTimeConstraint === "short"
                        ? "bg-orange-500/20 text-orange-500"
                        : "bg-slate-600/30 text-slate-400"
                    }`}>
                      <span className="material-symbols-outlined text-lg">timer</span>
                    </div>
                    <div className="flex flex-col">
                      <span className={`text-sm font-bold transition-colors ${
                        goodTimeConstraint === "short" ? "text-orange-500" : "text-white"
                      }`}>
                        Short on time
                      </span>
                      <span className="text-xs text-slate-400">Need compressed session</span>
                    </div>
                  </div>
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                    goodTimeConstraint === "short"
                      ? "border-orange-500 bg-orange-500"
                      : "border-slate-700"
                  }`}>
                    {goodTimeConstraint === "short" && (
                      <div className="w-1.5 h-1.5 bg-white rounded-full" />
                    )}
                  </div>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-5 mt-6 border-t border-slate-700 flex justify-between items-center">
          <button
            onClick={() => setStep("mood")}
            className="text-sm text-slate-500 hover:text-white font-medium transition-colors"
          >
            Back
          </button>
          <div className="flex items-center gap-3">
            {saveError && (
              <span className="text-xs text-red-400">{saveError}</span>
            )}
            <button
              onClick={handleNonRedSubmit}
              disabled={saving}
              className={`px-6 py-2.5 rounded-lg text-sm font-bold shadow-lg transition-all flex items-center gap-2 active:scale-[0.98] ${
                saving
                  ? "bg-green-500/30 text-white/50 cursor-not-allowed shadow-none"
                  : "bg-green-500 hover:bg-green-600 text-white shadow-green-500/20 hover:shadow-green-500/30"
              }`}
            >
              Update Training
              {!saving && (
                <span className="material-symbols-outlined text-lg leading-none font-bold">
                  arrow_forward
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Great protocol — Optimization Protocol
  // ---------------------------------------------------------------------------

  const UPGRADE_OPTIONS: {
    value: "intensity" | "volume";
    label: string;
    subtitle: string;
    detail: string;
    icon: string;
  }[] = [
    {
      value: "intensity",
      label: "Increase Intensity",
      subtitle: "Focus on power & speed",
      detail: "Shorter duration \u2022 Higher effort",
      icon: "bolt",
    },
    {
      value: "volume",
      label: "Increase Volume",
      subtitle: "Focus on endurance & capacity",
      detail: "Longer duration \u2022 Sustained effort",
      icon: "shutter_speed",
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="pb-5 border-b border-slate-700 flex justify-between items-center">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-green-500 bg-green-500/10 px-2 py-0.5 rounded border border-green-500/20">
              Step 2 of 2
            </span>
          </div>
          <h2 className="text-lg font-bold text-white tracking-tight">
            Optimization Protocol
          </h2>
        </div>
        <button
          onClick={() => setStep("mood")}
          className="text-slate-400 hover:text-white transition-colors p-1.5 rounded-md hover:bg-white/5"
          aria-label="Back to mood selection"
        >
          <span className="material-symbols-outlined text-xl">close</span>
        </button>
      </div>

      <div className="pt-6 space-y-6">
        {/* Hero */}
        <div className="text-center space-y-4 py-2">
          <div className="inline-flex p-4 rounded-full bg-green-500/10 ring-1 ring-green-500/20 shadow-[0_0_20px_-5px_rgba(34,197,94,0.3)] mb-2">
            <span className="material-symbols-outlined text-4xl text-green-500 font-bold">tune</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Peak State Detected</h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            Your subjective scores indicate high readiness. Upgrade intensity or volume?
          </p>
        </div>

        {/* Upgrade options */}
        <div className="grid gap-4">
          {UPGRADE_OPTIONS.map((opt) => {
            const sel = upgradeType === opt.value;
            return (
              <label key={opt.value} className="relative cursor-pointer group">
                <input
                  type="radio"
                  name="calibration"
                  className="sr-only"
                  checked={sel}
                  onChange={() => setUpgradeType(opt.value)}
                />
                <div className={`w-full rounded-xl border p-5 transition-all flex items-start justify-between ${
                  sel
                    ? "border-green-500 bg-green-500/10"
                    : "border-slate-700 bg-slate-600/5 hover:bg-slate-600/10"
                }`}>
                  <div className="flex gap-4">
                    <div className={`h-10 w-10 shrink-0 rounded-lg flex items-center justify-center border transition-colors ${
                      sel
                        ? "bg-green-500/20 border-green-500/50 text-green-500"
                        : "bg-slate-600 border-slate-700 text-white group-hover:border-green-500/50"
                    }`}>
                      <span className="material-symbols-outlined">{opt.icon}</span>
                    </div>
                    <div>
                      <h3 className={`font-bold text-base transition-colors ${
                        sel ? "text-green-500" : "text-white group-hover:text-green-500"
                      }`}>
                        {opt.label}
                      </h3>
                      <p className="text-xs text-slate-400 font-medium mt-1">{opt.subtitle}</p>
                      <p className="text-[11px] text-slate-400 mt-2 opacity-60">{opt.detail}</p>
                    </div>
                  </div>
                  <div className={`h-6 w-6 rounded-full border flex items-center justify-center transition-all shrink-0 ${
                    sel
                      ? "bg-green-500 border-green-500"
                      : "border-slate-700"
                  }`}>
                    {sel && (
                      <span className="material-symbols-outlined text-sm text-black font-bold">check</span>
                    )}
                  </div>
                </div>
              </label>
            );
          })}
        </div>

        {/* Wearable safety warning */}
        {wearableReadiness === "red" && (
          <div className="rounded-lg border border-red-500/20 bg-[#1a1111] p-4 flex gap-3">
            <span className="material-symbols-outlined text-red-500 shrink-0 mt-0.5">warning</span>
            <div>
              <h4 className="text-xs font-bold text-red-500 uppercase tracking-wide mb-1">AI Safety Warning</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Wearable data suggests low recovery despite feeling great. Training will be constrained for safety.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="pt-5 mt-6 border-t border-slate-700 space-y-3">
        <button
          onClick={handleNonRedSubmit}
          disabled={saving}
          className={`w-full font-bold py-3.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-lg ${
            saving
              ? "bg-green-500/30 text-white/50 cursor-not-allowed shadow-none"
              : "bg-green-500 hover:bg-green-600 text-black shadow-green-500/20"
          }`}
        >
          {saving ? "Saving..." : "Confirm Training"}
          {!saving && (
            <span className="material-symbols-outlined text-lg">arrow_forward</span>
          )}
        </button>
        <div className="flex justify-center">
          <button
            onClick={handleSkip}
            disabled={saving}
            className="text-sm text-slate-400 hover:text-white transition-colors underline decoration-slate-500/30 underline-offset-4"
          >
            Skip for now
          </button>
        </div>
        {saveError && (
          <p className="text-xs text-red-400 text-center">{saveError}</p>
        )}
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
    <div className="pt-6 space-y-8">
      {/* Pain Severity */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <label className="block text-sm font-bold text-white uppercase tracking-wide">
            Pain Severity
          </label>
          <span
            className={`text-2xl font-bold ${painSeverity !== null ? "text-green-500" : "text-slate-600"}`}
          >
            {painSeverity !== null ? painSeverity : "\u2014"}
            <span className="text-sm text-slate-400 font-normal ml-1">/10</span>
          </span>
        </div>
        <div
          className="flex gap-1.5"
          role="radiogroup"
          aria-label="Pain severity from 1 to 10"
        >
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
                    ? "bg-green-500 text-white"
                    : "bg-[#0f1521]/30 text-slate-500 border border-slate-700 hover:border-slate-500 hover:text-slate-300"
                }`}
              >
                {v}
              </button>
            );
          })}
        </div>
        <div className="flex justify-between text-xs text-slate-400 font-medium px-1">
          <span>Mild</span>
          <span>Moderate</span>
          <span>Severe</span>
        </div>
        {errors.pain_severity && (
          <p className="text-xs text-red-400 flex items-center gap-1">
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
      <div className="space-y-4">
        <label className="block text-sm font-bold text-white uppercase tracking-wide">
          Pain Location{" "}
          <span className="text-slate-400 text-[10px] font-normal normal-case ml-2">
            (Select all that apply)
          </span>
        </label>
        <div className="grid grid-cols-3 gap-3">
          {PAIN_LOCATIONS.map((loc) => {
            const sel = painLocations.includes(loc.id);
            return (
              <button
                key={loc.id}
                onClick={() => togglePainLocation(loc.id)}
                role="checkbox"
                aria-checked={sel}
                tabIndex={0}
                className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all h-20 ${
                  sel
                    ? "bg-green-500/10 border-green-500 text-green-500"
                    : "border-slate-700 bg-[#0f1521]/30 text-slate-400 hover:bg-[#0f1521] hover:border-slate-400/50"
                }`}
              >
                <span className="material-symbols-outlined mb-1">{loc.icon}</span>
                <span className="text-xs font-semibold">{loc.label}</span>
              </button>
            );
          })}
        </div>
        {errors.pain_locations && (
          <p className="text-xs text-red-400 flex items-center gap-1">
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

      {/* RPE/Soreness + Time Constraint */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <label className="block text-sm font-bold text-white uppercase tracking-wide">
            RPE / Soreness
          </label>
          <div className="relative">
            <select
              value={hurtSoreness ?? ""}
              onChange={(e) =>
                setHurtSoreness(
                  e.target.value ? parseInt(e.target.value, 10) : null,
                )
              }
              className="w-full bg-[#0f1521]/30 border border-slate-700 text-white text-sm rounded-lg focus:ring-green-500 focus:border-green-500 block p-3 appearance-none"
            >
              <option value="">Select...</option>
              {SORENESS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
              <span className="material-symbols-outlined text-xl">
                expand_more
              </span>
            </div>
          </div>
        </div>
        <TimeConstraintSelector
          value={timeConstraint}
          onChange={setTimeConstraint}
          customTime={customTime}
          onCustomChange={setCustomTime}
        />
      </div>

      {/* Notes */}
      <div className="space-y-3">
        <label className="block text-sm font-bold text-white uppercase tracking-wide">
          Notes
        </label>
        <textarea
          rows={4}
          maxLength={500}
          placeholder="Describe the pain type (sharp, dull, throbbing) or specific movements that trigger it..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full bg-[#0f1521]/30 border border-slate-700 text-white text-sm rounded-lg focus:ring-green-500 focus:border-green-500 block p-3 min-h-[100px] placeholder-slate-500/50 resize-none"
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
  notes: string;
  setNotes: (v: string) => void;
  saving: boolean;
  saveError: string | null;
  onBack: () => void;
  onSubmit: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="pt-6 space-y-6">
      {/* Info banner (Stitch: immune system recovery) */}
      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-start gap-4">
        <div className="bg-red-500/20 p-2 rounded-full text-red-500 shrink-0">
          <span className="material-symbols-outlined text-xl">sick</span>
        </div>
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wide mb-1">
            Immune System Recovery
          </h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            Based on your reported symptoms, high-intensity training is paused.
            Focus purely on recovery to prevent prolonged illness.
          </p>
        </div>
      </div>

      {/* Symptom tags */}
      <div className="space-y-3">
        <label className="block text-sm font-bold text-white uppercase tracking-wide">
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
                    ? "bg-green-500/10 text-green-400 border border-green-500/40"
                    : "bg-[#0f1521]/30 text-slate-400 border border-slate-700 hover:text-slate-200 hover:border-slate-500"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-3">
        <label className="block text-sm font-bold text-white uppercase tracking-wide">
          Notes (optional)
        </label>
        <textarea
          rows={4}
          maxLength={500}
          placeholder="Any additional details about how you're feeling..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full bg-[#0f1521]/30 border border-slate-700 text-white text-sm rounded-lg focus:ring-green-500 focus:border-green-500 block p-3 min-h-[100px] placeholder-slate-500/50 resize-none"
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
  tags,
  toggleTag,
  recoveryType,
  setRecoveryType,
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
  recoveryType: RecoveryType | null;
  setRecoveryType: (v: RecoveryType) => void;
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
      icon: "bed",
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
    <div className="pt-6 space-y-8">
      {/* Recovery type */}
      <div className="space-y-4">
        <label className="block text-sm font-bold text-white uppercase tracking-wide">
          Select Recovery Type
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {RECOVERY_OPTIONS.map((opt) => {
            const sel = recoveryType === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setRecoveryType(opt.value)}
                role="radio"
                aria-checked={sel}
                tabIndex={0}
                className={`relative flex flex-col items-center justify-center p-6 rounded-lg border transition-all h-40 ${
                  sel
                    ? "bg-green-500/10 border-green-500 text-green-500"
                    : "border-slate-700 bg-[#0f1521]/30 text-slate-400 hover:bg-[#0f1521] hover:border-slate-400/50"
                }`}
              >
                <span className="material-symbols-outlined mb-3 text-4xl">
                  {opt.icon}
                </span>
                <span
                  className={`text-base font-bold mb-1 ${sel ? "text-white" : ""}`}
                >
                  {opt.label}
                </span>
                <span className="text-xs text-center opacity-70 px-2">
                  {opt.desc}
                </span>
                {sel && (
                  <div className="absolute top-3 right-3 text-green-500">
                    <span className="material-symbols-outlined text-xl">
                      check_circle
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Contributing factors (optional multi-select) */}
      <div className="space-y-3">
        <label className="block text-sm font-bold text-white uppercase tracking-wide">
          Contributing Factors{" "}
          <span className="text-slate-400 text-[10px] font-normal normal-case ml-2">
            (optional)
          </span>
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
                    ? "bg-green-500/10 text-green-400 border border-green-500/40"
                    : "bg-[#0f1521]/30 text-slate-400 border border-slate-700 hover:text-slate-200 hover:border-slate-500"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-3">
        <label className="block text-sm font-bold text-white uppercase tracking-wide">
          Notes
        </label>
        <textarea
          rows={4}
          maxLength={500}
          placeholder="Add any details about your fatigue levels, sleep quality, or specific areas of soreness..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full bg-[#0f1521]/30 border border-slate-700 text-white text-sm rounded-lg focus:ring-green-500 focus:border-green-500 block p-3 min-h-[120px] placeholder-slate-500/50 resize-none"
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
// Shared: Time Constraint Selector (segmented control)
// ---------------------------------------------------------------------------

function TimeConstraintSelector({
  value,
  onChange,
  customTime,
  onCustomChange,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  customTime: string;
  onCustomChange: (v: string) => void;
}) {
  const isCustom = value === -1;
  return (
    <div className="space-y-3">
      <label className="block text-sm font-bold text-white uppercase tracking-wide">
        Time Constraint
      </label>
      <div className="flex rounded-lg bg-[#0f1521]/30 p-1 border border-slate-700">
        {[
          { label: "30m", val: 30 },
          { label: "45m", val: 45 },
          { label: "Custom", val: -1 },
        ].map((opt) => (
          <button
            key={opt.val}
            onClick={() => onChange(opt.val)}
            className={`flex-1 text-xs font-bold text-center py-2 rounded-md transition-all ${
              value === opt.val
                ? "bg-green-500 text-white"
                : "text-slate-400"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {isCustom && (
        <input
          type="number"
          min={1}
          placeholder="Minutes"
          value={customTime}
          onChange={(e) => onCustomChange(e.target.value)}
          className="w-24 bg-[#0f1521]/30 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-500/50 focus:outline-none focus:border-green-500"
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
    <div className="space-y-3 pt-5 border-t border-slate-700">
      <div className="flex justify-between items-center">
        <button
          onClick={onBack}
          disabled={saving}
          className="text-sm font-medium text-slate-400 hover:text-white transition-colors flex items-center gap-1 group"
        >
          <span className="material-symbols-outlined text-lg group-hover:-translate-x-1 transition-transform">
            arrow_back
          </span>
          Back
        </button>
        <div className="flex items-center gap-3">
          {saveError && (
            <span className="text-xs text-red-400">{saveError}</span>
          )}
          <button
            onClick={onSubmit}
            disabled={saving}
            className={`px-8 py-3 rounded-lg text-sm font-bold transition-all flex items-center gap-2 active:scale-[0.98] ${
              saving
                ? "bg-green-500/50 text-white cursor-not-allowed"
                : "bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/20 hover:shadow-green-500/30"
            }`}
          >
            {saving ? "Saving..." : "Confirm Calibration"}
            {!saving && (
              <span className="material-symbols-outlined text-lg leading-none font-bold">
                check
              </span>
            )}
          </button>
        </div>
      </div>
      {onSkip && (
        <div className="flex justify-center">
          <button
            onClick={onSkip}
            disabled={saving}
            className="text-sm font-medium text-slate-400 hover:text-white transition-colors"
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
