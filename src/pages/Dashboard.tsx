import { useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { HeroSection } from "@/components/dashboard/HeroSection";
import { SeasonTimeline } from "@/components/dashboard/SeasonTimeline";
import { ThisWeekCard } from "@/components/dashboard/ThisWeekCard";
import { QuickStats } from "@/components/dashboard/QuickStats";
import { GeneratePlanButton } from "@/components/dashboard/GeneratePlanButton";
import { DayStatusModal } from "@/components/calendar/DayStatusModal";
import { Skeleton } from "@/components/ui/skeleton";
import { Race } from "@/types/race";
import { DayStatus } from "@/types/dayStatus";
import { useRaces } from "@/hooks/useRaces";
import { useFocusPeriods } from "@/hooks/useFocusPeriods";
import { useBlocks } from "@/hooks/useBlocks";
import { useDayStatuses } from "@/hooks/useDayStatuses";
import { usePhases } from "@/hooks/usePhases";

export default function Dashboard() {
  const { races, loading: loadingRaces } = useRaces();
  const { focusPeriods, loading: loadingPeriods } = useFocusPeriods();
  const { blocks, loading: loadingBlocks } = useBlocks();
  const { dayStatuses, loading: loadingStatuses, saveStatus, clearStatus } = useDayStatuses();
  const { phases, loading: loadingPhases, generatePlan } = usePhases();

  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);

  const loading = loadingRaces || loadingPeriods || loadingBlocks || loadingStatuses || loadingPhases;

  // Find next A-race for generate button
  const today = new Date();
  const nextARace = races
    .filter((r) => r.priority === "A" && r.date > today)
    .sort((a, b) => a.date.getTime() - b.date.getTime())[0];

  const handleRaceClick = (race: Race) => {
    toast.info(`${race.name} - ${race.distance}${race.distanceUnit}`, {
      description: race.goalValue,
    });
  };

  const handleMarkDayStatus = () => {
    setIsStatusModalOpen(true);
  };

  const handleSaveStatus = async (status: DayStatus) => {
    await saveStatus(status);
    
    if (status.status !== "normal") {
      toast.success(`Marked ${format(new Date(status.date), "MMM d")} as ${status.status}`, {
        description: "Plan adjustment needed. Check the calendar for details.",
      });
    }
  };

  const handleClearStatus = async (date: string) => {
    await clearStatus(date);
  };

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
        <Skeleton className="h-32 rounded-lg" />
        <Skeleton className="h-48 rounded-lg" />
        <div className="grid md:grid-cols-2 gap-4">
          <Skeleton className="h-40 rounded-lg" />
          <Skeleton className="h-40 rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Hero Section */}
      <HeroSection races={races} focusPeriods={focusPeriods} phases={phases} />

      {/* Generate Plan Button */}
      <div className="flex justify-end">
        <GeneratePlanButton
          nextARace={nextARace}
          hasExistingPhases={phases.length > 0}
          onGenerate={generatePlan}
        />
      </div>

      {/* Season Timeline */}
      <SeasonTimeline
        races={races}
        focusPeriods={focusPeriods}
        phases={phases}
        onRaceClick={handleRaceClick}
      />

      {/* Stats + This Week */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-4">
          <QuickStats plannedHours={8} completedHours={3} status="On track" />
        </div>
        <ThisWeekCard blocks={blocks} onMarkDayStatus={handleMarkDayStatus} />
      </div>

      {/* Day Status Modal */}
      <DayStatusModal
        open={isStatusModalOpen}
        onOpenChange={setIsStatusModalOpen}
        defaultDate={new Date()}
        onSubmit={handleSaveStatus}
        onClear={handleClearStatus}
      />
    </div>
  );
}
