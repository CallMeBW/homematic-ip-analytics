#!/usr/bin/env node
/**
 * Fetch hourly outdoor weather for München-Stadt (DWD 03379) via Bright Sky.
 *
 * Coverage follows public/data/meta.json (indoor firstTs/lastTs). Re-runs only
 * fill gaps / extend past the last stored hour — safe after new Homematic exports.
 *
 *   npm run weather
 *   npm run weather -- --force   # refetch entire indoor range
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const META_PATH = path.join(ROOT, "public", "data", "meta.json");
const OUT_PATH = path.join(ROOT, "public", "data", "weather.json");

/** Hardcoded: DWD München-Stadt */
const STATION = {
  dwdStationId: "03379",
  name: "München-Stadt",
  lat: 48.1632,
  lon: 11.5429,
  height: 515.37,
  wmoStationId: "10865",
};

const API = "https://api.brightsky.dev/weather";
const TIMEZONE = "Europe/Berlin";
const USER_AGENT = "homematic-ip-analytics/0.1 (+local weather ingest; polite)";

/** Bright Sky allows ~10 req/s; stay well below and keep payloads modest. */
const CHUNK_DAYS = 45;
const REQUEST_GAP_MS = 300;
const MAX_RETRIES = 5;
const RETRY_BASE_MS = 1500;

/** Prefer real observations over model forecasts when hours collide. */
const OBS_TYPE_RANK = {
  historical: 3,
  synop: 2,
  current: 1,
  forecast: 0,
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseArgs(argv) {
  return { force: argv.includes("--force") };
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

/** Calendar YYYY-MM-DD in Europe/Berlin for a unix-ms timestamp. */
function berlinDateStr(ts) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ts));
}

/**
 * Midnight Europe/Berlin for YYYY-MM-DD → UTC ms.
 * Uses a noon UTC probe + offset formatters (DST-safe).
 */
function berlinMidnightUtcMs(yyyyMmDd) {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(probe);
  const get = (type) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  const offsetMs = asUtc - probe.getTime();
  return Date.UTC(y, m - 1, d, 0, 0, 0) - offsetMs;
}

function addDays(yyyyMmDd, days) {
  const t = berlinMidnightUtcMs(yyyyMmDd) + days * 86_400_000 + 12 * 3_600_000;
  return berlinDateStr(t);
}

function dayDiff(a, b) {
  return Math.round((berlinMidnightUtcMs(b) - berlinMidnightUtcMs(a)) / 86_400_000);
}

function loadMeta() {
  if (!fs.existsSync(META_PATH)) {
    throw new Error(`Missing ${META_PATH}. Run npm run ingest first.`);
  }
  const meta = JSON.parse(fs.readFileSync(META_PATH, "utf8"));
  if (meta.firstTs == null || meta.lastTs == null) {
    throw new Error("meta.json has no firstTs/lastTs");
  }
  return meta;
}

function loadExisting() {
  if (!fs.existsSync(OUT_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(OUT_PATH, "utf8"));
  } catch {
    console.warn("Existing weather.json unreadable — refetching.");
    return null;
  }
}

/** Needed half-open range [needStart, needEnd) as Berlin midnights (end = day after last indoor day). */
function neededRange(meta) {
  const needStart = berlinDateStr(meta.firstTs);
  const needEnd = addDays(berlinDateStr(meta.lastTs), 1);
  return { needStart, needEnd };
}

/**
 * Covered half-open [covStart, covEnd) from stored hourly points.
 * Returns null if empty / unusable.
 */
function coveredRange(existing) {
  const hourly = existing?.hourly;
  if (!Array.isArray(hourly) || hourly.length === 0) return null;
  const first = hourly[0]?.t;
  const last = hourly[hourly.length - 1]?.t;
  if (first == null || last == null) return null;
  return {
    covStart: berlinDateStr(first),
    // exclusive end = calendar day after the last hour's Berlin date
    covEnd: addDays(berlinDateStr(last), 1),
  };
}

/** Missing half-open day ranges to fetch. */
function missingRanges(needStart, needEnd, cov, force) {
  if (force || !cov) return [{ start: needStart, end: needEnd }];
  const gaps = [];
  if (needStart < cov.covStart) {
    gaps.push({ start: needStart, end: minDate(needEnd, cov.covStart) });
  }
  if (needEnd > cov.covEnd) {
    gaps.push({ start: maxDate(needStart, cov.covEnd), end: needEnd });
  }
  return gaps.filter((g) => g.start < g.end);
}

function minDate(a, b) {
  return a <= b ? a : b;
}
function maxDate(a, b) {
  return a >= b ? a : b;
}

function chunkRange(start, end) {
  const chunks = [];
  let cur = start;
  while (cur < end) {
    const daysLeft = dayDiff(cur, end);
    const step = Math.min(CHUNK_DAYS, daysLeft);
    const next = addDays(cur, step);
    chunks.push({ start: cur, end: next });
    cur = next;
  }
  return chunks;
}

function toIsoOffset(yyyyMmDd, hour = 0) {
  // Bright Sky accepts offset in the timestamp; we pass Berlin midnight as +01/+02 via timezone param.
  // Using date-only + timezone is enough; for chunk ends we use next midnight date.
  void hour;
  return yyyyMmDd;
}

async function fetchChunk(startDate, endDate) {
  const url = new URL(API);
  url.searchParams.set("dwd_station_id", STATION.dwdStationId);
  url.searchParams.set("date", toIsoOffset(startDate));
  url.searchParams.set("last_date", toIsoOffset(endDate));
  url.searchParams.set("timezone", TIMEZONE);

  let attempt = 0;
  while (true) {
    attempt += 1;
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      },
    });

    if (res.status === 429 || res.status >= 500) {
      if (attempt > MAX_RETRIES) {
        throw new Error(`Bright Sky ${res.status} after ${MAX_RETRIES} retries for ${startDate}→${endDate}`);
      }
      const retryAfter = Number(res.headers.get("retry-after"));
      const wait = Number.isFinite(retryAfter)
        ? retryAfter * 1000
        : RETRY_BASE_MS * 2 ** (attempt - 1);
      console.warn(`  ${res.status} — backing off ${wait}ms (attempt ${attempt}/${MAX_RETRIES})`);
      await sleep(wait);
      continue;
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Bright Sky ${res.status} for ${startDate}→${endDate}: ${body.slice(0, 200)}`);
    }

    return res.json();
  }
}

function sourceRank(sourcesById, sourceId) {
  const type = sourcesById.get(sourceId)?.observation_type ?? "";
  return OBS_TYPE_RANK[type] ?? -1;
}

function normalizeRecords(payload) {
  const sourcesById = new Map((payload.sources ?? []).map((s) => [s.id, s]));
  /** @type {Map<number, { t: number, temp: number|null, humidity: number|null, dewPoint: number|null, precipitation: number|null, sunshine: number|null, pressure: number|null, windSpeed: number|null, condition: string|null, icon: string|null, _rank: number }>} */
  const byTs = new Map();

  for (const w of payload.weather ?? []) {
    const rank = sourceRank(sourcesById, w.source_id);
    if (rank <= 0) continue; // drop forecasts
    const t = Date.parse(w.timestamp);
    if (!Number.isFinite(t)) continue;
    if (w.temperature == null) continue;

    const prev = byTs.get(t);
    if (prev && prev._rank >= rank) continue;

    byTs.set(t, {
      t,
      temp: w.temperature,
      humidity: w.relative_humidity ?? null,
      dewPoint: w.dew_point ?? null,
      precipitation: w.precipitation ?? null,
      sunshine: w.sunshine ?? null,
      pressure: w.pressure_msl ?? null,
      windSpeed: w.wind_speed ?? null,
      condition: w.condition ?? null,
      icon: w.icon ?? null,
      _rank: rank,
    });
  }

  return [...byTs.values()].map(({ _rank, ...row }) => row);
}

function mergeHourly(existing, incoming) {
  const byTs = new Map();
  for (const row of existing ?? []) {
    if (row?.t != null) byTs.set(row.t, row);
  }
  for (const row of incoming) {
    byTs.set(row.t, row);
  }
  return [...byTs.values()].sort((a, b) => a.t - b.t);
}

function buildOutput(meta, hourly, fetchedChunks) {
  const first = hourly[0];
  const last = hourly[hourly.length - 1];
  return {
    meta: {
      fetchedAt: new Date().toISOString(),
      provider: "brightsky",
      api: API,
      timezone: TIMEZONE,
      station: { ...STATION },
      indoor: {
        source: meta.source ?? null,
        firstTs: meta.firstTs,
        lastTs: meta.lastTs,
      },
      coverage: {
        firstTs: first?.t ?? null,
        lastTs: last?.t ?? null,
        firstDate: first ? berlinDateStr(first.t) : null,
        lastDate: last ? berlinDateStr(last.t) : null,
        hours: hourly.length,
      },
      fetch: {
        chunkDays: CHUNK_DAYS,
        chunksThisRun: fetchedChunks,
      },
    },
    hourly,
  };
}

async function main() {
  const { force } = parseArgs(process.argv.slice(2));
  const indoorMeta = loadMeta();
  const { needStart, needEnd } = neededRange(indoorMeta);
  const existing = force ? null : loadExisting();
  const cov = existing ? coveredRange(existing) : null;
  const gaps = missingRanges(needStart, needEnd, cov, force);

  console.log(`Indoor range: ${berlinDateStr(indoorMeta.firstTs)} → ${berlinDateStr(indoorMeta.lastTs)}`);
  console.log(`Needed weather (half-open): ${needStart} → ${needEnd}`);
  if (cov && !force) {
    console.log(`Already have: ${cov.covStart} → ${cov.covEnd} (${existing.hourly.length} hours)`);
  } else if (force) {
    console.log("Force refetch enabled.");
  } else {
    console.log("No existing weather.json — full fetch.");
  }

  if (gaps.length === 0) {
    console.log("Nothing to fetch — already covers the indoor window.");
    return;
  }

  const chunks = gaps.flatMap((g) => chunkRange(g.start, g.end));
  console.log(
    `Fetching ${chunks.length} chunk(s) of ≤${CHUNK_DAYS}d via Bright Sky (${STATION.name} / ${STATION.dwdStationId})…`
  );

  const incoming = [];
  for (let i = 0; i < chunks.length; i++) {
    const { start, end } = chunks[i];
    process.stdout.write(`  [${i + 1}/${chunks.length}] ${start} → ${end} … `);
    const payload = await fetchChunk(start, end);
    const rows = normalizeRecords(payload);
    // Drop the exclusive-end midnight duplicate if present (last_date is inclusive).
    const endMs = berlinMidnightUtcMs(end);
    const kept = rows.filter((r) => r.t >= berlinMidnightUtcMs(start) && r.t < endMs);
    incoming.push(...kept);
    console.log(`${kept.length} hours`);
    if (i < chunks.length - 1) await sleep(REQUEST_GAP_MS);
  }

  const base = force ? [] : existing?.hourly ?? [];
  const hourly = mergeHourly(base, incoming);

  // Trim to needed window (drop stale hours outside indoor pad).
  const trimStart = berlinMidnightUtcMs(needStart);
  const trimEnd = berlinMidnightUtcMs(needEnd);
  const trimmed = hourly.filter((r) => r.t >= trimStart && r.t < trimEnd);

  ensureDir(path.dirname(OUT_PATH));
  const out = buildOutput(indoorMeta, trimmed, chunks.length);
  fs.writeFileSync(OUT_PATH, JSON.stringify(out));
  console.log(
    `Wrote ${OUT_PATH} · ${out.meta.coverage.hours} hours · ${out.meta.coverage.firstDate} → ${out.meta.coverage.lastDate}`
  );
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
