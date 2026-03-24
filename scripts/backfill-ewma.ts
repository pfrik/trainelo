/**
 * One-time backfill script: populates ewma_daily from historical training load data.
 *
 * Usage: npx tsx scripts/backfill-ewma.ts
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.
 */

import { createClient } from "@supabase/supabase-js";
import { computeEwmaTimeSeries } from "../src/lib/core/recommendations/computeEwmaTimeSeries.js";
import type { DailyTssEntry } from "../src/lib/core/recommendations/computeEwma.js";

const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/^["']|["']$/g, "").trim();
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.replace(/^["']|["']$/g, "").trim();

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log("Fetching all users with training data...");

  // Get distinct user IDs from workouts
  const { data: users, error: usersErr } = await supabase
    .from("workouts")
    .select("user_id")
    .limit(1000);

  if (usersErr) {
    console.error("Failed to fetch users:", usersErr.message);
    process.exit(1);
  }

  const userIds = [...new Set((users ?? []).map((r: { user_id: string }) => r.user_id))];
  console.log(`Found ${userIds.length} user(s) with workout data`);

  for (const userId of userIds) {
    console.log(`\nProcessing user ${userId}...`);

    // Fetch ALL training load history (no 63-day limit)
    const { data: loadRows, error: loadErr } = await supabase
      .from("daily_training_load")
      .select("date, total_tss")
      .eq("user_id", userId)
      .order("date", { ascending: true });

    if (loadErr) {
      console.error(`  Failed to fetch training load: ${loadErr.message}`);
      continue;
    }

    if (!loadRows || loadRows.length === 0) {
      console.log("  No training load data, skipping");
      continue;
    }

    // Aggregate by date (multiple sources per day)
    const byDate = new Map<string, number>();
    for (const row of loadRows) {
      const d = String(row.date);
      byDate.set(d, (byDate.get(d) ?? 0) + (Number(row.total_tss) || 0));
    }

    const dailyTss: DailyTssEntry[] = Array.from(byDate.entries()).map(
      ([date, total_tss]) => ({ date, total_tss }),
    );

    const dates = dailyTss.map((d) => d.date).sort();
    const startDate = dates[0];
    const endDate = new Date().toISOString().slice(0, 10);

    console.log(`  Date range: ${startDate} → ${endDate} (${dailyTss.length} training days)`);

    // Compute time series
    const series = computeEwmaTimeSeries(dailyTss, startDate, endDate);
    console.log(`  Computed ${series.length} daily EWMA points`);

    // Bulk upsert in batches
    const rows = series.map((pt) => ({
      user_id: userId,
      date: pt.date,
      fitness_raw: pt.fitness,
      fatigue_raw: pt.fatigue,
      form_raw: pt.form,
      daily_tss: pt.tss,
      data_days: series.indexOf(pt) + 1,
    }));

    let inserted = 0;
    const BATCH = 200;
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const { error: insertErr } = await supabase
        .from("ewma_daily")
        .upsert(batch, { onConflict: "user_id,date" });

      if (insertErr) {
        console.error(`  Batch insert error at offset ${i}: ${insertErr.message}`);
      } else {
        inserted += batch.length;
      }
    }

    console.log(`  Inserted/updated ${inserted} rows`);
  }

  console.log("\nBackfill complete.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
