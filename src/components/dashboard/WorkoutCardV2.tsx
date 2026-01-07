import React, { useState } from 'react';
import { Clock, Activity, Heart, Play, Timer, Footprints } from 'lucide-react';

export function WorkoutCardV2() {
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);

  const durations = [
    { minutes: 30, label: '30m' },
    { minutes: 45, label: '45m' },
    { minutes: 60, label: '60m' },
    { minutes: 50, label: 'Full (50m)' }
  ];

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

  return (
    <div className="bg-dark-surface rounded-2xl overflow-hidden shadow-sm border border-slate-700/50 group relative">
      <div className="relative z-10 p-8">
        <div className="flex justify-between items-start mb-6">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="bg-primary text-slate-900 text-xs font-black px-3 py-1.5 rounded uppercase tracking-wide">
                Today's Focus
              </span>
              <span className="bg-slate-700/50 backdrop-blur-md text-slate-200 text-xs font-bold px-3 py-1.5 rounded border border-slate-600/50 uppercase tracking-wide">
                Aerobic Base
              </span>
            </div>
            <h2 className="text-3xl font-black text-white mb-2">
              Aerobic Flush Run
            </h2>
            <p className="text-slate-300">
              Easy recovery pace to promote blood flow and adaptation
            </p>
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold text-white">8.0</div>
            <div className="text-sm text-slate-400 font-medium">km</div>
          </div>
        </div>

        {/* Workout Structure */}
        <div className="bg-dark-base rounded-xl p-6 mb-6 border border-slate-700/30">
          <h3 className="font-bold text-white mb-4">Workout Structure</h3>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-lg bg-slate-700/50 flex items-center justify-center text-sm font-bold text-slate-400 flex-shrink-0">
                1
              </div>
              <div>
                <p className="font-semibold text-white">Warm-up</p>
                <p className="text-sm text-slate-400">
                  10 min easy pace, dynamic stretches
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-lg bg-slate-700/50 flex items-center justify-center text-sm font-bold text-slate-400 flex-shrink-0">
                2
              </div>
              <div>
                <p className="font-semibold text-white">Main Set</p>
                <p className="text-sm text-slate-400">
                  30 min steady Zone 2 (130-140 bpm)
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-lg bg-slate-700/50 flex items-center justify-center text-sm font-bold text-slate-400 flex-shrink-0">
                3
              </div>
              <div>
                <p className="font-semibold text-white">Cool-down</p>
                <p className="text-sm text-slate-400">
                  10 min easy jog, static stretches
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Time Adjustment */}
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-5 mb-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-8 h-8 bg-yellow-500/20 rounded-lg flex items-center justify-center text-yellow-400 flex-shrink-0">
              <Timer size={18} />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-bold text-white mb-1">
                Short on time?
              </h4>
              <p className="text-xs text-slate-400">
                The AI can adjust this workout to fit your schedule
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-3">
            {durations.map(duration => {
              const isSelected = selectedDuration === duration.minutes;
              const isFull = duration.minutes === 50;
              return (
                <button
                  key={duration.minutes}
                  onClick={() => setSelectedDuration(duration.minutes)}
                  className={`
                    px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
                    ${isSelected && isFull
                      ? 'bg-primary text-white shadow-sm'
                      : isSelected
                      ? 'bg-yellow-500 text-slate-900 shadow-sm'
                      : 'bg-dark-base border border-slate-700/50 text-slate-300 hover:bg-dark-base/70 hover:border-slate-600/50'
                    }
                    active:scale-95
                  `}
                >
                  {duration.label}
                </button>
              );
            })}
          </div>

          {selectedDuration && (
            <div className="pt-3 border-t border-yellow-500/30">
              <p className="text-xs text-slate-300">
                <span className="font-semibold text-yellow-400">
                  AI Adjustment:
                </span>{' '}
                {getAdjustmentMessage()}
              </p>
            </div>
          )}
        </div>

        {/* Workout Details and Start Button */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-2">
          <div className="flex items-center gap-6 w-full md:w-auto">
            <div className="flex items-center gap-2 text-slate-400">
              <Clock size={18} />
              <span className="text-sm font-medium">
                {selectedDuration || 50} min
              </span>
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              <Activity size={18} />
              <span className="text-sm font-medium">Zone 2</span>
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              <Heart size={18} />
              <span className="text-sm font-medium">130-140 bpm</span>
            </div>
          </div>

          <button className="w-full md:w-auto flex items-center justify-center gap-2 bg-primary hover:bg-primary-light text-white font-bold py-3 px-8 rounded-xl shadow-sm shadow-primary/10 transition-all active:scale-95">
            <Play size={18} fill="currentColor" />
            Start Workout
          </button>
        </div>
      </div>
    </div>
  );
}