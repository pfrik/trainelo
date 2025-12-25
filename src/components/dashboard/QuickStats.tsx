import { Clock, CheckCircle2, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface QuickStatsProps {
  plannedHours: number;
  completedHours: number;
  status: "On track" | "Behind" | "Ahead";
}

export function QuickStats({ plannedHours, completedHours, status }: QuickStatsProps) {
  const stats = [
    {
      label: "Weekly Planned",
      value: `${plannedHours}h`,
      icon: Clock,
      color: "text-muted-foreground",
    },
    {
      label: "Completed",
      value: `${completedHours}h`,
      icon: CheckCircle2,
      color: "text-primary",
    },
    {
      label: "Load Status",
      value: status,
      icon: TrendingUp,
      color:
        status === "On track"
          ? "text-green-600 dark:text-green-400"
          : status === "Behind"
          ? "text-amber-600 dark:text-amber-400"
          : "text-blue-600 dark:text-blue-400",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {stats.map((stat, i) => (
        <Card key={i} className="bg-muted/30">
          <CardContent className="p-3 text-center">
            <stat.icon className={cn("h-4 w-4 mx-auto mb-1", stat.color)} />
            <div className={cn("text-lg font-semibold", stat.color)}>{stat.value}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
              {stat.label}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
