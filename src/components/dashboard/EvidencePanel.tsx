import type { EvidenceSummary } from '@/lib/core/contracts';

/** Format an ISO timestamp safely; returns "unknown" on null/undefined/invalid */
function formatTimestamp(
  value: string | null | undefined,
  options: Intl.DateTimeFormatOptions,
): string {
  if (!value) return "unknown";
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) return "unknown";
  return new Intl.DateTimeFormat(undefined, options).format(ms);
}

interface EvidencePanelProps {
  evidence: EvidenceSummary;
  generatedAt: string;
  lastGarminSync?: string | null;
  expanded: boolean;
  onToggle: () => void;
}

export function EvidencePanel({ evidence, generatedAt, lastGarminSync, expanded, onToggle }: EvidencePanelProps) {
  const missingIndicators: string[] = [];
  if (evidence.sleep_quality === null) missingIndicators.push("Sleep");
  if (evidence.hrv_trend === null) missingIndicators.push("HRV");
  if (evidence.fitness_score === null) missingIndicators.push("Recovery");
  if (evidence.days_since_rest === null) missingIndicators.push("Rest history");

  return (
    <div className="mt-4">
      <button
        onClick={onToggle}
        className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
      >
        <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: '"FILL" 1' }}>
          {expanded ? "expand_less" : "expand_more"}
        </span>
        <span>Evidence ({Math.round(evidence.confidence * 100)}% confidence)</span>
      </button>
      {expanded && (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {evidence.fatigue_score !== null && (
              <div className="bg-slate-800/50 rounded-lg p-3">
                <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Fatigue</div>
                <div className="text-lg font-bold text-white">{evidence.fatigue_score}</div>
              </div>
            )}
            {evidence.fitness_score !== null && (
              <div className="bg-slate-800/50 rounded-lg p-3">
                <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Fitness</div>
                <div className="text-lg font-bold text-white">{evidence.fitness_score}</div>
              </div>
            )}
            {evidence.hrv_trend !== null && (
              <div className="bg-slate-800/50 rounded-lg p-3">
                <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">HRV Trend</div>
                <div className="text-lg font-bold text-white capitalize">{evidence.hrv_trend}</div>
              </div>
            )}
            {evidence.sleep_quality !== null && (
              <div className="bg-slate-800/50 rounded-lg p-3">
                <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Sleep Quality</div>
                <div className="text-lg font-bold text-white">{evidence.sleep_quality}</div>
              </div>
            )}
            {evidence.days_since_rest !== null && (
              <div className="bg-slate-800/50 rounded-lg p-3">
                <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Days Since Rest</div>
                <div className="text-lg font-bold text-white">{evidence.days_since_rest}</div>
              </div>
            )}
          </div>

          {/* Goal / Training Plan context */}
          {evidence.goal_title && (
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="bg-orange-500/10 text-orange-400 text-xs px-2 py-0.5 rounded border border-orange-500/30">
                {evidence.goal_title}
              </span>
              {evidence.training_phase && (
                <span className="bg-slate-700/50 text-slate-300 text-xs px-2 py-0.5 rounded capitalize">
                  {evidence.training_phase} phase
                </span>
              )}
              {evidence.plan_week_number && (
                <span className="bg-slate-700/50 text-slate-300 text-xs px-2 py-0.5 rounded">
                  Week {evidence.plan_week_number}
                </span>
              )}
              {evidence.days_until_race != null && (
                <span className="bg-slate-700/50 text-slate-300 text-xs px-2 py-0.5 rounded">
                  {evidence.days_until_race}d to race
                </span>
              )}
            </div>
          )}

          {/* Check-in context */}
          {evidence.checkin_mood != null ? (
            <>
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="bg-slate-700/50 text-slate-300 text-xs px-2 py-0.5 rounded">
                  Mood: {evidence.checkin_mood}
                </span>
                {evidence.checkin_rpe != null && (
                  <span className="bg-slate-700/50 text-slate-300 text-xs px-2 py-0.5 rounded">
                    RPE: {evidence.checkin_rpe}
                  </span>
                )}
                {evidence.checkin_soreness != null && (
                  <span className="bg-slate-700/50 text-slate-300 text-xs px-2 py-0.5 rounded">
                    Soreness: {evidence.checkin_soreness}
                  </span>
                )}
                {evidence.checkin_pain_flag && (
                  <span className="bg-red-500/10 text-red-400 text-xs px-2 py-0.5 rounded border border-red-500/30">
                    Pain
                  </span>
                )}
                {evidence.checkin_illness_flag && (
                  <span className="bg-amber-500/10 text-amber-400 text-xs px-2 py-0.5 rounded border border-amber-500/30">
                    Illness
                  </span>
                )}
              </div>
              {evidence.checkin_impact_note && (
                <div className="text-xs text-slate-500">{evidence.checkin_impact_note}</div>
              )}
            </>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              <span className="bg-slate-700/50 text-slate-500 text-xs px-2 py-0.5 rounded">
                Check-in missing
              </span>
            </div>
          )}

          {/* Missing data indicators */}
          {missingIndicators.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {missingIndicators.map((label) => (
                <span key={label} className="bg-slate-700/50 text-slate-500 text-xs px-2 py-0.5 rounded">
                  {label} missing
                </span>
              ))}
            </div>
          )}

          {/* Data freshness */}
          <div className="text-xs text-slate-500">
            Last Garmin sync:{" "}
            {formatTimestamp(lastGarminSync, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
            <span className="mx-1.5">&middot;</span>
            Updated: {formatTimestamp(generatedAt, { hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>
      )}
    </div>
  );
}
