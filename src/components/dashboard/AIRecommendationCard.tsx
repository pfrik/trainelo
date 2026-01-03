import React from 'react';
import { Brain, ArrowRight } from 'lucide-react';
export function AIRecommendationCard() {
  return <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-100 mb-8 relative overflow-hidden">
      {/* Subtle accent line on top */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#059669] to-[#06b6d4]"></div>

      <div className="flex items-start gap-4 mb-6">
        <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-[#059669] flex-shrink-0">
          <Brain size={24} />
        </div>
        <div>
          <h3 className="text-lg font-bold text-[#1f2937] mb-2">
            AI Recommendation: Adjust Today's Workout
          </h3>
          <p className="text-[#4b5563] leading-relaxed">
            Your HRV dropped 15% overnight and your resting heart rate is
            elevated by 8 bpm. We recommend switching today's tempo run to an
            easy aerobic flush to support recovery.
          </p>
        </div>
      </div>

      <div className="bg-gray-50 rounded-xl p-5 mb-6 border border-gray-100">
        <p className="text-sm text-[#4b5563]">
          <span className="font-bold text-[#1f2937]">Why this matters:</span>{' '}
          Pushing hard today could compromise your key workout on Thursday and
          delay your adaptation. An easy day now protects your marathon goal.
        </p>

        <div className="mt-4 pt-4 border-t border-gray-200 flex flex-col sm:flex-row gap-8">
          <div className="flex-1">
            <p className="text-xs font-semibold text-[#9ca3af] uppercase tracking-wider mb-1">
              Original Workout
            </p>
            <p className="font-medium text-[#6b7280] line-through">
              8 mi Tempo Run
            </p>
          </div>
          <div className="flex-1">
            <p className="text-xs font-bold text-[#059669] uppercase tracking-wider mb-1">
              Recommended
            </p>
            <p className="font-bold text-[#1f2937] flex items-center gap-2">
              5 mi Easy Recovery
              <ArrowRight size={16} className="text-[#059669]" />
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <button className="flex-1 bg-[#059669] hover:bg-[#047857] text-white font-bold py-3 px-6 rounded-xl shadow-sm shadow-emerald-900/10 transition-all active:scale-95 text-center">
          Accept Change
        </button>
        <button className="flex-1 bg-white border border-gray-200 text-[#6b7280] hover:bg-gray-50 hover:text-[#1f2937] font-medium py-3 px-6 rounded-xl transition-colors text-center">
          Keep Original Workout
        </button>
      </div>
    </div>;
}