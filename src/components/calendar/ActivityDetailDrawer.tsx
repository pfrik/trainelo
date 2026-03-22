import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { useWorkoutDetail, type WorkoutDetail } from "@/hooks/useWorkoutDetail";

interface ActivityDetailDrawerProps {
  workoutId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ── Sport detection (shared with CalendarWidget) ──

function detectSport(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("run") || t.includes("jog") || t.includes("walk")) return "run";
  if (t.includes("bike") || t.includes("cycling") || t.includes("ride")) return "bike";
  if (t.includes("swim") || t.includes("pool") || t.includes("water")) return "swim";
  if (t.includes("strength") || t.includes("gym") || t.includes("core") || t.includes("weight") || t.includes("fitness"))
    return "strength";
  return "other";
}

const SPORT_META: Record<string, { icon: string; color: string; bg: string }> = {
  run:      { icon: "directions_run",  color: "text-orange-400", bg: "bg-orange-400/10" },
  bike:     { icon: "directions_bike", color: "text-primary",    bg: "bg-primary/10" },
  swim:     { icon: "pool",            color: "text-blue-400",   bg: "bg-blue-400/10" },
  strength: { icon: "fitness_center",  color: "text-purple-400", bg: "bg-purple-400/10" },
  other:    { icon: "fitness_center",  color: "text-slate-400",  bg: "bg-slate-400/10" },
};

// ── Formatters ──

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatPace(seconds: number, meters: number): string {
  if (!meters || meters <= 0) return "--";
  const paceSecsPerKm = seconds / (meters / 1000);
  const m = Math.floor(paceSecsPerKm / 60);
  const s = Math.round(paceSecsPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatSpeed(seconds: number, meters: number): string {
  if (!seconds || seconds <= 0) return "--";
  return ((meters / 1000) / (seconds / 3600)).toFixed(1);
}

function formatDistance(meters: number): string {
  const km = meters / 1000;
  if (km >= 100) return km.toFixed(0);
  if (km >= 10) return km.toFixed(1);
  return km.toFixed(2);
}

function formatActivityType(type: string): string {
  if (!type) return "Workout";
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return { date, time };
}

// ── Components ──

function MetricCard({
  icon,
  label,
  value,
  unit,
}: {
  icon: string;
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <div className="flex flex-col gap-1 p-3 rounded-lg bg-slate-100 dark:bg-white/5">
      <div className="flex items-center gap-1.5">
        <span className="material-symbols-outlined text-slate-400 text-base">
          {icon}
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">
          {label}
        </span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-lg font-bold text-slate-900 dark:text-white">
          {value}
        </span>
        {unit && (
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

function HeartRateBar({ detail }: { detail: WorkoutDetail }) {
  const { avg_heart_rate, max_heart_rate, min_heart_rate } = detail;
  if (!avg_heart_rate) return null;

  const min = min_heart_rate ?? avg_heart_rate;
  const max = max_heart_rate ?? avg_heart_rate;
  const range = max - min || 1;
  const avgPos = ((avg_heart_rate - min) / range) * 100;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5">
        <span className="material-symbols-outlined text-red-400 text-base">
          favorite
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide font-medium">
          Heart Rate
        </span>
      </div>

      {/* Bar visualization */}
      <div className="relative h-2 rounded-full bg-gradient-to-r from-primary/60 via-yellow-400/60 to-red-400/60 overflow-hidden">
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border-2 border-red-400 shadow-sm"
          style={{ left: `clamp(6px, ${avgPos}% - 6px, calc(100% - 6px))` }}
        />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center">
          <p className="text-xs text-slate-500 dark:text-slate-400">Min</p>
          <p className="text-sm font-bold text-slate-900 dark:text-white">
            {min_heart_rate ?? "--"}
            <span className="text-xs font-normal text-slate-400 ml-0.5">bpm</span>
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-slate-500 dark:text-slate-400">Avg</p>
          <p className="text-sm font-bold text-red-400">
            {avg_heart_rate}
            <span className="text-xs font-normal text-slate-400 ml-0.5">bpm</span>
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-slate-500 dark:text-slate-400">Max</p>
          <p className="text-sm font-bold text-slate-900 dark:text-white">
            {max_heart_rate ?? "--"}
            <span className="text-xs font-normal text-slate-400 ml-0.5">bpm</span>
          </p>
        </div>
      </div>
    </div>
  );
}

function DetailContent({ detail }: { detail: WorkoutDetail }) {
  const sport = detectSport(detail.activity_type);
  const meta = SPORT_META[sport] || SPORT_META.other;
  const { date, time } = formatDateTime(detail.started_at);
  const isRunOrWalk = sport === "run";
  const hasPower = !!(detail.avg_power_watts || detail.max_power_watts);
  const hasCadence = !!(detail.avg_cadence || detail.max_cadence);
  const hasElevation = !!(detail.elevation_gain_meters || detail.elevation_loss_meters);
  const hasEnvironment = !!(detail.temperature_celsius !== null || detail.humidity_percent !== null);
  const hasTrainingLoad = !!(detail.training_stress_score || detail.intensity_factor);

  return (
    <div className="flex flex-col gap-5 pb-6 px-4 overflow-y-auto max-h-[70vh]">
      {/* ── Header ── */}
      <div className="flex items-start gap-3">
        <div className={`flex items-center justify-center w-12 h-12 rounded-xl ${meta.bg} shrink-0`}>
          <span
            className={`material-symbols-outlined ${meta.color} text-2xl`}
            style={{ fontVariationSettings: '"FILL" 1' }}
          >
            {meta.icon}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white truncate">
            {detail.title || formatActivityType(detail.activity_type)}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {date}
          </p>
          <p className="text-xs text-slate-400">
            {time}
            {detail.source === "garmin" && (
              <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400">
                <span className="material-symbols-outlined text-xs">watch</span>
                Garmin
              </span>
            )}
          </p>
        </div>
      </div>

      {/* ── Key metrics ── */}
      <div className="grid grid-cols-2 gap-2">
        {detail.distance_meters != null && detail.distance_meters > 0 && (
          <MetricCard
            icon="straighten"
            label="Distance"
            value={formatDistance(detail.distance_meters)}
            unit="km"
          />
        )}
        {detail.duration_seconds != null && (
          <MetricCard
            icon="timer"
            label="Duration"
            value={formatDuration(detail.duration_seconds)}
          />
        )}
        {isRunOrWalk && detail.distance_meters != null && detail.duration_seconds != null && detail.distance_meters > 0 && (
          <MetricCard
            icon="speed"
            label="Avg Pace"
            value={formatPace(detail.duration_seconds, detail.distance_meters)}
            unit="/km"
          />
        )}
        {!isRunOrWalk && detail.distance_meters != null && detail.duration_seconds != null && detail.distance_meters > 0 && (
          <MetricCard
            icon="speed"
            label="Avg Speed"
            value={formatSpeed(detail.duration_seconds, detail.distance_meters)}
            unit="km/h"
          />
        )}
        {detail.calories != null && (
          <MetricCard
            icon="local_fire_department"
            label="Calories"
            value={String(detail.calories)}
            unit="kcal"
          />
        )}
      </div>

      {/* ── Heart Rate ── */}
      {detail.avg_heart_rate != null && (
        <div className="p-3 rounded-lg bg-slate-100 dark:bg-white/5">
          <HeartRateBar detail={detail} />
        </div>
      )}

      {/* ── Power (cycling/etc) ── */}
      {hasPower && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-yellow-400 text-base">
              bolt
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide font-medium">
              Power
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {detail.avg_power_watts != null && (
              <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-white/5 text-center">
                <p className="text-xs text-slate-500 dark:text-slate-400">Avg</p>
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  {detail.avg_power_watts}<span className="text-xs font-normal text-slate-400 ml-0.5">W</span>
                </p>
              </div>
            )}
            {detail.normalized_power_watts != null && (
              <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-white/5 text-center">
                <p className="text-xs text-slate-500 dark:text-slate-400">NP</p>
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  {detail.normalized_power_watts}<span className="text-xs font-normal text-slate-400 ml-0.5">W</span>
                </p>
              </div>
            )}
            {detail.max_power_watts != null && (
              <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-white/5 text-center">
                <p className="text-xs text-slate-500 dark:text-slate-400">Max</p>
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  {detail.max_power_watts}<span className="text-xs font-normal text-slate-400 ml-0.5">W</span>
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Cadence ── */}
      {hasCadence && (
        <div className="grid grid-cols-2 gap-2">
          {detail.avg_cadence != null && (
            <MetricCard
              icon="steps"
              label="Avg Cadence"
              value={String(detail.avg_cadence)}
              unit={isRunOrWalk ? "spm" : "rpm"}
            />
          )}
          {detail.max_cadence != null && (
            <MetricCard
              icon="steps"
              label="Max Cadence"
              value={String(detail.max_cadence)}
              unit={isRunOrWalk ? "spm" : "rpm"}
            />
          )}
        </div>
      )}

      {/* ── Elevation ── */}
      {hasElevation && (
        <div className="grid grid-cols-2 gap-2">
          {detail.elevation_gain_meters != null && (
            <MetricCard
              icon="trending_up"
              label="Elev. Gain"
              value={String(Math.round(detail.elevation_gain_meters))}
              unit="m"
            />
          )}
          {detail.elevation_loss_meters != null && (
            <MetricCard
              icon="trending_down"
              label="Elev. Loss"
              value={String(Math.round(detail.elevation_loss_meters))}
              unit="m"
            />
          )}
        </div>
      )}

      {/* ── Training Load ── */}
      {hasTrainingLoad && (
        <div className="grid grid-cols-2 gap-2">
          {detail.training_stress_score != null && (
            <MetricCard
              icon="monitoring"
              label="TSS"
              value={String(Math.round(detail.training_stress_score))}
            />
          )}
          {detail.intensity_factor != null && (
            <MetricCard
              icon="equalizer"
              label="Intensity Factor"
              value={detail.intensity_factor.toFixed(2)}
            />
          )}
        </div>
      )}

      {/* ── Subjective ── */}
      {(detail.perceived_exertion != null || detail.feeling_score != null) && (
        <div className="grid grid-cols-2 gap-2">
          {detail.perceived_exertion != null && (
            <MetricCard
              icon="psychology"
              label="RPE"
              value={`${detail.perceived_exertion}/10`}
            />
          )}
          {detail.feeling_score != null && (
            <MetricCard
              icon="sentiment_satisfied"
              label="Feeling"
              value={`${detail.feeling_score}/5`}
            />
          )}
        </div>
      )}

      {/* ── Environment ── */}
      {hasEnvironment && (
        <div className="grid grid-cols-2 gap-2">
          {detail.temperature_celsius != null && (
            <MetricCard
              icon="thermostat"
              label="Temperature"
              value={String(Math.round(detail.temperature_celsius))}
              unit="°C"
            />
          )}
          {detail.humidity_percent != null && (
            <MetricCard
              icon="humidity_percentage"
              label="Humidity"
              value={String(Math.round(detail.humidity_percent))}
              unit="%"
            />
          )}
        </div>
      )}

      {/* ── Notes ── */}
      {detail.notes && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-slate-400 text-base">
              notes
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide font-medium">
              Notes
            </span>
          </div>
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
            {detail.notes}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Main export ──

export function ActivityDetailDrawer({
  workoutId,
  open,
  onOpenChange,
}: ActivityDetailDrawerProps) {
  const { detail, loading } = useWorkoutDetail(open ? workoutId : null);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="sr-only">
          <DrawerTitle>Activity Details</DrawerTitle>
          <DrawerDescription>Detailed view of your workout activity</DrawerDescription>
        </DrawerHeader>

        {loading ? (
          <div className="flex items-center justify-center h-48 pb-6">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : detail ? (
          <DetailContent detail={detail} />
        ) : (
          <div className="flex flex-col items-center justify-center h-48 pb-6 gap-2">
            <span className="material-symbols-outlined text-slate-400 text-3xl">
              error_outline
            </span>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Could not load activity details
            </p>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
