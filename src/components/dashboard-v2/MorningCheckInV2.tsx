import React, { useState } from 'react';
import { Check } from 'lucide-react';

type ReadinessLevel = 1 | 2 | 3 | 4 | 5;

const contextTags = [
  { id: 'stress', label: 'Work Stress', icon: '💼' },
  { id: 'travel', label: 'Travel', icon: '✈️' },
  { id: 'alcohol', label: 'Alcohol', icon: '🍷' },
  { id: 'late-meal', label: 'Late Meal', icon: '🍽️' },
  { id: 'sickness', label: 'Sickness', icon: '🤒' }
];

export function MorningCheckInV2() {
  const [selectedLevel, setSelectedLevel] = useState<ReadinessLevel | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showContextPrompt, setShowContextPrompt] = useState(false);

  const levels = [
    { value: 1 as ReadinessLevel, emoji: '😫', label: 'Drained' },
    { value: 2 as ReadinessLevel, emoji: '😴', label: 'Tired' },
    { value: 3 as ReadinessLevel, emoji: '😐', label: 'OK' },
    { value: 4 as ReadinessLevel, emoji: '😊', label: 'Good' },
    { value: 5 as ReadinessLevel, emoji: '🚀', label: 'Fresh' }
  ];

  const handleLevelSelect = (level: ReadinessLevel) => {
    setSelectedLevel(level);
    if (level <= 2) {
      setShowContextPrompt(true);
      setSelectedTags([]);
    } else {
      setShowContextPrompt(false);
      setSelectedTags([]);
    }
  };

  const toggleTag = (tagId: string) => {
    setSelectedTags(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  return (
    <div className="bg-gradient-to-r from-dark-surface to-dark-surface rounded-2xl p-6 mb-8 relative overflow-hidden border border-slate-700 shadow-sm">
      <div className="absolute top-0 left-0 w-1 h-full bg-primary"></div>

      <div className="relative z-10">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
          <div className="max-w-xl">
            <div className="flex items-center space-x-3 mb-2">
              <span className="bg-green-500/20 text-green-400 text-xs font-bold px-2 py-1 rounded uppercase tracking-wider border border-green-500/20">
                Required
              </span>
              <h2 className="text-lg font-bold text-white">Morning Check-in</h2>
            </div>
            <p className="text-slate-300 text-sm leading-relaxed">
              How are you feeling right now? Your input helps calibrate today's recommended intensity and recovery scores.
            </p>
          </div>

          <div className="flex gap-3">
            {levels.map((level) => {
              const isSelected = selectedLevel === level.value;
              return (
                <button
                  key={level.value}
                  onClick={() => handleLevelSelect(level.value)}
                  className={`
                    flex flex-col items-center gap-1 p-3 rounded-xl transition-all transform active:scale-95
                    ${isSelected
                      ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-105'
                      : 'bg-dark-base hover:bg-dark-base/70 text-slate-400 hover:text-slate-300 border border-slate-700/50'
                    }
                  `}
                  title={level.label}
                >
                  <span className="text-2xl">{level.emoji}</span>
                  <span className="text-xs font-medium">{level.label}</span>
                  {isSelected && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full animate-pulse"></div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Context Tags for negative states */}
        {showContextPrompt && (
          <div className="mt-6 pt-6 border-t border-slate-700/50 animate-in fade-in slide-in-from-top-2 duration-300">
            <p className="text-sm font-medium text-white mb-3">
              What's impacting you? (Optional)
            </p>
            <div className="flex flex-wrap gap-2">
              {contextTags.map((tag) => {
                const isSelected = selectedTags.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    onClick={() => toggleTag(tag.id)}
                    className={`
                      flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200
                      ${isSelected
                        ? 'bg-primary text-white shadow-sm'
                        : 'bg-dark-base text-slate-400 hover:text-slate-300 border border-slate-700/50 hover:border-slate-600/50'
                      }
                      active:scale-95
                    `}
                  >
                    <span className="text-base">{tag.icon}</span>
                    <span>{tag.label}</span>
                    {isSelected && <Check size={14} className="ml-0.5" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {selectedLevel && (
          <div className="mt-4 text-center xl:text-left">
            <p className="text-xs text-slate-400">
              <span className="font-semibold text-primary">Thanks for sharing.</span>
              {selectedLevel <= 2 && selectedTags.length > 0 &&
                " The AI will factor this into today's recommendations."
              }
              {selectedLevel >= 4 &&
                ' Great! Your energy looks good. The AI will optimize for quality training.'
              }
              {selectedLevel === 3 &&
                ' Your feedback helps the AI make better recommendations.'
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
}