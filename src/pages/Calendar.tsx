import { useState } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react";
import { format, addWeeks, subWeeks, addMonths, subMonths } from "date-fns";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExternalBlock } from "@/types/block";
import { Race } from "@/types/race";
import { FocusPeriod } from "@/types/focus";
import { WeekView } from "@/components/calendar/WeekView";
import { MonthView } from "@/components/calendar/MonthView";
import { ExternalBlockFormModal } from "@/components/calendar/ExternalBlockFormModal";

// Get dates for this week's seed blocks
const getThisWeekDates = () => {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

  return {
    tuesday: new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 1),
    thursday: new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 3),
    saturday: new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 5),
  };
};

const thisWeek = getThisWeekDates();

const seedBlocks: ExternalBlock[] = [
  {
    id: "1",
    title: "TR: Pettit",
    date: thisWeek.tuesday,
    startTime: "06:00",
    duration: 60,
    discipline: "Bike",
    source: "TrainerRoad",
    isFixed: true,
  },
  {
    id: "2",
    title: "TR: Geiger",
    date: thisWeek.thursday,
    startTime: "06:00",
    duration: 75,
    discipline: "Bike",
    source: "TrainerRoad",
    isFixed: true,
  },
  {
    id: "3",
    title: "TR: Tallac",
    date: thisWeek.saturday,
    startTime: "07:00",
    duration: 90,
    discipline: "Bike",
    source: "TrainerRoad",
    isFixed: true,
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

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<"week" | "month">("week");
  const [blocks, setBlocks] = useState<ExternalBlock[]>(seedBlocks);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<ExternalBlock | undefined>();
  const [defaultDate, setDefaultDate] = useState<Date | undefined>();

  const handlePrev = () => {
    setCurrentDate((d) => (view === "week" ? subWeeks(d, 1) : subMonths(d, 1)));
  };

  const handleNext = () => {
    setCurrentDate((d) => (view === "week" ? addWeeks(d, 1) : addMonths(d, 1)));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleAddBlock = (date?: Date) => {
    setEditingBlock(undefined);
    setDefaultDate(date);
    setIsModalOpen(true);
  };

  const handleEditBlock = (block: ExternalBlock) => {
    setEditingBlock(block);
    setDefaultDate(undefined);
    setIsModalOpen(true);
  };

  const handleDeleteBlock = (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  };

  const handleSaveBlock = (data: Omit<ExternalBlock, "id">) => {
    if (editingBlock) {
      setBlocks((prev) =>
        prev.map((b) => (b.id === editingBlock.id ? { ...b, ...data } : b))
      );
    } else {
      const newBlock: ExternalBlock = {
        id: crypto.randomUUID(),
        ...data,
      };
      setBlocks((prev) => [...prev, newBlock]);
    }
    setIsModalOpen(false);
    setEditingBlock(undefined);
    setDefaultDate(undefined);
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <CalendarIcon className="h-6 w-6 text-primary" />
          <h1 className="text-xl md:text-2xl font-semibold text-foreground">
            Calendar
          </h1>
        </div>
        <Button onClick={() => handleAddBlock()} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Block
        </Button>
      </div>

      {/* Navigation */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handlePrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleToday}>
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={handleNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-lg font-medium ml-2">
            {view === "week"
              ? format(currentDate, "MMM d, yyyy")
              : format(currentDate, "MMMM yyyy")}
          </span>
        </div>

        <Tabs value={view} onValueChange={(v) => setView(v as "week" | "month")}>
          <TabsList>
            <TabsTrigger value="week">Week</TabsTrigger>
            <TabsTrigger value="month">Month</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Calendar View */}
      {view === "week" ? (
        <WeekView
          currentDate={currentDate}
          blocks={blocks}
          races={seedRaces}
          focusPeriods={seedFocusPeriods}
          onEditBlock={handleEditBlock}
          onDeleteBlock={handleDeleteBlock}
          onAddBlock={handleAddBlock}
        />
      ) : (
        <MonthView
          currentDate={currentDate}
          blocks={blocks}
          races={seedRaces}
          focusPeriods={seedFocusPeriods}
          onEditBlock={handleEditBlock}
          onDayClick={handleAddBlock}
        />
      )}

      {/* Form Modal */}
      <ExternalBlockFormModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        block={editingBlock}
        onSubmit={handleSaveBlock}
        defaultDate={defaultDate}
      />
    </div>
  );
}
