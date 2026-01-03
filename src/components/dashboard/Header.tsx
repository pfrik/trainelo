import React from 'react';
import { Bell, Plus } from 'lucide-react';
export function Header() {
  return <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
      <div>
        <h1 className="text-3xl font-bold text-[#1f2937] tracking-tight">
          Good Morning, Alex
        </h1>
        <p className="text-[#6b7280] mt-1">Tuesday, January 14, 2025</p>
      </div>

      <div className="flex items-center gap-4">
        <button className="p-2 text-[#6b7280] hover:bg-white hover:text-[#1f2937] rounded-full transition-colors relative">
          <Bell size={20} />
          <span className="absolute top-2 right-2.5 w-2 h-2 bg-[#ef4444] rounded-full border border-[#FAF9F7]"></span>
        </button>

        <button className="flex items-center gap-2 bg-[#059669] hover:bg-[#047857] text-white px-5 py-2.5 rounded-lg font-medium shadow-sm shadow-emerald-900/10 transition-all active:scale-95">
          <Plus size={18} />
          Log Activity
        </button>
      </div>
    </header>;
}