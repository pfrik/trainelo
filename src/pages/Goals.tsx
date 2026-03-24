import { useState } from "react";
import { Plus, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useGoals, type CreateGoalInput } from "@/hooks/useGoals";
import { GoalCreationWizard } from "@/components/goals/GoalCreationWizard";
import { GoalCard } from "@/components/goals/GoalCard";

export default function Goals() {
  const { goals, loading, error, createGoal, generatePlan, deleteGoal } =
    useGoals();
  const [wizardOpen, setWizardOpen] = useState(false);

  const handleCreate = async (
    input: CreateGoalInput,
  ): Promise<{ goalId: string } | null> => {
    const goal = await createGoal(input);
    if (goal) return { goalId: goal.id };
    return null;
  };

  const handleGeneratePlan = async (goalId: string) => {
    await generatePlan(goalId);
  };

  const activeGoals = goals.filter(
    (g) => g.status === "active" && g.plan_status === "active",
  );
  const draftGoals = goals.filter(
    (g) => g.status === "active" && g.plan_status !== "active",
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Goals</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Define your races and Trainelo builds your plan
            </p>
          </div>
          <Button onClick={() => setWizardOpen(true)} size="sm">
            <Plus className="h-4 w-4 mr-1" /> New Goal
          </Button>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-3">
            <Skeleton className="h-32 w-full rounded-lg" />
            <Skeleton className="h-32 w-full rounded-lg" />
          </div>
        )}

        {/* Active plans */}
        {!loading && activeGoals.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Active Plans
            </h2>
            {activeGoals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onDelete={deleteGoal}
              />
            ))}
          </div>
        )}

        {/* Draft goals */}
        {!loading && draftGoals.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Draft
            </h2>
            {draftGoals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onDelete={deleteGoal}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && goals.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
              <Target className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-semibold">No goals yet</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                Set a race goal and Trainelo will generate a personalized
                training plan to get you there.
              </p>
            </div>
            <Button onClick={() => setWizardOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Create Your First Goal
            </Button>
          </div>
        )}
      </div>

      {/* Creation wizard dialog */}
      <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              New Training Goal
            </DialogTitle>
          </DialogHeader>
          <GoalCreationWizard
            onSubmit={handleCreate}
            onGeneratePlan={handleGeneratePlan}
            onClose={() => setWizardOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
