import { useState, useEffect } from "react";
import { Plus, Target } from "lucide-react";
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

  // Prevent body scroll when wizard is open
  useEffect(() => {
    if (wizardOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [wizardOpen]);

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

      {/* Goal Wizard — Full-viewport modal */}
      {wizardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 bg-[#0B0E11]/80 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-4xl my-auto bg-slate-800 rounded-2xl shadow-[0_32px_64px_-12px_rgba(0,0,0,0.8)] border border-white/10 overflow-hidden">
            {/* Modal Header */}
            <header className="h-16 px-8 flex justify-between items-center bg-slate-800 border-b border-white/5 sticky top-0 z-10">
              <div className="flex items-center gap-4">
                <span className="text-2xl font-bold text-white tracking-tight font-headline">Trainelo</span>
                <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400 border-l border-white/10 pl-4 font-headline opacity-60">
                  Goal Wizard
                </span>
              </div>
              <button
                onClick={() => setWizardOpen(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined text-[24px]">close</span>
              </button>
            </header>

            {/* Modal Content */}
            <div className="p-8 md:p-12 max-h-[calc(100vh-8rem)] overflow-y-auto">
              <GoalCreationWizard
                onSubmit={handleCreate}
                onGeneratePlan={handleGeneratePlan}
                onClose={() => setWizardOpen(false)}
              />
            </div>
          </div>

          {/* Background Accents */}
          <div className="fixed top-[-10%] right-[-5%] w-[50%] h-[70%] bg-primary/5 blur-[120px] rounded-full -z-10 pointer-events-none" />
          <div className="fixed bottom-[-5%] left-[-5%] w-[40%] h-[50%] bg-primary/5 blur-[100px] rounded-full -z-10 pointer-events-none" />
        </div>
      )}
    </div>
  );
}
