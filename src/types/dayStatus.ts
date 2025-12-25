export type DayStatusType = "normal" | "sick" | "injured" | "traveling";

export interface DayStatus {
  date: string; // YYYY-MM-DD format
  status: DayStatusType;
  notes?: string;
}
