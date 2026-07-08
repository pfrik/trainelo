/**
 * "While you slept" band — replaces the old stat band between the hero and
 * the signals section. A dark full-bleed strip where an overnight HRV trace
 * draws itself across the night as the band scrolls into view, annotations
 * fading in along the way, ending on a pulsing readiness dot and the morning
 * readout. Static (fully drawn) under prefers-reduced-motion.
 */

import { Moon, Sunrise } from "lucide-react";
import { useInView } from "@/hooks/useInView";

// Trace geometry: rMSSD rising gently through the night with organic wobble.
const W = 800;
const H = 150;
const PAD_X = 8;
const N = 36;
const BASELINE_Y = 92; // 28-day baseline the trace climbs past

const PTS: Array<[number, number]> = Array.from({ length: N }, (_, i) => {
  const t = i / (N - 1);
  const y = 112 - 52 * t + 7 * Math.sin(t * 8.5) + 4 * Math.sin(t * 21 + 2);
  return [PAD_X + t * (W - PAD_X * 2), y];
});
const LINE = PTS.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
const AREA = `${PAD_X},${H} ${LINE} ${W - PAD_X},${H}`;
const [END_X, END_Y] = PTS[PTS.length - 1];

/** Small annotation that fades in over the trace. */
function TraceNote({
  label,
  className,
  inView,
  delay,
}: {
  label: string;
  className: string;
  inView: boolean;
  delay: number;
}) {
  return (
    <span
      style={{ transitionDelay: `${delay}ms` }}
      className={`absolute hidden sm:flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 transition-opacity duration-700 motion-reduce:transition-none ${
        inView ? "opacity-100" : "opacity-0"
      } ${className}`}
    >
      <span className="w-1 h-1 rounded-full bg-slate-500" aria-hidden />
      {label}
    </span>
  );
}

export function NightBand() {
  const { ref, inView } = useInView<HTMLElement>(0.3);

  return (
    <section ref={ref} className="border-y border-slate-800 bg-dark-base">
      <div className="max-w-6xl mx-auto px-6 py-14">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-10">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-2">
              Overnight
            </div>
            <h2 className="font-headline text-2xl sm:text-3xl font-bold tracking-tight text-white">
              The work happens while you sleep.
            </h2>
          </div>
          <p className="text-sm text-slate-400 leading-relaxed sm:max-w-sm sm:text-right">
            Your watch records the night. Trainelo scores it and has a session
            waiting before your alarm goes off.
          </p>
        </div>

        <div className="relative">
          <TraceNote label="Deep sleep" className="left-[24%] top-[80%]" inView={inView} delay={1100} />
          <TraceNote label="HRV climbing" className="left-[55%] top-[30%]" inView={inView} delay={1600} />

          {/* Morning readout chip, lands as the trace finishes drawing */}
          <span
            style={{ transitionDelay: "2100ms" }}
            className={`absolute right-0 top-[6%] flex items-center gap-1.5 bg-primary/10 border border-primary/30 text-primary text-[11px] font-semibold px-3 py-1 rounded-full whitespace-nowrap transition-all duration-500 motion-reduce:transition-none ${
              inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
            }`}
          >
            <Sunrise className="w-3.5 h-3.5" aria-hidden />
            07:04 · Session ready
          </span>

          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full h-auto"
            role="img"
            aria-label="Heart-rate variability rising through the night, ending above baseline with the morning session ready"
          >
            <defs>
              <linearGradient id="night-band-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#94a3b8" stopOpacity="0.14" />
                <stop offset="100%" stopColor="#94a3b8" stopOpacity="0" />
              </linearGradient>
            </defs>

            <line
              x1={PAD_X}
              x2={W - PAD_X}
              y1={BASELINE_Y}
              y2={BASELINE_Y}
              stroke="#334155"
              strokeWidth="1"
              strokeDasharray="4 5"
            />

            <polygon
              points={AREA}
              fill="url(#night-band-fill)"
              className={`transition-opacity duration-1000 delay-700 motion-reduce:transition-none ${
                inView ? "opacity-100" : "opacity-0"
              }`}
            />

            <polyline
              points={LINE}
              fill="none"
              stroke="#94a3b8"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={1}
              strokeDasharray="1"
              style={{ strokeDashoffset: inView ? 0 : 1, transitionDuration: "2200ms" }}
              className="transition-[stroke-dashoffset] ease-out motion-reduce:transition-none"
            />

            <g
              style={{ transitionDelay: "2000ms" }}
              className={`transition-opacity duration-500 motion-reduce:transition-none ${
                inView ? "opacity-100" : "opacity-0"
              }`}
            >
              <circle
                cx={END_X}
                cy={END_Y}
                r="5"
                fill="#22c55e"
                opacity="0.5"
                style={{ transformBox: "fill-box", transformOrigin: "center" }}
                className={`motion-reduce:animate-none ${
                  inView ? "animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite]" : ""
                }`}
              />
              <circle cx={END_X} cy={END_Y} r="4.5" fill="#22c55e" />
            </g>
          </svg>

          <div
            className="flex items-center justify-between mt-3 text-[10px] text-slate-600 tabular-nums"
            aria-hidden
          >
            <span className="flex items-center gap-1">
              <Moon className="w-3 h-3" />
              23:00
            </span>
            <span>01:00</span>
            <span>03:00</span>
            <span>05:00</span>
            <span className="flex items-center gap-1 text-slate-400">
              07:00
              <Sunrise className="w-3 h-3" />
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
