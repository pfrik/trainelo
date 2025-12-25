import { useState } from "react";
import { Plus, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RaceCard } from "@/components/races/RaceCard";
import { RaceFormModal } from "@/components/races/RaceFormModal";
import { useRaces } from "@/hooks/useRaces";
import type { Race } from "@/types/race";
import { Skeleton } from "@/components/ui/skeleton";

export default function Races() {
  const { races, loading, addRace, updateRace, deleteRace } = useRaces();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRace, setEditingRace] = useState<Race | null>(null);

  const sortedRaces = [...races].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const handleSubmit = async (data: Omit<Race, "id"> & { id?: string }) => {
    if (data.id) {
      await updateRace(data.id, data);
    } else {
      await addRace(data);
    }
    setEditingRace(null);
  };

  const handleEdit = (race: Race) => {
    setEditingRace(race);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    await deleteRace(id);
  };

  const handleOpenChange = (open: boolean) => {
    setIsModalOpen(open);
    if (!open) {
      setEditingRace(null);
    }
  };

  if (loading) {
    return (
      <div className="p-4 md:p-6 pb-24 md:pb-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Trophy className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold text-foreground">Races</h1>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

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
