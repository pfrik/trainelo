import { Bell, Plus } from 'lucide-react';
import { useDashboardData } from '@/hooks/useDashboardData';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { format } from 'date-fns';
import { MorningCheckIn } from '@/components/dashboard/MorningCheckIn';
import { RecoveryStatusRow } from '@/components/dashboard/RecoveryStatusRow';
import { AiInsightCard } from '@/components/dashboard/AiInsightCard';
import { GoalProgressCard } from '@/components/dashboard/GoalProgressCard';
import { TodaysWorkoutCard } from '@/components/dashboard/TodaysWorkoutCard';
import { WorkoutTimingChart } from '@/components/dashboard/WorkoutTimingChart';
import { WeeklyTrainingChart } from '@/components/dashboard/WeeklyTrainingChart';
import { useState } from 'react';
import type { SubjectiveCheckIn } from '@/types/dashboard.types';

export default function Dashboard() {
  const { data, loading } = useDashboardData();
  const [hasCheckedIn, setHasCheckedIn] = useState(false);

  const handleCheckIn = (mood: SubjectiveCheckIn['mood']) => {
    console.log('Mood selected:', mood);
    setHasCheckedIn(true);
  };

  const handleAcceptWorkout = () => {
    console.log('Accepted workout recommendation');
  };

  const handleRejectWorkout = () => {
    console.log('Rejected workout recommendation');
  };

  const handleKeepOriginalWorkout = () => {
    console.log('Keeping original workout');
  };

  const handleStartWorkout = () => {
    console.log('Starting workout');
  };

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-700"></div>
      </div>
    );
  }

  const currentDate = new Date();
  const greeting = getGreeting();

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Dashboard Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="text-center flex-1">
              <h1 className="text-2xl font-semibold text-gray-900">
                {greeting}, {data.user.name}
              </h1>
              <p className="text-sm text-gray-500">
                {format(currentDate, 'EEEE, MMMM d, yyyy')}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                {data.notifications && data.notifications > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
                    {data.notifications}
                  </span>
                )}
              </Button>
              <Button className="bg-emerald-700 hover:bg-emerald-800 text-white">
                <Plus className="h-4 w-4 mr-2" />
                Log Activity
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6 max-w-7xl mx-auto">
        <div className="space-y-6">
          {/* Morning Check-in Section */}
          {!hasCheckedIn && (
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <h2 className="text-lg font-semibold">Morning Check-in</h2>
              </div>
              <p className="text-gray-600">
                How are you feeling today?
              </p>
              <MorningCheckIn onCheckIn={handleCheckIn} />
            </Card>
          )}

          {/* Goal Event and AI Recommendation Row */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Marathon Goal Card */}
            <Card className="p-6">
              <GoalProgressCard goal={data.currentGoal} />
            </Card>

            {/* AI Recommendation Card */}
            <Card className="p-6 border-l-4 border-l-emerald-500">
              <div className="mb-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <span className="text-emerald-700">✦</span>
                  AI Recommendation: Adjust Today's Workout
                </h3>
                <p className="text-sm text-gray-600 mt-2">
                  {data.aiRecommendation.reason}
                </p>
              </div>
              <AiInsightCard
                recommendation={data.aiRecommendation}
                onAccept={handleAcceptWorkout}
                onReject={handleRejectWorkout}
                onKeepOriginal={handleKeepOriginalWorkout}
              />
            </Card>
          </div>

          {/* Recovery Status Row */}
          <div className="bg-white rounded-lg p-6">
            <h3 className="font-semibold mb-4">Recovery Status</h3>
            <RecoveryStatusRow stats={data.todayStats} />
          </div>

          {/* Today's Workout Section */}
          <Card className="p-6">
            <TodaysWorkoutCard
              workout={data.aiRecommendation.recommendedPlan}
              onStart={handleStartWorkout}
            />
            <WorkoutTimingChart workout={data.aiRecommendation.recommendedPlan} />
          </Card>

          {/* Weekly Training Chart */}
          <Card className="p-6">
            <h3 className="font-semibold mb-4">This Week's Training</h3>
            <WeeklyTrainingChart weeklyData={data.weeklyTraining} />
          </Card>
        </div>
      </div>
    </div>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}