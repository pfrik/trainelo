import { useState } from "react";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, format, isSameMonth, isSameDay, startOfWeek, endOfWeek } from "date-fns";
import { Button } from "@/components/ui/button";
import { usePlannedWorkouts } from "@/hooks/usePlannedWorkouts";
import { PlannedWorkout } from "@/types/plannedWorkout";

export default function Calendar() {
  const { workouts, loading } = usePlannedWorkouts();
  const [currentDate, setCurrentDate] = useState(new Date());

  const handlePrevMonth = () => {
    setCurrentDate(subMonths(currentDate, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(addMonths(currentDate, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Get all days to display in the calendar grid
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Group workouts by date
  const workoutsByDate = workouts.reduce((acc, workout) => {
    const dateKey = format(workout.date, 'yyyy-MM-dd');
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(workout);
    return acc;
  }, {} as Record<string, PlannedWorkout[]>);

  if (loading) {
    return (
      <div className="p-4 md:p-6">
        <div className="flex items-center gap-3 mb-6">
          <CalendarIcon className="h-6 w-6 text-primary" />
          <h1 className="text-xl md:text-2xl font-semibold">Calendar</h1>
        </div>
        <div className="animate-pulse h-96 bg-muted rounded-lg" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <CalendarIcon className="h-6 w-6 text-primary" />
        <h1 className="text-xl md:text-2xl font-semibold">Calendar</h1>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handlePrevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleToday}>
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={handleNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <h2 className="text-lg font-medium">
          {format(currentDate, 'MMMM yyyy')}
        </h2>
      </div>

      {/* Calendar Grid */}
      <div className="border rounded-lg overflow-hidden">
        {/* Weekday Headers */}
        <div className="grid grid-cols-7 bg-muted">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground">
              {day}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 divide-x divide-y">
          {days.map((day) => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const dayWorkouts = workoutsByDate[dateKey] || [];
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isToday = isSameDay(day, new Date());

            return (
              <div
                key={dateKey}
                className={`min-h-[100px] p-2 ${
                  !isCurrentMonth ? 'bg-muted/30' : ''
                } ${isToday ? 'bg-primary/5' : ''}`}
              >
                <div className={`text-sm mb-1 ${
                  !isCurrentMonth ? 'text-muted-foreground' : ''
                } ${isToday ? 'font-semibold' : ''}`}>
                  {format(day, 'd')}
                </div>

                {/* Workout Cards */}
                <div className="space-y-1">
                  {dayWorkouts.map((workout) => (
                    <div
                      key={workout.id}
                      className="p-1 rounded text-xs bg-primary/10 hover:bg-primary/20 cursor-pointer"
                    >
                      <div className="font-medium truncate">{workout.workoutType}</div>
                      <div className="text-muted-foreground">
                        {workout.distance && `${workout.distance}km • `}
                        {workout.duration}min
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}