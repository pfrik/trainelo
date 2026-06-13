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

/** Format a signed delta for display, e.g. +5 / -8 / 0. */
function formatDelta(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

/** Readiness tier: green ≥65, yellow 40-64, red <40. */
function readinessTier(score: number): { color: string; label: string } {
  if (score >= 80) return { color: 'text-green-400', label: 'Strong' };
  if (score >= 65) return { color: 'text-green-400', label: 'Good' };
  if (score >= 50) return { color: 'text-orange-400', label: 'Moderate' };
  if (score >= 40) return { color: 'text-orange-400', label: 'Fair' };
  return { color: 'text-red-400', label: 'Low' };
}

/** Component signal chip with tier coloring. */
function SignalChip({ label, value }: { label: string; value: number }) {
  const tier = readinessTier(value);
  return (
    <span className={`bg-slate-700/50 text-xs px-2 py-0.5 rounded ${tier.color}`}>
      {label} {value}
    </span>
  );
}

function SignalBreakdown({ sc }: { sc: NonNullable<EvidenceSummary['signal_contribution']> }) {
  if (sc.objective_score == null || sc.final_score == null) return null;

  const components = sc.objective_components;
  const delta = sc.subjective_delta;
  const rawDelta = sc.subjective_delta_raw;
  const wasCapped = delta !== rawDelta;
  const objTier = readinessTier(sc.objective_score);
  const finalTier = readinessTier(sc.final_score);

  return (
    <div className="bg-slate-800/50 rounded-lg p-3 space-y-2.5">
      <div className="text-xs text-slate-500 uppercase tracking-wide">Signal Breakdown</div>

      {/* Objective baseline + components */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-slate-300">Wearable readiness</span>
        <span className="flex items-center gap-1.5">
          <span className={`text-sm font-bold ${objTier.color}`}>{sc.objective_score}</span>
          <span className={`text-xs ${objTier.color} opacity-70`}>{objTier.label}</span>
        </span>
      </div>
      {components && (
        <div className="flex flex-wrap gap-1.5">
          {components.sleep != null && <SignalChip label="Sleep" value={components.sleep} />}
          {components.hrv != null && <SignalChip label="HRV" value={components.hrv} />}
          {components.metrics != null && <SignalChip label="Recovery" value={components.metrics} />}
          {components.load_penalty > 0 && (
            <span className="bg-slate-700/50 text-slate-400 text-xs px-2 py-0.5 rounded">
              Load &minus;{components.load_penalty}
            </span>
          )}
          {components.fitness_bonus > 0 && (
            <span className="bg-slate-700/50 text-green-400 text-xs px-2 py-0.5 rounded">
              Fitness +{components.fitness_bonus}
            </span>
          )}
        </div>
      )}

      {/* Subjective adjustment */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-slate-300">Check-in adjustment</span>
        <span
          className={`text-sm font-bold ${
            delta > 0 ? 'text-green-400' : delta < 0 ? 'text-orange-400' : 'text-slate-400'
          }`}
        >
          {delta === 0 ? 'None' : formatDelta(delta)}
        </span>
      </div>
      {wasCapped && (
        <div className="text-xs text-slate-500">
          Capped from {formatDelta(rawDelta)} — check-in adjusts the score, wearable data sets the baseline.
        </div>
      )}

      {/* Final blended score */}
      <div className="flex items-center justify-between gap-2 border-t border-slate-700/50 pt-2">
        <span className="text-sm text-slate-300">Blended readiness</span>
        <span className="flex items-center gap-1.5">
          <span className={`text-sm font-bold ${finalTier.color}`}>{sc.final_score}</span>
          <span className={`text-xs ${finalTier.color} opacity-70`}>{finalTier.label}</span>
        </span>
      </div>

      {/* Conflict callout */}
      {sc.conflict_flag && sc.conflict_description && (
        <div className="flex items-start gap-2 bg-orange-500/10 border border-orange-500/30 rounded-lg p-2.5">
          <span
            className="material-symbols-outlined text-base text-orange-400"
            style={{ fontVariationSettings: '"FILL" 1' }}
            aria-hidden="true"
          >
            warning
          </span>
          <div className="text-xs text-orange-200">
            <span className="font-semibold text-orange-400">Signals disagree. </span>
            {sc.conflict_description}
          </div>
        </div>
      )}
    </div>
  );
}

const CALIBRATION_LEVEL_STYLES: Record<string, { badge: string; icon: string }> = {
  red:     { badge: 'bg-red-500/10 text-red-400 border border-red-500/30',     icon: 'block' },
  amber:   { badge: 'bg-orange-500/10 text-orange-400 border border-orange-500/30', icon: 'radio_button_partial' },
  green:   { badge: 'bg-green-500/10 text-green-400 border border-green-500/30',    icon: 'check_circle' },
  upgrade: { badge: 'bg-green-500/10 text-green-400 border border-green-500/30',    icon: 'trending_up' },
};

const CALIBRATION_LEVEL_LABEL: Record<string, string> = {
  red: 'Rest / Recovery', amber: 'Modified', green: 'As Planned', upgrade: 'Push Today',
};

function CalibrationCard({ evidence }: { evidence: EvidenceSummary }) {
  const level = evidence.calibration_level;
  const headline = evidence.calibration_headline;
  if (!level || !headline) return null;

  const style = CALIBRATION_LEVEL_STYLES[level] ?? CALIBRATION_LEVEL_STYLES.green;
  const iMul = evidence.calibration_intensity_multiplier ?? 1;
  const dMul = evidence.calibration_duration_multiplier ?? 1;
  const hasAdjustment = iMul !== 1 || dMul !== 1;

  return (
    <div className="bg-slate-800/50 rounded-lg p-3 space-y-2">
      <div className="text-xs text-slate-500 uppercase tracking-wide">Session Calibration</div>
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm text-slate-200 leading-snug">{headline}</span>
        <span className={`shrink-0 flex items-center gap-1 text-xs px-2 py-0.5 rounded ${style.badge}`}>
          <span
            className="material-symbols-outlined text-sm"
            style={{ fontVariationSettings: '"FILL" 1' }}
            aria-hidden="true"
          >
            {style.icon}
          </span>
          {CALIBRATION_LEVEL_LABEL[level]}
        </span>
      </div>
      {evidence.calibration_rationale && (
        <p className="text-xs text-slate-400 leading-relaxed">{evidence.calibration_rationale}</p>
      )}
      {hasAdjustment && (
        <div className="flex gap-2 flex-wrap">
          {iMul !== 1 && (
            <span className={`text-xs px-2 py-0.5 rounded ${iMul < 1 ? 'bg-orange-500/10 text-orange-400' : 'bg-green-500/10 text-green-400'}`}>
              Intensity {iMul < 1 ? `${Math.round(iMul * 100)}%` : `+${Math.round((iMul - 1) * 100)}%`}
            </span>
          )}
          {dMul !== 1 && (
            <span className={`text-xs px-2 py-0.5 rounded ${dMul < 1 ? 'bg-orange-500/10 text-orange-400' : 'bg-green-500/10 text-green-400'}`}>
              Duration {dMul < 1 ? `${Math.round(dMul * 100)}%` : `+${Math.round((dMul - 1) * 100)}%`}
            </span>
          )}
        </div>
      )}
      {evidence.calibration_warnings && evidence.calibration_warnings.length > 0 && (
        <div className="space-y-1">
          {evidence.calibration_warnings.map((w, i) => (
            <div key={i} className="text-xs text-slate-400">
              <span className="text-orange-400 mr-1">·</span>{w}
            </div>
          ))}
        </div>
      )}
    </div>
  );
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

          {/* Objective vs. subjective signal breakdown */}
          {evidence.signal_contribution && <SignalBreakdown sc={evidence.signal_contribution} />}

          {/* Session calibration outcome */}
          <CalibrationCard evidence={evidence} />

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
