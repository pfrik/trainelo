import React from 'react';
import { LayoutDashboard, Calendar, Dumbbell, BarChart3, Heart, Brain, Trophy, MoreVertical } from 'lucide-react';
export function Sidebar() {
  return <aside className="hidden md:flex flex-col w-64 bg-white border-r border-gray-100 h-screen fixed left-0 top-0 z-10">
      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 bg-[#059669] rounded-lg flex items-center justify-center text-white font-bold">
          T
        </div>
        <span className="text-xl font-bold text-[#1f2937] tracking-tight">
          Trainelo
        </span>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-8 overflow-y-auto">
        <div className="space-y-1">
          <a href="#" className="flex items-center gap-3 px-3 py-2.5 bg-[#FAF9F7] text-[#059669] rounded-lg font-medium">
            <LayoutDashboard size={20} />
            Dashboard
          </a>
          <a href="#" className="flex items-center gap-3 px-3 py-2.5 text-[#6b7280] hover:bg-gray-50 hover:text-[#1f2937] rounded-lg transition-colors">
            <Calendar size={20} />
            Training Plan
          </a>
          <a href="#" className="flex items-center gap-3 px-3 py-2.5 text-[#6b7280] hover:bg-gray-50 hover:text-[#1f2937] rounded-lg transition-colors">
            <Dumbbell size={20} />
            Workouts
          </a>
          <a href="#" className="flex items-center gap-3 px-3 py-2.5 text-[#6b7280] hover:bg-gray-50 hover:text-[#1f2937] rounded-lg transition-colors">
            <BarChart3 size={20} />
            Progress
          </a>
          <a href="#" className="flex items-center gap-3 px-3 py-2.5 text-[#6b7280] hover:bg-gray-50 hover:text-[#1f2937] rounded-lg transition-colors">
            <Heart size={20} />
            Recovery
          </a>
        </div>

        <div>
          <h3 className="px-3 text-xs font-semibold text-[#9ca3af] uppercase tracking-wider mb-2">
            Insights
          </h3>
          <div className="space-y-1">
            <a href="#" className="flex items-center gap-3 px-3 py-2.5 text-[#6b7280] hover:bg-gray-50 hover:text-[#1f2937] rounded-lg transition-colors">
              <Brain size={20} />
              AI Coach
            </a>
            <a href="#" className="flex items-center gap-3 px-3 py-2.5 text-[#6b7280] hover:bg-gray-50 hover:text-[#1f2937] rounded-lg transition-colors">
              <Trophy size={20} />
              Goals
            </a>
          </div>
        </div>
      </nav>

      <div className="p-4 border-t border-gray-100">
        <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
          <img src="https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&h=100&fit=crop" alt="User" className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[#1f2937] truncate">
              Alex Rivera
            </p>
            <p className="text-xs text-[#6b7280] truncate">View Profile</p>
          </div>
          <MoreVertical size={16} className="text-[#9ca3af]" />
        </div>
      </div>
    </aside>;
}