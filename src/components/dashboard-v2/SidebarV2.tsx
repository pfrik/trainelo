import React from 'react';

export function SidebarV2() {
  return (
    <aside className="w-64 bg-dark-base border-r border-slate-800 flex flex-col justify-between flex-shrink-0 z-20">
      <div className="p-6">
        {/* User Profile Section */}
        <div className="flex items-center space-x-3 mb-8">
          <div className="relative">
            <img
              alt="Alex Morgan"
              className="w-12 h-12 rounded-full object-cover border-2 border-primary"
              src="https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&h=100&fit=crop"
            />
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-dark-base rounded-full"></div>
          </div>
          <div>
            <h3 className="font-bold text-white">Alex Morgan</h3>
            <p className="text-xs text-slate-400">Pro Plan Member</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="space-y-2">
          <a
            className="flex items-center space-x-3 px-4 py-3 bg-primary text-white rounded-xl shadow-lg shadow-green-500/20 group transition-all"
            href="#"
          >
            <span className="material-symbols-outlined">dashboard</span>
            <span className="font-medium">Dashboard</span>
          </a>
          <a
            className="flex items-center space-x-3 px-4 py-3 text-slate-400 hover:bg-dark-surface rounded-xl transition-colors group"
            href="#"
          >
            <span className="material-symbols-outlined group-hover:text-primary transition-colors">fitness_center</span>
            <span className="font-medium">Training Log</span>
          </a>
          <a
            className="flex items-center space-x-3 px-4 py-3 text-slate-400 hover:bg-dark-surface rounded-xl transition-colors group"
            href="#"
          >
            <span className="material-symbols-outlined group-hover:text-primary transition-colors">insights</span>
            <span className="font-medium">Analytics</span>
          </a>
          <a
            className="flex items-center space-x-3 px-4 py-3 text-slate-400 hover:bg-dark-surface rounded-xl transition-colors group"
            href="#"
          >
            <span className="material-symbols-outlined group-hover:text-primary transition-colors">battery_charging_full</span>
            <span className="font-medium">Recovery</span>
          </a>
        </nav>
      </div>

      {/* Settings Link */}
      <div className="p-6 border-t border-slate-800">
        <a
          className="flex items-center space-x-3 text-slate-400 hover:text-primary transition-colors"
          href="#"
        >
          <span className="material-symbols-outlined">settings</span>
          <span className="font-medium">Settings</span>
        </a>
      </div>
    </aside>
  );
}