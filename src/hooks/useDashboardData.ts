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
            name: '8 mi Tempo Run',
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
            name: '5 mi Easy Recovery',
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
        weeklyTraining: [
          {
            date: new Date('2025-01-13'),
            weekLabel: 'MON',
            isCompleted: true,
            isRest: true,
            workoutType: 'rest',
          },
          {
            date: new Date('2025-01-14'),
            weekLabel: 'TUE',
            isCompleted: true,
            isRest: false,
            workoutType: 'easy',
            minutes: 60,
          },
          {
            date: new Date('2025-01-15'),
            weekLabel: 'WED',
            isCompleted: false,
            isRest: false,
            workoutType: 'strength',
            minutes: 45,
          },
          {
            date: new Date('2025-01-16'),
            weekLabel: 'THU',
            isCompleted: false,
            isRest: false,
            workoutType: 'tempo',
            minutes: 50,
          },
          {
            date: new Date('2025-01-17'),
            weekLabel: 'FRI',
            isCompleted: false,
            isRest: false,
            workoutType: 'easy',
            minutes: 40,
          },
          {
            date: new Date('2025-01-18'),
            weekLabel: 'SAT',
            isCompleted: false,
            isRest: false,
            workoutType: 'long',
            minutes: 120,
          },
          {
            date: new Date('2025-01-19'),
            weekLabel: 'SUN',
            isCompleted: false,
            isRest: true,
            workoutType: 'rest',
          },
        ],
        notifications: 0,
      };

      setData(mockData);
      setLoading(false);
    };

    fetchDashboardData();
  }, []);

  return { data, loading };
}