/**
 * Confluence band — the dark full-bleed break between the hero and the
 * "Start the day knowing" signals. Replaces the old overnight HRV trace.
 *
 * Tells the actual thesis in one image: what your watch measured (slate) and
 * what you reported in the check-in (orange) flow continuously into a single
 * green decision — today's session, with the reason shown. Signals stream along
 * the two paths as an ambient loop ("the engine is always working"); pills,
 * node and card reveal once as the band scrolls into view. Static, no flow,
 * under prefers-reduced-motion.
 */

import { useInView } from "@/hooks/useInView";

const WATCH_PILLS = ["Sleep 7:42", "HRV above baseline", "Load high"];
const YOU_PILLS = ["Feeling good", "Legs still heavy", "No pain"];

// Stream geometry (SVG user units). Both curves converge on the node at 250,100
// and continue as a short green nub to the endpoint at 352,100.
const WATCH_PATH = "M4,54 C 150,54 175,96 250,100";
const YOU_PATH = "M4,146 C 150,146 175,104 250,100";
const NUB_PATH = "M250,100 L 352,100";

/** One flowing signal dot travelling along a stream path. */
function FlowDot({
  href,
  color,
  r,
  dur,
  begin,
  inView,
}: {
  href: string;
  color: string;
  r: number;
  dur: string;
  begin: string;
  inView: boolean;
}) {
  return (
    <circle
      r={r}
      fill={color}
      className={`motion-reduce:hidden transition-opacity duration-500 ${
        inView ? "opacity-100" : "opacity-0"
      }`}
    >
      <animateMotion dur={dur} begin={begin} repeatCount="indefinite">
        <mpath href={href} />
      </animateMotion>
    </circle>
  );
}

/** A labelled lane of signal pills that reveal in sequence. */
function Lane({
  label,
  labelClass,
  pills,
  pillClass,
  inView,
  baseDelay,
}: {
  label: string;
  labelClass: string;
  pills: string[];
  pillClass: string;
  inView: boolean;
  baseDelay: number;
}) {
  return (
    <div>
      <div
        style={{ transitionDelay: `${baseDelay}ms` }}
        className={`text-[10.5px] font-bold uppercase tracking-widest mb-2.5 transition-all duration-500 motion-reduce:transition-none ${labelClass} ${
          inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1.5"
        }`}
      >
        {label}
      </div>
      <div className="flex flex-wrap gap-2">
        {pills.map((pill, i) => (
          <span
            key={pill}
            style={{ transitionDelay: `${baseDelay + 100 + i * 100}ms` }}
            className={`inline-flex items-center text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap border transition-all duration-500 motion-reduce:transition-none ${pillClass} ${
              inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1.5"
            }`}
          >
            {pill}
          </span>
        ))}
      </div>
    </div>
  );
}

export function ConfluenceBand() {
  const { ref, inView } = useInView<HTMLElement>(0.3);

  return (
    <section ref={ref} className="border-y border-slate-800 bg-dark-base">
      <div className="max-w-6xl mx-auto px-6 py-12 sm:py-14">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-8 sm:mb-10">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-2">
              Your watch + you
            </div>
            <h2 className="font-headline text-2xl sm:text-3xl font-bold tracking-tight text-white">
              The numbers and the feel, one session.
            </h2>
          </div>
          <p className="text-sm text-slate-400 leading-relaxed sm:max-w-xs sm:text-right">
            Your watch has the numbers. You have the feel. Together they decide
            today's session.
          </p>
        </div>

        <div className="grid grid-cols-1 items-center gap-6 sm:gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(240px,1.15fr)_minmax(190px,230px)]">
          {/* Inputs */}
          <div className="grid gap-6">
            <Lane
              label="Your watch"
              labelClass="text-slate-400"
              pills={WATCH_PILLS}
              pillClass="bg-slate-400/10 border-slate-400/25 text-slate-300"
              inView={inView}
              baseDelay={0}
            />
            <Lane
              label="You"
              labelClass="text-orange-400"
              pills={YOU_PILLS}
              pillClass="bg-orange-500/10 border-orange-500/30 text-orange-300"
              inView={inView}
              baseDelay={150}
            />
          </div>

          {/* Confluence graphic (desktop) */}
          <div className="hidden sm:block">
            <svg
              viewBox="-4 0 368 200"
              className="w-full h-auto overflow-visible"
              role="img"
              aria-label="Your watch data and your morning check-in flowing together into one calibrated session, with the reason shown"
            >
              <path id="confluence-watch" d={WATCH_PATH} fill="none" stroke="#94a3b8" strokeWidth="2.4" strokeLinecap="round" opacity="0.28" />
              <path id="confluence-you" d={YOU_PATH} fill="none" stroke="#f97316" strokeWidth="2.4" strokeLinecap="round" opacity="0.28" />
              <path id="confluence-nub" d={NUB_PATH} fill="none" stroke="#22c55e" strokeWidth="2.8" strokeLinecap="round" opacity="0.3" />

              {/* pulsing merge node */}
              <circle
                cx="250"
                cy="100"
                r="8"
                fill="none"
                stroke="#22c55e"
                strokeWidth="2"
                style={{ transformBox: "fill-box", transformOrigin: "center" }}
                className={`motion-reduce:animate-none ${
                  inView ? "animate-[ping_2.6s_cubic-bezier(0,0,0.2,1)_infinite]" : "opacity-0"
                }`}
                aria-hidden
              />
              <circle
                cx="250"
                cy="100"
                r="7"
                fill="#22c55e"
                className={`transition-opacity duration-300 motion-reduce:transition-none ${
                  inView ? "opacity-100" : "opacity-0"
                }`}
                style={{ transitionDelay: "300ms" }}
              />
              <circle
                cx="352"
                cy="100"
                r="6"
                fill="#22c55e"
                className={`transition-opacity duration-300 motion-reduce:transition-none ${
                  inView ? "opacity-100" : "opacity-0"
                }`}
                style={{ transitionDelay: "900ms" }}
              />

              {/* flowing signals */}
              <FlowDot href="#confluence-watch" color="#94a3b8" r={3.4} dur="2.2s" begin="0s" inView={inView} />
              <FlowDot href="#confluence-watch" color="#94a3b8" r={3.4} dur="2.2s" begin="0.9s" inView={inView} />
              <FlowDot href="#confluence-watch" color="#94a3b8" r={3.4} dur="2.2s" begin="1.6s" inView={inView} />
              <FlowDot href="#confluence-you" color="#f97316" r={3.4} dur="2.2s" begin="0.4s" inView={inView} />
              <FlowDot href="#confluence-you" color="#f97316" r={3.4} dur="2.2s" begin="1.3s" inView={inView} />
              <FlowDot href="#confluence-nub" color="#22c55e" r={3} dur="1.1s" begin="0.2s" inView={inView} />
              <FlowDot href="#confluence-nub" color="#22c55e" r={3} dur="1.1s" begin="0.7s" inView={inView} />
            </svg>
          </div>

          {/* Down arrow (mobile only) */}
          <div className="sm:hidden text-center text-primary text-xl" aria-hidden>
            &darr;
          </div>

          {/* Decision */}
          <div
            style={{ transitionDelay: "900ms" }}
            className={`bg-dark-surface border border-primary/40 rounded-xl px-4 py-4 transition-all duration-500 motion-reduce:transition-none ${
              inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1.5"
            }`}
          >
            <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">
              Today
            </div>
            <div className="font-headline text-xl font-bold text-white">
              Tempo · 40 min
            </div>
            <div className="text-[11px] text-slate-400 mt-2.5 pt-2 border-t border-slate-800 leading-relaxed">
              <span className="text-primary font-bold">Why</span> · recovered
              well, but legs are heavy
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
