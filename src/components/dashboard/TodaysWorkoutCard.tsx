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
            <Badge className={getWorkoutTypeColor(workout.type)}>
              {workout.type.toUpperCase()} WORKOUT
            </Badge>
            <h3 className="text-2xl font-bold mt-2">{workout.name}</h3>
            <p className="text-gray-600 mt-1">{workout.description}</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold">{workout.recommendedPerceivedEffort || 5}.0</p>
            <p className="text-sm text-gray-500">miles</p>
          </div>
        </div>
      </div>

      {/* Workout Structure */}
      <div>
        <h4 className="font-semibold mb-3 flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Workout Structure
        </h4>
        <div className="space-y-3">
          {workout.segments.map((segment, index) => (
            <div key={index} className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-medium">
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

      {/* AI Notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <p className="text-sm text-amber-700 flex items-start gap-2">
          <span className="text-lg">⚡</span>
          <span>
            Short on time?
            <br />
            The AI can adjust this workout to fit your schedule
          </span>
        </p>
      </div>

      {/* Timing Info */}
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

      {/* Start Button */}
      <Button
        onClick={onStart}
        className="w-full bg-emerald-700 hover:bg-emerald-800 text-white h-12"
        size="lg"
      >
        <Play className="h-5 w-5 mr-2" />
        Start Workout
      </Button>
    </div>
  );
}