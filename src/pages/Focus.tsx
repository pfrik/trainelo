import { Target } from "lucide-react";

export default function Focus() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
      <div className="flex items-center gap-3 mb-4">
        <Target className="h-8 w-8 text-primary" />
        <h1 className="text-2xl font-semibold text-foreground">Focus</h1>
      </div>
      <p className="text-muted-foreground text-center">
        Focus periods coming soon
      </p>
    </div>
  );
}
