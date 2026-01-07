import React from 'react';

export function WorkoutCardV2() {
  return (
    <div className="bg-dark-surface rounded-2xl overflow-hidden shadow-sm border border-slate-700/50 group relative">
      <div className="relative z-10 p-8 flex flex-col justify-between h-full min-h-[380px]">
        <div className="flex items-center gap-3 mb-6">
          <span className="bg-primary text-slate-900 text-xs font-black px-3 py-1.5 rounded uppercase tracking-wide">
            Today's Focus
          </span>
          <span className="bg-slate-700/50 backdrop-blur-md text-slate-200 text-xs font-bold px-3 py-1.5 rounded border border-slate-600/50 uppercase tracking-wide">
            High Intensity
          </span>
        </div>
        <div className="mb-4">
          <h2 className="text-4xl md:text-5xl font-black text-white leading-tight tracking-tight">
            Tempo Run: Build Speed
          </h2>
        </div>
        {/* Placeholder content - will implement details in Phase 2 */}
        <div className="text-slate-400">Workout details will be here</div>
      </div>
    </div>
  );
}