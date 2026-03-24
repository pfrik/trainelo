import { useState } from "react";
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
  ComposedChart,
} from "recharts";
import { usePmcData, type PmcPoint } from "@/hooks/usePmcData";

// ============================================================================
// Constants
// ============================================================================

const TIME_RANGES = [
  { label: "7d", days: 7 },
  { label: "1m", days: 30 },
  { label: "3m", days: 90 },
  { label: "6m", days: 180 },
  { label: "1y", days: 365 },
];

interface FormZone {
  label: string;
  min: number;
  max: number;
  color: string;
  textColor: string;
}

const FORM_ZONES: FormZone[] = [
  { label: "Transition", min: 15, max: 50, color: "rgba(34,211,238,0.08)", textColor: "text-cyan-400" },
  { label: "Fresh", min: 5, max: 15, color: "rgba(34,197,94,0.08)", textColor: "text-green-400" },
  { label: "Grey Zone", min: -10, max: 5, color: "rgba(100,116,139,0.06)", textColor: "text-slate-400" },
  { label: "Optimal", min: -25, max: -10, color: "rgba(20,184,166,0.10)", textColor: "text-teal-400" },
  { label: "High Risk", min: -50, max: -25, color: "rgba(239,68,68,0.10)", textColor: "text-red-400" },
];

function getFormZone(form: number): FormZone {
  for (const zone of FORM_ZONES) {
    if (form >= zone.min && form < zone.max) return zone;
  }
  return form >= 50 ? FORM_ZONES[0] : FORM_ZONES[4];
}

// ============================================================================
// Helpers
// ============================================================================

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string; color: string }>;
  label?: string;
}) {
  if (!active || !payload || !label) return null;

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 shadow-lg text-xs">
      <div className="text-slate-400 mb-1">{formatDate(label)}</div>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-slate-400 capitalize w-12">{entry.dataKey}</span>
          <span className="font-bold text-white">{Math.round(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

interface PmcChartProps {
  raceDate?: string | null;
  raceName?: string | null;
}

export function PmcChart({ raceDate, raceName }: PmcChartProps) {
  const [days, setDays] = useState(90);
  const { data, loading, error } = usePmcData(days);

  if (loading) {
    return (
      <div className="h-80 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || data.length === 0) {
    return (
      <div className="h-80 flex items-center justify-center text-slate-500 text-sm">
        {error ?? "No performance data yet. Data will appear after your training is synced."}
      </div>
    );
  }

  const latest = data[data.length - 1];
  const currentZone = getFormZone(latest.form);
  const tickInterval = Math.max(1, Math.floor(data.length / 6));

  return (
    <div>
      {/* Header: title + time range + legend */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-lg text-slate-900 dark:text-white">Performance</h3>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 text-xs mr-2">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500" /> <span className="text-slate-400">Fitness</span></span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-orange-500" /> <span className="text-slate-400">Fatigue</span></span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500" /> <span className="text-slate-400">Form</span></span>
          </div>
          <div className="flex bg-slate-800/70 rounded-lg p-0.5">
            {TIME_RANGES.map((r) => (
              <button
                key={r.days}
                onClick={() => setDays(r.days)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  days === r.days
                    ? "bg-primary text-slate-900"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main layout: charts + sidebar */}
      <div className="flex gap-4">
        {/* Charts column */}
        <div className="flex-1 min-w-0">
          {/* Top panel: Fitness + Fatigue */}
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="date" hide />
                <YAxis
                  tick={{ fill: "#64748b", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, "auto"]}
                  width={35}
                />
                <Tooltip content={<CustomTooltip />} />

                {/* Race day marker */}
                {raceDate && (
                  <ReferenceLine
                    x={raceDate}
                    stroke="#f97316"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    label={{
                      value: raceName ? `🏁 ${raceName}` : "🏁 Race",
                      position: "top",
                      fill: "#f97316",
                      fontSize: 10,
                    }}
                  />
                )}

                <Line
                  type="monotone"
                  dataKey="fitness"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="fatigue"
                  stroke="#f97316"
                  strokeWidth={1.5}
                  dot={false}
                  strokeOpacity={0.7}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Bottom panel: Form with zone bands */}
          <div className="h-28">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 0, right: 5, left: -15, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  tick={{ fill: "#64748b", fontSize: 10 }}
                  axisLine={{ stroke: "#334155" }}
                  tickLine={false}
                  interval={tickInterval}
                />
                <YAxis
                  tick={{ fill: "#64748b", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  domain={[-40, 30]}
                  width={35}
                />
                <Tooltip content={<CustomTooltip />} />

                {/* Zone bands */}
                {FORM_ZONES.map((zone) => (
                  <ReferenceArea
                    key={zone.label}
                    y1={Math.max(zone.min, -40)}
                    y2={Math.min(zone.max, 30)}
                    fill={zone.color}
                    strokeOpacity={0}
                  />
                ))}

                <ReferenceLine y={0} stroke="#475569" strokeDasharray="3 3" />

                {/* Race day marker */}
                {raceDate && (
                  <ReferenceLine
                    x={raceDate}
                    stroke="#f97316"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                  />
                )}

                <Line
                  type="monotone"
                  dataKey="form"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sidebar: current values */}
        <div className="w-28 flex-shrink-0 flex flex-col justify-center gap-3">
          <div>
            <div className="text-xs text-slate-500 mb-0.5">Fitness</div>
            <div className="text-2xl font-bold text-blue-500">{Math.round(latest.fitness)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-0.5">Fatigue</div>
            <div className="text-2xl font-bold text-orange-500">{Math.round(latest.fatigue)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-0.5">Form</div>
            <div className="text-2xl font-bold text-green-500">
              {latest.form >= 0 ? "+" : ""}{Math.round(latest.form)}
            </div>
          </div>
          <div className={`text-xs font-medium px-2 py-1 rounded-md text-center ${currentZone.textColor} bg-slate-800/50 border border-slate-700/50`}>
            {currentZone.label}
          </div>
        </div>
      </div>
    </div>
  );
}
