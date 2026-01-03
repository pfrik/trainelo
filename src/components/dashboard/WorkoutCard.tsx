import React, { useState } from 'react';
import { Clock, Activity, Heart, Play, Timer } from 'lucide-react';
export function WorkoutCard() {
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);
  const durations = [{
    minutes: 30,
    label: '30m'
  }, {
    minutes: 45,
    label: '45m'
  }, {
    minutes: 60,
    label: '60m'
  }, {
    minutes: 50,
    label: 'Full (50m)'
  }];
  const getAdjustmentMessage = () => {
    if (!selectedDuration) return null;
    if (selectedDuration === 50) {
      return 'Full workout as planned';
    }
    if (selectedDuration === 30) {
      return 'Adjusted: Increased intensity to Zone 3 intervals to maintain training load in 30 min';
    }
    if (selectedDuration === 45) {
      return 'Adjusted: Condensed warm-up and cool-down, maintained Zone 2 steady state';
    }
    return 'Adjusted: Modified structure to fit your available time while preserving training benefits';
  };
  return <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-8">
      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold text-[#059669] uppercase tracking-wider">
              Recommended Workout
            </span>
          </div>
          <h2 className="text-2xl font-bold text-[#1f2937] mb-2">
            Aerobic Flush Run
          </h2>
          <p className="text-[#6b7280]">
            Easy recovery pace to promote blood flow and adaptation
          </p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-[#1f2937]">8.0</div>
          <div className="text-sm text-[#6b7280] font-medium">km</div>
        </div>
      </div>

      <div className="bg-[#FAF9F7] rounded-xl p-6 mb-6">
        <h3 className="font-bold text-[#1f2937] mb-4">Workout Structure</h3>
        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center text-sm font-bold text-[#6b7280] flex-shrink-0">
              1
            </div>
            <div>
              <p className="font-bold text-[#1f2937]">Warm-up</p>
              <p className="text-sm text-[#6b7280]">
                10 min easy pace, dynamic stretches
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center text-sm font-bold text-[#6b7280] flex-shrink-0">
              2
            </div>
            <div>
              <p className="font-bold text-[#1f2937]">Main Set</p>
              <p className="text-sm text-[#6b7280]">
                30 min steady Zone 2 (130-140 bpm)
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center text-sm font-bold text-[#6b7280] flex-shrink-0">
              3
            </div>
            <div>
              <p className="font-bold text-[#1f2937]">Cool-down</p>
              <p className="text-sm text-[#6b7280]">
                10 min easy jog, static stretches
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-100 rounded-xl p-5 mb-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center text-amber-600 flex-shrink-0">
            <Timer size={18} />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-bold text-[#1f2937] mb-1">
              Short on time?
            </h4>
            <p className="text-xs text-[#6b7280]">
              The AI can adjust this workout to fit your schedule
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
          {durations.map(duration => {
          const isSelected = selectedDuration === duration.minutes;
          const isFull = duration.minutes === 50;
          return <button key={duration.minutes} onClick={() => setSelectedDuration(duration.minutes)} className={`
                  px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
                  ${isSelected && isFull ? 'bg-[#059669] text-white shadow-sm' : isSelected ? 'bg-amber-500 text-white shadow-sm' : 'bg-white border border-amber-200 text-[#6b7280] hover:bg-amber-50 hover:border-amber-300'}
                  active:scale-95
                `}>
                {duration.label}
              </button>;
        })}
        </div>

        {selectedDuration && <div className="pt-3 border-t border-amber-200">
            <p className="text-xs text-[#4b5563]">
              <span className="font-semibold text-amber-700">
                AI Adjustment:
              </span>{' '}
              {getAdjustmentMessage()}
            </p>
          </div>}
      </div>

      <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-2">
        <div className="flex items-center gap-6 w-full md:w-auto">
          <div className="flex items-center gap-2 text-[#4b5563]">
            <Clock size={18} />
            <span className="text-sm font-medium">
              {selectedDuration || 50} min
            </span>
          </div>
          <div className="flex items-center gap-2 text-[#4b5563]">
            <Activity size={18} />
            <span className="text-sm font-medium">Zone 2</span>
          </div>
          <div className="flex items-center gap-2 text-[#4b5563]">
            <Heart size={18} />
            <span className="text-sm font-medium">130-140 bpm</span>
          </div>
        </div>

        <button className="w-full md:w-auto flex items-center justify-center gap-2 bg-[#059669] hover:bg-[#047857] text-white font-bold py-3 px-8 rounded-xl shadow-sm shadow-emerald-900/10 transition-all active:scale-95">
          <Play size={18} fill="currentColor" />
          Start Workout
        </button>
      </div>
    </div>;
}