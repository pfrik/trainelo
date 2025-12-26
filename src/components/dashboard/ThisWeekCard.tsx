import { startOfWeek, endOfWeek, isSameDay } from "date-fns";
import { Lock, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalBlock } from "@/types/block";
import { cn } from "@/lib/utils";
import { getSportConfig, formatDuration } from "@/lib/sportConfig";
import { formatInTimezone } from "@/lib/dateUtils";

interface ThisWeekCardProps {
  blocks: ExternalBlock[];
  onMarkDayStatus?: () => void;
}

export function ThisWeekCard({ blocks, onMarkDayStatus }: ThisWeekCardProps) {
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

  const thisWeekBlocks = blocks
    .filter((b) => b.date >= weekStart && b.date <= weekEnd)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const suggestions = [
    { text: "Easy 45min run (Zone 2)", discipline: "Run" },
    { text: "30min core strength", discipline: "Strength" },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">This Week</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Scheduled Blocks */}
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">Scheduled</div>
          {thisWeekBlocks.length === 0 ? (
            <div className="text-sm text-muted-foreground">No blocks scheduled</div>
          ) : (
            <div className="space-y-1.5">
              {thisWeekBlocks.map((block) => {
                const config = getSportConfig(block.discipline);
                const Icon = config.icon;
                return (
                  <div
                    key={block.id}
                    className={cn(
                      "flex items-center gap-2 p-2 rounded-md border-l-4 bg-muted/30",
                      config.borderClass,
                      config.textClass
                    )}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold">{formatDuration(block.duration)}</span>
                        {block.isFixed && <Lock className="h-3 w-3 flex-shrink-0 opacity-60" />}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {block.title}
                      </div>
                      <div className="text-[10px] text-muted-foreground/70">
                        {formatInTimezone(block.date, "EEE")} • {block.startTime}
                      </div>
                    </div>
                    {isSameDay(block.date, today) && (
                      <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
                        Today
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Suggested Training */}
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">Suggested</div>
          <div className="space-y-1.5">
            {suggestions.map((s, i) => {
              const config = getSportConfig(s.discipline);
              const Icon = config.icon;
              return (
                <div
                  key={i}
                  className="flex items-center gap-2 p-2 rounded-md border border-dashed border-border text-sm text-muted-foreground"
                >
                  <Icon className="h-4 w-4 flex-shrink-0 opacity-50" />
                  <span className="flex-1">{s.text}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Action */}
        <Button
          variant="outline"
          size="sm"
          className="w-full text-muted-foreground"
          onClick={onMarkDayStatus}
        >
          <AlertTriangle className="h-3.5 w-3.5 mr-2" />
          Mark today as sick / injured / traveling
        </Button>
      </CardContent>
    </Card>
  );
}
