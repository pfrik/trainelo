// Dashboard Type Definitions

// Recovery & Health Metrics
export interface DailyStats {
  sleep: {
    duration: number; // in hours (e.g., 7.7)
    deepSleep: number; // in hours (e.g., 3.5)
    remSleep: number; // in hours
    quality: 'good' | 'caution' | 'elevated';
  };
  hrv: {
    value: number; // in ms (e.g., 42)
    dailyAverage: number;
    status: 'good' | 'caution' | 'elevated';
    percentFromBaseline: number;
  };
  restingHeartRate: {
    value: number; // in bpm (e.g., 58)
    average: number;
    status: 'good' | 'caution' | 'elevated';
    percentFromBaseline: number;
  };
}

// Subjective Check-In
export interface SubjectiveCheckIn {
  mood: 'drained' | 'tired' | 'ok' | 'good' | 'fresh';
  soreness?: number; // 1-10
  motivation?: number; // 1-10
  timestamp: Date;
}

// Workout Structure
export interface WorkoutSegment {
  type: 'warmup' | 'main' | 'cooldown';
  duration: number; // in minutes
  description: string;
  sets?: WorkoutSet[];
}

export interface WorkoutSet {
  repetitions?: number;
  duration?: string; // e.g., "1:30-1:40 bpm"
  intensity?: string; // e.g., "Zone 2"
  description: string;
}

export interface WorkoutPlan {
  id: string;
  name: string;
  type: 'aerobic' | 'threshold' | 'intervals' | 'recovery' | 'long run';
  totalDuration: number; // in minutes
  segments: WorkoutSegment[];
  targetKilometers?: number;
  description?: string;
  recommendedPerceivedEffort?: number; // 1-10
}

// AI Recommendations
export interface WorkoutRecommendation {
  originalPlan: WorkoutPlan;
  recommendedPlan: WorkoutPlan;
  reason: string;
  alternativeOption?: WorkoutPlan;
}

// Goal/Event
export interface TrainingGoal {
  id: string;
  name: string;
  type: 'marathon' | 'half-marathon' | '10k' | '5k' | 'custom';
  date: Date;
  targetTime?: string; // e.g., "Sub 3:30"
  daysRemaining: number;
  trainingProgress: number; // percentage 0-100
}

// Weekly Training Summary
export interface WeeklyTrainingData {
  date: Date;
  weekLabel: string; // e.g., "MON", "TUE"
  isCompleted: boolean;
  isRest: boolean;
  workoutType?: 'strength' | 'easy' | 'tempo' | 'long' | 'rest';
  minutes?: number;
}

// Dashboard Data Container
export interface DashboardData {
  user: {
    name: string;
    profilePicture?: string;
  };
  todayStats: DailyStats;
  checkIn?: SubjectiveCheckIn;
  currentGoal: TrainingGoal;
  aiRecommendation: WorkoutRecommendation;
  weeklyTraining: WeeklyTrainingData[];
  notifications?: number;
}

// Component Props Interfaces
export interface MorningCheckInProps {
  onCheckIn: (mood: SubjectiveCheckIn['mood']) => void;
}

export interface RecoveryStatusRowProps {
  stats: DailyStats;
}

export interface AiInsightCardProps {
  recommendation: WorkoutRecommendation;
  onAccept: () => void;
  onReject: () => void;
  onKeepOriginal: () => void;
}

export interface GoalProgressCardProps {
  goal: TrainingGoal;
}

export interface TodaysWorkoutCardProps {
  workout: WorkoutPlan;
  onStart: () => void;
}

export interface WeeklyTrainingChartProps {
  weeklyData: WeeklyTrainingData[];
}

// Helper Type for Status Colors
export type StatusColor = 'good' | 'caution' | 'elevated';

// Timing Chart Data
export interface WorkoutTimingData {
  intervals: {
    label: string;
    start: number; // minutes from start
    duration: number; // in minutes
    type: 'warmup' | 'main' | 'cooldown';
  }[];
}