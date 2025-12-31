import { supabase } from '@/integrations/supabase/client';
import { addWeeks, addDays, format, startOfWeek, differenceInDays, isSameDay } from 'date-fns';

interface TrainingWeek {
  weekNumber: number;
  phase: 'base' | 'build' | 'peak' | 'taper';
  weeklyVolume: number; // km
  workouts: PlannedWorkout[];
}

interface PlannedWorkout {
  title: string;
  description: string;
  plannedDate: Date;
  workoutType: string;
  distanceKm: number;
  durationMinutes: number;
  intensityLevel: number;
  trainingPhase: 'base' | 'build' | 'peak' | 'recovery' | 'transition';
  notes: string;
}

/**
 * Creates a goal for Texel 60km on March 29, 2026 with 5:30 target time
 */
export async function createTexelGoal(userId: string) {
  const { data, error } = await supabase
    .from('goals')
    .insert({
      user_id: userId,
      title: 'Texel 60km Ultra Trail',
      description: 'Complete the Texel 60km ultra trail race in under 5 hours 30 minutes',
      target_date: '2026-03-29',
      status: 'active',
      goal_type: 'performance',
      target_value: 330, // 5:30 in minutes
      target_unit: 'minutes'
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Generates a 13-week periodized training plan for an ultra trail goal
 */
export async function generateTrainingPlan(goalId: string, userId: string, raceDate: Date) {
  const startDate = addWeeks(raceDate, -13);
  const trainingWeeks: TrainingWeek[] = [];

  // Define 13-week periodization
  const periodization = [
    { week: 1, phase: 'base', volumeMultiplier: 0.6, description: 'Base building' },
    { week: 2, phase: 'base', volumeMultiplier: 0.65, description: 'Base building' },
    { week: 3, phase: 'base', volumeMultiplier: 0.7, description: 'Base building' },
    { week: 4, phase: 'base', volumeMultiplier: 0.6, description: 'Recovery week' },
    { week: 5, phase: 'build', volumeMultiplier: 0.75, description: 'Build phase' },
    { week: 6, phase: 'build', volumeMultiplier: 0.8, description: 'Build phase' },
    { week: 7, phase: 'build', volumeMultiplier: 0.85, description: 'Build phase' },
    { week: 8, phase: 'build', volumeMultiplier: 0.65, description: 'Recovery week' },
    { week: 9, phase: 'peak', volumeMultiplier: 0.9, description: 'Peak phase' },
    { week: 10, phase: 'peak', volumeMultiplier: 1.0, description: 'Peak volume' },
    { week: 11, phase: 'peak', volumeMultiplier: 0.85, description: 'Peak phase' },
    { week: 12, phase: 'taper', volumeMultiplier: 0.6, description: 'Taper' },
    { week: 13, phase: 'taper', volumeMultiplier: 0.4, description: 'Race week' }
  ];

  const peakWeeklyVolume = 80; // km for 60km race

  // Generate workouts for each week
  for (const period of periodization) {
    const weekStart = addWeeks(startDate, period.week - 1);
    const weekVolume = Math.round(peakWeeklyVolume * period.volumeMultiplier);
    const workouts: PlannedWorkout[] = [];

    // Create week structure based on phase
    if (period.phase === 'base') {
      // Base phase: Focus on easy miles and building endurance
      workouts.push(
        createWorkout('Easy Run', addDays(weekStart, 1), 8, 50, 3, 'Easy aerobic run'),
        createWorkout('Tempo Run', addDays(weekStart, 3), 12, 70, 6, 'Steady tempo pace'),
        createWorkout('Long Run', addDays(weekStart, 6), weekVolume * 0.4, Math.round((weekVolume * 0.4) * 8), 4, 'Build endurance'),
        createWorkout('Recovery Run', addDays(weekStart, 4), 6, 40, 2, 'Active recovery')
      );
    } else if (period.phase === 'build') {
      // Build phase: Add intensity and hill work
      workouts.push(
        createWorkout('Hill Repeats', addDays(weekStart, 1), 10, 65, 7, '6x3min hill repeats'),
        createWorkout('Threshold Run', addDays(weekStart, 3), 15, 80, 7, 'Lactate threshold pace'),
        createWorkout('Long Trail Run', addDays(weekStart, 6), weekVolume * 0.45, Math.round((weekVolume * 0.45) * 9), 5, 'Trail specific with elevation'),
        createWorkout('Easy Run', addDays(weekStart, 2), 8, 50, 3, 'Easy recovery'),
        createWorkout('Medium Run', addDays(weekStart, 4), 12, 70, 5, 'Steady aerobic')
      );
    } else if (period.phase === 'peak') {
      // Peak phase: Race-specific training
      workouts.push(
        createWorkout('Speed Work', addDays(weekStart, 1), 12, 70, 8, '8x800m @ 5K pace'),
        createWorkout('Tempo Trail Run', addDays(weekStart, 3), 18, 100, 7, 'Race pace on trails'),
        createWorkout('Long Trail Run', addDays(weekStart, 6), weekVolume * 0.5, Math.round((weekVolume * 0.5) * 9), 6, 'Race simulation'),
        createWorkout('Recovery Run', addDays(weekStart, 2), 6, 40, 2, 'Easy recovery'),
        createWorkout('Medium Run', addDays(weekStart, 4), 10, 60, 4, 'Aerobic maintenance')
      );
    } else if (period.phase === 'taper') {
      // Taper phase: Reduce volume, maintain intensity
      if (period.week === 13) {
        // Race week
        workouts.push(
          createWorkout('Shakeout Run', addDays(weekStart, 1), 5, 30, 3, 'Easy shakeout'),
          createWorkout('Pre-Race Run', addDays(weekStart, 4), 4, 25, 3, 'Race prep with strides'),
          createWorkout('RACE DAY', addDays(weekStart, 6), 60, 330, 8, 'Texel 60km Ultra Trail')
        );
      } else {
        workouts.push(
          createWorkout('Tempo Run', addDays(weekStart, 1), 10, 55, 6, 'Maintain fitness'),
          createWorkout('Easy Run', addDays(weekStart, 3), 8, 50, 3, 'Recovery focus'),
          createWorkout('Medium Long Run', addDays(weekStart, 6), weekVolume * 0.4, Math.round((weekVolume * 0.4) * 8), 4, 'Maintain endurance')
        );
      }
    }

    trainingWeeks.push({
      weekNumber: period.week,
      phase: period.phase as any,
      weeklyVolume: weekVolume,
      workouts: workouts
    });
  }

  // Insert all workouts into the database
  const allWorkouts = trainingWeeks.flatMap(week =>
    week.workouts.map(workout => ({
      user_id: userId,
      goal_id: goalId,
      title: workout.title,
      description: workout.description,
      planned_date: format(workout.plannedDate, 'yyyy-MM-dd'),
      planned_duration_minutes: workout.durationMinutes,
      workout_type: workout.workoutType,
      intensity_level: workout.intensityLevel,
      training_phase: workout.trainingPhase,
      distance_km: workout.distanceKm,
      notes: workout.notes
    }))
  );

  const { error } = await supabase
    .from('planned_workouts')
    .insert(allWorkouts);

  if (error) throw error;

  return trainingWeeks;
}

function createWorkout(
  title: string,
  date: Date,
  distanceKm: number,
  durationMin: number,
  intensity: number,
  notes: string
): PlannedWorkout {
  // Determine workout type and phase based on title
  let workoutType = 'run';
  let trainingPhase: PlannedWorkout['trainingPhase'] = 'base';

  if (title.toLowerCase().includes('hill')) workoutType = 'hill';
  else if (title.toLowerCase().includes('trail')) workoutType = 'trail';
  else if (title.toLowerCase().includes('tempo')) workoutType = 'tempo';
  else if (title.toLowerCase().includes('speed')) workoutType = 'speed';
  else if (title.toLowerCase().includes('recovery')) workoutType = 'recovery';
  else if (title.toLowerCase().includes('race')) workoutType = 'race';

  if (intensity >= 7) trainingPhase = 'build';
  else if (intensity >= 5) trainingPhase = 'base';
  else if (intensity <= 3) trainingPhase = 'recovery';

  return {
    title,
    description: notes,
    plannedDate: date,
    workoutType,
    distanceKm,
    durationMinutes: durationMin,
    intensityLevel: intensity,
    trainingPhase,
    notes
  };
}

/**
 * Gets today's workout with AI-based adjustments based on recent metrics and performance
 */
export async function getTodaysWorkout(userId: string) {
  const today = new Date();
  const todayFormatted = format(today, 'yyyy-MM-dd');

  // Get today's planned workout
  const { data: plannedWorkout, error: workoutError } = await supabase
    .from('planned_workouts')
    .select('*')
    .eq('user_id', userId)
    .eq('planned_date', todayFormatted)
    .single();

  if (workoutError || !plannedWorkout) {
    return null;
  }

  // Get recent metrics (last 7 days)
  const sevenDaysAgo = format(addDays(today, -7), 'yyyy-MM-dd');
  const { data: recentMetrics } = await supabase
    .from('daily_metrics')
    .select('*')
    .eq('user_id', userId)
    .gte('date', sevenDaysAgo)
    .order('date', { ascending: false });

  // Get recent workouts (last 7 days)
  const { data: recentWorkouts } = await supabase
    .from('workout_completions')
    .select('*')
    .eq('user_id', userId)
    .gte('completed_date', sevenDaysAgo)
    .order('completed_date', { ascending: false });

  // Get latest training load
  const { data: trainingLoad } = await supabase
    .from('training_load')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(1)
    .single();

  // AI adjustment logic
  let adjustments = {
    distanceMultiplier: 1,
    intensityAdjustment: 0,
    recommendation: '',
    reasons: [] as string[]
  };

  // Check recent metrics for fatigue indicators
  if (recentMetrics && recentMetrics.length > 0) {
    const latestMetric = recentMetrics[0];
    const avgEnergyLevel = recentMetrics.reduce((sum, m) => sum + (m.energy_level || 5), 0) / recentMetrics.length;
    const avgSleepQuality = recentMetrics.reduce((sum, m) => sum + (m.sleep_quality || 5), 0) / recentMetrics.length;
    const avgStressLevel = recentMetrics.reduce((sum, m) => sum + (m.stress_level || 5), 0) / recentMetrics.length;

    // Adjust based on energy levels
    if (avgEnergyLevel < 4) {
      adjustments.distanceMultiplier *= 0.8;
      adjustments.intensityAdjustment -= 1;
      adjustments.reasons.push('Low energy levels detected');
    }

    // Adjust based on sleep quality
    if (avgSleepQuality < 4) {
      adjustments.distanceMultiplier *= 0.9;
      adjustments.reasons.push('Poor sleep quality');
    }

    // Adjust based on stress
    if (avgStressLevel > 7) {
      adjustments.intensityAdjustment -= 1;
      adjustments.reasons.push('High stress levels');
    }

    // Check for pain/injury
    if (latestMetric.injury_pain_level && latestMetric.injury_pain_level > 3) {
      adjustments.distanceMultiplier *= 0.7;
      adjustments.intensityAdjustment -= 2;
      adjustments.reasons.push(`Injury/pain level: ${latestMetric.injury_pain_level}/10`);
    }

    // Check HRV if available
    if (latestMetric.hrv_ms) {
      const avgHRV = recentMetrics.reduce((sum, m) => sum + (m.hrv_ms || 0), 0) / recentMetrics.filter(m => m.hrv_ms).length;
      if (latestMetric.hrv_ms < avgHRV * 0.9) {
        adjustments.intensityAdjustment -= 1;
        adjustments.reasons.push('HRV below average');
      }
    }
  }

  // Check training load and acute:chronic ratio
  if (trainingLoad) {
    if (trainingLoad.acute_chronic_ratio && trainingLoad.acute_chronic_ratio > 1.5) {
      adjustments.distanceMultiplier *= 0.8;
      adjustments.reasons.push('High acute:chronic workload ratio');
    } else if (trainingLoad.acute_chronic_ratio && trainingLoad.acute_chronic_ratio > 1.3) {
      adjustments.distanceMultiplier *= 0.9;
      adjustments.reasons.push('Elevated training load');
    }
  }

  // Check recent workout completion
  if (recentWorkouts && recentWorkouts.length > 0) {
    const consecutiveDays = countConsecutiveWorkoutDays(recentWorkouts);
    if (consecutiveDays >= 4) {
      adjustments.distanceMultiplier *= 0.8;
      adjustments.intensityAdjustment -= 1;
      adjustments.reasons.push(`${consecutiveDays} consecutive training days`);
    }
  }

  // Apply adjustments
  const adjustedWorkout = {
    ...plannedWorkout,
    adjusted_distance_km: Math.round(plannedWorkout.distance_km * adjustments.distanceMultiplier * 10) / 10,
    adjusted_intensity: Math.max(1, Math.min(10, plannedWorkout.intensity_level + adjustments.intensityAdjustment)),
    adjusted_duration_minutes: Math.round(plannedWorkout.planned_duration_minutes * adjustments.distanceMultiplier),
    ai_recommendations: generateRecommendation(adjustments),
    adjustment_reasons: adjustments.reasons
  };

  return adjustedWorkout;
}

function countConsecutiveWorkoutDays(workouts: any[]): number {
  if (!workouts || workouts.length === 0) return 0;

  let consecutive = 1;
  const sortedWorkouts = [...workouts].sort((a, b) =>
    new Date(b.completed_date).getTime() - new Date(a.completed_date).getTime()
  );

  for (let i = 1; i < sortedWorkouts.length; i++) {
    const currentDate = new Date(sortedWorkouts[i].completed_date);
    const prevDate = new Date(sortedWorkouts[i - 1].completed_date);

    if (differenceInDays(prevDate, currentDate) === 1) {
      consecutive++;
    } else {
      break;
    }
  }

  return consecutive;
}

function generateRecommendation(adjustments: any): string {
  const { distanceMultiplier, intensityAdjustment, reasons } = adjustments;

  if (distanceMultiplier === 1 && intensityAdjustment === 0) {
    return "You're in good shape for today's workout. Stick to the plan!";
  }

  let recommendation = "Based on your recent data, consider ";

  if (distanceMultiplier < 0.8) {
    recommendation += "significantly reducing today's volume ";
  } else if (distanceMultiplier < 1) {
    recommendation += "moderating today's distance ";
  }

  if (intensityAdjustment < -1) {
    recommendation += "and keeping the effort very easy. ";
  } else if (intensityAdjustment < 0) {
    recommendation += "and reducing intensity slightly. ";
  }

  if (reasons.some(r => r.includes('injury') || r.includes('pain'))) {
    recommendation += "Consider cross-training or rest if pain persists. ";
  }

  recommendation += "Listen to your body!";

  return recommendation;
}