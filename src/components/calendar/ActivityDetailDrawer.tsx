import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useWorkoutDetail, type WorkoutDetail } from "@/hooks/useWorkoutDetail";

interface ActivityDetailDrawerProps {
  workoutId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ── Sport detection ──

function detectSport(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("run") || t.includes("jog") || t.includes("walk")) return "run";
  if (t.includes("bike") || t.includes("cycling") || t.includes("ride")) return "bike";
  if (t.includes("swim") || t.includes("pool") || t.includes("water")) return "swim";
  if (t.includes("strength") || t.includes("gym") || t.includes("core") || t.includes("weight") || t.includes("fitness"))
    return "strength";
  return "other";
}

const SPORT_META: Record<string, { icon: string; color: string; bg: string; border: string; headerBg: string }> = {
  run:      { icon: "directions_run",  color: "text-orange-400",  bg: "bg-orange-400",  border: "border-orange-400/20", headerBg: "bg-orange-400/10" },
  bike:     { icon: "directions_bike", color: "text-primary",     bg: "bg-primary",     border: "border-primary/20",    headerBg: "bg-primary/10" },
  swim:     { icon: "pool",            color: "text-blue-400",    bg: "bg-blue-400",    border: "border-blue-400/20",   headerBg: "bg-blue-400/10" },
  strength: { icon: "fitness_center",  color: "text-purple-400",  bg: "bg-purple-400",  border: "border-purple-400/20", headerBg: "bg-purple-400/10" },
  other:    { icon: "fitness_center",  color: "text-slate-400",   bg: "bg-slate-400",   border: "border-slate-400/20",  headerBg: "bg-slate-400/10" },
};

// ── Formatters ──

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatSpeedAsPace(mps: number): string {
  if (!mps || mps <= 0) return "--";
  const secsPerKm = 1000 / mps;
  const m = Math.floor(secsPerKm / 60);
  const s = Math.round(secsPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatSpeedAsKmh(mps: number): string {
  if (!mps || mps <= 0) return "--";
  return (mps * 3.6).toFixed(1);
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

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function trainingEffectLabel(te: number): string {
  if (te < 1) return "None";
  if (te < 2) return "Minor";
  if (te < 3) return "Maintaining";
  if (te < 4) return "Improving";
  if (te < 5) return "Highly Improving";
  return "Overreaching";
}

// ── Detail content ──

/** Reusable detail section */
function DetailSection({
  title,
  badge,
  rows,
}: {
  title: string;
  badge?: { label: string; className: string };
  rows: { label: string; value: string }[];
}) {
  if (rows.length === 0) return null;
  return (
    <div className="bg-white/5 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-black text-white/60 uppercase tracking-wide">{title}</p>
        {badge && (
          <span className={`text-[10px] font-black px-2 py-0.5 rounded ${badge.className}`}>
            {badge.label}
          </span>
        )}
      </div>
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between text-[11px]">
            <span className="text-slate-400">{row.label}</span>
            <span className="text-white font-bold">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailContent({ detail, onClose }: { detail: WorkoutDetail; onClose: () => void }) {
  const sport = detectSport(detail.activity_type);
  const meta = SPORT_META[sport] || SPORT_META.other;
  const isRun = sport === "run";
  const isBike = sport === "bike";
  const isSwim = sport === "swim";
  const hasPower = !!(detail.avg_power_watts || detail.max_power_watts);

  // ── Top 3 key metrics (sport-specific) ──
  const keyMetrics: { label: string; value: string; unit?: string; highlight?: boolean }[] = [];

  if (detail.duration_seconds != null) {
    keyMetrics.push({ label: "Duration", value: formatDuration(detail.duration_seconds) });
  }

  if (isRun) {
    if (detail.distance_meters != null && detail.distance_meters > 0) {
      keyMetrics.push({ label: "Distance", value: formatDistance(detail.distance_meters), unit: "km" });
    }
    // Prefer avg_speed_mps (from Garmin GPS), fall back to distance/time
    if (detail.avg_speed_mps != null) {
      keyMetrics.push({ label: "Avg Pace", value: formatSpeedAsPace(detail.avg_speed_mps), unit: "/km" });
    } else if (detail.distance_meters && detail.duration_seconds) {
      keyMetrics.push({ label: "Avg Pace", value: formatPace(detail.duration_seconds, detail.distance_meters), unit: "/km" });
    }
  } else if (isBike) {
    if (hasPower && detail.avg_power_watts != null) {
      keyMetrics.push({ label: "Avg Power", value: String(detail.avg_power_watts), unit: "W" });
    } else if (detail.distance_meters != null && detail.distance_meters > 0) {
      keyMetrics.push({ label: "Distance", value: formatDistance(detail.distance_meters), unit: "km" });
    }
    if (detail.intensity_factor != null) {
      keyMetrics.push({ label: "Int. Factor", value: detail.intensity_factor.toFixed(2), highlight: true });
    } else if (detail.avg_speed_mps != null) {
      keyMetrics.push({ label: "Avg Speed", value: formatSpeedAsKmh(detail.avg_speed_mps), unit: "km/h" });
    }
  } else if (isSwim) {
    if (detail.distance_meters != null && detail.distance_meters > 0) {
      keyMetrics.push({ label: "Distance", value: String(Math.round(detail.distance_meters)), unit: "m" });
    }
    // Swim pace: per 100m
    if (detail.avg_speed_mps != null && detail.avg_speed_mps > 0) {
      const secsPer100 = 100 / detail.avg_speed_mps;
      const m = Math.floor(secsPer100 / 60);
      const s = Math.round(secsPer100 % 60);
      keyMetrics.push({ label: "Pace", value: `${m}:${String(s).padStart(2, "0")}`, unit: "/100m" });
    }
  } else {
    // Strength / other
    if (detail.calories != null) {
      keyMetrics.push({ label: "Calories", value: String(detail.calories), unit: "kcal" });
    }
    if (detail.avg_heart_rate != null) {
      keyMetrics.push({ label: "Avg HR", value: String(detail.avg_heart_rate), unit: "bpm" });
    }
  }

  const topMetrics = keyMetrics.slice(0, 3);

  // ── Heart Rate section ──
  const hrRows: { label: string; value: string }[] = [];
  if (detail.avg_heart_rate != null) hrRows.push({ label: "Average", value: `${detail.avg_heart_rate} bpm` });
  if (detail.max_heart_rate != null) hrRows.push({ label: "Max", value: `${detail.max_heart_rate} bpm` });
  if (detail.min_heart_rate != null) hrRows.push({ label: "Min", value: `${detail.min_heart_rate} bpm` });

  // ── Performance section (sport-specific) ──
  const perfRows: { label: string; value: string }[] = [];

  if (isRun) {
    if (detail.max_speed_mps != null) perfRows.push({ label: "Max Pace", value: `${formatSpeedAsPace(detail.max_speed_mps)} /km` });
    if (detail.avg_cadence != null) perfRows.push({ label: "Avg Cadence", value: `${detail.avg_cadence} spm` });
    if (detail.avg_stride_length_cm != null) perfRows.push({ label: "Avg Stride Length", value: `${detail.avg_stride_length_cm} cm` });
    if (detail.avg_vertical_oscillation_cm != null) perfRows.push({ label: "Vertical Oscillation", value: `${detail.avg_vertical_oscillation_cm} cm` });
    if (detail.avg_ground_contact_time_ms != null) perfRows.push({ label: "Ground Contact Time", value: `${Math.round(detail.avg_ground_contact_time_ms)} ms` });
  } else if (isBike) {
    if (detail.normalized_power_watts != null) perfRows.push({ label: "Normalized Power", value: `${detail.normalized_power_watts} W` });
    if (detail.max_power_watts != null) perfRows.push({ label: "Max Power", value: `${detail.max_power_watts} W` });
    if (detail.avg_speed_mps != null) perfRows.push({ label: "Avg Speed", value: `${formatSpeedAsKmh(detail.avg_speed_mps)} km/h` });
    if (detail.max_speed_mps != null) perfRows.push({ label: "Max Speed", value: `${formatSpeedAsKmh(detail.max_speed_mps)} km/h` });
    if (detail.avg_cadence != null) perfRows.push({ label: "Avg Cadence", value: `${detail.avg_cadence} rpm` });
  } else if (isSwim) {
    if (detail.avg_cadence != null) perfRows.push({ label: "Avg Strokes/Length", value: `${detail.avg_cadence}` });
  } else {
    if (detail.avg_cadence != null) perfRows.push({ label: "Avg Cadence", value: `${detail.avg_cadence}` });
  }

  // Elevation (for run/bike)
  if (detail.elevation_gain_meters != null) perfRows.push({ label: "Elevation Gain", value: `${Math.round(detail.elevation_gain_meters)} m` });
  if (detail.elevation_loss_meters != null) perfRows.push({ label: "Elevation Loss", value: `${Math.round(detail.elevation_loss_meters)} m` });

  // Distance + calories (if not already in top metrics)
  if (!isSwim && detail.distance_meters != null && detail.distance_meters > 0 && !topMetrics.some(m => m.label === "Distance")) {
    perfRows.push({ label: "Distance", value: `${formatDistance(detail.distance_meters)} km` });
  }
  if (detail.calories != null && !topMetrics.some(m => m.label === "Calories")) {
    perfRows.push({ label: "Calories", value: `${detail.calories} kcal` });
  }

  // ── Training Load section ──
  const loadRows: { label: string; value: string }[] = [];
  if (detail.aerobic_training_effect != null) {
    loadRows.push({ label: "Aerobic TE", value: `${detail.aerobic_training_effect.toFixed(1)} — ${trainingEffectLabel(detail.aerobic_training_effect)}` });
  }
  if (detail.anaerobic_training_effect != null) {
    loadRows.push({ label: "Anaerobic TE", value: `${detail.anaerobic_training_effect.toFixed(1)} — ${trainingEffectLabel(detail.anaerobic_training_effect)}` });
  }
  if (detail.training_stress_score != null) loadRows.push({ label: "TSS", value: String(Math.round(detail.training_stress_score)) });
  if (detail.intensity_factor != null && !topMetrics.some(m => m.label === "Int. Factor")) {
    loadRows.push({ label: "Intensity Factor", value: detail.intensity_factor.toFixed(2) });
  }
  if (detail.vo2max_value != null) loadRows.push({ label: "VO2 Max", value: `${detail.vo2max_value}` });
  if (detail.moving_duration_seconds != null && detail.elapsed_duration_seconds != null) {
    loadRows.push({
      label: "Moving / Elapsed",
      value: `${formatDuration(detail.moving_duration_seconds)} / ${formatDuration(detail.elapsed_duration_seconds)}`,
    });
  }

  // ── Subjective + Environment ──
  const extraRows: { label: string; value: string }[] = [];
  if (detail.perceived_exertion != null) extraRows.push({ label: "RPE", value: `${detail.perceived_exertion}/10` });
  if (detail.feeling_score != null) {
    const feelings = ["", "Bad", "Poor", "OK", "Good", "Great"];
    extraRows.push({ label: "Feeling", value: feelings[detail.feeling_score] || `${detail.feeling_score}/5` });
  }
  if (detail.temperature_celsius != null) extraRows.push({ label: "Temperature", value: `${Math.round(detail.temperature_celsius)}°C` });
  if (detail.humidity_percent != null) extraRows.push({ label: "Humidity", value: `${Math.round(detail.humidity_percent)}%` });

  return (
    <div className="overflow-hidden max-h-[80vh] flex flex-col">
      {/* ── Header ── */}
      <div className={`${meta.headerBg} px-5 py-4 flex justify-between items-center border-b ${meta.border} shrink-0`}>
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full ${meta.bg} flex items-center justify-center`}>
            <span
              className="material-symbols-outlined text-white text-lg"
              style={{ fontVariationSettings: '"FILL" 1' }}
            >
              {meta.icon}
            </span>
          </div>
          <div>
            <p className={`text-[10px] font-black ${meta.color} uppercase leading-none mb-1 tracking-wider`}>
              Workout Complete
            </p>
            <h3 className="text-sm font-black text-white tracking-tight uppercase">
              {detail.title || formatActivityType(detail.activity_type)}
            </h3>
          </div>
        </div>
        <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>

      {/* ── Body (scrollable) ── */}
      <div className="p-5 space-y-4 overflow-y-auto">
        {/* Date & source */}
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>{formatDate(detail.started_at)} at {formatTime(detail.started_at)}</span>
          {detail.source === "garmin" && (
            <span className="flex items-center gap-1 text-slate-500">
              <span className="material-symbols-outlined text-xs">watch</span>
              Garmin
            </span>
          )}
        </div>

        {/* ── Key metrics grid ── */}
        {topMetrics.length > 0 && (
          <div className={`grid gap-4 ${topMetrics.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
            {topMetrics.map((m, i) => (
              <div
                key={m.label}
                className={`text-center ${i > 0 ? "border-l border-white/5" : ""}`}
              >
                <p className="text-[9px] font-black text-white/40 uppercase mb-1 tracking-wide">
                  {m.label}
                </p>
                <p className={`text-lg font-black ${m.highlight ? meta.color : "text-white"}`}>
                  {m.value}
                  {m.unit && (
                    <span className="text-[10px] font-bold text-white/40 ml-0.5">{m.unit}</span>
                  )}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* ── Heart Rate ── */}
        <DetailSection
          title="Heart Rate"
          badge={detail.avg_heart_rate != null ? { label: `${detail.avg_heart_rate} BPM AVG`, className: "text-red-400 bg-red-400/10" } : undefined}
          rows={hrRows}
        />

        {/* ── Performance (sport-specific) ── */}
        <DetailSection title="Performance" rows={perfRows} />

        {/* ── Training Load ── */}
        <DetailSection title="Training Load" rows={loadRows} />

        {/* ── Subjective & Environment ── */}
        <DetailSection title="Conditions" rows={extraRows} />

        {/* ── Notes ── */}
        {detail.notes && (
          <div className="bg-white/5 rounded-lg p-3">
            <p className="text-[10px] font-black text-white/60 uppercase tracking-wide mb-2">Notes</p>
            <p className="text-[11px] text-slate-300 leading-relaxed">{detail.notes}</p>
          </div>
        )}
      </div>
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[360px] p-0 gap-0 bg-dark-surface border-white/10 rounded-xl overflow-hidden [&>button:last-child]:hidden">
        <DialogTitle className="sr-only">Activity Details</DialogTitle>
        <DialogDescription className="sr-only">Detailed view of your workout activity</DialogDescription>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : detail ? (
          <DetailContent detail={detail} onClose={() => onOpenChange(false)} />
        ) : (
          <div className="flex flex-col items-center justify-center h-48 gap-2">
            <span className="material-symbols-outlined text-slate-500 text-3xl">error_outline</span>
            <p className="text-sm text-slate-500">Could not load activity details</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
