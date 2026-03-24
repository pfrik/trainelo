import { useState, useCallback } from "react";
import { ChevronRight, ChevronLeft } from "lucide-react";
import type { CreateGoalInput } from "@/hooks/useGoals";

// ============================================================================
// Types
// ============================================================================

type Step = "sport" | "details" | "fitness" | "review";

interface SportOption {
  value: string;
  label: string;
  icon: string;
  distances: Array<{ label: string; km: number }>;
}

// ============================================================================
// Constants
// ============================================================================

const SPORTS: SportOption[] = [
  {
    value: "running",
    label: "Running",
    icon: "directions_run",
    distances: [
      { label: "5K", km: 5 },
      { label: "10K", km: 10 },
      { label: "Half Marathon", km: 21.1 },
      { label: "Marathon", km: 42.2 },
      { label: "50K Ultra", km: 50 },
      { label: "60K Ultra", km: 60 },
      { label: "100K Ultra", km: 100 },
    ],
  },
  {
    value: "cycling",
    label: "Cycling",
    icon: "pedal_bike",
    distances: [
      { label: "Gran Fondo (100km)", km: 100 },
      { label: "Century (160km)", km: 160 },
      { label: "Double Century (200km+)", km: 200 },
    ],
  },
  {
    value: "triathlon",
    label: "Triathlon",
    icon: "pool",
    distances: [
      { label: "Sprint", km: 25.75 },
      { label: "Olympic", km: 51.5 },
      { label: "Half Ironman (70.3)", km: 113 },
      { label: "Ironman", km: 226 },
    ],
  },
];

const PRIORITIES = [
  { value: "A", label: "A Race", desc: "Primary goal — plan revolves around this" },
  { value: "B", label: "B Race", desc: "Important but secondary" },
  { value: "C", label: "C Race", desc: "Training race / tune-up" },
];

// ============================================================================
// Component
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

  // Form state
  const [sport, setSport] = useState("");
  const [distanceKm, setDistanceKm] = useState(0);
  const [distanceLabel, setDistanceLabel] = useState("");
  const [customDistance, setCustomDistance] = useState("");
  const [eventName, setEventName] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [targetHours, setTargetHours] = useState("");
  const [targetMinutes, setTargetMinutes] = useState("");
  const [priority, setPriority] = useState("A");
  const [trainingDays, setTrainingDays] = useState(5);

  const selectedSport = SPORTS.find((s) => s.value === sport);
  const canProceedFromSport = sport !== "" && distanceKm > 0;
  const canProceedFromDetails = eventName.trim() !== "" && targetDate !== "";

  const targetTimeMinutes =
    (parseInt(targetHours) || 0) * 60 + (parseInt(targetMinutes) || 0) || undefined;

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
      setDistanceLabel(`${num}km`);
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
      });

      if (result?.goalId) {
        await onGeneratePlan(result.goalId);
        onClose();
      }
    } finally {
      setSubmitting(false);
    }
  }, [onSubmit, onGeneratePlan, onClose, eventName, targetDate, sport, distanceKm, targetTimeMinutes, priority, trainingDays]);

  const steps: Step[] = ["sport", "details", "fitness", "review"];

  return (
    <div className="space-y-6">
      {/* Progress indicator */}
      <div className="flex items-center gap-2 text-sm">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            {i > 0 && <ChevronRight className="h-3 w-3 text-slate-600" />}
            <span className={step === s ? "text-white font-medium" : "text-slate-500 capitalize"}>
              {s}
            </span>
          </div>
        ))}
      </div>

      {/* Step 1: Sport */}
      {step === "sport" && (
        <div className="space-y-5">
          <h3 className="text-lg font-bold text-white">What are you training for?</h3>

          <div className="grid grid-cols-3 gap-3">
            {SPORTS.map((s) => (
              <button
                key={s.value}
                onClick={() => { setSport(s.value); setDistanceKm(0); setDistanceLabel(""); }}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors ${
                  sport === s.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-slate-700 hover:border-slate-500 text-slate-300"
                }`}
              >
                <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: '"FILL" 1' }}>
                  {s.icon}
                </span>
                <span className="text-sm font-medium">{s.label}</span>
              </button>
            ))}
          </div>

          {selectedSport && (
            <div className="space-y-3">
              <label className="text-sm font-medium text-slate-300">Distance</label>
              <div className="flex flex-wrap gap-2">
                {selectedSport.distances.map((d) => (
                  <button
                    key={d.km}
                    onClick={() => handleSelectDistance(d.km, d.label)}
                    className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                      distanceKm === d.km && customDistance === ""
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-slate-700 text-slate-300 hover:border-slate-500"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Custom distance"
                  value={customDistance}
                  onChange={(e) => handleCustomDistance(e.target.value)}
                  className="w-40 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm placeholder-slate-500 focus:border-primary focus:outline-none"
                />
                <span className="text-sm text-slate-500">km</span>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={() => setStep("details")}
              disabled={!canProceedFromSport}
              className="flex items-center gap-1 px-4 py-2.5 bg-primary text-slate-900 rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Details */}
      {step === "details" && (
        <div className="space-y-5">
          <h3 className="text-lg font-bold text-white">Event details</h3>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-300 mb-1.5 block">Event name</label>
              <input
                placeholder="e.g., Texel 60km Ultra Trail"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm placeholder-slate-500 focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-300 mb-1.5 block">Race date</label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-300 mb-1.5 block">Target time (optional)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="HH"
                  value={targetHours}
                  onChange={(e) => setTargetHours(e.target.value)}
                  className="w-20 px-3 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm text-center focus:border-primary focus:outline-none"
                  min={0} max={24}
                />
                <span className="text-slate-500">h</span>
                <input
                  type="number"
                  placeholder="MM"
                  value={targetMinutes}
                  onChange={(e) => setTargetMinutes(e.target.value)}
                  className="w-20 px-3 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm text-center focus:border-primary focus:outline-none"
                  min={0} max={59}
                />
                <span className="text-slate-500">min</span>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-300 mb-1.5 block">Race priority</label>
              <div className="grid grid-cols-3 gap-2">
                {PRIORITIES.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => setPriority(p.value)}
                    className={`p-3 rounded-xl border text-left transition-colors ${
                      priority === p.value
                        ? "border-primary bg-primary/10"
                        : "border-slate-700 hover:border-slate-500"
                    }`}
                  >
                    <div className="font-bold text-sm text-white">{p.label}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{p.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-between">
            <button onClick={() => setStep("sport")} className="flex items-center gap-1 text-sm text-slate-400 hover:text-white transition-colors">
              <ChevronLeft className="h-4 w-4" /> Back
            </button>
            <button
              onClick={() => setStep("fitness")}
              disabled={!canProceedFromDetails}
              className="flex items-center gap-1 px-4 py-2.5 bg-primary text-slate-900 rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Fitness / Availability */}
      {step === "fitness" && (
        <div className="space-y-5">
          <h3 className="text-lg font-bold text-white">Training availability</h3>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-slate-300">Training days per week</label>
              <span className="text-sm font-bold text-white tabular-nums">{trainingDays} days</span>
            </div>
            <div className="flex gap-2">
              {[3, 4, 5, 6].map((d) => (
                <button
                  key={d}
                  onClick={() => setTrainingDays(d)}
                  className={`flex-1 py-3 rounded-xl text-sm font-bold border transition-colors ${
                    trainingDays === d
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-slate-700 text-slate-300 hover:border-slate-500"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-between">
            <button onClick={() => setStep("details")} className="flex items-center gap-1 text-sm text-slate-400 hover:text-white transition-colors">
              <ChevronLeft className="h-4 w-4" /> Back
            </button>
            <button
              onClick={() => setStep("review")}
              className="flex items-center gap-1 px-4 py-2.5 bg-primary text-slate-900 rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Review */}
      {step === "review" && (
        <div className="space-y-5">
          <h3 className="text-lg font-bold text-white">Review your goal</h3>

          <div className="rounded-xl bg-slate-800/50 border border-slate-700 p-5 space-y-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl text-primary" style={{ fontVariationSettings: '"FILL" 1' }}>
                  {selectedSport?.icon ?? "flag"}
                </span>
              </div>
              <div>
                <div className="font-bold text-white">{eventName}</div>
                <div className="text-sm text-slate-400">
                  {selectedSport?.label} — {distanceLabel || `${distanceKm}km`}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-800 rounded-lg p-3">
                <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Race Date</div>
                <div className="text-sm font-bold text-white">
                  {targetDate
                    ? new Date(targetDate + "T00:00:00").toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "—"}
                </div>
              </div>
              {targetTimeMinutes ? (
                <div className="bg-slate-800 rounded-lg p-3">
                  <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Target Time</div>
                  <div className="text-sm font-bold text-white">
                    {Math.floor(targetTimeMinutes / 60)}h {targetTimeMinutes % 60}min
                  </div>
                </div>
              ) : null}
              <div className="bg-slate-800 rounded-lg p-3">
                <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Priority</div>
                <div className="text-sm font-bold text-white">
                  {PRIORITIES.find((p) => p.value === priority)?.label}
                </div>
              </div>
              <div className="bg-slate-800 rounded-lg p-3">
                <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Training Days</div>
                <div className="text-sm font-bold text-white">{trainingDays} days/week</div>
              </div>
            </div>
          </div>

          <div className="flex justify-between">
            <button onClick={() => setStep("fitness")} className="flex items-center gap-1 text-sm text-slate-400 hover:text-white transition-colors">
              <ChevronLeft className="h-4 w-4" /> Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-slate-900 rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-900"></div>
                  Generating plan...
                </>
              ) : (
                "Create Goal & Generate Plan"
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
