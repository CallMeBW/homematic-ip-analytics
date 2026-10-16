import { berlinParts } from "./time.mjs";
import { bucketMeans, mean, percentile } from "./stats.mjs";

/** Sample gap used only to score summer-like days when detecting season boundaries. */
export const HIBERNATION_GAP = 2.5;
/** Rolling window / run params for apartment-level heating-season onset & offset. */
export const SEASON_SMOOTH_DAYS = 14;
export const SEASON_MIN_RUN = 21;
export const SEASON_MERGE_GAP = 45;
export const SEASON_HIB_FRAC = 0.6;
export const SEASON_GAP_MED = 2.5;

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Detect contiguous heating seasons from apartment daily rows
 * (each row: { date, t, room, actual, setpoint, gap }).
 * Returns [{ start, end, startTs, endTs, days }] — one interval per winter.
 */
export function detectHeatingSeasons(dailyAll) {
  const byDate = new Map();
  for (const r of dailyAll) {
    if (r.setpoint == null || r.gap == null) continue;
    if (!byDate.has(r.date)) byDate.set(r.date, []);
    byDate.get(r.date).push(r);
  }
  const days = [...byDate.entries()]
    .map(([date, rows]) => {
      const gaps = rows.map((r) => r.gap);
      return {
        date,
        t: rows[0].t,
        gapMed: percentile([...gaps].sort((a, b) => a - b), 0.5),
        hibFrac: rows.filter((r) => r.gap > HIBERNATION_GAP).length / rows.length,
        anyChange: rows.some((r) => (r.spDelta ?? 0) >= 0.3),
      };
    })
    .sort((a, b) => a.t - b.t);

  if (days.length < SEASON_SMOOTH_DAYS) return [];

  const scored = days.map((d, i) => {
    const win = days.slice(Math.max(0, i - SEASON_SMOOTH_DAYS + 1), i + 1);
    const hib14 = mean(win.map((x) => x.hibFrac));
    const gap14 = percentile(
      [...win.map((x) => x.gapMed)].sort((a, b) => a - b),
      0.5
    );
    const active = hib14 < SEASON_HIB_FRAC && gap14 < SEASON_GAP_MED;
    return { ...d, hib14, gap14, active };
  });

  const runs = [];
  let runStart = null;
  for (let i = 0; i < scored.length; i++) {
    if (scored[i].active) {
      if (runStart == null) runStart = i;
    } else if (runStart != null) {
      if (i - runStart >= SEASON_MIN_RUN) runs.push([runStart, i - 1]);
      runStart = null;
    }
  }
  if (runStart != null && scored.length - runStart >= SEASON_MIN_RUN) {
    runs.push([runStart, scored.length - 1]);
  }

  const merged = [];
  for (const [a, b] of runs) {
    const last = merged[merged.length - 1];
    if (last && a - last[1] < SEASON_MERGE_GAP) last[1] = b;
    else merged.push([a, b]);
  }

  return merged.map(([a, b]) => ({
    start: scored[a].date,
    end: scored[b].date,
    startTs: scored[a].t,
    endTs: scored[b].t,
    days: b - a + 1,
  }));
}

export function datesInHeatingSeasons(seasons) {
  const set = new Set();
  for (const s of seasons) {
    const start = new Date(`${s.start}T12:00:00Z`);
    const end = new Date(`${s.end}T12:00:00Z`);
    for (let t = start.getTime(); t <= end.getTime(); t += 86_400_000) {
      const d = new Date(t);
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, "0");
      const day = String(d.getUTCDate()).padStart(2, "0");
      set.add(`${y}-${m}-${day}`);
    }
  }
  return set;
}

/** Hour + weekday profiles split by detected heating season vs summer season. */
export function buildSeasonalProfiles(hourlyActual, heatingSeasonDates) {
  const hourBucketsHeating = Array.from({ length: 24 }, () => []);
  const hourBucketsOff = Array.from({ length: 24 }, () => []);
  const dowBucketsHeating = Array.from({ length: 7 }, () => []);
  const dowBucketsOff = Array.from({ length: 7 }, () => []);

  for (const p of hourlyActual) {
    const { hour, dow, dateKey } = berlinParts(p.t);
    const inHeating = heatingSeasonDates.has(dateKey);
    (inHeating ? hourBucketsHeating : hourBucketsOff)[hour].push(p.v);
    (inHeating ? dowBucketsHeating : dowBucketsOff)[dow].push(p.v);
  }

  const mapHour = (buckets) =>
    bucketMeans(buckets).map(({ i, avg, n }) => ({ hour: i, avg, n }));
  const mapDow = (buckets) =>
    bucketMeans(buckets).map(({ i, avg, n }) => ({
      dow: i,
      label: DOW_LABELS[i],
      avg,
      n,
    }));

  return {
    byHourHeating: mapHour(hourBucketsHeating),
    byHourOffSeason: mapHour(hourBucketsOff),
    byWeekdayHeating: mapDow(dowBucketsHeating),
    byWeekdayOffSeason: mapDow(dowBucketsOff),
  };
}
