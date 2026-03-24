import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  ComposedChart,
} from "recharts";
import { usePmcData, type PmcPoint } from "@/hooks/usePmcData";

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
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 shadow-lg">
      <div className="text-xs text-slate-400 mb-1.5">{formatDate(label)}</div>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2 text-sm">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-slate-400 capitalize">{entry.dataKey}:</span>
          <span className="font-bold text-white">{Math.round(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function PmcChart() {
  const { data, loading, error } = usePmcData(90);

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-slate-500 text-sm">
        {error ?? "No performance data yet. Data will appear after your training is synced."}
      </div>
    );
  }

  // Show tick labels for ~6 evenly spaced dates
  const tickInterval = Math.max(1, Math.floor(data.length / 6));

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#334155"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={{ fill: "#64748b", fontSize: 11 }}
            axisLine={{ stroke: "#334155" }}
            tickLine={false}
            interval={tickInterval}
          />
          <YAxis
            tick={{ fill: "#64748b", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            domain={[-30, 100]}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={0} stroke="#475569" strokeDasharray="3 3" />

          {/* Fitness — blue */}
          <Line
            type="monotone"
            dataKey="fitness"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            name="fitness"
          />

          {/* Fatigue — orange */}
          <Line
            type="monotone"
            dataKey="fatigue"
            stroke="#f97316"
            strokeWidth={2}
            dot={false}
            name="fatigue"
          />

          {/* Form — green/teal */}
          <Line
            type="monotone"
            dataKey="form"
            stroke="#22c55e"
            strokeWidth={1.5}
            dot={false}
            strokeDasharray="4 2"
            name="form"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
