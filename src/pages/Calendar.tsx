import { useState } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  AlertTriangle,
  X,
  BarChart3,
} from "lucide-react";
import { addWeeks, subWeeks, addMonths, subMonths } from "date-fns";
import { DndContext, DragEndEvent, DragOverlay, pointerWithin, useSensor, useSensors, PointerSensor } from "@dnd-kit/core";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { PlannedWorkout } from "@/types/plannedWorkout";
import { DayStatus } from "@/types/dayStatus";
import { WeekView } from "@/components/calendar/WeekView";
import { MonthView } from "@/components/calendar/MonthView";
import { ExternalBlockFormModal } from "@/components/calendar/ExternalBlockFormModal";
import { DayStatusModal } from "@/components/calendar/DayStatusModal";
import { WeeklySummaryPanel } from "@/components/calendar/WeeklySummaryPanel";
import { WorkoutDetailDrawer } from "@/components/calendar/WorkoutDetailDrawer";
import { WorkoutCard } from "@/components/calendar/WorkoutCard";
import { usePlannedWorkouts } from "@/hooks/usePlannedWorkouts";
import { useRaces } from "@/hooks/useRaces";
import { useFocusPeriods } from "@/hooks/useFocusPeriods";
import { useDayStatuses } from "@/hooks/useDayStatuses";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { toast } from "sonner";
import { toDateString, formatCalendarHeader, formatInTimezone, fromDateString } from "@/lib/dateUtils";

export default function Calendar() {
  const { workouts, loading: loadingWorkouts, addWorkout, updateWorkout, deleteWorkout } = usePlannedWorkouts();
  const { races, loading: loadingRaces } = useRaces();
  const { focusPeriods, loading: loadingPeriods } = useFocusPeriods();
  const { dayStatuses, loading: loadingStatuses, saveStatus, clearStatus } = useDayStatuses();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<"week" | "month">("week");
  const [isWorkoutModalOpen, setIsWorkoutModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState<PlannedWorkout | undefined>();
  const [defaultDate, setDefaultDate] = useState<Date | undefined>();
  const [statusModalDate, setStatusModalDate] = useState<Date | undefined>();
  const [dismissedBanners, setDismissedBanners] = useState<string[]>([]);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [selectedWorkout, setSelectedWorkout] = useState<PlannedWorkout | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeWorkout, setActiveWorkout] = useState<PlannedWorkout | null>(null);
  const [summaryCollapsed] = useLocalStorage("summary-collapsed", false);

  // Configure drag sensor with distance threshold to allow clicks
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required before drag starts
      },
    })
  );

  const loading = loadingWorkouts || loadingRaces || loadingPeriods || loadingStatuses;

  // Get non-normal statuses for banner
  const affectedStatuses = dayStatuses.filter(
    (s) => s.status !== "normal" && !dismissedBanners.includes(s.date)
  );

  const handlePrev = () => {
    setCurrentDate((d) => (view === "week" ? subWeeks(d, 1) : subMonths(d, 1)));
  };

  const handleNext = () => {
    setCurrentDate((d) => (view === "week" ? addWeeks(d, 1) : addMonths(d, 1)));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleAddWorkout = (date?: Date) => {
    setEditingWorkout(undefined);
    setDefaultDate(date);
    setIsWorkoutModalOpen(true);
  };

  const handleEditWorkout = (workout: PlannedWorkout) => {
    setEditingWorkout(workout);
    setDefaultDate(undefined);
    setIsWorkoutModalOpen(true);
  };

  const handleDeleteWorkout = async (id: string) => {
    await deleteWorkout(id);
    setDrawerOpen(false);
    setSelectedWorkout(null);
  };

  const handleWorkoutClick = (workout: PlannedWorkout) => {
    setSelectedWorkout(workout);
    setDrawerOpen(true);
  };

  const handleSaveWorkout = async (data: Omit<PlannedWorkout, "id">) => {
    if (editingWorkout) {
      await updateWorkout(editingWorkout.id, data);
    } else {
      await addWorkout(data);
    }
    setIsWorkoutModalOpen(false);
    setEditingWorkout(undefined);
    setDefaultDate(undefined);
  };

  const handleDayStatusClick = (date: Date) => {
    setStatusModalDate(date);
    setIsStatusModalOpen(true);
  };

  const handleSaveStatus = async (status: DayStatus) => {
    await saveStatus(status);
    // Remove from dismissed if re-added
    setDismissedBanners((prev) => prev.filter((d) => d !== status.date));
  };

  const handleClearStatus = async (date: string) => {
    await clearStatus(date);
    setDismissedBanners((prev) => prev.filter((d) => d !== date));
  };

  const handleDismissBanner = (date: string) => {
    setDismissedBanners((prev) => [...prev, date]);
  };

  const getExistingStatus = (date: Date) => {
    const dateStr = toDateString(date);
    return dayStatuses.find((s) => s.date === dateStr);
  };

  const handleDragStart = (event: { active: { data: { current?: { workout?: PlannedWorkout } } } }) => {
    const workout = event.active.data.current?.workout;
    if (workout) {
      setActiveWorkout(workout);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveWorkout(null);

    const { active, over } = event;

    if (!over) return;

    const workout = active.data.current?.workout as PlannedWorkout | undefined;
    const targetDateStr = over.id as string;

    if (!workout) return;

    const currentDateStr = toDateString(workout.date);
    if (currentDateStr === targetDateStr) return;

    const newDate = fromDateString(targetDateStr);

    await updateWorkout(workout.id, { ...workout, date: newDate });
    toast.success(`Workout moved to ${formatInTimezone(newDate, "EEEE, d MMM")}`);
  };

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex items-center gap-3">
          <CalendarIcon className="h-6 w-6 text-primary" />
          <h1 className="text-xl md:text-2xl font-semibold text-foreground">Calendar</h1>
        </div>
        <Skeleton className="h-96 rounded-lg" />
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      collisionDetection={pointerWithin}
    >
      <div className="flex gap-6">
        {/* Main Calendar Area */}
        <div className="flex-1 p-4 md:p-6 space-y-4 min-w-0">
          {/* Adjustment Banners */}
          {affectedStatuses.map((status) => (
            <Alert key={status.date} variant="destructive" className="bg-destructive/10 border-destructive/30">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between flex-1">
                <span>
                  Plan adjustment needed — you've marked{" "}
                  <strong>{formatInTimezone(fromDateString(status.date), "d MMM")}</strong> as{" "}
                  <strong>{status.status}</strong>
                  {status.notes && ` (${status.notes})`}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 ml-2"
                  onClick={() => handleDismissBanner(status.date)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </AlertDescription>
            </Alert>
          ))}

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <CalendarIcon className="h-6 w-6 text-primary" />
              <h1 className="text-xl md:text-2xl font-semibold text-foreground">
                Calendar
              </h1>
            </div>
            <div className="flex items-center gap-2">
              {/* Mobile Summary Toggle */}
              <Sheet open={summaryOpen} onOpenChange={setSummaryOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="lg:hidden">
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Summary
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-80 p-4">
                  <WeeklySummaryPanel
                    currentDate={currentDate}
                    workouts={workouts}
                    races={races}
                  />
                </SheetContent>
              </Sheet>
              <Button onClick={() => handleAddWorkout()} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Workout
              </Button>
            </div>
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
                {formatCalendarHeader(currentDate, view)}
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
              workouts={workouts}
              races={races}
              focusPeriods={focusPeriods}
              dayStatuses={dayStatuses}
              onEditWorkout={handleEditWorkout}
              onDeleteWorkout={handleDeleteWorkout}
              onWorkoutClick={handleWorkoutClick}
              onAddWorkout={handleAddWorkout}
              onDayStatusClick={handleDayStatusClick}
            />
          ) : (
            <MonthView
              currentDate={currentDate}
              workouts={workouts}
              races={races}
              focusPeriods={focusPeriods}
              dayStatuses={dayStatuses}
              onEditWorkout={handleEditWorkout}
              onWorkoutClick={handleWorkoutClick}
              onDayClick={handleDayStatusClick}
              onAddWorkout={handleAddWorkout}
            />
          )}

          {/* TODO: Create WorkoutFormModal */}
          {/* <WorkoutFormModal
            open={isWorkoutModalOpen}
            onOpenChange={setIsWorkoutModalOpen}
            workout={editingWorkout}
            onSubmit={handleSaveWorkout}
            defaultDate={defaultDate}
          /> */}

          {/* Day Status Modal */}
          <DayStatusModal
            open={isStatusModalOpen}
            onOpenChange={setIsStatusModalOpen}
            defaultDate={statusModalDate}
            existingStatus={statusModalDate ? getExistingStatus(statusModalDate) : undefined}
            onSubmit={handleSaveStatus}
            onClear={handleClearStatus}
          />

          {/* TODO: Create WorkoutDetailDrawer */}
          {/* <WorkoutDetailDrawer
            workout={selectedWorkout}
            open={drawerOpen}
            onOpenChange={setDrawerOpen}
            onEdit={handleEditWorkout}
            onDelete={handleDeleteWorkout}
          /> */}
        </div>

        {/* Desktop Summary Sidebar */}
        <div className="hidden lg:block w-72 p-6 pl-0">
          <div className="sticky top-6">
            <WeeklySummaryPanel
              currentDate={currentDate}
              workouts={workouts}
              races={races}
            />
          </div>
        </div>
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeWorkout ? (
          <div className="opacity-80 rotate-3 scale-105 pointer-events-none">
            <WorkoutCard
              workout={activeWorkout}
              onEdit={() => {}}
              onDelete={() => {}}
              compact
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
