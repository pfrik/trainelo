export type WorkoutPhase = "base" | "build" | "peak" | "recovery" | "transition";

export interface PlannedWorkout {
  id: string;
  title: string;
  date: Date;
  duration: number; // minutes
  workoutType: string; // e.g., 'run', 'bike', 'swim', 'strength'
  intensityLevel: number; // 1-10
  distance?: number; // km
  description?: string;
  notes?: string;
  trainingPhase?: WorkoutPhase;
}