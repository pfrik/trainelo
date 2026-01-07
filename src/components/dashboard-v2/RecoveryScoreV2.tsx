import React from 'react';

export function RecoveryScoreV2() {
  return (
    <div className="bg-dark-surface rounded-2xl p-6 shadow-sm border border-slate-700/50 relative overflow-hidden">
      <div className="flex justify-between items-start mb-6 relative z-10">
        <div>
          <h3 className="font-bold text-lg text-white">Recovery Score</h3>
          <p className="text-sm text-slate-400">Primed to perform</p>
        </div>
      </div>
      {/* Placeholder - will implement circular progress in Phase 2 */}
      <div className="text-slate-400 text-center py-8">Recovery score visualization will be here</div>
    </div>
  );
}