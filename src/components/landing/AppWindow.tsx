import { type ReactNode } from "react";

/** Dark app-window frame for real product components on the light canvas. */
export function AppWindow({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="bg-dark-base rounded-2xl border border-slate-700/60 shadow-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800 bg-dark-surface/60">
        <span className="flex gap-1.5" aria-hidden>
          <span className="w-2.5 h-2.5 rounded-full bg-slate-700" />
          <span className="w-2.5 h-2.5 rounded-full bg-slate-700" />
          <span className="w-2.5 h-2.5 rounded-full bg-slate-700" />
        </span>
        <span className="text-xs text-slate-500 font-medium mx-auto pr-8">{title}</span>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}
