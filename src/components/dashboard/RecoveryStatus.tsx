import React from 'react';
import { BedDouble, Activity, HeartPulse } from 'lucide-react';
export function RecoveryStatus() {
  return <div className="mb-8">
      <h3 className="text-lg font-bold text-[#1f2937] mb-4">Recovery Status</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Sleep Card - GOOD */}
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-500">
              <BedDouble size={20} />
            </div>
            <span className="bg-[#06b6d4] text-white text-xs font-bold px-2.5 py-1 rounded-md">
              GOOD
            </span>
          </div>
          <div className="mb-1">
            <span className="text-2xl font-bold text-[#1f2937]">7h 42m</span>
          </div>
          <p className="text-sm text-[#6b7280] mb-2">Sleep Duration</p>
          <p className="text-xs text-[#6b7280]">Deep: 1h 45m • REM: 2h 10m</p>
        </div>

        {/* HRV Card - CAUTION */}
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center text-amber-500">
              <Activity size={20} />
            </div>
            <span className="bg-[#f59e0b] text-white text-xs font-bold px-2.5 py-1 rounded-md">
              CAUTION
            </span>
          </div>
          <div className="mb-1">
            <span className="text-2xl font-bold text-[#1f2937]">42 ms</span>
          </div>
          <p className="text-sm text-[#6b7280] mb-2">HRV (7-day avg: 49)</p>
          <p className="text-xs text-amber-600 font-medium">
            ↓ 15% from baseline
          </p>
        </div>

        {/* Resting HR Card - ELEVATED */}
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center text-red-500">
              <HeartPulse size={20} />
            </div>
            <span className="bg-[#ef4444] text-white text-xs font-bold px-2.5 py-1 rounded-md">
              ELEVATED
            </span>
          </div>
          <div className="mb-1">
            <span className="text-2xl font-bold text-[#1f2937]">58 bpm</span>
          </div>
          <p className="text-sm text-[#6b7280] mb-2">Resting HR (avg: 54)</p>
          <p className="text-xs text-red-600 font-medium">
            ↑ 8 bpm from baseline
          </p>
        </div>
      </div>
    </div>;
}