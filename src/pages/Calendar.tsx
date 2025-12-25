import { useState } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  AlertTriangle,
  X,
} from "lucide-react";
import { format, addWeeks, subWeeks, addMonths, subMonths } from "date-fns";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalBlock } from "@/types/block";
import { DayStatus } from "@/types/dayStatus";
import { WeekView } from "@/components/calendar/WeekView";
import { MonthView } from "@/components/calendar/MonthView";
import { ExternalBlockFormModal } from "@/components/calendar/ExternalBlockFormModal";
import { DayStatusModal } from "@/components/calendar/DayStatusModal";
import { useBlocks } from "@/hooks/useBlocks";
import { useRaces } from "@/hooks/useRaces";
import { useFocusPeriods } from "@/hooks/useFocusPeriods";
import { useDayStatuses } from "@/hooks/useDayStatuses";

export default function Calendar() {
  const { blocks, loading: loadingBlocks, addBlock, updateBlock, deleteBlock } = useBlocks();
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
    <div className="p-4 md:p-6 space-y-4">
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
          races={races}
          focusPeriods={focusPeriods}
          dayStatuses={dayStatuses}
          onEditBlock={handleEditBlock}
          onDeleteBlock={handleDeleteBlock}
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
    </div>
  );
}
