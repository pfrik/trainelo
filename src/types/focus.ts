export type Discipline = "Run" | "Bike" | "Swim" | "Balanced";

export interface Distribution {
  run: number;
  bike: number;
  swim: number;
  strength: number;
}

export interface FocusPeriod {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  primaryDiscipline: Discipline;
  distribution: Distribution;
}
