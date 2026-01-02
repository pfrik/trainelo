import type { WorkoutPlan } from '@/types/dashboard.types';

interface WorkoutTimingChartProps {
  workout: WorkoutPlan;
}

export function WorkoutTimingChart({ workout }: WorkoutTimingChartProps) {
  const totalDuration = workout.totalDuration;

  // Calculate segment positions and widths
  let currentPosition = 0;
  const segments = workout.segments.map(segment => {
    const width = (segment.duration / totalDuration) * 100;
    const position = currentPosition;
    currentPosition += width;

    return {
      ...segment,
      width,
      position,
    };
  });

  const getSegmentColor = (type: string) => {
    switch (type) {
      case 'warmup':
        return 'bg-blue-400';
      case 'main':
        return 'bg-emerald-500';
      case 'cooldown':
        return 'bg-purple-400';
      default:
        return 'bg-gray-400';
    }
  };

  const formatTime = (minutes: number) => {
    if (minutes === 0) return '0';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  // Generate time markers (every 30 minutes)
  const timeMarkers = [];
  for (let i = 0; i <= totalDuration; i += 30) {
    timeMarkers.push({
      time: i,
      position: (i / totalDuration) * 100
    });
  }

  return (
    <div className="mt-4">
      {/* Time bar visualization */}
      <div className="relative h-12 bg-gray-100 rounded-lg overflow-hidden">
        {segments.map((segment, index) => (
          <div
            key={index}
            className={`absolute h-full ${getSegmentColor(segment.type)}`}
            style={{
              left: `${segment.position}%`,
              width: `${segment.width}%`,
            }}
          >
            <div className="h-full flex items-center justify-center text-white text-sm font-medium px-1">
              {segment.duration}m
            </div>
          </div>
        ))}
      </div>

      {/* Time markers */}
      <div className="relative h-8">
        {timeMarkers.map((marker, index) => (
          <div
            key={index}
            className="absolute flex flex-col items-center"
            style={{ left: `${marker.position}%` }}
          >
            <div className="w-0.5 h-2 bg-gray-400" />
            <span className="text-xs text-gray-500 mt-1 -translate-x-1/2">
              {formatTime(marker.time)}
            </span>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-blue-400 rounded" />
          <span className="text-xs text-gray-600">Warm-up</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-emerald-500 rounded" />
          <span className="text-xs text-gray-600">Main Set</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-purple-400 rounded" />
          <span className="text-xs text-gray-600">Cool-down</span>
        </div>
      </div>
    </div>
  );
}