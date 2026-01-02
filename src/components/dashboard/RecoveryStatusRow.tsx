import { Badge } from '@/components/ui/badge';
import { Zap, Heart, Moon } from 'lucide-react';
import type { RecoveryStatusRowProps, StatusColor } from '@/types/dashboard.types';
import { cn } from '@/lib/utils';

export function RecoveryStatusRow({ stats }: RecoveryStatusRowProps) {
  const getStatusColor = (status: StatusColor) => {
    switch (status) {
      case 'good':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'caution':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'elevated':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusBadge = (status: StatusColor) => {
    switch (status) {
      case 'good':
        return 'GOOD';
      case 'caution':
        return 'CAUTION';
      case 'elevated':
        return 'ELEVATED';
      default:
        return 'UNKNOWN';
    }
  };

  const metrics = [
    {
      icon: Moon,
      label: 'Sleep Duration',
      value: `${stats.sleep.duration}h ${Math.round((stats.sleep.duration % 1) * 60)}m`,
      subtext: `Deep: ${stats.sleep.deepSleep}h • REM: ${stats.sleep.remSleep}h 😴`,
      status: stats.sleep.quality,
    },
    {
      icon: Zap,
      label: 'HRV (7-day avg: 49)',
      value: `${stats.hrv.value} ms`,
      subtext: `↓ ${Math.abs(stats.hrv.percentFromBaseline)}% from baseline`,
      status: stats.hrv.status,
      isWarning: true,
    },
    {
      icon: Heart,
      label: 'Resting HR (avg: 54)',
      value: `${stats.restingHeartRate.value} bpm`,
      subtext: `↑ ${stats.restingHeartRate.percentFromBaseline}% from baseline`,
      status: stats.restingHeartRate.status,
      isWarning: true,
    },
  ];

  return (
    <div className="grid md:grid-cols-3 gap-6">
      {metrics.map((metric, index) => (
        <div
          key={index}
          className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <metric.icon className="h-5 w-5 text-gray-600" />
              <div>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-xs font-medium uppercase tracking-wide px-2 py-0.5',
                    getStatusColor(metric.status)
                  )}
                >
                  {getStatusBadge(metric.status)}
                </Badge>
              </div>
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{metric.value}</p>
            <p className="text-sm text-gray-600 mt-1">{metric.label}</p>
            <p className={cn(
              'text-xs mt-2',
              metric.isWarning ? 'text-amber-600' : 'text-gray-500'
            )}>
              {metric.subtext}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}