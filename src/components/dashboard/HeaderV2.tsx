import React from 'react';

export function HeaderV2() {
  const currentDate = new Date();
  const formattedDate = currentDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  });

  return (
    <header className="flex justify-between items-end mb-8">
      <div>
        <h1 className="text-3xl font-extrabold text-white mb-1">
          Welcome back, Alex
        </h1>
        <div className="flex items-center text-sm text-slate-400 space-x-2">
          <span>{formattedDate}</span>
          <span className="w-1 h-1 rounded-full bg-slate-400"></span>
          <span>London</span>
          <span className="w-1 h-1 rounded-full bg-slate-400"></span>
          <div className="flex items-center">
            <span className="material-symbols-outlined text-yellow-500 text-base mr-1">wb_sunny</span>
            <span>18°C</span>
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        {/* Goal Context Badge */}
        <div className="px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full flex items-center gap-2">
          <span className="text-xs font-bold text-blue-400 uppercase tracking-wide">
            Goal Context
          </span>
          <span className="text-xs text-blue-100">
            Marathon - April 20 (95 days remaining)
          </span>
        </div>

        {/* Notifications */}
        <button className="p-2 text-slate-400 hover:bg-dark-surface rounded-full transition-colors relative">
          <span className="material-symbols-outlined">notifications</span>
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-dark-base"></span>
        </button>

        {/* Edit Profile Button */}
        <button className="px-4 py-2 bg-dark-surface text-slate-200 rounded-lg text-sm font-semibold hover:bg-dark-surface-lighter transition-colors border border-slate-700">
          Edit Profile
        </button>
      </div>
    </header>
  );
}