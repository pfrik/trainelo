import { Check, X, Activity, Dumbbell, Heart, Timer, Coffee } from 'lucide-react';
import type { WeeklyTrainingChartProps } from '@/types/dashboard.types';
import { cn } from '@/lib/utils';

export function WeeklyTrainingChart({ weeklyData }: WeeklyTrainingChartProps) {
  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const getWorkoutIcon = (type?: string) => {
    switch (type) {
      case 'rest':
        return Coffee;
      case 'easy':
        return Activity;
      case 'tempo':
        return Timer;
      case 'strength':
        return Dumbbell;
      case 'long':
        return Heart;
      default:
        return Activity;
    }
  };

  const formatMinutes = (minutes: number) => {
    if (minutes < 60) return `${minutes}min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  return (
    <div>
      {/* Day Cards Grid */}
      <div className="grid grid-cols-7 gap-3">
        {weeklyData.map((day, index) => {
          const Icon = getWorkoutIcon(day.workoutType);
          const isCurrentDay = isToday(day.date);

          return (
            <div
              key={index}
              className={cn(
                'aspect-square rounded-lg p-3 flex flex-col items-center justify-center relative transition-all',
                isCurrentDay
                  ? 'bg-emerald-500 text-white shadow-md'
                  : 'bg-white border border-gray-200 hover:border-gray-300'
              )}
            >
              {/* Day Label */}
              <div className={cn(
                "text-xs font-semibold mb-2",
                isCurrentDay ? "text-white" : "text-gray-700"
              )}>
                {day.weekLabel}
              </div>

              {/* Icon */}
              <Icon className={cn(
                "h-6 w-6 mb-1",
                isCurrentDay ? "text-white" : day.isCompleted ? "text-emerald-600" : "text-gray-400"
              )} />

              {/* Duration or Status */}
              <div className={cn(
                "text-xs font-medium",
                isCurrentDay ? "text-white" : "text-gray-600"
              )}>
                {day.isRest ? (
                  "Rest"
                ) : day.minutes ? (
                  formatMinutes(day.minutes)
                ) : (
                  "Planned"
                )}
              </div>

              {/* Completion Check Mark */}
              {day.isCompleted && !isCurrentDay && (
                <div className="absolute top-1 right-1">
                  <Check className="h-4 w-4 text-emerald-500" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}