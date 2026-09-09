/**
 * Backfill Aggregation Script — one-time script that aggregates ALL
 * historical access_logs + login_sessions into the summary tables.
 *
 * Usage:
 *   npx tsx src/scripts/backfill-aggregation.ts
 *
 * What it does:
 *   1. Finds the earliest and latest dates in access_logs
 *   2. Iterates day-by-day from earliest → latest
 *   3. Calls runAggregation() for each date
 *   4. Prints a progress bar + final summary
 *
 * Safe to re-run — aggregation is idempotent (ON DUPLICATE KEY UPDATE).
 */
import dotenv from 'dotenv';
dotenv.config();

import { pool } from '../models/db';
import { runAggregation } from '../models/activityModel';

async function backfill(): Promise<void> {
  console.log('═'.repeat(70));
  console.log('  Activity Aggregation Backfill — historical data');
  console.log('═'.repeat(70));

  // 1. Find date range in access_logs
  const [[rangeRow]] = await pool.query<any[]>(
    `SELECT
       DATE(MIN(created_at)) AS earliest,
       DATE(MAX(created_at)) AS latest,
       COUNT(*)             AS total_logs
     FROM access_logs`,
  );

  if (!rangeRow || !rangeRow.earliest) {
    console.log('\n⚠️  No access_logs found — nothing to backfill.');
    process.exit(0);
  }

  // MySQL DATE() may return a Date object (depending on driver config).
  // Convert to "YYYY-MM-DD" string safely, avoiding UTC off-by-one.
  const toDateString = (val: any): string => {
    if (val instanceof Date) {
      return `${val.getFullYear()}-${String(val.getMonth() + 1).padStart(2, '0')}-${String(val.getDate()).padStart(2, '0')}`;
    }
    return String(val);
  };

  const earliestStr: string = toDateString(rangeRow.earliest);
  const latestStr: string = toDateString(rangeRow.latest);
  const totalLogs: number = rangeRow.total_logs;

  // Build a list of dates from earliest → latest (inclusive)
  const dates: string[] = [];
  const cur = new Date(earliestStr + 'T00:00:00');
  const end = new Date(latestStr + 'T00:00:00');
  const msPerDay = 24 * 60 * 60 * 1000;
  for (let t = cur.getTime(); t <= end.getTime(); t += msPerDay) {
    const dt = new Date(t);
    dates.push(
      `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`,
    );
  }
  const totalDays = dates.length;

  console.log(`\n  Date range:   ${earliestStr} → ${latestStr}`);
  console.log(`  Total days:   ${totalDays}`);
  console.log(`  Total logs:   ${totalLogs}`);
  console.log('');

  // 2. Iterate day-by-day
  let processed = 0;
  let totalDaily = 0;
  let totalHourly = 0;
  let totalModule = 0;
  let failedDays = 0;
  const errors: string[] = [];

  for (const dateStr of dates) {
    processed++;

    try {
      const results = await runAggregation(dateStr, dateStr);
      if (results.length > 0) {
        totalDaily += results[0].dailyRows;
        totalHourly += results[0].hourlyRows;
        totalModule += results[0].moduleRows;
      }
    } catch (err) {
      failedDays++;
      errors.push(`${dateStr}: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Progress bar (every day or every 10 days if large)
    const pct = Math.round((processed / totalDays) * 100);
    const barLen = 40;
    const filled = Math.round((pct / 100) * barLen);
    const bar = '█'.repeat(filled) + '░'.repeat(barLen - filled);
    process.stdout.write(`\r  Progress: [${bar}] ${pct}%  (${processed}/${totalDays} days)`);
  }

  console.log('\n');
  console.log('─'.repeat(70));
  console.log('  BACKFILL COMPLETE');
  console.log('─'.repeat(70));
  console.log(`  Days processed:    ${processed}`);
  console.log(`  Days failed:       ${failedDays}`);
  console.log(`  Daily rows:        ${totalDaily}`);
  console.log(`  Hourly rows:       ${totalHourly}`);
  console.log(`  Module rows:       ${totalModule}`);

  if (errors.length > 0) {
    console.log(`\n  ⚠️  Errors (${errors.length}):`);
    errors.slice(0, 10).forEach((e) => console.log(`    - ${e}`));
    if (errors.length > 10) console.log(`    ... and ${errors.length - 10} more`);
  }

  // 3. Verify results
  const [[dailyCount]] = await pool.query<any[]>(
    'SELECT COUNT(*) AS total, COUNT(DISTINCT activity_date) AS days FROM user_activity_daily',
  );
  const [[hourlyCount]] = await pool.query<any[]>(
    'SELECT COUNT(*) AS total FROM user_activity_hourly',
  );
  const [[moduleCount]] = await pool.query<any[]>(
    'SELECT COUNT(*) AS total FROM module_access_summary WHERE total_access > 0',
  );

  console.log('');
  console.log('  Verification:');
  console.log(`    user_activity_daily:    ${dailyCount.total} rows across ${dailyCount.days} days`);
  console.log(`    user_activity_hourly:   ${hourlyCount.total} rows`);
  console.log(`    module_access_summary:  ${moduleCount.total} rows with access > 0`);
  console.log('');

  process.exit(0);
}

backfill().catch((err) => {
  console.error('\n❌ Backfill failed:', err);
  process.exit(1);
});