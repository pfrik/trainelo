import { useWeeklyAvailability } from "@/hooks/useWeeklyAvailability";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock } from "lucide-react";

function formatMinutes(minutes: number): string {
  if (minutes === 0) return "0";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}:${mins.toString().padStart(2, "0")}`;
}

export function WeeklyAvailabilitySection() {
  const { availability, loading, updateDay, dayNames } = useWeeklyAvailability();

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Weekly Availability</CardTitle>
          <CardDescription>Loading your schedule...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Clock className="h-5 w-5 text-primary" />
          <div>
            <CardTitle>Weekly Availability</CardTitle>
            <CardDescription>
              Set your available training time for each day. The plan will adapt to your schedule.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {availability.map((day) => (
          <div key={day.day_of_week} className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">
                {dayNames[day.day_of_week]}
              </span>
              <span
                className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                  day.minutes === 0
                    ? "bg-muted text-muted-foreground"
                    : "bg-teal-500/20 text-teal-600 dark:text-teal-400"
                }`}
              >
                {formatMinutes(day.minutes)}
              </span>
            </div>
            <Slider
              value={[day.minutes]}
              onValueChange={(value) => updateDay(day.day_of_week, value[0])}
              min={0}
              max={240}
              step={15}
              className="[&_[role=slider]]:bg-teal-500 [&_[role=slider]]:border-teal-500 [&_.bg-primary]:bg-teal-500"
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
