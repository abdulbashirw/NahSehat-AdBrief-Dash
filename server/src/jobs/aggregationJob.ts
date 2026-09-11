/**
 * Aggregation Job — scheduled background task that periodically
 * aggregates raw access_logs + login_sessions into the pre-aggregated
 * summary tables (user_activity_daily, user_activity_hourly,
 * module_access_summary).
 *
 * Schedule:
 *   - Runs every 1 hour (aggregates today's data)
 *   - Runs once on startup (aggregates today, catches up any gap)
 *
 * The job is non-blocking — errors are logged but never crash the server.
 * The aggregation itself is idempotent (uses ON DUPLICATE KEY UPDATE),
 * so re-running for the same date is safe.
 */
import { runAggregation } from '../models/activityModel';

const AGGREGATION_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

let intervalHandle: NodeJS.Timeout | null = null;
let isRunning = false;

/**
 * Run aggregation for today.
 * Called by the scheduler and on startup.
 */
async function aggregateToday(): Promise<void> {
  if (isRunning) {
    console.log('[aggregationJob] Already running — skipping this cycle');
    return;
  }

  isRunning = true;
  // Use local date to avoid UTC off-by-one (toISOString shifts to UTC)
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const startedAt = Date.now();

  try {
    console.log(`[aggregationJob] Aggregating data for ${today}...`);
    const results = await runAggregation(today, today);

    if (results.length > 0) {
      const r = results[0];
      console.log(
        `[aggregationJob] ✅ Done in ${Date.now() - startedAt}ms — ` +
          `daily: ${r.dailyRows}, hourly: ${r.hourlyRows}, module: ${r.moduleRows}`,
      );
    } else {
      console.log(`[aggregationJob] ✅ Done in ${Date.now() - startedAt}ms — no data for ${today}`);
    }
  } catch (err) {
    console.error(`[aggregationJob] Failed for ${today}`);
  } finally {
    isRunning = false;
  }
}

/**
 * Start the scheduled aggregation job.
 * Call once during server startup (after DB connection is established).
 */
export function startAggregationJob(): void {
  // Run once on startup (after a short delay to let the server fully boot)
  setTimeout(() => {
    aggregateToday().catch(() => {});
  }, 10_000);

  // Schedule recurring aggregation every hour
  intervalHandle = setInterval(() => {
    aggregateToday().catch(() => {});
  }, AGGREGATION_INTERVAL_MS);

  console.log(`[aggregationJob] Scheduled — runs every ${AGGREGATION_INTERVAL_MS / 60000} min + once on startup`);
}

/**
 * Stop the scheduled aggregation job (for graceful shutdown / tests).
 */
export function stopAggregationJob(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log('[aggregationJob] Stopped');
  }
}