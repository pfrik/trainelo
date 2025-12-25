import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Race } from "@/types/race";

interface GeneratePlanButtonProps {
  nextARace: Race | undefined;
  hasExistingPhases: boolean;
  onGenerate: (aRaceDate: Date) => Promise<boolean>;
}

export function GeneratePlanButton({
  nextARace,
  hasExistingPhases,
  onGenerate,
}: GeneratePlanButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [generating, setGenerating] = useState(false);

  const handleClick = () => {
    if (!nextARace) return;

    if (hasExistingPhases) {
      setShowConfirm(true);
    } else {
      handleGenerate();
    }
  };

  const handleGenerate = async () => {
    if (!nextARace) return;
    setShowConfirm(false);
    setGenerating(true);
    await onGenerate(nextARace.date);
    setGenerating(false);
  };

  return (
    <>
      <Button
        onClick={handleClick}
        disabled={!nextARace || generating}
        variant="outline"
        size="sm"
        className="gap-2"
      >
        <Sparkles className="h-4 w-4" />
        {generating ? "Generating..." : "Generate Training Plan"}
      </Button>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace Training Phases?</AlertDialogTitle>
            <AlertDialogDescription>
              This will replace your current training phases with a new plan
              based on your next A-race. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleGenerate}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
