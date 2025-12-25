import { useState } from "react";
import { Plus, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FocusPeriod, Distribution } from "@/types/focus";
import { FocusTimeline } from "@/components/focus/FocusTimeline";
import { FocusPeriodFormModal } from "@/components/focus/FocusPeriodFormModal";
import { Race } from "@/types/race";

const seedFocusPeriods: FocusPeriod[] = [
  {
    id: "1",
    name: "Ultra Run Focus",
    startDate: new Date("2024-12-01"),
    endDate: new Date("2026-03-29"),
    primaryDiscipline: "Run",
    distribution: { run: 60, bike: 25, swim: 5, strength: 10 },
  },
  {
    id: "2",
    name: "Amstel Gold Prep",
    startDate: new Date("2026-03-30"),
    endDate: new Date("2026-04-30"),
    primaryDiscipline: "Bike",
    distribution: { run: 20, bike: 60, swim: 5, strength: 15 },
  },
];

const seedRaces: Race[] = [
  {
    id: "1",
    name: "Vondelparkloop - 10km",
    date: new Date("2026-01-18"),
    sport: "Run",
    distance: 10,
    distanceUnit: "km",
    priority: "B",
    goalType: "Other",
    goalValue: "Test fitness",
  },
  {
    id: "2",
    name: "Amstel Gold Race",
    date: new Date("2026-04-18"),
    sport: "Bike",
    distance: 250,
    distanceUnit: "km",
    priority: "B",
    goalType: "Finish",
    goalValue: "Finish strong",
  },
  {
    id: "3",
    name: "Sprint Triathlon",
    date: new Date("2026-05-17"),
    sport: "Triathlon",
    distance: 25,
    distanceUnit: "km",
    priority: "A",
    goalType: "Finish",
    goalValue: "Finish strong",
  },
  {
    id: "4",
    name: "Zestig van Texel",
    date: new Date("2026-03-29"),
    sport: "Run",
    distance: 60,
    distanceUnit: "km",
    priority: "A",
    goalType: "Finish",
    goalValue: "Finish strong",
  },
];

export default function Focus() {
  const [focusPeriods, setFocusPeriods] = useState<FocusPeriod[]>(seedFocusPeriods);
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

  const handleDeletePeriod = (id: string) => {
    setFocusPeriods((prev) => prev.filter((p) => p.id !== id));
  };

  const handleSavePeriod = (data: {
    name: string;
    startDate: Date;
    endDate: Date;
    primaryDiscipline: string;
    distribution: Distribution;
  }) => {
    if (editingPeriod) {
      setFocusPeriods((prev) =>
        prev.map((p) =>
          p.id === editingPeriod.id
            ? { ...p, ...data, primaryDiscipline: data.primaryDiscipline as FocusPeriod["primaryDiscipline"] }
            : p
        )
      );
    } else {
      const newPeriod: FocusPeriod = {
        id: crypto.randomUUID(),
        name: data.name,
        startDate: data.startDate,
        endDate: data.endDate,
        primaryDiscipline: data.primaryDiscipline as FocusPeriod["primaryDiscipline"],
        distribution: data.distribution,
      };
      setFocusPeriods((prev) => [...prev, newPeriod]);
    }
    setIsModalOpen(false);
    setEditingPeriod(undefined);
  };

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
        races={seedRaces}
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
