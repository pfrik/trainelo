import { Check, X } from 'lucide-react';
import type { WeeklyTrainingChartProps } from '@/types/dashboard.types';
import { cn } from '@/lib/utils';

export function WeeklyTrainingChart({ weeklyData }: WeeklyTrainingChartProps) {
  const maxHeight = 120; // Max bar height in pixels
  const maxMinutes = Math.max(...weeklyData.filter(d => d.minutes).map(d => d.minutes!));

  const getBarHeight = (minutes?: number) => {
    if (!minutes || minutes === 0) return 0;
    return (minutes / maxMinutes) * maxHeight;
  };

  const getBarColor = (type?: string, isCompleted?: boolean) => {
    if (!isCompleted) return 'bg-gray-200';

    switch (type) {
      case 'rest':
        return 'bg-gray-400';
      case 'easy':
        return 'bg-emerald-400';
      case 'tempo':
        return 'bg-amber-400';
      case 'strength':
        return 'bg-blue-400';
      case 'long':
        return 'bg-purple-400';
      default:
        return 'bg-gray-400';
    }
  };

  const formatMinutes = (minutes: number) => {
    if (minutes < 60) return `${minutes}`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  return (
    <div>
      {/* Chart Container */}
      <div className="flex items-end justify-between gap-2" style={{ height: `${maxHeight + 50}px` }}>
        {weeklyData.map((day, index) => (
          <div
            key={index}
            className="flex-1 flex flex-col items-center justify-end relative"
          >
            {/* Bar */}
            {!day.isRest && day.minutes ? (
              <div
                className={cn(
                  'w-full rounded-t-md transition-all duration-300',
                  getBarColor(day.workoutType, day.isCompleted),
                  isToday(day.date) && 'ring-2 ring-emerald-500 ring-offset-2'
                )}
                style={{ height: `${getBarHeight(day.minutes)}px` }}
              >
                {/* Show duration on hover */}
                <div className="opacity-0 hover:opacity-100 transition-opacity absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-medium whitespace-nowrap">
                  {formatMinutes(day.minutes)}
                </div>
              </div>
            ) : (
              <div className="w-full h-8 flex items-center justify-center">
                {day.isRest && (
                  <span className="text-xs text-gray-400 font-medium">Rest</span>
                )}
              </div>
            )}

            {/* Day label and status */}
            <div className="mt-2 text-center">
              <div className="text-sm font-semibold text-gray-700">
                {day.weekLabel}
              </div>
              {day.isCompleted ? (
                <Check className="h-5 w-5 text-emerald-500 mx-auto mt-1" />
              ) : !day.isRest ? (
                <div className="h-5 w-5 rounded-full bg-gray-300 mx-auto mt-1" />
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 mt-6">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-emerald-400 rounded" />
          <span className="text-xs text-gray-600">Easy</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-blue-400 rounded" />
          <span className="text-xs text-gray-600">Strength</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-amber-400 rounded" />
          <span className="text-xs text-gray-600">Tempo</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-purple-400 rounded" />
          <span className="text-xs text-gray-600">Long Run</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-gray-400 rounded" />
          <span className="text-xs text-gray-600">Rest</span>
        </div>
      </div>
    </div>
  );
}