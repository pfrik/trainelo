import { Trophy } from "lucide-react";

export default function Races() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
      <div className="flex items-center gap-3 mb-4">
        <Trophy className="h-8 w-8 text-primary" />
        <h1 className="text-2xl font-semibold text-foreground">Races</h1>
      </div>
      <p className="text-muted-foreground text-center">
        Race calendar coming soon
      </p>
    </div>
  );
}
