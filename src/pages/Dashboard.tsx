import { useDashboardData } from '@/hooks/useDashboardData';
import { SidebarV2 } from '@/components/dashboard/SidebarV2';
import { HeaderV2 } from '@/components/dashboard/HeaderV2';
import { MorningCheckInV2 } from '@/components/dashboard/MorningCheckInV2';
import { WorkoutCardV2 } from '@/components/dashboard/WorkoutCardV2';
import { RecoveryScoreV2 } from '@/components/dashboard/RecoveryScoreV2';
import { WeeklyCalendarV2 } from '@/components/dashboard/WeeklyCalendarV2';
import { ActionListV2 } from '@/components/dashboard/ActionListV2';

export default function Dashboard() {
  const { data, loading } = useDashboardData();

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-dark-base">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-dark-base">
      {/* Fixed Sidebar */}
      <SidebarV2 />

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto bg-dark-base relative">
        <div className="max-w-7xl mx-auto px-8 py-8">
          {/* Header */}
          <HeaderV2 />

          {/* Morning Check-in Banner */}
          <MorningCheckInV2 />

          {/* Main Content Grid */}
          <div className="grid grid-cols-12 gap-6">
            {/* Left Column - 8 cols */}
            <div className="col-span-12 lg:col-span-8 space-y-6">
              {/* Today's Workout Card */}
              <WorkoutCardV2 />

              {/* Weekly Calendar */}
              <WeeklyCalendarV2 />
            </div>

            {/* Right Column - 4 cols */}
            <div className="col-span-12 lg:col-span-4 space-y-6">
              {/* Recovery Score Widget */}
              <RecoveryScoreV2 />

              {/* Action List */}
              <ActionListV2 />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
