import { useDashboardData } from '@/hooks/useDashboardData';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { Header } from '@/components/dashboard/Header';
import { AIRecommendationCard } from '@/components/dashboard/AIRecommendationCard';
import { GoalCard } from '@/components/dashboard/GoalCard';
import { MorningCheckin } from '@/components/dashboard/MorningCheckin';
import { RecoveryStatus } from '@/components/dashboard/RecoveryStatus';
import { WorkoutCard } from '@/components/dashboard/WorkoutCard';
import { WeeklyView } from '@/components/dashboard/WeeklyView';

export default function Dashboard() {
  const { data, loading } = useDashboardData();

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-700"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF9F7] flex">
      {/* Fixed Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 md:ml-64">
        <div className="px-4 py-8 max-w-6xl">
          {/* Header */}
          <Header />

          {/* Main Content */}
          <div className="space-y-0">
            {/* Morning Check-in */}
            <MorningCheckin />

            {/* Goal Card */}
            <GoalCard />

            {/* AI Recommendation Card */}
            <AIRecommendationCard />

            {/* Recovery Status */}
            <RecoveryStatus />

            {/* Workout Card */}
            <WorkoutCard />

            {/* Weekly View */}
            <WeeklyView />
          </div>
        </div>
      </div>
    </div>
  );
}