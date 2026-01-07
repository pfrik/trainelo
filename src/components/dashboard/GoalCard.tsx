import React from 'react';
import { Flag } from 'lucide-react';
export function GoalCard() {
  return <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
      {/* Decorative background gradient */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-orange-50 rounded-full blur-3xl -mr-32 -mt-32 opacity-50 pointer-events-none"></div>

      <div className="flex items-start gap-5 relative z-10">
        <div className="w-14 h-14 bg-orange-100 rounded-xl flex items-center justify-center text-[#f97316] flex-shrink-0">
          <Flag size={28} fill="currentColor" className="opacity-90" />
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-[#f97316] uppercase tracking-wider">
              Goal Event
            </span>
          </div>
          <h2 className="text-xl font-bold text-[#1f2937] mb-1">
            Marathon - April 20, 2025
          </h2>
          <p className="text-[#6b7280]">Target: Sub 3:30 • 95 days remaining</p>
        </div>
      </div>

      <div className="flex items-center gap-4 relative z-10">
        <div className="text-right">
          <div className="text-3xl font-bold text-[#059669]">68%</div>
          <div className="text-sm text-[#6b7280] font-medium">
            Training Complete
          </div>
        </div>

        {/* Circular Progress Ring */}
        <div className="relative w-16 h-16">
          <svg className="w-full h-full transform -rotate-90">
            <circle cx="32" cy="32" r="28" stroke="#e5e7eb" strokeWidth="6" fill="none" />
            <circle cx="32" cy="32" r="28" stroke="#059669" strokeWidth="6" fill="none" strokeDasharray="175.9" strokeDashoffset={175.9 * (1 - 0.68)} strokeLinecap="round" />
          </svg>
        </div>
      </div>
    </div>;
}