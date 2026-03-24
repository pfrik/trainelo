import { useState, useCallback } from "react";
import { Target, ChevronRight, ChevronLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import type { CreateGoalInput } from "@/hooks/useGoals";

// ============================================================================
// Types
// ============================================================================

type Step = "sport" | "details" | "fitness" | "review";

interface SportOption {
  value: string;
  label: string;
  icon: string;
  distances: Array<{ label: string; km: number; category: string }>;
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
      { label: "5K", km: 5, category: "sprint" },
      { label: "10K", km: 10, category: "short" },
      { label: "Half Marathon", km: 21.1, category: "medium" },
      { label: "Marathon", km: 42.2, category: "long" },
      { label: "50K Ultra", km: 50, category: "ultra" },
      { label: "60K Ultra", km: 60, category: "ultra" },
      { label: "100K Ultra", km: 100, category: "ultra" },
    ],
  },
  {
    value: "cycling",
    label: "Cycling",
    icon: "pedal_bike",
    distances: [
      { label: "Gran Fondo (100km)", km: 100, category: "medium" },
      { label: "Century (160km)", km: 160, category: "long" },
      { label: "Double Century (200km+)", km: 200, category: "long" },
    ],
  },
  {
    value: "triathlon",
    label: "Triathlon",
    icon: "pool",
    distances: [
      { label: "Sprint", km: 25.75, category: "sprint" },
      { label: "Olympic", km: 51.5, category: "medium" },
      { label: "Half Ironman (70.3)", km: 113, category: "long" },
      { label: "Ironman", km: 226, category: "ultra" },
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
  const [sport, setSport] = useState<string>("");
  const [distanceKm, setDistanceKm] = useState<number>(0);
  const [distanceLabel, setDistanceLabel] = useState<string>("");
  const [customDistance, setCustomDistance] = useState<string>("");
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

  const handleSelectDistance = useCallback(
    (km: number, label: string) => {
      setDistanceKm(km);
      setDistanceLabel(label);
      setCustomDistance("");
    },
    [],
  );

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
  }, [
    onSubmit,
    onGeneratePlan,
    onClose,
    eventName,
    targetDate,
    sport,
    distanceKm,
    targetTimeMinutes,
    priority,
    trainingDays,
  ]);

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {(["sport", "details", "fitness", "review"] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            {i > 0 && <ChevronRight className="h-3 w-3" />}
            <span
              className={cn(
                "capitalize",
                step === s && "text-foreground font-medium",
              )}
            >
              {s}
            </span>
          </div>
        ))}
      </div>

      {/* Step 1: Sport Selection */}
      {step === "sport" && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">What are you training for?</h3>

          {/* Sport cards */}
          <div className="grid grid-cols-3 gap-3">
            {SPORTS.map((s) => (
              <button
                key={s.value}
                onClick={() => {
                  setSport(s.value);
                  setDistanceKm(0);
                  setDistanceLabel("");
                }}
                className={cn(
                  "flex flex-col items-center gap-2 p-4 rounded-lg border transition-colors",
                  sport === s.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-muted-foreground",
                )}
              >
                <span className="material-symbols-outlined text-2xl">
                  {s.icon}
                </span>
                <span className="text-sm font-medium">{s.label}</span>
              </button>
            ))}
          </div>

          {/* Distance selection */}
          {selectedSport && (
            <div className="space-y-3">
              <Label>Distance</Label>
              <div className="flex flex-wrap gap-2">
                {selectedSport.distances.map((d) => (
                  <button
                    key={d.km}
                    onClick={() => handleSelectDistance(d.km, d.label)}
                    className={cn(
                      "px-3 py-1.5 rounded-md text-sm border transition-colors",
                      distanceKm === d.km && customDistance === ""
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-muted-foreground",
                    )}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder="Custom distance (km)"
                  value={customDistance}
                  onChange={(e) => handleCustomDistance(e.target.value)}
                  className="w-48"
                />
                <span className="text-sm text-muted-foreground">km</span>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <Button
              onClick={() => setStep("details")}
              disabled={!canProceedFromSport}
            >
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Event Details */}
      {step === "details" && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Event details</h3>

          <div className="space-y-3">
            <div>
              <Label htmlFor="eventName">Event name</Label>
              <Input
                id="eventName"
                placeholder="e.g., Texel 60km Ultra Trail"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="targetDate">Race date</Label>
              <Input
                id="targetDate"
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
              />
            </div>

            <div>
              <Label>Target time (optional)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder="HH"
                  value={targetHours}
                  onChange={(e) => setTargetHours(e.target.value)}
                  className="w-20"
                  min={0}
                  max={24}
                />
                <span className="text-muted-foreground">h</span>
                <Input
                  type="number"
                  placeholder="MM"
                  value={targetMinutes}
                  onChange={(e) => setTargetMinutes(e.target.value)}
                  className="w-20"
                  min={0}
                  max={59}
                />
                <span className="text-muted-foreground">min</span>
              </div>
            </div>

            <div>
              <Label>Race priority</Label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {PRIORITIES.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => setPriority(p.value)}
                    className={cn(
                      "p-3 rounded-lg border text-left transition-colors",
                      priority === p.value
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-muted-foreground",
                    )}
                  >
                    <div className="font-medium text-sm">{p.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {p.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep("sport")}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            <Button
              onClick={() => setStep("fitness")}
              disabled={!canProceedFromDetails}
            >
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Fitness / Availability */}
      {step === "fitness" && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Training availability</h3>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Training days per week</Label>
                <span className="text-sm font-medium tabular-nums">
                  {trainingDays} days
                </span>
              </div>
              <Slider
                value={[trainingDays]}
                onValueChange={([v]) => setTrainingDays(v)}
                min={3}
                max={6}
                step={1}
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>3</span>
                <span>4</span>
                <span>5</span>
                <span>6</span>
              </div>
            </div>
          </div>

          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep("details")}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            <Button onClick={() => setStep("review")}>
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Review */}
      {step === "review" && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Review your goal</h3>

          <div className="rounded-lg border border-border p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Target className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="font-semibold">{eventName}</div>
                <div className="text-sm text-muted-foreground">
                  {selectedSport?.label} — {distanceLabel || `${distanceKm}km`}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-muted-foreground">Race date</div>
                <div className="font-medium">
                  {new Date(targetDate + "T00:00:00").toLocaleDateString(
                    "en-US",
                    { month: "long", day: "numeric", year: "numeric" },
                  )}
                </div>
              </div>
              {targetTimeMinutes && (
                <div>
                  <div className="text-muted-foreground">Target time</div>
                  <div className="font-medium">
                    {Math.floor(targetTimeMinutes / 60)}h{" "}
                    {targetTimeMinutes % 60}min
                  </div>
                </div>
              )}
              <div>
                <div className="text-muted-foreground">Priority</div>
                <div className="font-medium">
                  {PRIORITIES.find((p) => p.value === priority)?.label}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Training days</div>
                <div className="font-medium">{trainingDays} days/week</div>
              </div>
            </div>
          </div>

          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep("fitness")}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating plan...
                </>
              ) : (
                "Create Goal & Generate Plan"
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
