import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import type { AiInsightCardProps } from '@/types/dashboard.types';
import { cn } from '@/lib/utils';

export function AiInsightCard({
  recommendation,
  onAccept,
  onReject,
  onKeepOriginal
}: AiInsightCardProps) {
  const { originalPlan, recommendedPlan } = recommendation;

  return (
    <div className="space-y-4">
      <div className="bg-gray-50 rounded-lg p-4 space-y-3">
        {/* Original Workout */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">ORIGINAL WORKOUT</span>
          <div className="flex-1 border-t border-gray-300" />
        </div>
        <div className="pl-2">
          <p className="text-gray-500 line-through">
            {originalPlan.name}
          </p>
        </div>

        {/* Recommended Workout */}
        <div className="flex items-center gap-3 mt-4">
          <span className="text-sm font-medium text-emerald-700">RECOMMENDED</span>
          <div className="flex-1 border-t border-emerald-300" />
        </div>
        <div className="pl-2">
          <p className="font-medium text-gray-900">
            {recommendedPlan.name}
          </p>
          <div className="flex items-center gap-2 mt-1 text-sm text-emerald-600">
            <ArrowRight className="h-4 w-4" />
            <span>{recommendedPlan.targetMiles} mi Easy Recovery</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button
          onClick={onAccept}
          className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white"
        >
          Accept Change
        </Button>
        <Button
          onClick={onKeepOriginal}
          variant="outline"
          className="flex-1 hover:bg-gray-50"
        >
          Keep Original Workout
        </Button>
      </div>
    </div>
  );
}