/**
 * Database query functions for goals and training plans.
 * Server-side only — uses service role client.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ============================================================================
// Types
// ============================================================================

export interface ScheduledWorkoutRow {
  template_ref: string;
  goal_id: string;
  goal_title: string;
  phase: string;
  week_number: number;
  target_date: string;
  planned_workout_id: string;
  sport: string | null;
  target_tss: number | null;
}

export interface GoalRow {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  target_date: string | null;
  status: string;
  goal_type: string | null;
  target_value: number | null;
  target_unit: string | null;
  sport: string | null;
  race_distance_km: number | null;
  target_time_minutes: number | null;
  priority: string | null;
  plan_status: string | null;
  plan_generated_at: string | null;
  plan_weeks: number | null;
  peak_weekly_volume_km: number | null;
  training_days_per_week: number | null;
  current_weekly_volume_km: number | null;
  created_at: string;
  updated_at: string;
}

export interface TrainingPlanWeekRow {
  id: string;
  goal_id: string;
  week_number: number;
  phase: string;
  week_start_date: string;
  planned_volume_km: number | null;
  planned_hours: number | null;
  planned_tss: number | null;
  actual_volume_km: number | null;
  actual_hours: number | null;
  actual_tss: number | null;
  compliance_pct: number | null;
}

export interface PlannedWorkoutRow {
  id: string;
  user_id: string;
  goal_id: string | null;
  title: string;
  description: string | null;
  planned_date: string;
  planned_duration_minutes: number | null;
  workout_type: string | null;
  intensity_level: number | null;
  training_phase: string | null;
  distance_km: number | null;
  template_ref: string | null;
  sport: string | null;
  week_number: number | null;
  day_of_week: number | null;
  status: string | null;
  target_tss: number | null;
}

// ============================================================================
// Client setup (same pattern as queries.ts)
// ============================================================================

let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  _client = createClient(url.replace(/^["']|["']$/g, "").trim(), key.replace(/^["']|["']$/g, "").trim(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _client;
}

// ============================================================================
// Scheduled Workout Resolution (Pipeline Bridge)
// ============================================================================

/**
 * Get the planned workout for a specific user + date.
 * Used by the recommendation pipeline to populate DailyConstraints.
 *
 * Resolves multi-goal conflicts by preferring A > B > C priority,
 * then nearest race date within same priority.
 */
export async function getPlannedWorkoutForDate(
  userId: string,
  dateIso: string,
): Promise<ScheduledWorkoutRow | null> {
  const supabase = getClient();

  // Join planned_workouts with goals to get context
  const { data, error } = await supabase
    .from("planned_workouts")
    .select(`
      id,
      template_ref,
      training_phase,
      week_number,
      goal_id,
      sport,
      target_tss,
      goals!inner (
        id,
        title,
        target_date,
        priority,
        plan_status
      )
    `)
    .eq("user_id", userId)
    .eq("planned_date", dateIso)
    .eq("status", "planned")
    .order("planned_date", { ascending: true })
    .limit(10);

  if (error || !data || data.length === 0) {
    return null;
  }

  // Filter to active plans only
  const active = data.filter(
    (row: Record<string, unknown>) => {
      const goals = row.goals as Record<string, unknown> | null;
      return goals && goals.plan_status === "active";
    },
  );

  if (active.length === 0) return null;

  // Sort by priority (A < B < C) then by nearest race date
  const priorityOrder: Record<string, number> = { A: 0, B: 1, C: 2 };
  active.sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
    const goalsA = a.goals as Record<string, unknown>;
    const goalsB = b.goals as Record<string, unknown>;
    const pa = priorityOrder[String(goalsA.priority ?? "C")] ?? 2;
    const pb = priorityOrder[String(goalsB.priority ?? "C")] ?? 2;
    if (pa !== pb) return pa - pb;
    // Same priority: nearest race date first
    const da = String(goalsA.target_date ?? "9999-12-31");
    const db = String(goalsB.target_date ?? "9999-12-31");
    return da.localeCompare(db);
  });

  const winner = active[0] as Record<string, unknown>;
  const goals = winner.goals as Record<string, unknown>;
  const targetDate = String(goals.target_date ?? dateIso);
  const daysUntilRace = Math.max(
    0,
    Math.floor(
      (new Date(targetDate).getTime() - new Date(dateIso).getTime()) /
        (24 * 60 * 60 * 1000),
    ),
  );

  return {
    template_ref: String(winner.template_ref ?? ""),
    goal_id: String(goals.id ?? ""),
    goal_title: String(goals.title ?? ""),
    phase: String(winner.training_phase ?? "base"),
    week_number: Number(winner.week_number ?? 1),
    target_date: targetDate,
    planned_workout_id: String(winner.id ?? ""),
    sport: winner.sport != null ? String(winner.sport) : null,
    target_tss: winner.target_tss != null ? Number(winner.target_tss) : null,
  };
}

// ============================================================================
// Goal CRUD Queries
// ============================================================================

export async function getUserGoals(userId: string): Promise<GoalRow[]> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("goals")
    .select("*")
    .eq("user_id", userId)
    .neq("status", "cancelled")
    .order("target_date", { ascending: true });

  if (error) throw error;
  return (data ?? []) as GoalRow[];
}

export async function getGoalById(
  goalId: string,
  userId: string,
): Promise<GoalRow | null> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("goals")
    .select("*")
    .eq("id", goalId)
    .eq("user_id", userId)
    .single();

  if (error) return null;
  return data as GoalRow;
}

export async function createGoal(
  goal: Partial<GoalRow> & { user_id: string; title: string },
): Promise<GoalRow> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("goals")
    .insert(goal)
    .select()
    .single();

  if (error) throw error;
  return data as GoalRow;
}

export async function updateGoal(
  goalId: string,
  userId: string,
  updates: Partial<GoalRow>,
): Promise<GoalRow> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("goals")
    .update(updates)
    .eq("id", goalId)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw error;
  return data as GoalRow;
}

// ============================================================================
// Training Plan Queries
// ============================================================================

export async function getGoalPlanWeeks(
  goalId: string,
  userId: string,
): Promise<TrainingPlanWeekRow[]> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("training_plan_weeks")
    .select("*")
    .eq("goal_id", goalId)
    .eq("user_id", userId)
    .order("week_number", { ascending: true });

  if (error) throw error;
  return (data ?? []) as TrainingPlanWeekRow[];
}

export async function getPlannedWorkoutsForGoal(
  goalId: string,
  userId: string,
): Promise<PlannedWorkoutRow[]> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("planned_workouts")
    .select("*")
    .eq("goal_id", goalId)
    .eq("user_id", userId)
    .order("planned_date", { ascending: true });

  if (error) throw error;
  return (data ?? []) as PlannedWorkoutRow[];
}

/**
 * Estimate current weekly training volume from the last N weeks of actual workouts.
 */
export async function getRecentWeeklyVolume(
  userId: string,
  weeks: number = 4,
): Promise<number> {
  const supabase = getClient();
  const since = new Date();
  since.setDate(since.getDate() - weeks * 7);
  const sinceIso = since.toISOString();

  const { data, error } = await supabase
    .from("workouts")
    .select("distance_meters")
    .eq("user_id", userId)
    .gte("started_at", sinceIso);

  if (error || !data || data.length === 0) return 0;

  const totalMeters = data.reduce(
    (sum: number, w: Record<string, unknown>) =>
      sum + (Number(w.distance_meters) || 0),
    0,
  );

  // Convert to km and divide by weeks
  return Math.round((totalMeters / 1000 / weeks) * 10) / 10;
}

// ============================================================================
// Bulk insert helpers (for plan generation)
// ============================================================================

export async function insertPlanWeeks(
  rows: Array<{
    user_id: string;
    goal_id: string;
    week_number: number;
    phase: string;
    week_start_date: string;
    planned_volume_km: number;
    planned_hours: number;
  }>,
): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase.from("training_plan_weeks").insert(rows);
  if (error) throw error;
}

export async function insertPlannedWorkouts(
  rows: Array<{
    user_id: string;
    goal_id: string;
    title: string;
    description: string;
    planned_date: string;
    planned_duration_minutes: number;
    workout_type: string;
    intensity_level: number;
    training_phase: string;
    distance_km: number | null;
    template_ref: string;
    sport: string;
    week_number: number;
    day_of_week: number;
    status: string;
  }>,
): Promise<void> {
  const supabase = getClient();
  // Insert in batches of 100 to avoid payload limits
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100);
    const { error } = await supabase.from("planned_workouts").insert(batch);
    if (error) throw error;
  }
}

// ============================================================================
// EWMA Daily Persistence
// ============================================================================

export async function upsertEwmaDaily(
  userId: string,
  dateIso: string,
  fitnessRaw: number,
  fatigueRaw: number,
  dailyTss: number = 0,
  dataDays: number = 0,
): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase.from("ewma_daily").upsert(
    {
      user_id: userId,
      date: dateIso,
      fitness_raw: fitnessRaw,
      fatigue_raw: fatigueRaw,
      form_raw: fitnessRaw - fatigueRaw,
      daily_tss: dailyTss,
      data_days: dataDays,
    },
    { onConflict: "user_id,date" },
  );
  if (error) throw error;
}

/**
 * Latest persisted EWMA state strictly before `beforeDate` — the seed for
 * continuing the recursion without replaying full history. Returns null when
 * no usable row exists (data_days <= 0 rows predate proper persistence and
 * would poison the cold-start flags).
 */
export async function getLatestEwmaState(
  userId: string,
  beforeDate: string,
): Promise<{
  date: string;
  fitness_raw: number;
  fatigue_raw: number;
  data_days: number;
} | null> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("ewma_daily")
    .select("date, fitness_raw, fatigue_raw, data_days")
    .eq("user_id", userId)
    .lt("date", beforeDate)
    .gt("data_days", 0)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return {
    date: String(data.date),
    fitness_raw: Number(data.fitness_raw),
    fatigue_raw: Number(data.fatigue_raw),
    data_days: Number(data.data_days),
  };
}

export async function getEwmaHistory(
  userId: string,
  days: number = 90,
): Promise<Array<{
  date: string;
  fitness_raw: number;
  fatigue_raw: number;
  form_raw: number;
  daily_tss: number;
}>> {
  const supabase = getClient();
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceIso = since.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("ewma_daily")
    .select("date, fitness_raw, fatigue_raw, form_raw, daily_tss")
    .eq("user_id", userId)
    .gte("date", sinceIso)
    .order("date", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Array<{
    date: string;
    fitness_raw: number;
    fatigue_raw: number;
    form_raw: number;
    daily_tss: number;
  }>;
}

// ============================================================================
// Anomaly Log Persistence
// ============================================================================

export interface AnomalyLogRow {
  date: string;
  reason_codes: string[];
  caution_level: string;
  restrictions: string[];
  question_key: string | null;
  resolved: boolean;
}

export async function upsertAnomalyLog(
  userId: string,
  dateIso: string,
  reasonCodes: string[],
  cautionLevel: string,
  restrictions: string[],
  questionKey: string | null,
): Promise<void> {
  const supabase = getClient();
  const isClean = cautionLevel === "none" || reasonCodes.length === 0;
  const { error } = await supabase.from("daily_anomaly_log").upsert(
    {
      user_id: userId,
      date: dateIso,
      reason_codes: reasonCodes,
      caution_level: cautionLevel,
      restrictions,
      question_key: questionKey,
      resolved: isClean,
      resolved_at: isClean ? new Date().toISOString() : null,
    },
    { onConflict: "user_id,date" },
  );
  if (error) throw error;
}

export async function getRecentAnomalyHistory(
  userId: string,
  days: number = 7,
): Promise<AnomalyLogRow[]> {
  const supabase = getClient();
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceIso = since.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("daily_anomaly_log")
    .select("date, reason_codes, caution_level, restrictions, question_key, resolved")
    .eq("user_id", userId)
    .gte("date", sinceIso)
    .order("date", { ascending: false });

  if (error) throw error;
  return (data ?? []) as AnomalyLogRow[];
}

// ============================================================================
// Compliance Matching Queries (Bio-Adaptive Brain)
// ============================================================================

/** Row shape returned by getActualWorkoutsForDate. */
export interface ActualWorkoutRow {
  id: string;
  activity_type: string;
  activity_subtype: string | null;
  duration_seconds: number;
  training_stress_score: number | null;
  intensity_factor: number | null;
  source: string;
}

/**
 * Get all actual workouts for a user on a specific date.
 * Returns fields needed for compliance matching.
 */
export async function getActualWorkoutsForDate(
  userId: string,
  dateIso: string,
): Promise<ActualWorkoutRow[]> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("workouts")
    .select(
      "id, activity_type, activity_subtype, duration_seconds, training_stress_score, intensity_factor, source",
    )
    .eq("user_id", userId)
    .gte("started_at", `${dateIso}T00:00:00Z`)
    .lt("started_at", `${dateIso}T23:59:59Z`);

  if (error) throw error;
  return (data ?? []) as ActualWorkoutRow[];
}

/**
 * Get all planned workouts for a user on a specific date (all goals).
 * Returns full planned workout rows for compliance matching.
 */
export async function getAllPlannedWorkoutsForDate(
  userId: string,
  dateIso: string,
): Promise<PlannedWorkoutRow[]> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("planned_workouts")
    .select("*")
    .eq("user_id", userId)
    .eq("planned_date", dateIso)
    .eq("status", "planned");

  if (error) throw error;
  return (data ?? []) as PlannedWorkoutRow[];
}

/**
 * Update a planned workout with compliance matching results.
 */
export async function updatePlannedWorkoutCompliance(
  plannedWorkoutId: string,
  status: string,
  matchScore: number | null,
  matchedWorkoutId: string | null,
  matchReason: string | null,
): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase
    .from("planned_workouts")
    .update({
      status,
      match_score: matchScore,
      matched_workout_id: matchedWorkoutId,
      match_reason: matchReason,
    })
    .eq("id", plannedWorkoutId);

  if (error) throw error;
}

/**
 * Upsert a daily compliance log entry.
 */
export async function upsertDailyComplianceLog(
  userId: string,
  dateIso: string,
  data: {
    planned_tss: number;
    actual_tss: number;
    surplus_tss: number;
    cross_sport_tss: number;
    transferred_tss: number;
    match_count: number;
    miss_count: number;
    unplanned_count: number;
    avg_match_score: number | null;
    source_breakdown: unknown[];
  },
): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase.from("daily_compliance_log").upsert(
    {
      user_id: userId,
      date: dateIso,
      ...data,
    },
    { onConflict: "user_id,date" },
  );
  if (error) throw error;
}

/** Row shape returned by getDailyComplianceLog. */
export interface DailyComplianceLogRow {
  date: string;
  planned_tss: number;
  actual_tss: number;
  surplus_tss: number;
  cross_sport_tss: number;
  transferred_tss: number;
  match_count: number;
  miss_count: number;
  unplanned_count: number;
  avg_match_score: number | null;
  source_breakdown: unknown[];
}

/**
 * Get the compliance log for a specific user and date.
 */
export async function getDailyComplianceLog(
  userId: string,
  dateIso: string,
): Promise<DailyComplianceLogRow | null> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("daily_compliance_log")
    .select("*")
    .eq("user_id", userId)
    .eq("date", dateIso)
    .single();

  if (error) return null;
  return data as DailyComplianceLogRow;
}

// ============================================================================
// Plan cleanup
// ============================================================================

/**
 * Delete all planned workouts and weeks for a goal (before regenerating).
 */
export async function clearPlanForGoal(
  goalId: string,
  userId: string,
): Promise<void> {
  const supabase = getClient();

  const { error: e1 } = await supabase
    .from("planned_workouts")
    .delete()
    .eq("goal_id", goalId)
    .eq("user_id", userId);
  if (e1) throw e1;

  const { error: e2 } = await supabase
    .from("training_plan_weeks")
    .delete()
    .eq("goal_id", goalId)
    .eq("user_id", userId);
  if (e2) throw e2;
}
