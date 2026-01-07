import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { PlannedWorkout } from "@/types/plannedWorkout";
import { format } from "date-fns";
import { Play, MoreVertical, User } from "lucide-react";
import { toast } from "sonner";
import { getTodayInTimezone, toDateString, fromDateString, formatDisplayDateLong } from "@/lib/dateUtils";

interface ReadinessData {
  score: number;
  color: "green" | "yellow" | "red";
  label: string;
}

export default function Today() {
  const { user } = useAuth();
  const [todayWorkout, setTodayWorkout] = useState<PlannedWorkout | null>(null);
  const [loading, setLoading] = useState(true);
  const [readiness, setReadiness] = useState<ReadinessData>({
    score: 85,
    color: "green",
    label: "High"
  });

  // Get greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  // Get user's display name
  const getUserName = () => {
    if (!user) return "Athlete";
    return user.user_metadata?.name || user.email?.split("@")[0] || "Athlete";
  };

  // Calculate readiness score (placeholder logic - will be enhanced later)
  const calculateReadiness = async () => {
    // This is a placeholder. In a real app, this would calculate based on:
    // - Recent training load
    // - Sleep quality
    // - HRV data
    // - Previous workout intensity
    // For now, we'll use a random value
    const score = Math.floor(Math.random() * 30) + 70; // 70-100
    let color: "green" | "yellow" | "red";
    let label: string;

    if (score >= 85) {
      color = "green";
      label = "High";
    } else if (score >= 70) {
      color = "yellow";
      label = "Moderate";
    } else {
      color = "red";
      label = "Low";
    }

    setReadiness({ score, color, label });
  };

  // Fetch today's workout
  const fetchTodayWorkout = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const today = getTodayInTimezone();
      const todayString = toDateString(today);

      const { data, error } = await supabase
        .from("planned_workouts")
        .select("*")
        .eq("planned_date", todayString)
        .single();

      if (error && error.code !== "PGRST116") {
        // PGRST116 is "no rows returned"
        console.error("Error fetching today's workout:", error);
        toast.error("Failed to load today's workout");
      } else if (data) {
        const workout: PlannedWorkout = {
          id: data.id,
          title: data.title,
          date: fromDateString(data.planned_date),
          duration: data.planned_duration_minutes || 60,
          workoutType: data.workout_type || "run",
          intensityLevel: data.intensity_level || 5,
          distance: data.distance_km || undefined,
          description: data.description || undefined,
          notes: data.notes || undefined,
          trainingPhase: data.training_phase || undefined,
        };
        setTodayWorkout(workout);
      }
    } catch (error) {
      console.error("Error fetching today's workout:", error);
      toast.error("Failed to load today's workout");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTodayWorkout();
    calculateReadiness();
  }, [user]);

  // Get workout pace based on intensity
  const getWorkoutPace = (workout: PlannedWorkout) => {
    // This is placeholder logic - would be personalized based on user's fitness level
    const paceMap: Record<number, string> = {
      1: "6:30/km",
      2: "6:15/km",
      3: "6:00/km",
      4: "5:45/km",
      5: "5:30/km",
      6: "5:15/km",
      7: "5:00/km",
      8: "4:45/km",
      9: "4:30/km",
      10: "4:15/km",
    };
    return paceMap[workout.intensityLevel] || "5:30/km";
  };

  // Get AI reasoning for workout
  const getAIReasoning = (workout: PlannedWorkout, readiness: ReadinessData) => {
    if (readiness.color === "green" && workout.intensityLevel >= 7) {
      return "Recovery is high. Good day to push lactate threshold.";
    } else if (readiness.color === "yellow") {
      return "Moderate recovery. Focus on maintaining steady effort.";
    } else if (readiness.color === "red") {
      return "Low recovery. Consider reducing intensity or taking a rest day.";
    }
    return "Balanced workout to maintain fitness progression.";
  };

  const readinessColorClasses = {
    green: "bg-green-100 text-green-800 border-green-200",
    yellow: "bg-yellow-100 text-yellow-800 border-yellow-200",
    red: "bg-red-100 text-red-800 border-red-200",
  };

  const readinessGradients = {
    green: "from-green-400 to-green-600",
    yellow: "from-yellow-400 to-yellow-600",
    red: "from-red-400 to-red-600",
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {getGreeting()}, {getUserName()}
          </h1>
          <p className="text-gray-600 mt-1">{formatDisplayDateLong(new Date())}</p>
        </div>
        <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
          <User className="w-6 h-6 text-gray-600" />
        </div>
      </div>

      {/* Readiness Score Card */}
      <div className={`rounded-xl p-6 mb-6 border ${readinessColorClasses[readiness.color]}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium opacity-80 mb-1">Readiness Score</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">{readiness.score}%</span>
              <span className="text-sm font-medium">{readiness.label}</span>
            </div>
          </div>
          <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${readinessGradients[readiness.color]} opacity-20`}></div>
        </div>
      </div>

      {/* Workout Card */}
      {todayWorkout ? (
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
          {/* Background pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute -right-20 -top-20 w-80 h-80 rounded-full bg-white/20"></div>
            <div className="absolute -left-20 -bottom-20 w-80 h-80 rounded-full bg-white/20"></div>
          </div>

          {/* Content */}
          <div className="relative z-10">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-blue-100 uppercase tracking-wider">
                TODAY'S WORKOUT
              </span>
              <button className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                <MoreVertical className="w-5 h-5" />
              </button>
            </div>

            {/* Workout Title */}
            <h2 className="text-3xl font-bold mb-4">{todayWorkout.title}</h2>

            {/* Workout Details */}
            <div className="flex gap-6 mb-6">
              <div>
                <p className="text-sm text-blue-100 mb-1">Target Pace</p>
                <p className="text-lg font-semibold">{getWorkoutPace(todayWorkout)}</p>
              </div>
              <div>
                <p className="text-sm text-blue-100 mb-1">Duration</p>
                <p className="text-lg font-semibold">{todayWorkout.duration} min</p>
              </div>
              {todayWorkout.distance && (
                <div>
                  <p className="text-sm text-blue-100 mb-1">Distance</p>
                  <p className="text-lg font-semibold">{todayWorkout.distance} km</p>
                </div>
              )}
            </div>

            {/* AI Reasoning */}
            <div className="bg-white/20 rounded-lg p-4 mb-6">
              <p className="text-sm leading-relaxed">
                {getAIReasoning(todayWorkout, readiness)}
              </p>
            </div>

            {/* Start Button */}
            <button className="w-full bg-white text-blue-600 rounded-xl py-4 font-semibold flex items-center justify-center gap-3 hover:bg-blue-50 transition-colors shadow-md">
              <Play className="w-5 h-5 fill-current" />
              Start Workout
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-gray-100 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
            <Play className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No workout planned</h3>
          <p className="text-gray-600">
            You don't have any workouts scheduled for today.
          </p>
        </div>
      )}
    </div>
  );
}