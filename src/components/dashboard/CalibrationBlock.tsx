import type { EvidenceSummary } from '@/lib/core/contracts';

function getCalibrationStyles(level: string): { bg: string; text: string; border: string } {
  switch (level) {
    case "red":
      return { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/30" };
    case "amber":
      return { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/30" };
    case "upgrade":
      return { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/30" };
    default:
      return { bg: "bg-green-500/10", text: "text-green-400", border: "border-green-500/30" };
  }
}

export function CalibrationBlock({ evidence }: { evidence: EvidenceSummary }) {
  const level = evidence.calibration_level;
  if (!level) return null;

  const styles = getCalibrationStyles(level);
  const warnings = evidence.calibration_warnings ?? [];
  const rules = (evidence.calibration_applied_rules ?? []).slice(0, 3);

  return (
    <div className="space-y-2 mt-4">
      {/* Headline + level badge */}
      <div className="flex items-start gap-2">
        <span className={`${styles.bg} ${styles.text} ${styles.border} border text-xs font-bold px-2 py-0.5 rounded uppercase flex-shrink-0`}>
          {level}
        </span>
        {evidence.calibration_headline && (
          <span className="text-sm text-slate-300">{evidence.calibration_headline}</span>
        )}
      </div>

      {/* Rationale */}
      {evidence.calibration_rationale && (
        <p className="text-xs text-slate-400 leading-relaxed">{evidence.calibration_rationale}</p>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="space-y-1">
          {warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <span className="material-symbols-outlined text-amber-400 text-sm flex-shrink-0 mt-0.5" style={{ fontVariationSettings: '"FILL" 1' }}>warning</span>
              <span className="text-xs text-amber-300">{w}</span>
            </div>
          ))}
        </div>
      )}

      {/* Applied rules (top 3) */}
      {rules.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {rules.map((rule) => (
            <span key={rule} className="bg-slate-700/50 text-slate-500 text-xs px-2 py-0.5 rounded font-mono">
              {rule}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
