export function WorkoutDetail({ workout }: { workout: Record<string, any> }) {
  if (!workout) return null;

  const w = workout;

  return (
    <div className="mt-4 space-y-3">
      {/* Header: duration + target km + RPE */}
      <div className="flex flex-wrap gap-3 text-xs">
        <span className="bg-slate-700/50 text-slate-300 px-2 py-1 rounded flex items-center gap-1">
          <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: '"FILL" 1' }}>timer</span>
          {w.total_duration_minutes} min
        </span>
        {w.target_km != null && (
          <span className="bg-slate-700/50 text-slate-300 px-2 py-1 rounded flex items-center gap-1">
            <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: '"FILL" 1' }}>route</span>
            {w.target_km} km
          </span>
        )}
        <span className="bg-slate-700/50 text-slate-300 px-2 py-1 rounded flex items-center gap-1">
          <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: '"FILL" 1' }}>speed</span>
          RPE {w.rpe_target}/10
        </span>
        {w.intensity_multiplier !== 1.0 && (
          <span className="bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-1 rounded text-xs">
            Intensity {Math.round(w.intensity_multiplier * 100)}%
          </span>
        )}
        {w.duration_multiplier !== 1.0 && (
          <span className="bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-1 rounded text-xs">
            Duration {Math.round(w.duration_multiplier * 100)}%
          </span>
        )}
      </div>

      {/* Segments */}
      <div className="space-y-2">
        {w.segments.map((seg: any, i: number) => (
          <div key={i} className="flex gap-3 items-start">
            <div className={`w-1 self-stretch rounded-full flex-shrink-0 ${
              seg.type === "warmup" ? "bg-blue-400/60" :
              seg.type === "cooldown" ? "bg-indigo-400/60" :
              "bg-primary/60"
            }`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-semibold text-slate-400 uppercase">{seg.type}</span>
                <span className="text-xs text-slate-500">{seg.duration_minutes} min</span>
              </div>
              <p className="text-xs text-slate-300">{seg.description}</p>
              {seg.sets.length > 0 && (
                <div className="mt-1 space-y-1">
                  {seg.sets.map((set: any, j: number) => (
                    <div key={j} className="flex items-center gap-2 text-xs">
                      <span className="text-primary font-semibold">{set.duration_display}</span>
                      <span className="text-slate-500">@</span>
                      <span className="text-slate-300">{set.intensity_label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Description */}
      <p className="text-xs text-slate-500 italic">{w.description}</p>
    </div>
  );
}
