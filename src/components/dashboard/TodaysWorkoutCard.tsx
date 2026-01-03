import { Button } from '@/components/ui/button';
import { Play, Clock, Activity, Heart } from 'lucide-react';
import type { TodaysWorkoutCardProps } from '@/types/dashboard.types';
import { Badge } from '@/components/ui/badge';

export function TodaysWorkoutCard({ workout, onStart }: TodaysWorkoutCardProps) {
  const getWorkoutTypeColor = (type: string) => {
    switch (type) {
      case 'recovery':
        return 'bg-emerald-100 text-emerald-700';
      case 'aerobic':
        return 'bg-blue-100 text-blue-700';
      case 'threshold':
        return 'bg-amber-100 text-amber-700';
      case 'intervals':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  };

  return (
    <div className="space-y-6">
      {/* Workout Header */}
      <div>
        <div className="flex items-start justify-between mb-4">
          <div>
            <Badge className={`${getWorkoutTypeColor(workout.type)} text-xs uppercase tracking-wide`}>
              {workout.type} WORKOUT
            </Badge>
            <h3 className="text-lg font-semibold text-gray-900 mt-2">{workout.name}</h3>
            <p className="text-sm text-gray-600 mt-1">{workout.description}</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold">{workout.recommendedPerceivedEffort || 5}.0</p>
            <p className="text-sm text-gray-500">miles</p>
          </div>
        </div>
      </div>

      {/* Workout Structure */}
      <div>
        <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Activity className="h-5 w-5 text-gray-600" />
          Workout Structure
        </h4>
        <div className="space-y-3">
          {workout.segments.map((segment, index) => (
            <div key={index} className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded bg-gray-200 flex items-center justify-center text-sm font-medium text-gray-600">
                {index + 1}
              </div>
              <div className="flex-1">
                <p className="font-medium capitalize">
                  {segment.type === 'warmup' && 'Warm-up'}
                  {segment.type === 'main' && 'Main Set'}
                  {segment.type === 'cooldown' && 'Cool-down'}
                </p>
                <p className="text-sm text-gray-600">{segment.description}</p>
                {segment.sets && segment.sets.map((set, setIdx) => (
                  <p key={setIdx} className="text-sm text-gray-500 mt-1">
                    {set.duration} {set.intensity && `(${set.intensity})`}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Short on Time Section */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-start gap-2 mb-3">
          <div>
            <p className="text-sm font-semibold text-amber-700">Short on time?</p>
            <p className="text-sm text-amber-600">The AI can adjust this workout to fit your schedule</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="bg-white border-amber-200 hover:bg-amber-100 hover:border-amber-300"
            onClick={() => console.log('Adjust to 30m')}
          >
            30m
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="bg-white border-amber-200 hover:bg-amber-100 hover:border-amber-300"
            onClick={() => console.log('Adjust to 45m')}
          >
            45m
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="bg-white border-amber-200 hover:bg-amber-100 hover:border-amber-300"
            onClick={() => console.log('Adjust to 60m')}
          >
            60m
          </Button>
        </div>
      </div>

      {/* Footer with Stats and Start Button */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            <span>{formatDuration(workout.totalDuration)}</span>
          </div>
          <div className="flex items-center gap-1">
            <Activity className="h-4 w-4" />
            <span>Zone 2</span>
          </div>
          <div className="flex items-center gap-1">
            <Heart className="h-4 w-4" />
            <span>130-140 bpm</span>
          </div>
        </div>
        <Button
          onClick={onStart}
          className="bg-emerald-700 hover:bg-emerald-800 text-white"
          size="default"
        >
          <Play className="h-4 w-4 mr-2" />
          Start Workout
        </Button>
      </div>
    </div>
  );
}