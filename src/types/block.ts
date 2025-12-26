export type BlockDiscipline = "Bike" | "Run" | "Swim" | "Strength";
export type BlockSource = "TrainerRoad" | "Coach" | "Manual";
export type WorkoutType = "Easy" | "Tempo" | "Intervals" | "Long" | "Recovery";

export interface ExternalBlock {
  id: string;
  title: string;
  date: Date;
  startTime: string; // HH:mm format
  duration: number; // minutes
  discipline: BlockDiscipline;
  source: BlockSource;
  isFixed: boolean;
  completed: boolean;
  workoutType?: WorkoutType;
  description?: string;
}
