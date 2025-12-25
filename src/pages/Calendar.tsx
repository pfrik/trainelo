import { Calendar as CalendarIcon } from "lucide-react";

export default function Calendar() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
      <div className="flex items-center gap-3 mb-4">
        <CalendarIcon className="h-8 w-8 text-primary" />
        <h1 className="text-2xl font-semibold text-foreground">Calendar</h1>
      </div>
      <p className="text-muted-foreground text-center">
        Training calendar coming soon
      </p>
    </div>
  );
}
