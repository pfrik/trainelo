import { useState } from "react";
import { Plus, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RaceCard } from "@/components/races/RaceCard";
import { RaceFormModal } from "@/components/races/RaceFormModal";
import type { Race } from "@/types/race";

const seedRaces: Race[] = [
  {
    id: "1",
    name: "Vondelparkloop - 10km",
    date: new Date("2026-01-18"),
    sport: "Run",
    distance: 10,
    distanceUnit: "km",
    priority: "B",
    goalType: "Finish",
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

export default function Races() {
  const [races, setRaces] = useState<Race[]>(seedRaces);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRace, setEditingRace] = useState<Race | null>(null);

  const sortedRaces = [...races].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const handleSubmit = (data: Omit<Race, "id"> & { id?: string }) => {
    if (data.id) {
      setRaces((prev) =>
        prev.map((r) => (r.id === data.id ? { ...data, id: data.id } as Race : r))
      );
    } else {
      const newRace: Race = {
        ...data,
        id: crypto.randomUUID(),
      };
      setRaces((prev) => [...prev, newRace]);
    }
    setEditingRace(null);
  };

  const handleEdit = (race: Race) => {
    setEditingRace(race);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    setRaces((prev) => prev.filter((r) => r.id !== id));
  };

  const handleOpenChange = (open: boolean) => {
    setIsModalOpen(open);
    if (!open) {
      setEditingRace(null);
    }
  };

  return (
    <div className="p-4 md:p-6 pb-24 md:pb-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Trophy className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-semibold text-foreground">Races</h1>
        </div>
        <Button onClick={() => setIsModalOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Add Race
        </Button>
      </div>

      {sortedRaces.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No races yet. Add your first race to get started!</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sortedRaces.map((race) => (
            <RaceCard
              key={race.id}
              race={race}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <RaceFormModal
        open={isModalOpen}
        onOpenChange={handleOpenChange}
        race={editingRace}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
