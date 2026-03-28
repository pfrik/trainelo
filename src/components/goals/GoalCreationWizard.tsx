import { useState, useCallback, useMemo } from "react";
import type { CreateGoalInput } from "@/hooks/useGoals";

// ============================================================================
// Types
// ============================================================================

type Step = "sport" | "details";

interface SportOption {
  value: string;
  label: string;
  icon: string;
  disabled?: boolean;
  distances: Array<{ label: string; km: number }>;
}

type CourseProfile = "flat" | "rolling" | "hilly" | "mountain";
type GoalTarget = "finish" | "time";

// ============================================================================
// Constants
// ============================================================================

const SPORTS: SportOption[] = [
  {
    value: "running",
    label: "Running",
    icon: "directions_run",
    distances: [
      { label: "Full Marathon", km: 42.2 },
      { label: "Half Marathon", km: 21.1 },
      { label: "10 KM Run", km: 10 },
      { label: "5 KM Run", km: 5 },
      { label: "50K Ultra", km: 50 },
      { label: "60K Ultra", km: 60 },
      { label: "100K Ultra", km: 100 },
    ],
  },
  {
    value: "cycling",
    label: "Cycling",
    icon: "directions_bike",
    distances: [
      { label: "Gran Fondo (100km)", km: 100 },
      { label: "Century (160km)", km: 160 },
      { label: "Double Century (200km+)", km: 200 },
    ],
  },
  {
    value: "swimming",
    label: "Swimming",
    icon: "pool",
    disabled: true,
    distances: [],
  },
  {
    value: "triathlon",
    label: "Triathlon",
    icon: "social_leaderboard",
    distances: [
      { label: "Sprint", km: 25.75 },
      { label: "Olympic", km: 51.5 },
      { label: "Half Ironman (70.3)", km: 113 },
      { label: "Ironman", km: 226 },
    ],
  },
];

const PRIORITIES = [
  { value: "A", label: "Target Goal", desc: "Includes a full 2-3 week taper and peak for maximum performance." },
  { value: "B", label: "Tune-Up", desc: "Intermediate races with a partial taper to test fitness." },
  { value: "C", label: "Training", desc: "Low-stakes races with no taper, used as a high-intensity workout." },
];

const COURSE_PROFILES: Array<{ value: CourseProfile; label: string; icon: string }> = [
  { value: "flat", label: "Flat", icon: "horizontal_rule" },
  { value: "rolling", label: "Rolling", icon: "trending_up" },
  { value: "hilly", label: "Hilly", icon: "terrain" },
  { value: "mountain", label: "Mountain", icon: "landscape" },
];

// ============================================================================
// Subcomponents
// ============================================================================

function SelectionBox({
  active,
  disabled,
  onClick,
  children,
  className = "",
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`
        border rounded-2xl transition-all duration-200
        ${active
          ? "border-primary bg-primary/5 shadow-[0_0_0_1px_#22C55E]"
          : "border-white/10 bg-slate-700 hover:border-white/25 hover:bg-slate-600"
        }
        ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}
        ${className}
      `}
    >
      {children}
    </button>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="mb-14">
      <div className="flex justify-between items-end mb-4">
        <div />
        <span className="font-headline text-2xl font-bold text-primary">{percent}%</span>
      </div>
      <div className="h-1.5 w-full bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-primary shadow-[0_0_15px_rgba(34,197,94,0.4)] transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function SectionLabel({ children, optional }: { children: React.ReactNode; optional?: boolean }) {
  return (
    <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-4">
      {children}
      {optional && <span className="text-slate-500/60 normal-case italic ml-2 font-normal">(Optional)</span>}
    </label>
  );
}

// ============================================================================
// Main Component
// ============================================================================

interface GoalCreationWizardProps {
  onSubmit: (input: CreateGoalInput) => Promise<{ goalId: string } | null>;
  onGeneratePlan: (goalId: string) => Promise<unknown>;
  onClose: () => void;
}

export function GoalCreationWizard({
  onSubmit,
  onGeneratePlan,
  onClose,
}: GoalCreationWizardProps) {
  const [step, setStep] = useState<Step>("sport");
  const [submitting, setSubmitting] = useState(false);

  // Step 1: Sport
  const [sport, setSport] = useState("");

  // Step 2: Details
  const [eventName, setEventName] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [distanceKm, setDistanceKm] = useState(0);
  const [distanceLabel, setDistanceLabel] = useState("");
  const [customDistance, setCustomDistance] = useState("");
  const [priority, setPriority] = useState("A");
  const [goalTarget, setGoalTarget] = useState<GoalTarget>("time");
  const [targetTime, setTargetTime] = useState("");
  const [courseProfile, setCourseProfile] = useState<CourseProfile | null>(null);
  const [trainingDays, setTrainingDays] = useState(5);
  const [weeklyVolume, setWeeklyVolume] = useState(20);

  const selectedSport = SPORTS.find((s) => s.value === sport);

  const daysToGo = useMemo(() => {
    if (!targetDate) return null;
    const diff = Math.ceil(
      (new Date(targetDate + "T00:00:00").getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );
    return diff > 0 ? diff : null;
  }, [targetDate]);

  const canContinue = sport !== "";
  const canGenerate = eventName.trim() !== "" && targetDate !== "" && distanceKm > 0;

  // Parse target time HH:MM:SS → minutes
  const targetTimeMinutes = useMemo(() => {
    if (goalTarget === "finish" || !targetTime) return undefined;
    const parts = targetTime.split(":").map(Number);
    if (parts.length >= 2) {
      const h = parts[0] || 0;
      const m = parts[1] || 0;
      const s = parts[2] || 0;
      const total = h * 60 + m + s / 60;
      return total > 0 ? Math.round(total) : undefined;
    }
    return undefined;
  }, [goalTarget, targetTime]);

  const handleSelectDistance = useCallback((km: number, label: string) => {
    setDistanceKm(km);
    setDistanceLabel(label);
    setCustomDistance("");
  }, []);

  const handleCustomDistance = useCallback((value: string) => {
    setCustomDistance(value);
    const num = parseFloat(value);
    if (!isNaN(num) && num > 0) {
      setDistanceKm(num);
      setDistanceLabel(`${num} km`);
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    try {
      const result = await onSubmit({
        title: eventName,
        target_date: targetDate,
        sport,
        race_distance_km: distanceKm,
        target_time_minutes: targetTimeMinutes,
        priority,
        training_days_per_week: trainingDays,
        current_weekly_volume_km: weeklyVolume,
      });

      if (result?.goalId) {
        await onGeneratePlan(result.goalId);
        onClose();
      }
    } finally {
      setSubmitting(false);
    }
  }, [onSubmit, onGeneratePlan, onClose, eventName, targetDate, sport, distanceKm, targetTimeMinutes, priority, trainingDays, weeklyVolume]);

  // ========================================================================
  // Screen 1: Sport Selection
  // ========================================================================

  if (step === "sport") {
    return (
      <div>
        <ProgressBar percent={33} />

        <h1 className="font-headline text-4xl font-bold tracking-tight uppercase mb-4">
          Sport Selection
        </h1>

        <p className="text-slate-400 text-base max-w-xl mx-auto text-center leading-relaxed mb-12">
          Select your primary sport for your training engine. We'll calibrate your cycles based on your choice.
        </p>

        {/* Sport Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {SPORTS.map((s) => (
            <SelectionBox
              key={s.value}
              active={sport === s.value}
              disabled={s.disabled}
              onClick={() => setSport(s.value)}
              className="relative flex flex-col items-center p-8 group"
            >
              {/* Selected badge */}
              {sport === s.value && (
                <div className="absolute bg-primary text-black text-[10px] font-black uppercase px-2 py-0.5 rounded-sm tracking-widest shadow-lg -top-2.5 left-1/2 -translate-x-1/2 z-20">
                  Selected
                </div>
              )}

              {/* Disabled badge */}
              {s.disabled && (
                <div className="absolute bg-slate-600 text-slate-300 text-[9px] font-bold uppercase px-2 py-0.5 rounded-sm tracking-widest -top-2.5 left-1/2 -translate-x-1/2 z-20">
                  Coming soon
                </div>
              )}

              <div className={`mb-6 h-16 w-16 rounded-xl flex items-center justify-center transition-transform duration-500 ${
                sport === s.value
                  ? "bg-primary/10"
                  : "bg-slate-800 border border-white/5 group-hover:scale-110"
              }`}>
                <span
                  className={`material-symbols-outlined text-3xl transition-colors ${
                    sport === s.value ? "text-primary" : "text-slate-400 group-hover:text-primary"
                  }`}
                  style={{ fontVariationSettings: sport === s.value ? '"FILL" 1' : '"FILL" 0' }}
                >
                  {s.icon}
                </span>
              </div>

              <h3 className="font-headline font-bold text-lg tracking-tight text-white uppercase italic">
                {s.label}
              </h3>
            </SelectionBox>
          ))}
        </div>

        {/* Continue */}
        <div className="flex flex-col items-center gap-6">
          <button
            onClick={() => setStep("details")}
            disabled={!canContinue}
            className="w-full md:w-auto px-16 py-5 rounded-2xl bg-primary hover:bg-[#2be06b] text-black font-headline font-bold text-sm uppercase tracking-widest shadow-[0_20px_40px_-10px_rgba(34,197,94,0.25)] transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            Continue
          </button>
          <p className="text-slate-500 text-[11px] flex items-center gap-2 tracking-wide">
            <span className="material-symbols-outlined text-sm">info</span>
            You can add secondary sports later in your profile.
          </p>
        </div>
      </div>
    );
  }

  // ========================================================================
  // Screen 2: Race Details
  // ========================================================================

  return (
    <div>
      <ProgressBar percent={66} />

      <h1 className="font-headline text-4xl font-bold tracking-tight uppercase mb-10">
        Race Details
      </h1>

      <div className="space-y-12">
        {/* Row 1: Race Name + Date */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2">
            <SectionLabel>Race Name</SectionLabel>
            <div className="relative">
              <input
                type="text"
                placeholder="e.g., Berlin Marathon"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                className="w-full bg-slate-700/50 border border-white/10 rounded-xl px-5 py-4 text-white focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-slate-500/50 transition-all font-medium text-lg"
              />
              <span className="material-symbols-outlined absolute right-5 top-1/2 -translate-y-1/2 text-slate-500/40">flag</span>
            </div>
          </div>
          <div>
            <SectionLabel>Race Date</SectionLabel>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="w-full bg-slate-700/50 border border-white/10 rounded-xl px-5 py-4 text-white focus:ring-1 focus:ring-primary focus:border-primary transition-all font-medium text-lg [color-scheme:dark]"
            />
            {daysToGo && (
              <p className="text-[11px] text-primary font-bold uppercase tracking-widest mt-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: '"FILL" 1' }}>timer</span>
                {daysToGo} Days to Go
              </p>
            )}
          </div>
        </section>

        {/* Row 2: Distance + Priority */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-8 border-t border-white/5">
          {/* Distance */}
          <div>
            <SectionLabel>Race Distance</SectionLabel>
            <div className="grid grid-cols-2 gap-3">
              {(selectedSport?.distances ?? []).slice(0, 4).map((d) => (
                <SelectionBox
                  key={d.km}
                  active={distanceKm === d.km && customDistance === ""}
                  onClick={() => handleSelectDistance(d.km, d.label)}
                  className="px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-center"
                >
                  <span className={distanceKm === d.km && customDistance === "" ? "text-white" : "text-slate-300"}>
                    {d.label}
                  </span>
                </SelectionBox>
              ))}
              <div className="col-span-2 mt-2">
                <div className="relative w-48">
                  <input
                    type="text"
                    placeholder="Custom (KM)"
                    value={customDistance}
                    onChange={(e) => handleCustomDistance(e.target.value)}
                    className="w-full bg-slate-700/50 border border-white/10 rounded-lg px-4 py-3 text-[10px] font-bold text-white focus:ring-1 focus:ring-primary placeholder:text-slate-500/30 uppercase tracking-widest"
                  />
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-[16px] text-slate-500/40">edit_note</span>
                </div>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-5 italic">
              Distances for {selectedSport?.label ?? "..."}.{" "}
              <button
                onClick={() => { setSport(""); setDistanceKm(0); setDistanceLabel(""); setCustomDistance(""); setStep("sport"); }}
                className="text-primary hover:underline font-bold uppercase ml-1 not-italic"
              >
                Change Sport?
              </button>
            </p>
          </div>

          {/* Priority */}
          <div>
            <div className="flex items-center gap-2 mb-5">
              <SectionLabel>Race Priority</SectionLabel>
              <div className="group relative -mt-4">
                <span className="material-symbols-outlined text-[18px] text-slate-500/40 cursor-help hover:text-primary transition-colors">info</span>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-64 p-4 bg-slate-800 border border-white/10 rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none">
                  <div className="space-y-3">
                    <div>
                      <span className="text-primary font-bold text-[10px] uppercase block mb-1">A - Peak Performance</span>
                      <p className="text-[11px] text-slate-400 leading-relaxed">Target goals with a full 2-3 week taper for maximum results.</p>
                    </div>
                    <div>
                      <span className="text-white/80 font-bold text-[10px] uppercase block mb-1">B - Tune-Up</span>
                      <p className="text-[11px] text-slate-400 leading-relaxed">Intermediate races with a partial taper to test fitness.</p>
                    </div>
                    <div>
                      <span className="text-white/80 font-bold text-[10px] uppercase block mb-1">C - Training</span>
                      <p className="text-[11px] text-slate-400 leading-relaxed">Low-stakes races with no taper, used as a high-intensity workout.</p>
                    </div>
                  </div>
                  <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-8 border-transparent border-t-slate-800" />
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              {PRIORITIES.map((p) => (
                <label
                  key={p.value}
                  className={`flex-1 block text-center py-5 rounded-2xl border cursor-pointer transition-all ${
                    priority === p.value
                      ? "border-primary bg-primary/5 shadow-[0_0_0_1px_#22C55E]"
                      : "border-white/10 bg-slate-700/50 hover:bg-slate-700"
                  }`}
                >
                  <input
                    type="radio"
                    name="priority"
                    value={p.value}
                    checked={priority === p.value}
                    onChange={() => setPriority(p.value)}
                    className="hidden"
                  />
                  <span className={`block font-headline font-black text-3xl mb-1 ${priority === p.value ? "text-primary" : "text-slate-400"}`}>
                    {p.value}
                  </span>
                  <span className={`block text-[9px] font-bold uppercase tracking-widest ${priority === p.value ? "text-primary" : "text-slate-400"}`}>
                    {p.label}
                  </span>
                </label>
              ))}
            </div>
            <div className="mt-4 p-5 rounded-2xl bg-slate-700/30 border border-white/5">
              <p className="text-[12px] text-slate-400 leading-relaxed">
                <span className="font-bold text-primary uppercase mr-2">
                  {priority}-Race:
                </span>
                {PRIORITIES.find((p) => p.value === priority)?.desc}
              </p>
            </div>
          </div>
        </section>

        {/* Row 3: Goal Target */}
        <section className="pt-8 border-t border-white/5">
          <SectionLabel>Goal Target</SectionLabel>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-stretch">
            <div className="flex gap-4">
              {/* Just Finish */}
              <SelectionBox
                active={goalTarget === "finish"}
                onClick={() => setGoalTarget("finish")}
                className="flex-1 flex flex-col items-center justify-center p-8 text-center"
              >
                <span className={`material-symbols-outlined text-4xl mb-4 transition-colors ${goalTarget === "finish" ? "text-primary" : "text-slate-400"}`}>
                  check_circle
                </span>
                <span className="font-headline font-bold text-xl uppercase tracking-tight text-white">Just Finish</span>
                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-2">Endurance focus</span>
              </SelectionBox>

              {/* Specific Time */}
              <SelectionBox
                active={goalTarget === "time"}
                onClick={() => setGoalTarget("time")}
                className="flex-1 flex flex-col items-center justify-center p-8 text-center"
              >
                <span
                  className={`material-symbols-outlined text-4xl mb-4 transition-colors ${goalTarget === "time" ? "text-primary" : "text-slate-400"}`}
                  style={{ fontVariationSettings: '"FILL" 1' }}
                >
                  timer
                </span>
                <span className="font-headline font-bold text-xl uppercase tracking-tight text-white">Specific Time</span>
                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-2">Performance focus</span>
              </SelectionBox>
            </div>

            {/* Target Time Input */}
            <div className={`flex flex-col justify-center transition-all duration-300 ${goalTarget === "finish" ? "opacity-20 pointer-events-none" : ""}`}>
              <SectionLabel>Target Finish Time (HH:MM:SS)</SectionLabel>
              <div className="relative">
                <input
                  type="text"
                  placeholder="03:45:00"
                  value={targetTime}
                  onChange={(e) => setTargetTime(e.target.value)}
                  className="w-full bg-slate-700/50 border border-white/10 rounded-xl px-6 py-5 text-white font-headline font-bold text-3xl placeholder:text-slate-500/20 focus:ring-1 focus:ring-primary focus:border-primary transition-all tracking-tight"
                />
                <span className="material-symbols-outlined absolute right-6 top-1/2 -translate-y-1/2 text-slate-500/40">edit</span>
              </div>
              <div className="mt-4 p-4 rounded-xl bg-primary/5 border border-primary/10">
                <p className="text-[12px] text-slate-400 font-medium">
                  Based on your calibration, we'll suggest a challenging target once your plan is active.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Row 4: Course Profile */}
        <section className="pt-8 border-t border-white/5">
          <SectionLabel optional>Course Profile</SectionLabel>
          <div className="flex flex-wrap gap-3">
            {COURSE_PROFILES.map((cp) => (
              <SelectionBox
                key={cp.value}
                active={courseProfile === cp.value}
                onClick={() => setCourseProfile(courseProfile === cp.value ? null : cp.value)}
                className="px-8 py-4 flex items-center gap-3"
              >
                <span className={`material-symbols-outlined ${courseProfile === cp.value ? "text-primary" : "text-slate-400"}`}
                  style={{ fontVariationSettings: courseProfile === cp.value ? '"FILL" 1' : '"FILL" 0' }}
                >
                  {cp.icon}
                </span>
                <span className="font-headline font-bold text-sm tracking-wide uppercase text-white">
                  {cp.label}
                </span>
              </SelectionBox>
            ))}
          </div>
        </section>

        {/* Row 5: Sliders */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-8 border-t border-white/5">
          {/* Weekly Training Days */}
          <div>
            <div className="flex justify-between items-center mb-6">
              <SectionLabel optional>Weekly Training Days</SectionLabel>
              <span className="font-headline font-bold text-primary text-3xl -mt-4">
                {trainingDays} <span className="text-[11px] uppercase font-bold text-slate-400 ml-1">Days</span>
              </span>
            </div>
            <div className="relative pt-2">
              <input
                type="range"
                min={3}
                max={7}
                step={1}
                value={trainingDays}
                onChange={(e) => setTrainingDays(Number(e.target.value))}
                className="w-full accent-primary cursor-pointer slider-green"
              />
              <div className="flex justify-between mt-4 px-1">
                <span className="text-[11px] font-bold text-slate-500/60 uppercase tracking-widest">3 Days</span>
                <span className="text-[11px] font-bold text-slate-500/60 uppercase tracking-widest">7 Days</span>
              </div>
            </div>
          </div>

          {/* Current Weekly Volume */}
          <div>
            <div className="flex justify-between items-center mb-6">
              <SectionLabel optional>Current Weekly Volume</SectionLabel>
              <span className="font-headline font-bold text-primary text-3xl -mt-4">
                {weeklyVolume} <span className="text-[11px] uppercase font-bold text-slate-400 ml-1">KM/WK</span>
              </span>
            </div>
            <div className="relative pt-2">
              <input
                type="range"
                min={0}
                max={150}
                step={1}
                value={weeklyVolume}
                onChange={(e) => setWeeklyVolume(Number(e.target.value))}
                className="w-full accent-primary cursor-pointer slider-green"
              />
              <div className="flex justify-between mt-4 px-1">
                <span className="text-[11px] font-bold text-slate-500/60 uppercase tracking-widest">0 KM/WK</span>
                <span className="text-[11px] font-bold text-slate-500/60 uppercase tracking-widest">150 KM/WK</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Footer Navigation */}
      <footer className="flex flex-col md:flex-row justify-between items-center gap-8 pt-12 mt-12 border-t border-white/5">
        <button
          onClick={() => setStep("sport")}
          className="font-headline font-bold text-[11px] uppercase tracking-[0.25em] text-slate-400 hover:text-white transition-colors flex items-center gap-3 group"
        >
          <span className="material-symbols-outlined text-[20px] group-hover:-translate-x-1 transition-transform">arrow_back</span>
          Previous Step
        </button>
        <button
          onClick={handleSubmit}
          disabled={!canGenerate || submitting}
          className="w-full md:w-auto px-16 py-5 rounded-2xl bg-primary hover:bg-[#2be06b] text-black font-headline font-bold text-sm uppercase tracking-widest shadow-[0_20px_40px_-10px_rgba(34,197,94,0.25)] transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          {submitting ? (
            <span className="flex items-center gap-3">
              <span className="animate-spin material-symbols-outlined text-lg" style={{ fontVariationSettings: '"FILL" 1' }}>progress_activity</span>
              Generating Plan...
            </span>
          ) : (
            "Generate Training Plan"
          )}
        </button>
      </footer>
    </div>
  );
}
