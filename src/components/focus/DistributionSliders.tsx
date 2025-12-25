import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import type { Distribution } from "@/types/focus";

interface DistributionSlidersProps {
  distribution: Distribution;
  onChange: (distribution: Distribution) => void;
  error?: string;
}

const disciplines = [
  { key: "run" as const, label: "Run", color: "bg-primary" },
  { key: "bike" as const, label: "Bike", color: "bg-chart-2" },
  { key: "swim" as const, label: "Swim", color: "bg-chart-3" },
  { key: "strength" as const, label: "Strength", color: "bg-chart-4" },
];

export function DistributionSliders({ distribution, onChange, error }: DistributionSlidersProps) {
  const total = distribution.run + distribution.bike + distribution.swim + distribution.strength;

  const handleChange = (key: keyof Distribution, value: number) => {
    onChange({
      ...distribution,
      [key]: value,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>Distribution</Label>
        <span className={`text-sm font-medium ${total === 100 ? "text-primary" : "text-destructive"}`}>
          Total: {total}%
        </span>
      </div>

      {disciplines.map(({ key, label, color }) => (
        <div key={key} className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{label}</span>
            <span className="text-sm font-medium w-12 text-right">{distribution[key]}%</span>
          </div>
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${color}`} />
            <Slider
              value={[distribution[key]]}
              onValueChange={([value]) => handleChange(key, value)}
              max={100}
              step={5}
              className="flex-1"
            />
          </div>
        </div>
      ))}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Distribution preview bar */}
      <div className="h-4 rounded-full overflow-hidden flex bg-muted">
        {disciplines.map(({ key, color }) => (
          distribution[key] > 0 && (
            <div
              key={key}
              className={`${color} transition-all`}
              style={{ width: `${distribution[key]}%` }}
            />
          )
        ))}
      </div>
    </div>
  );
}
