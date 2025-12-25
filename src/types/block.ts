export type BlockDiscipline = "Bike" | "Run" | "Swim" | "Strength";
export type BlockSource = "TrainerRoad" | "Coach" | "Manual";

export interface ExternalBlock {
  id: string;
  title: string;
  date: Date;
  startTime: string; // HH:mm format
  duration: number; // minutes
  discipline: BlockDiscipline;
  source: BlockSource;
  isFixed: boolean;
}
