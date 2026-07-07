/**
 * Presentational recovery ring for the landing page — same geometry and
 * tiering as the dashboard's Recovery Score card. Status color is always
 * paired with the score text; the ring itself is decorative.
 */

interface RecoveryRingProps {
  /** Readiness 0-100. */
  score: number;
  /** Diameter in px (default 128). */
  size?: number;
}

export function RecoveryRing({ score, size = 128 }: RecoveryRingProps) {
  const safeScore = Math.max(0, Math.min(100, Math.round(score)));
  const stroke = size >= 120 ? 10 : 8;
  const radius = size / 2 - stroke;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - safeScore / 100);
  const color =
    safeScore >= 70 ? "text-primary" : safeScore >= 40 ? "text-amber-400" : "text-red-400";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="w-full h-full -rotate-90" viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle
          className="text-dark-surface-lighter"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="currentColor"
          strokeWidth={stroke}
        />
        <circle
          className={`${color} transition-[stroke-dashoffset] duration-700 ease-out motion-reduce:transition-none`}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="currentColor"
          strokeDasharray={String(circumference)}
          strokeDashoffset={String(offset)}
          strokeLinecap="round"
          strokeWidth={stroke}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={`${
            size >= 100 ? "text-2xl" : size >= 80 ? "text-lg" : "text-sm"
          } font-black text-white leading-none tabular-nums`}
        >
          {safeScore}%
        </span>
        {size >= 80 && (
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-1">
            Ready
          </span>
        )}
      </div>
    </div>
  );
}
