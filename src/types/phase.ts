export type PhaseType = "base" | "build" | "peak" | "taper" | "recovery";

export interface Phase {
  id: string;
  name: string;
  type: PhaseType;
  startDate: Date;
  endDate: Date;
  weeklyHoursTarget?: number;
}

export const phaseColors: Record<PhaseType, string> = {
  base: "bg-blue-500/40",
  build: "bg-yellow-500/40",
  peak: "bg-orange-500/40",
  taper: "bg-green-500/40",
  recovery: "bg-muted",
};

export const phaseLabels: Record<PhaseType, string> = {
  base: "Base",
  build: "Build",
  peak: "Peak",
  taper: "Taper",
  recovery: "Recovery",
};
