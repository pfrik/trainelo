import React from 'react';
import { Check, Dumbbell, Zap, Footprints, Armchair } from 'lucide-react';
export function WeeklyView() {
  const days = [{
    day: 'MON',
    status: 'complete',
    label: 'Rest',
    icon: Check
  }, {
    day: 'TUE',
    status: 'active',
    label: '8 km Easy',
    icon: Footprints
  }, {
    day: 'WED',
    status: 'upcoming',
    label: 'Strength',
    icon: Dumbbell
  }, {
    day: 'THU',
    status: 'upcoming',
    label: 'Tempo 13km',
    icon: Zap
  }, {
    day: 'FRI',
    status: 'upcoming',
    label: '6 km Easy',
    icon: Footprints
  }, {
    day: 'SAT',
    status: 'upcoming',
    label: 'Long 26km',
    icon: Footprints
  }, {
    day: 'SUN',
    status: 'upcoming',
    label: 'Rest',
    icon: Armchair
  }];
  return <div className="mb-8">
      <h3 className="text-lg font-bold text-[#1f2937] mb-4">
        This Week's Training
      </h3>
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
          {days.map((item, index) => {
          const isComplete = item.status === 'complete';
          const isActive = item.status === 'active';
          const Icon = item.icon;
          return <div key={index} className="flex flex-col">
                <div className="text-xs font-semibold text-[#9ca3af] text-center mb-2">
                  {item.day}
                </div>
                <div className={`
                    aspect-square rounded-xl flex items-center justify-center mb-2 transition-all
                    ${isComplete ? 'bg-emerald-50 text-[#059669]' : ''}
                    ${isActive ? 'bg-[#059669] text-white shadow-md shadow-emerald-900/20 ring-2 ring-emerald-100 ring-offset-2' : ''}
                    ${!isComplete && !isActive ? 'bg-gray-50 text-[#9ca3af]' : ''}
                  `}>
                  <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                </div>
                <div className={`text-xs text-center font-medium ${isActive ? 'text-[#059669]' : 'text-[#6b7280]'}`}>
                  {item.label}
                </div>
              </div>;
        })}
        </div>
      </div>
    </div>;
}