export type SportType = "Run" | "Bike" | "Swim" | "Triathlon" | "Other";
export type Priority = "A" | "B" | "C";
export type GoalType = "Finish" | "Time goal" | "Placement" | "Other";
export type DistanceUnit = "km" | "miles";

export interface Race {
  id: string;
  name: string;
  date: Date;
  sport: SportType;
  distance: number;
  distanceUnit: DistanceUnit;
  priority: Priority;
  goalType: GoalType;
  goalValue: string;
}
