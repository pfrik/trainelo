/**
 * Local intervals.icu backfill / manual sync.
 *
 * Usage:
 *   npx tsx scripts/intervals-backfill.ts                 # last 7 days
 *   npx tsx scripts/intervals-backfill.ts --days 30       # last 30 days
 *   npx tsx scripts/intervals-backfill.ts --days 5 --dry-run
 *
 * Reads SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / INTERVALS_ICU_* from
 * .env.local and TRAINELO_USER_ID from scripts/garmin-sync/.env (falls back
 * to .env.local if set there).
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { runIntervalsSync } from "../src/lib/sync/intervalsSync.js";

config({ path: ".env.local" });
config({ path: "scripts/garmin-sync/.env" });

function getArg(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  if (index === -1 || index + 1 >= process.argv.length) return null;
  return process.argv[index + 1];
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

async function main(): Promise<void> {
  const days = Number(getArg("--days") ?? "7");
  if (!Number.isInteger(days) || days < 1 || days > 365) {
    console.error("--days must be an integer between 1 and 365");
    process.exit(1);
  }
  const dryRun = process.argv.includes("--dry-run");

  const supabaseUrl = requireEnv("SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const athleteId = requireEnv("INTERVALS_ICU_ATHLETE_ID");
  const apiKey = requireEnv("INTERVALS_ICU_API_KEY");
  const userId = requireEnv("TRAINELO_USER_ID");

  const newest = new Date().toISOString().slice(0, 10);
  const oldestDate = new Date();
  oldestDate.setUTCDate(oldestDate.getUTCDate() - days);
  const oldest = oldestDate.toISOString().slice(0, 10);

  console.log(`intervals.icu sync ${oldest} → ${newest}${dryRun ? " (dry run)" : ""}`);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const stats = await runIntervalsSync({
    supabase,
    athleteId,
    apiKey,
    userId,
    oldest,
    newest,
    dryRun,
    log: (message, context) =>
      console.log(`  ${message}${context ? " " + JSON.stringify(context) : ""}`),
  });

  console.log("\nSummary:");
  console.log(`  wellness:   fetched ${stats.wellness.fetched}, upserted ${stats.wellness.upserted}, skipped ${stats.wellness.skipped}`);
  console.log(`  activities: fetched ${stats.activities.fetched}, upserted ${stats.activities.upserted}, deduped ${stats.activities.deduped}, skipped ${stats.activities.skipped}`);
  if (stats.errors.length > 0) {
    console.error(`  errors (${stats.errors.length}):`);
    for (const error of stats.errors) console.error(`    - ${error}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
