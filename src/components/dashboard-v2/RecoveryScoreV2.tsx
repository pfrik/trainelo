import React from 'react';
import { BedDouble, Activity, HeartPulse } from 'lucide-react';

export function RecoveryScoreV2() {
  const recoveryScore = 85;
  const radius = 80;
  const strokeWidth = 12;
  const normalizedRadius = radius - strokeWidth / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (recoveryScore / 100) * circumference;

  const metrics = [
    {
      icon: BedDouble,
      label: 'Sleep',
      value: '7h 42m',
      status: 'good',
      color: 'text-blue-400'
    },
    {
      icon: Activity,
      label: 'HRV',
      value: '42 ms',
      status: 'caution',
      color: 'text-yellow-400'
    },
    {
      icon: HeartPulse,
      label: 'Resting HR',
      value: '58 bpm',
      status: 'elevated',
      color: 'text-red-400'
    }
  ];

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#10b981'; // green
    if (score >= 60) return '#f59e0b'; // yellow
    return '#ef4444'; // red
  };

  return (
    <div className="bg-dark-surface rounded-2xl p-6 shadow-sm border border-slate-700/50 relative overflow-hidden">
      <div className="flex justify-between items-start mb-6 relative z-10">
        <div>
          <h3 className="font-bold text-lg text-white">Recovery Score</h3>
          <p className="text-sm text-slate-400">
            {recoveryScore >= 80 ? 'Primed to perform' :
             recoveryScore >= 60 ? 'Moderate recovery' :
             'Consider easy day'}
          </p>
        </div>
      </div>

      {/* Circular Progress */}
      <div className="flex justify-center mb-6">
        <div className="relative">
          <svg
            height={radius * 2}
            width={radius * 2}
            className="transform -rotate-90"
          >
            {/* Background circle */}
            <circle
              stroke="#1e293b"
              fill="transparent"
              strokeWidth={strokeWidth}
              r={normalizedRadius}
              cx={radius}
              cy={radius}
            />
            {/* Progress circle */}
            <circle
              stroke={getScoreColor(recoveryScore)}
              fill="transparent"
              strokeWidth={strokeWidth}
              strokeDasharray={circumference + ' ' + circumference}
              style={{ strokeDashoffset }}
              strokeLinecap="round"
              r={normalizedRadius}
              cx={radius}
              cy={radius}
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-bold text-white">{recoveryScore}</span>
            <span className="text-sm text-slate-400">Recovery</span>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="space-y-3">
        {metrics.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <div key={index} className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg bg-dark-base flex items-center justify-center ${metric.color}`}>
                <Icon size={16} />
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-400">{metric.label}</span>
                  <span className="text-sm font-medium text-white">{metric.value}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}