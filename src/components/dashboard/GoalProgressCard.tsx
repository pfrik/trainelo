import { Flag } from 'lucide-react';
import type { GoalProgressCardProps } from '@/types/dashboard.types';
import { format } from 'date-fns';

export function GoalProgressCard({ goal }: GoalProgressCardProps) {
  const circumference = 2 * Math.PI * 40; // radius = 40
  const strokeDashoffset = circumference - (goal.trainingProgress / 100) * circumference;

  return (
    <div className="relative">
      <div className="flex items-center gap-2 mb-3">
        <Flag className="h-5 w-5 text-amber-600" />
        <span className="text-xs font-medium text-amber-600 uppercase tracking-wide">Goal Event</span>
      </div>

      <h3 className="text-lg font-semibold text-gray-900">
        {goal.name} - {format(goal.date, 'MMMM d, yyyy')}
      </h3>

      <p className="text-sm text-gray-600 mt-1">
        Target: {goal.targetTime} • {goal.daysRemaining} days remaining
      </p>

      {/* Circular Progress */}
      <div className="absolute right-0 top-0">
        <div className="relative w-28 h-28">
          <svg className="w-full h-full -rotate-90">
            {/* Background circle */}
            <circle
              cx="56"
              cy="56"
              r="40"
              stroke="currentColor"
              strokeWidth="8"
              fill="none"
              className="text-gray-200"
            />
            {/* Progress circle */}
            <circle
              cx="56"
              cy="56"
              r="40"
              stroke="currentColor"
              strokeWidth="8"
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="text-emerald-500 transition-all duration-500 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold text-emerald-700">
              {goal.trainingProgress}%
            </span>
            <span className="text-xs text-gray-500">Training Complete</span>
          </div>
        </div>
      </div>
    </div>
  );
}