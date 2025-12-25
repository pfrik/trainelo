import { toast } from "sonner";
import { HeroSection } from "@/components/dashboard/HeroSection";
import { SeasonTimeline } from "@/components/dashboard/SeasonTimeline";
import { ThisWeekCard } from "@/components/dashboard/ThisWeekCard";
import { QuickStats } from "@/components/dashboard/QuickStats";
import { Race } from "@/types/race";
import { FocusPeriod } from "@/types/focus";
import { ExternalBlock } from "@/types/block";

// Seed data (same as other pages for consistency)
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

// Get this week's blocks
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

export default function Dashboard() {
  const handleRaceClick = (race: Race) => {
    toast.info(`${race.name} - ${race.distance}${race.distanceUnit}`, {
      description: race.goalValue,
    });
  };

  const handleMarkDayStatus = () => {
    toast.info("Day status adjustment coming soon", {
      description: "This will let you mark days as sick, injured, or traveling.",
    });
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Hero Section */}
      <HeroSection races={seedRaces} focusPeriods={seedFocusPeriods} />

      {/* Season Timeline */}
      <SeasonTimeline
        races={seedRaces}
        focusPeriods={seedFocusPeriods}
        onRaceClick={handleRaceClick}
      />

      {/* Stats + This Week */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-4">
          <QuickStats plannedHours={8} completedHours={3} status="On track" />
        </div>
        <ThisWeekCard blocks={seedBlocks} onMarkDayStatus={handleMarkDayStatus} />
      </div>
    </div>
  );
}
