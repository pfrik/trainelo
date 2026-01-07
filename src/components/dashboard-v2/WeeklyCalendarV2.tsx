import React from 'react';
import { Check, Dumbbell, Zap, Footprints, Armchair } from 'lucide-react';

export function WeeklyCalendarV2() {
  const days = [{
    day: 'MON',
    date: 16,
    status: 'complete',
    label: 'Rest',
    icon: Check
  }, {
    day: 'TUE',
    date: 17,
    status: 'active',
    label: '8 km Easy',
    icon: Footprints
  }, {
    day: 'WED',
    date: 18,
    status: 'upcoming',
    label: 'Strength',
    icon: Dumbbell
  }, {
    day: 'THU',
    date: 19,
    status: 'upcoming',
    label: 'Tempo 13km',
    icon: Zap
  }, {
    day: 'FRI',
    date: 20,
    status: 'upcoming',
    label: '6 km Easy',
    icon: Footprints
  }, {
    day: 'SAT',
    date: 21,
    status: 'upcoming',
    label: 'Long 26km',
    icon: Footprints
  }, {
    day: 'SUN',
    date: 22,
    status: 'upcoming',
    label: 'Rest',
    icon: Armchair
  }];

  return (
    <div className="bg-dark-surface rounded-2xl p-6 shadow-sm border border-slate-700/50">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-bold text-lg text-white">This Week's Training</h3>
        <span className="text-sm text-slate-400">Dec 16-22</span>
      </div>

      <div className="grid grid-cols-7 gap-3">
        {days.map((item, index) => {
          const isComplete = item.status === 'complete';
          const isActive = item.status === 'active';
          const Icon = item.icon;

          return (
            <div key={index} className="flex flex-col">
              <div className="text-xs font-semibold text-slate-500 text-center mb-1">
                {item.day}
              </div>
              <div className="text-xs text-slate-400 text-center mb-2">
                {item.date}
              </div>
              <div className={`
                aspect-square rounded-xl flex items-center justify-center mb-2 transition-all cursor-pointer
                ${isComplete ? 'bg-primary/10 text-primary border-2 border-primary/20' : ''}
                ${isActive ? 'bg-primary text-white shadow-md shadow-primary/20 ring-2 ring-primary/20 ring-offset-2 ring-offset-dark-surface' : ''}
                ${!isComplete && !isActive ? 'bg-dark-base text-slate-500 border border-slate-700/50 hover:border-slate-600/50' : ''}
              `}>
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <div className={`text-xs text-center font-medium ${isActive ? 'text-primary' : 'text-slate-400'}`}>
                {item.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}