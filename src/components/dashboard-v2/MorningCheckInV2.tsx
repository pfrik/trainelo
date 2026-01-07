import React from 'react';

export function MorningCheckInV2() {
  return (
    <div className="bg-gradient-to-r from-dark-surface to-dark-surface rounded-2xl p-6 mb-8 relative overflow-hidden border border-slate-700 shadow-sm">
      <div className="absolute top-0 left-0 w-1 h-full bg-primary"></div>
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center relative z-10 gap-6">
        <div className="max-w-xl">
          <div className="flex items-center space-x-3 mb-2">
            <span className="bg-green-500/20 text-green-400 text-xs font-bold px-2 py-1 rounded uppercase tracking-wider border border-green-500/20">
              Required
            </span>
            <h2 className="text-lg font-bold text-white">Morning Check-in</h2>
          </div>
          <p className="text-slate-300 text-sm leading-relaxed">
            How are you feeling right now? Your input helps calibrate today's recommended intensity and recovery scores.
          </p>
        </div>
        {/* Placeholder for emoji buttons - will implement in Phase 2 */}
        <div className="text-slate-500">Morning check-in buttons will be here</div>
      </div>
    </div>
  );
}