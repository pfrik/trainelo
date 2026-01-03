import React, { useState } from 'react';
import { Zap, Check } from 'lucide-react';
type ReadinessLevel = 1 | 2 | 3 | 4 | 5;
const contextTags = [{
  id: 'stress',
  label: 'Work Stress',
  icon: '💼'
}, {
  id: 'travel',
  label: 'Travel',
  icon: '✈️'
}, {
  id: 'alcohol',
  label: 'Alcohol',
  icon: '🍷'
}, {
  id: 'late-meal',
  label: 'Late Meal',
  icon: '🍽️'
}, {
  id: 'sickness',
  label: 'Sickness',
  icon: '🤒'
}];
export function MorningCheckin() {
  const [selectedLevel, setSelectedLevel] = useState<ReadinessLevel | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showContextPrompt, setShowContextPrompt] = useState(false);
  const levels = [{
    value: 1 as ReadinessLevel,
    label: 'Drained',
    color: 'from-red-500 to-orange-500'
  }, {
    value: 2 as ReadinessLevel,
    label: 'Tired',
    color: 'from-orange-500 to-amber-500'
  }, {
    value: 3 as ReadinessLevel,
    label: 'OK',
    color: 'from-amber-500 to-yellow-500'
  }, {
    value: 4 as ReadinessLevel,
    label: 'Good',
    color: 'from-emerald-400 to-emerald-500'
  }, {
    value: 5 as ReadinessLevel,
    label: 'Fresh',
    color: 'from-emerald-500 to-teal-500'
  }];
  const handleLevelSelect = (level: ReadinessLevel) => {
    setSelectedLevel(level);
    // Show context prompt only for negative states (Drained or Tired)
    if (level <= 2) {
      setShowContextPrompt(true);
      setSelectedTags([]);
    } else {
      setShowContextPrompt(false);
      setSelectedTags([]);
    }
  };
  const toggleTag = (tagId: string) => {
    setSelectedTags(prev => prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]);
  };
  const getInsightMessage = () => {
    if (!selectedLevel) return null;
    if (selectedLevel <= 2 && selectedTags.length > 0) {
      return "Thanks for the context. The AI will factor this into today's recommendations.";
    }
    if (selectedLevel >= 4) {
      return 'Great! Your energy looks good. The AI will optimize for quality training.';
    }
    return 'Your feedback helps the AI make better recommendations.';
  };
  return <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center text-[#059669] flex-shrink-0">
          <Zap size={20} />
        </div>

        <div className="flex-1">
          <h3 className="text-base font-bold text-[#1f2937] mb-1">
            Morning Check-in
          </h3>
          <p className="text-sm text-[#6b7280] mb-4">
            How are you feeling today?
          </p>

          <div className="flex flex-wrap gap-2">
            {levels.map(level => {
            const isSelected = selectedLevel === level.value;
            const isPastSelection = selectedLevel !== null && level.value <= selectedLevel;
            return <button key={level.value} onClick={() => handleLevelSelect(level.value)} className={`
                    relative px-4 py-2.5 rounded-lg font-medium text-sm transition-all duration-300
                    ${isSelected ? 'bg-gradient-to-r ' + level.color + ' text-white shadow-md scale-105' : isPastSelection ? 'bg-gray-100 text-[#6b7280] hover:bg-gray-200' : 'bg-gray-50 text-[#9ca3af] hover:bg-gray-100 hover:text-[#6b7280]'}
                    active:scale-95
                  `}>
                  {level.label}
                  {isSelected && <span className="absolute -top-1 -right-1 w-2 h-2 bg-white rounded-full shadow-sm"></span>}
                </button>;
          })}
          </div>

          {/* Context Tags - Only show for negative states */}
          {showContextPrompt && <div className="mt-5 pt-5 border-t border-gray-100 animate-in fade-in slide-in-from-top-2 duration-300">
              <p className="text-sm font-medium text-[#1f2937] mb-3">
                What's impacting you? (Optional)
              </p>
              <div className="flex flex-wrap gap-2">
                {contextTags.map(tag => {
              const isSelected = selectedTags.includes(tag.id);
              return <button key={tag.id} onClick={() => toggleTag(tag.id)} className={`
                        flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200
                        ${isSelected ? 'bg-[#059669] text-white shadow-sm' : 'bg-gray-50 text-[#6b7280] hover:bg-gray-100 border border-gray-200'}
                        active:scale-95
                      `}>
                      <span className="text-base">{tag.icon}</span>
                      <span>{tag.label}</span>
                      {isSelected && <Check size={14} className="ml-0.5" />}
                    </button>;
            })}
              </div>
            </div>}

          {selectedLevel && <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs text-[#6b7280]">
                <span className="font-semibold text-[#059669]">
                  Thanks for sharing.
                </span>{' '}
                {getInsightMessage()}
              </p>
            </div>}
        </div>
      </div>
    </div>;
}