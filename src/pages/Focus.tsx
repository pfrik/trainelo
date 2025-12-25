import { useState } from "react";
import { Plus, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FocusPeriod, Distribution } from "@/types/focus";
import { FocusTimeline } from "@/components/focus/FocusTimeline";
import { FocusPeriodFormModal } from "@/components/focus/FocusPeriodFormModal";
import { useFocusPeriods } from "@/hooks/useFocusPeriods";
import { useRaces } from "@/hooks/useRaces";
import { Skeleton } from "@/components/ui/skeleton";

export default function Focus() {
  const { focusPeriods, loading: loadingPeriods, addFocusPeriod, updateFocusPeriod, deleteFocusPeriod } = useFocusPeriods();
  const { races, loading: loadingRaces } = useRaces();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<FocusPeriod | undefined>();

  const handleAddPeriod = () => {
    setEditingPeriod(undefined);
    setIsModalOpen(true);
  };

  const handleEditPeriod = (period: FocusPeriod) => {
    setEditingPeriod(period);
    setIsModalOpen(true);
  };

  const handleDeletePeriod = async (id: string) => {
    await deleteFocusPeriod(id);
  };

  const handleSavePeriod = async (data: {
    name: string;
    startDate: Date;
    endDate: Date;
    primaryDiscipline: string;
    distribution: Distribution;
  }) => {
    const periodData: Omit<FocusPeriod, "id"> = {
      name: data.name,
      startDate: data.startDate,
      endDate: data.endDate,
      primaryDiscipline: data.primaryDiscipline as FocusPeriod["primaryDiscipline"],
      distribution: data.distribution,
    };

    if (editingPeriod) {
      await updateFocusPeriod(editingPeriod.id, periodData);
    } else {
      await addFocusPeriod(periodData);
    }
    setIsModalOpen(false);
    setEditingPeriod(undefined);
  };

  if (loadingPeriods || loadingRaces) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Target className="h-6 w-6 text-primary" />
            <h1 className="text-xl md:text-2xl font-semibold text-foreground">Focus Periods</h1>
          </div>
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Target className="h-6 w-6 text-primary" />
          <h1 className="text-xl md:text-2xl font-semibold text-foreground">Focus Periods</h1>
        </div>
        <Button onClick={handleAddPeriod} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Period
        </Button>
      </div>

      <FocusTimeline
        periods={focusPeriods}
        races={races}
        onEdit={handleEditPeriod}
        onDelete={handleDeletePeriod}
      />

      <FocusPeriodFormModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        period={editingPeriod}
        onSubmit={handleSavePeriod}
      />
    </div>
  );
}
