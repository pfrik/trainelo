import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { MorningCheckInProps, SubjectiveCheckIn } from '@/types/dashboard.types';
import { cn } from '@/lib/utils';

const moodOptions: Array<{ value: SubjectiveCheckIn['mood']; label: string; emoji: string }> = [
  { value: 'drained', label: 'Drained', emoji: '😫' },
  { value: 'tired', label: 'Tired', emoji: '😴' },
  { value: 'ok', label: 'OK', emoji: '😐' },
  { value: 'good', label: 'Good', emoji: '😊' },
  { value: 'fresh', label: 'Fresh!', emoji: '🚀' },
];

export function MorningCheckIn({ onCheckIn }: MorningCheckInProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [selectedMood, setSelectedMood] = useState<SubjectiveCheckIn['mood'] | null>(null);

  const handleMoodSelect = (mood: SubjectiveCheckIn['mood']) => {
    setSelectedMood(mood);
    setIsAnimating(true);

    // Trigger callback after animation starts
    setTimeout(() => {
      onCheckIn(mood);
    }, 300);
  };

  return (
    <div
      className={cn(
        'transition-all duration-500 ease-out',
        isAnimating && 'opacity-0 transform -translate-y-4 scale-95'
      )}
    >
      <div className="flex flex-wrap gap-2 mt-4">
        {moodOptions.map((option) => (
          <Button
            key={option.value}
            variant="outline"
            className={cn(
              'h-8 px-3 py-1 text-sm font-medium rounded-full',
              'hover:border-emerald-500 hover:bg-emerald-50',
              'transition-all duration-200',
              selectedMood === option.value && 'border-emerald-500 bg-emerald-50'
            )}
            onClick={() => handleMoodSelect(option.value)}
          >
            <span className="mr-1">{option.emoji}</span>
            <span>{option.label}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}