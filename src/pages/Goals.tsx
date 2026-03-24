import { useState } from "react";
import { Plus, Target } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useGoals, type CreateGoalInput } from "@/hooks/useGoals";
import { GoalCreationWizard } from "@/components/goals/GoalCreationWizard";
import { GoalCard } from "@/components/goals/GoalCard";
import { AppSidebar } from "@/components/navigation/AppSidebar";

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
    <div className="dark h-screen flex overflow-hidden bg-light-base dark:bg-dark-base text-slate-800 dark:text-slate-200 font-sans antialiased transition-colors duration-200">

      <AppSidebar />

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-light-base dark:bg-dark-base relative">
        <div className="max-w-5xl mx-auto px-8 py-8">

          {/* Header */}
          <header className="flex justify-between items-end mb-8">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-1">Goals</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Define your races and Trainelo builds your training plan
              </p>
            </div>
            <button
              onClick={() => setWizardOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary text-slate-900 rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-4 w-4" />
              New Goal
            </button>
          </header>

          {/* Error */}
          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400 mb-6">
              {error}
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mb-4"></div>
              <p className="text-slate-400">Loading goals...</p>
            </div>
          )}

          {/* Active Plans */}
          {!loading && activeGoals.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <span className="bg-green-500/20 text-green-400 text-xs font-bold px-2 py-1 rounded uppercase tracking-wider border border-green-500/20">Active</span>
                <span className="text-sm text-slate-400">{activeGoals.length} plan{activeGoals.length > 1 ? "s" : ""}</span>
              </div>
              <div className="space-y-4">
                {activeGoals.map((goal) => (
                  <GoalCard key={goal.id} goal={goal} onDelete={deleteGoal} />
                ))}
              </div>
            </div>
          )}

          {/* Draft Goals */}
          {!loading && draftGoals.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <span className="bg-slate-700/50 text-slate-400 text-xs font-bold px-2 py-1 rounded uppercase tracking-wider">Draft</span>
              </div>
              <div className="space-y-4">
                {draftGoals.map((goal) => (
                  <GoalCard key={goal.id} goal={goal} onDelete={deleteGoal} />
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {!loading && goals.length === 0 && (
            <div className="bg-light-surface dark:bg-dark-surface rounded-2xl p-12 shadow-sm border border-slate-200 dark:border-slate-700/50 flex flex-col items-center text-center">
              <div className="h-16 w-16 rounded-full bg-slate-800 flex items-center justify-center mb-6">
                <Target className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="font-bold text-lg text-white mb-2">No goals yet</h3>
              <p className="text-sm text-slate-400 max-w-md mb-6">
                Set a race goal and Trainelo will generate a personalized, periodized training plan to get you to the start line ready.
              </p>
              <button
                onClick={() => setWizardOpen(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-slate-900 rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Create Your First Goal
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Creation wizard dialog */}
      <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-dark-surface border-slate-700/50 text-slate-200">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
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
