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
import { format, addWeeks, subWeeks, addMonths, subMonths, parseISO } from "date-fns";
import { DndContext, DragEndEvent, DragOverlay, pointerWithin } from "@dnd-kit/core";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ExternalBlock } from "@/types/block";
import { DayStatus } from "@/types/dayStatus";
import { WeekView } from "@/components/calendar/WeekView";
import { MonthView } from "@/components/calendar/MonthView";
import { ExternalBlockFormModal } from "@/components/calendar/ExternalBlockFormModal";
import { DayStatusModal } from "@/components/calendar/DayStatusModal";
import { WeeklySummaryPanel } from "@/components/calendar/WeeklySummaryPanel";
import { WorkoutDetailDrawer } from "@/components/calendar/WorkoutDetailDrawer";
import { BlockCard } from "@/components/calendar/BlockCard";
import { useBlocks } from "@/hooks/useBlocks";
import { useRaces } from "@/hooks/useRaces";
import { useFocusPeriods } from "@/hooks/useFocusPeriods";
import { useDayStatuses } from "@/hooks/useDayStatuses";
import { toast } from "sonner";

export default function Calendar() {
  const { blocks, loading: loadingBlocks, addBlock, updateBlock, deleteBlock, toggleComplete, updateDescription } = useBlocks();
  const { races, loading: loadingRaces } = useRaces();
  const { focusPeriods, loading: loadingPeriods } = useFocusPeriods();
  const { dayStatuses, loading: loadingStatuses, saveStatus, clearStatus } = useDayStatuses();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<"week" | "month">("week");
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<ExternalBlock | undefined>();
  const [defaultDate, setDefaultDate] = useState<Date | undefined>();
  const [statusModalDate, setStatusModalDate] = useState<Date | undefined>();
  const [dismissedBanners, setDismissedBanners] = useState<string[]>([]);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState<ExternalBlock | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeBlock, setActiveBlock] = useState<ExternalBlock | null>(null);

  const loading = loadingBlocks || loadingRaces || loadingPeriods || loadingStatuses;

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

  const handleAddBlock = (date?: Date) => {
    setEditingBlock(undefined);
    setDefaultDate(date);
    setIsBlockModalOpen(true);
  };

  const handleEditBlock = (block: ExternalBlock) => {
    setEditingBlock(block);
    setDefaultDate(undefined);
    setIsBlockModalOpen(true);
  };

  const handleDeleteBlock = async (id: string) => {
    await deleteBlock(id);
    setDrawerOpen(false);
    setSelectedBlock(null);
  };

  const handleBlockClick = (block: ExternalBlock) => {
    setSelectedBlock(block);
    setDrawerOpen(true);
  };

  const handleSaveBlock = async (data: Omit<ExternalBlock, "id">) => {
    if (editingBlock) {
      await updateBlock(editingBlock.id, data);
    } else {
      await addBlock(data);
    }
    setIsBlockModalOpen(false);
    setEditingBlock(undefined);
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
    const dateStr = format(date, "yyyy-MM-dd");
    return dayStatuses.find((s) => s.date === dateStr);
  };

  const handleDragStart = (event: { active: { data: { current?: { block?: ExternalBlock } } } }) => {
    const block = event.active.data.current?.block;
    if (block) {
      setActiveBlock(block);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveBlock(null);
    
    const { active, over } = event;
    
    if (!over) return;
    
    const block = active.data.current?.block as ExternalBlock | undefined;
    const targetDateStr = over.id as string;
    
    if (!block || block.isFixed) return;
    
    const currentDateStr = format(block.date, "yyyy-MM-dd");
    if (currentDateStr === targetDateStr) return;
    
    const newDate = parseISO(targetDateStr);
    
    await updateBlock(block.id, { ...block, date: newDate });
    toast.success(`Workout moved to ${format(newDate, "EEEE, MMM d")}`);
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
                  <strong>{format(new Date(status.date), "MMM d")}</strong> as{" "}
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
                    blocks={blocks}
                    races={races}
                  />
                </SheetContent>
              </Sheet>
              <Button onClick={() => handleAddBlock()} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Block
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
              races={races}
              focusPeriods={focusPeriods}
              dayStatuses={dayStatuses}
              onEditBlock={handleEditBlock}
              onDeleteBlock={handleDeleteBlock}
              onToggleComplete={toggleComplete}
              onBlockClick={handleBlockClick}
              onAddBlock={handleAddBlock}
              onDayStatusClick={handleDayStatusClick}
            />
          ) : (
            <MonthView
              currentDate={currentDate}
              blocks={blocks}
              races={races}
              focusPeriods={focusPeriods}
              dayStatuses={dayStatuses}
              onEditBlock={handleEditBlock}
              onToggleComplete={toggleComplete}
              onBlockClick={handleBlockClick}
              onDayClick={handleDayStatusClick}
            />
          )}

          {/* Block Form Modal */}
          <ExternalBlockFormModal
            open={isBlockModalOpen}
            onOpenChange={setIsBlockModalOpen}
            block={editingBlock}
            onSubmit={handleSaveBlock}
            defaultDate={defaultDate}
          />

          {/* Day Status Modal */}
          <DayStatusModal
            open={isStatusModalOpen}
            onOpenChange={setIsStatusModalOpen}
            defaultDate={statusModalDate}
            existingStatus={statusModalDate ? getExistingStatus(statusModalDate) : undefined}
            onSubmit={handleSaveStatus}
            onClear={handleClearStatus}
          />

          {/* Workout Detail Drawer */}
          <WorkoutDetailDrawer
            block={selectedBlock}
            open={drawerOpen}
            onOpenChange={setDrawerOpen}
            onEdit={handleEditBlock}
            onDelete={handleDeleteBlock}
            onToggleComplete={toggleComplete}
            onDescriptionChange={updateDescription}
            description={selectedBlock?.description || ""}
          />
        </div>

        {/* Desktop Summary Sidebar */}
        <div className="hidden lg:block w-72 p-6 pl-0">
          <div className="sticky top-6">
            <WeeklySummaryPanel
              currentDate={currentDate}
              blocks={blocks}
              races={races}
            />
          </div>
        </div>
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeBlock ? (
          <div className="opacity-80 rotate-3 scale-105 pointer-events-none">
            <BlockCard
              block={activeBlock}
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
