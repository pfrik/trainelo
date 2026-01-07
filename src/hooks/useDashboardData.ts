import { useState, useEffect } from 'react';
import type { DashboardData } from '@/types/dashboard.types';

export function useDashboardData() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate API call with mock data
    const fetchDashboardData = async () => {
      // Mock delay
      await new Promise(resolve => setTimeout(resolve, 500));

      const mockData: DashboardData = {
        user: {
          name: 'Alex',
          profilePicture: undefined,
        },
        todayStats: {
          sleep: {
            duration: 7.7,
            deepSleep: 3.5,
            remSleep: 2.0,
            quality: 'good',
          },
          hrv: {
            value: 42,
            dailyAverage: 49,
            status: 'caution',
            percentFromBaseline: -15,
          },
          restingHeartRate: {
            value: 58,
            average: 54,
            status: 'elevated',
            percentFromBaseline: 8,
          },
        },
        currentGoal: {
          id: '1',
          name: 'Marathon',
          type: 'marathon',
          date: new Date('2025-04-20'),
          targetTime: 'Sub 3:30',
          daysRemaining: 95,
          trainingProgress: 68,
        },
        aiRecommendation: {
          originalPlan: {
            id: 'original-1',
            name: '13 km Tempo Run',
            type: 'threshold',
            totalDuration: 80,
            segments: [
              {
                type: 'warmup',
                duration: 10,
                description: 'Easy pace dynamic stretches',
              },
              {
                type: 'main',
                duration: 60,
                description: 'Tempo pace',
                sets: [
                  {
                    duration: '30 min',
                    intensity: 'Zone 2',
                    description: 'Steady Zone 2 (130-140 bpm)',
                  },
                ],
              },
              {
                type: 'cooldown',
                duration: 10,
                description: 'Easy jog, static stretches',
              },
            ],
            targetKilometers: 12.9,
            description: 'Threshold training to improve lactate clearance',
            recommendedPerceivedEffort: 7,
          },
          recommendedPlan: {
            id: 'recommended-1',
            name: '8 km Easy Recovery',
            type: 'recovery',
            totalDuration: 50,
            segments: [
              {
                type: 'warmup',
                duration: 10,
                description: '10 min easy pace, dynamic stretches',
              },
              {
                type: 'main',
                duration: 30,
                description: '30 min steady Zone 2 (130-140 bpm)',
                sets: [
                  {
                    duration: '30 min',
                    intensity: 'Zone 2',
                    description: 'Steady Zone 2 (130-140 bpm)',
                  },
                ],
              },
              {
                type: 'cooldown',
                duration: 10,
                description: '10 min easy jog, static stretches',
              },
            ],
            targetKilometers: 8.0,
            description: 'Easy recovery pace to promote blood flow and adaptation',
            recommendedPerceivedEffort: 5,
          },
          reason: 'Your HRV dropped 15% overnight and your resting heart rate is elevated by 8 bpm. We recommend switching today\'s tempo run to an easy aerobic flush to support recovery.',
        },
        weeklyTraining: (() => {
          // Generate dates for the current week (Monday to Sunday)
          const today = new Date();
          const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
          const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
          const monday = new Date(today);
          monday.setDate(today.getDate() + mondayOffset);

          const weekDays = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
          const workoutSchedule = [
            { isRest: true, workoutType: 'rest' as const },
            { isRest: false, workoutType: 'easy' as const, minutes: 60 },
            { isRest: false, workoutType: 'strength' as const, minutes: 45 },
            { isRest: false, workoutType: 'tempo' as const, minutes: 50 },
            { isRest: false, workoutType: 'easy' as const, minutes: 40 },
            { isRest: false, workoutType: 'long' as const, minutes: 120 },
            { isRest: true, workoutType: 'rest' as const },
          ];

          return weekDays.map((label, index) => {
            const date = new Date(monday);
            date.setDate(monday.getDate() + index);
            const isPast = date < new Date(today.toDateString());

            return {
              date,
              weekLabel: label,
              isCompleted: isPast && !workoutSchedule[index].isRest,
              isRest: workoutSchedule[index].isRest,
              workoutType: workoutSchedule[index].workoutType,
              minutes: workoutSchedule[index].minutes,
            };
          });
        })(),
        notifications: 0,
      };

      setData(mockData);
      setLoading(false);
    };

    fetchDashboardData();
  }, []);

  return { data, loading };
}