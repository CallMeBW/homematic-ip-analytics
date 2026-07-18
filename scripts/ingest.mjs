#!/usr/bin/env node
/**
 * Homematic IP export ingest
 * Drop a new HmIP_Export*.zip into data/ (or extract CSVs into data/raw/),
 * then run: npm run ingest
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import Papa from "papaparse";

const require = createRequire(import.meta.url);
const AdmZip = require("adm-zip");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATA = path.join(ROOT, "data");
const RAW = path.join(DATA, "raw");
const OUT = path.join(ROOT, "public", "data");

const ROOM_ORDER = ["Wohnzimmer", "Schlafzimmer", "Büro", "Bad"];
const ROOM_COLORS = {
  Wohnzimmer: "#e07a3d",
  Schlafzimmer: "#2f6f8f",
  Büro: "#3d8b6e",
  Bad: "#8b5a9e",
};

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function findZip() {
  if (!fs.existsSync(DATA)) return null;
  const zips = fs
    .readdirSync(DATA)
    .filter((f) => f.toLowerCase().endsWith(".zip"))
    .map((f) => ({
      name: f,
      mtime: fs.statSync(path.join(DATA, f)).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime);
  return zips[0] ? path.join(DATA, zips[0].name) : null;
}

function extractZipIfNeeded() {
  const zipPath = findZip();
  if (!zipPath) {
    if (!fs.existsSync(RAW) || fs.readdirSync(RAW).filter((f) => f.endsWith(".csv")).length === 0) {
      throw new Error(
        "No zip in data/ and no CSVs in data/raw/. Place a Homematic IP export zip in data/."
      );
    }
    console.log("Using existing CSVs in data/raw/");
    return path.basename(RAW);
  }
  console.log(`Extracting ${path.basename(zipPath)}…`);
  ensureDir(RAW);
  for (const f of fs.readdirSync(RAW)) {
    fs.unlinkSync(path.join(RAW, f));
  }
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(RAW, true);
  return path.basename(zipPath);
}

function parseCsvFile(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const parsed = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });
  const points = [];
  let gaps = 0;
  for (const row of parsed.data) {
    const ts = Number(row["Time stamp"]);
    const rawVal = row.Value;
    const room = (row.Room || "").replace(/^"|"$/g, "");
    const category = (row.Category || "").replace(/^"|"$/g, "");
    const gapType = row["Data gap type"];
    if (gapType && String(gapType).trim() !== "") gaps += 1;
    if (!Number.isFinite(ts) || rawVal === "" || rawVal == null) continue;
    const value = Number(String(rawVal).replace(",", "."));
    if (!Number.isFinite(value)) continue;
    points.push({ t: ts, v: value, room, category });
  }
  points.sort((a, b) => a.t - b.t);
  return { points, gaps, room: points[0]?.room, category: points[0]?.category };
}

/** Average values into fixed-width buckets */
function bucketAverage(points, bucketMs) {
  if (!points.length) return [];
  const map = new Map();
  for (const p of points) {
    const key = Math.floor(p.t / bucketMs) * bucketMs;
    let b = map.get(key);
    if (!b) {
      b = { t: key, sum: 0, n: 0, min: p.v, max: p.v };
      map.set(key, b);
    }
    b.sum += p.v;
    b.n += 1;
    if (p.v < b.min) b.min = p.v;
    if (p.v > b.max) b.max = p.v;
  }
  return [...map.values()]
    .sort((a, b) => a.t - b.t)
    .map((b) => ({ t: b.t, v: +(b.sum / b.n).toFixed(3), min: b.min, max: b.max, n: b.n }));
}

/** Largest-Triangle-Three-Buckets downsampling for display series */
function lttb(data, threshold) {
  if (data.length <= threshold) return data.map((d) => ({ t: d.t, v: d.v }));
  const sampled = [];
  const bucketSize = (data.length - 2) / (threshold - 2);
  let a = 0;
  sampled.push({ t: data[0].t, v: data[0].v });
  for (let i = 0; i < threshold - 2; i++) {
    const rangeStart = Math.floor((i + 1) * bucketSize) + 1;
    const rangeEnd = Math.min(Math.floor((i + 2) * bucketSize) + 1, data.length);
    const rangeAvgX =
      data.slice(rangeStart, rangeEnd).reduce((s, d) => s + d.t, 0) /
      Math.max(1, rangeEnd - rangeStart);
    const rangeAvgY =
      data.slice(rangeStart, rangeEnd).reduce((s, d) => s + d.v, 0) /
      Math.max(1, rangeEnd - rangeStart);
    const pointStart = Math.floor(i * bucketSize) + 1;
    const pointEnd = Math.min(Math.floor((i + 1) * bucketSize) + 1, data.length);
    let maxArea = -1;
    let nextA = pointStart;
    const pointAx = data[a].t;
    const pointAy = data[a].v;
    for (let j = pointStart; j < pointEnd; j++) {
      const area =
        Math.abs(
          (pointAx - rangeAvgX) * (data[j].v - pointAy) -
            (pointAx - data[j].t) * (rangeAvgY - pointAy)
        ) * 0.5;
      if (area > maxArea) {
        maxArea = area;
        nextA = j;
      }
    }
    sampled.push({ t: data[nextA].t, v: data[nextA].v });
    a = nextA;
  }
  sampled.push({ t: data[data.length - 1].t, v: data[data.length - 1].v });
  return sampled;
}

function mean(arr) {
  if (!arr.length) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stddev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1));
}

function percentile(sorted, p) {
  if (!sorted.length) return null;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] * (hi - idx) + sorted[hi] * (idx - lo);
}

function berlinParts(ms) {
  const d = new Date(ms);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(d);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  const year = get("year");
  const month = get("month");
  const day = get("day");
  const hour = Number(get("hour"));
  const weekday = get("weekday"); // Mon, Tue, …
  const dateKey = `${year}-${month}-${day}`;
  const monthKey = `${year}-${month}`;
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
    // en-GB weekday short can be Mon etc — map via date in Berlin midday
    weekday === "Sun"
      ? "Sun"
      : weekday
  );
  // More reliable DOW via noon UTC offset trick
  const noonGuess = Date.parse(`${dateKey}T12:00:00+01:00`);
  const dowNum = new Date(
    new Date(ms).toLocaleString("en-US", { timeZone: "Europe/Berlin" })
  ).getDay();
  return { dateKey, monthKey, hour, dow: dowNum, year: Number(year), month: Number(month) };
}

function alignSeries(actual, setpoint, toleranceMs = 15 * 60 * 1000) {
  // For each actual point, find nearest setpoint within tolerance (setpoints change rarely)
  if (!actual.length || !setpoint.length) return [];
  const sp = setpoint;
  let j = 0;
  const out = [];
  for (const a of actual) {
    while (j < sp.length - 1 && Math.abs(sp[j + 1].t - a.t) <= Math.abs(sp[j].t - a.t)) j++;
    // Hold last known setpoint (forward-fill style): find latest sp.t <= a.t
    let k = j;
    while (k < sp.length - 1 && sp[k + 1].t <= a.t) k++;
    while (k > 0 && sp[k].t > a.t) k--;
    const s = sp[k];
    if (Math.abs(s.t - a.t) > 24 * 60 * 60 * 1000 && s.t > a.t) continue;
    out.push({ t: a.t, actual: a.v, setpoint: s.v, gap: +(a.v - s.v).toFixed(3) });
  }
  return out;
}

function detectSetpointChanges(setpoint, minDelta = 0.15) {
  const events = [];
  for (let i = 1; i < setpoint.length; i++) {
    const delta = setpoint[i].v - setpoint[i - 1].v;
    if (Math.abs(delta) >= minDelta) {
      events.push({
        t: setpoint[i].t,
        from: setpoint[i - 1].v,
        to: setpoint[i].v,
        delta: +delta.toFixed(2),
      });
    }
  }
  return events;
}

function estimateHeatUpEvents(aligned, changes) {
  // After a setpoint increase of >=0.5°C, measure time until actual reaches within 0.3 of new setpoint
  const results = [];
  for (const ch of changes) {
    if (ch.delta < 0.5) continue;
    const startIdx = aligned.findIndex((p) => p.t >= ch.t);
    if (startIdx < 0) continue;
    const target = ch.to - 0.3;
    let reached = null;
    for (let i = startIdx; i < aligned.length; i++) {
      if (aligned[i].t - ch.t > 6 * 60 * 60 * 1000) break;
      if (aligned[i].actual >= target) {
        reached = aligned[i].t;
        break;
      }
    }
    if (reached) {
      results.push({
        t: ch.t,
        minutes: Math.round((reached - ch.t) / 60000),
        from: ch.from,
        to: ch.to,
      });
    }
  }
  return results;
}

function buildHistogram(values, binWidth = 0.5) {
  if (!values.length) return [];
  const min = Math.floor(Math.min(...values) / binWidth) * binWidth;
  const max = Math.ceil(Math.max(...values) / binWidth) * binWidth;
  const bins = [];
  for (let x = min; x < max + binWidth / 2; x += binWidth) {
    bins.push({ x: +x.toFixed(2), count: 0 });
  }
  for (const v of values) {
    const idx = Math.min(bins.length - 1, Math.floor((v - min) / binWidth));
    bins[idx].count += 1;
  }
  return bins;
}

function main() {
  const sourceName = extractZipIfNeeded();
  ensureDir(OUT);
  ensureDir(path.join(OUT, "rooms"));

  const csvFiles = fs.readdirSync(RAW).filter((f) => f.toLowerCase().endsWith(".csv"));
  if (!csvFiles.length) throw new Error("No CSV files found after extract.");

  /** @type {Record<string, { actual: any[], setpoint: any[], gaps: number }>} */
  const byRoom = {};

  for (const file of csvFiles) {
    console.log(`Parsing ${file}…`);
    const { points, gaps, room, category } = parseCsvFile(path.join(RAW, file));
    if (!room) {
      console.warn(`  skip (no room): ${file}`);
      continue;
    }
    if (!byRoom[room]) byRoom[room] = { actual: [], setpoint: [], gaps: 0 };
    byRoom[room].gaps += gaps;
    if (category === "valveActualTemperature") byRoom[room].actual = points;
    else if (category === "setPointTemperature") byRoom[room].setpoint = points;
    else console.warn(`  unknown category ${category}`);
  }

  const rooms = Object.keys(byRoom).sort(
    (a, b) => (ROOM_ORDER.indexOf(a) === -1 ? 99 : ROOM_ORDER.indexOf(a)) - (ROOM_ORDER.indexOf(b) === -1 ? 99 : ROOM_ORDER.indexOf(b))
  );

  const HOUR = 60 * 60 * 1000;
  const DAY = 24 * HOUR;

  const roomSummaries = [];
  const dailyAll = [];
  const monthlyAll = [];
  const hourProfile = {}; // room -> 24 avg
  const weekdayProfile = {}; // room -> 7 avg
  const distributions = {};
  const heatmap = {}; // room -> [{date, avg, min, max}]
  const funFacts = [];
  const setpointEventsByRoom = {};
  const heatUpByRoom = {};
  let globalMinT = Infinity;
  let globalMaxT = -Infinity;
  let globalMinPoint = null;
  let globalMaxPoint = null;
  let totalRawPoints = 0;

  // Cross-room daily map for correlation
  const dailyByRoom = {};

  for (const room of rooms) {
    const { actual, setpoint } = byRoom[room];
    totalRawPoints += actual.length + setpoint.length;
    console.log(`Analyzing ${room}: ${actual.length} actual, ${setpoint.length} setpoint`);

    const hourlyActual = bucketAverage(actual, HOUR);
    const hourlySetpoint = bucketAverage(setpoint, HOUR);
    const dailyActual = bucketAverage(actual, DAY);
    const dailySetpoint = bucketAverage(setpoint, DAY);
    const aligned = alignSeries(hourlyActual, hourlySetpoint);
    const changes = detectSetpointChanges(
      setpoint.filter((_, i, arr) => i === 0 || Math.abs(arr[i].v - arr[i - 1].v) >= 0.05)
    );
    // Deduplicate rapid identical changes from raw
    const significantChanges = [];
    for (const ch of changes) {
      const last = significantChanges[significantChanges.length - 1];
      if (!last || Math.abs(ch.to - last.to) >= 0.15 || ch.t - last.t > HOUR) {
        significantChanges.push(ch);
      }
    }
    const heatUps = estimateHeatUpEvents(aligned, significantChanges);

    const vals = actual.map((p) => p.v);
    const sorted = [...vals].sort((a, b) => a - b);
    const avg = mean(vals);
    const sd = stddev(vals);
    const minV = sorted[0];
    const maxV = sorted[sorted.length - 1];
    const minPt = actual.reduce((best, p) => (p.v < best.v ? p : best), actual[0]);
    const maxPt = actual.reduce((best, p) => (p.v > best.v ? p : best), actual[0]);

    if (minPt.v < globalMinT) {
      globalMinT = minPt.v;
      globalMinPoint = { room, ...minPt };
    }
    if (maxPt.v > globalMaxT) {
      globalMaxT = maxPt.v;
      globalMaxPoint = { room, ...maxPt };
    }

    const comfortLow = 20;
    const comfortHigh = 22.5;
    const comfortCount = vals.filter((v) => v >= comfortLow && v <= comfortHigh).length;
    const comfortPct = (100 * comfortCount) / vals.length;

    const underheat = aligned.filter((p) => p.gap < -0.5).length;
    const overheat = aligned.filter((p) => p.gap > 0.5).length;
    const underPct = aligned.length ? (100 * underheat) / aligned.length : 0;
    const overPct = aligned.length ? (100 * overheat) / aligned.length : 0;
    const avgGap = mean(aligned.map((p) => p.gap));

    // Night (23–6) vs day (9–17) averages
    const nightVals = [];
    const dayVals = [];
    const hourBuckets = Array.from({ length: 24 }, () => []);
    const dowBuckets = Array.from({ length: 7 }, () => []);

    for (const p of hourlyActual) {
      const { hour, dow } = berlinParts(p.t);
      hourBuckets[hour].push(p.v);
      dowBuckets[dow].push(p.v);
      if (hour >= 23 || hour < 6) nightVals.push(p.v);
      if (hour >= 9 && hour <= 17) dayVals.push(p.v);
    }

    const byHour = hourBuckets.map((arr, hour) => ({
      hour,
      avg: arr.length ? +mean(arr).toFixed(2) : null,
      n: arr.length,
    }));
    const byWeekday = dowBuckets.map((arr, dow) => ({
      dow,
      label: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dow],
      avg: arr.length ? +mean(arr).toFixed(2) : null,
      n: arr.length,
    }));

    hourProfile[room] = byHour;
    weekdayProfile[room] = byWeekday;

    const coldestHour = byHour.filter((h) => h.avg != null).sort((a, b) => a.avg - b.avg)[0];
    const warmestHour = byHour.filter((h) => h.avg != null).sort((a, b) => b.avg - a.avg)[0];

    const monthMap = new Map();
    for (const p of dailyActual) {
      const { monthKey, dateKey } = berlinParts(p.t);
      if (!monthMap.has(monthKey)) monthMap.set(monthKey, []);
      monthMap.get(monthKey).push(p.v);

      dailyAll.push({
        t: p.t,
        date: dateKey,
        room,
        actual: +p.v.toFixed(2),
        min: +p.min.toFixed(2),
        max: +p.max.toFixed(2),
      });
    }

    // Attach daily setpoint avg
    const spDailyMap = new Map(dailySetpoint.map((p) => [berlinParts(p.t).dateKey, p.v]));
    for (const row of dailyAll.filter((d) => d.room === room)) {
      if (spDailyMap.has(row.date)) row.setpoint = +spDailyMap.get(row.date).toFixed(2);
    }

    const monthly = [...monthMap.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([month, arr]) => ({
        month,
        room,
        avg: +mean(arr).toFixed(2),
        min: +Math.min(...arr).toFixed(2),
        max: +Math.max(...arr).toFixed(2),
      }));
    monthlyAll.push(...monthly);

    const heatDays = dailyActual.map((d) => {
      const { dateKey } = berlinParts(d.t);
      return {
        date: dateKey,
        t: d.t,
        avg: +d.v.toFixed(2),
        min: +d.min.toFixed(2),
        max: +d.max.toFixed(2),
        range: +(d.max - d.min).toFixed(2),
      };
    });
    heatmap[room] = heatDays;
    dailyByRoom[room] = Object.fromEntries(heatDays.map((d) => [d.date, d.avg]));

    distributions[room] = buildHistogram(vals, 0.5);

    const avgHeatUp =
      heatUps.length > 0 ? Math.round(mean(heatUps.map((h) => h.minutes))) : null;

    const displaySeries = {
      actual: lttb(hourlyActual, 800),
      setpoint: lttb(hourlySetpoint, 400),
      gap: lttb(
        aligned.map((p) => ({ t: p.t, v: p.gap })),
        600
      ),
    };

    const recentCutoff = Date.now() - 90 * DAY;
    const recentHourly = {
      actual: hourlyActual.filter((p) => p.t >= recentCutoff).map((p) => ({ t: p.t, v: +p.v.toFixed(2) })),
      setpoint: hourlySetpoint
        .filter((p) => p.t >= recentCutoff)
        .map((p) => ({ t: p.t, v: +p.v.toFixed(2) })),
    };

    fs.writeFileSync(
      path.join(OUT, "rooms", `${slug(room)}.json`),
      JSON.stringify({
        room,
        color: ROOM_COLORS[room] || "#666",
        series: displaySeries,
        recentHourly,
        daily: heatDays,
        byHour,
        byWeekday,
        setpointChanges: significantChanges.slice(-200),
        heatUps: heatUps.slice(-50),
      })
    );

    roomSummaries.push({
      room,
      color: ROOM_COLORS[room] || "#666",
      slug: slug(room),
      points: actual.length,
      setpointPoints: setpoint.length,
      gaps: byRoom[room].gaps,
      avg: +avg.toFixed(2),
      stddev: +sd.toFixed(2),
      min: minV,
      max: maxV,
      p10: +percentile(sorted, 0.1).toFixed(2),
      p50: +percentile(sorted, 0.5).toFixed(2),
      p90: +percentile(sorted, 0.9).toFixed(2),
      minAt: minPt.t,
      maxAt: maxPt.t,
      comfortPct: +comfortPct.toFixed(1),
      underheatPct: +underPct.toFixed(1),
      overheatPct: +overPct.toFixed(1),
      avgGap: avgGap != null ? +avgGap.toFixed(2) : null,
      nightAvg: nightVals.length ? +mean(nightVals).toFixed(2) : null,
      dayAvg: dayVals.length ? +mean(dayVals).toFixed(2) : null,
      nightDayDelta:
        nightVals.length && dayVals.length
          ? +(mean(dayVals) - mean(nightVals)).toFixed(2)
          : null,
      coldestHour: coldestHour?.hour ?? null,
      warmestHour: warmestHour?.hour ?? null,
      coldestHourAvg: coldestHour?.avg ?? null,
      warmestHourAvg: warmestHour?.avg ?? null,
      setpointChanges: significantChanges.length,
      avgHeatUpMinutes: avgHeatUp,
      firstTs: actual[0]?.t,
      lastTs: actual[actual.length - 1]?.t,
    });

    setpointEventsByRoom[room] = significantChanges.length;
    heatUpByRoom[room] = avgHeatUp;

    funFacts.push({
      id: `${slug(room)}-coldest`,
      icon: "snowflake",
      title: `Coldest in ${room}`,
      text: `${minV.toFixed(1)}°C on ${fmtDate(minPt.t)}`,
      value: minV,
      room,
    });
    funFacts.push({
      id: `${slug(room)}-warmest`,
      icon: "sun",
      title: `Warmest in ${room}`,
      text: `${maxV.toFixed(1)}°C on ${fmtDate(maxPt.t)}`,
      value: maxV,
      room,
    });
    if (coldestHour && warmestHour) {
      funFacts.push({
        id: `${slug(room)}-diurnal`,
        icon: "clock",
        title: `${room} daily rhythm`,
        text: `Coldest around ${coldestHour.hour}:00 (${coldestHour.avg}°C), warmest around ${warmestHour.hour}:00 (${warmestHour.avg}°C)`,
        room,
      });
    }
    if (avgHeatUp != null) {
      funFacts.push({
        id: `${slug(room)}-heatup`,
        icon: "flame",
        title: `${room} heat-up time`,
        text: `After raising the setpoint, it takes ~${avgHeatUp} min on average to catch up`,
        value: avgHeatUp,
        room,
      });
    }
  }

  // Correlations between rooms (daily averages)
  const correlations = [];
  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < rooms.length; j++) {
      const a = rooms[i];
      const b = rooms[j];
      const dates = Object.keys(dailyByRoom[a]).filter((d) => dailyByRoom[b][d] != null);
      const xs = dates.map((d) => dailyByRoom[a][d]);
      const ys = dates.map((d) => dailyByRoom[b][d]);
      correlations.push({
        a,
        b,
        r: +pearson(xs, ys).toFixed(3),
        n: dates.length,
      });
    }
  }
  correlations.sort((x, y) => Math.abs(y.r) - Math.abs(x.r));

  // Apartment-wide daily mean
  const dateRooms = new Map();
  for (const row of dailyAll) {
    if (!dateRooms.has(row.date)) dateRooms.set(row.date, { t: row.t, date: row.date, rooms: {} });
    dateRooms.get(row.date).rooms[row.room] = row.actual;
  }
  const apartmentDaily = [...dateRooms.values()]
    .map((d) => {
      const vals = Object.values(d.rooms);
      return {
        t: d.t,
        date: d.date,
        avg: +mean(vals).toFixed(2),
        min: +Math.min(...vals).toFixed(2),
        max: +Math.max(...vals).toFixed(2),
        spread: +(Math.max(...vals) - Math.min(...vals)).toFixed(2),
        rooms: d.rooms,
      };
    })
    .sort((a, b) => a.t - b.t);

  const widestDay = apartmentDaily.reduce((best, d) => (d.spread > best.spread ? d : best), apartmentDaily[0]);
  const tightestDay = apartmentDaily.reduce((best, d) => (d.spread < best.spread ? d : best), apartmentDaily[0]);
  const coldestDay = apartmentDaily.reduce((best, d) => (d.avg < best.avg ? d : best), apartmentDaily[0]);
  const warmestDay = apartmentDaily.reduce((best, d) => (d.avg > best.avg ? d : best), apartmentDaily[0]);

  const warmestRoom = [...roomSummaries].sort((a, b) => b.avg - a.avg)[0];
  const coldestRoom = [...roomSummaries].sort((a, b) => a.avg - b.avg)[0];
  const mostStable = [...roomSummaries].sort((a, b) => a.stddev - b.stddev)[0];
  const mostVolatile = [...roomSummaries].sort((a, b) => b.stddev - a.stddev)[0];
  const biggestSetback = [...roomSummaries]
    .filter((r) => r.nightDayDelta != null)
    .sort((a, b) => b.nightDayDelta - a.nightDayDelta)[0];

  funFacts.unshift(
    {
      id: "span",
      icon: "calendar",
      title: "Observation window",
      text: `${fmtDate(Math.min(...roomSummaries.map((r) => r.firstTs)))} → ${fmtDate(Math.max(...roomSummaries.map((r) => r.lastTs)))} · ${totalRawPoints.toLocaleString("de-DE")} raw samples`,
    },
    {
      id: "global-cold",
      icon: "snowflake",
      title: "Apartment record low",
      text: `${globalMinPoint.v.toFixed(1)}°C in ${globalMinPoint.room} on ${fmtDate(globalMinPoint.t)}`,
      value: globalMinPoint.v,
      room: globalMinPoint.room,
    },
    {
      id: "global-hot",
      icon: "sun",
      title: "Apartment record high",
      text: `${globalMaxPoint.v.toFixed(1)}°C in ${globalMaxPoint.room} on ${fmtDate(globalMaxPoint.t)}`,
      value: globalMaxPoint.v,
      room: globalMaxPoint.room,
    },
    {
      id: "warmest-room",
      icon: "home",
      title: "Warmest room overall",
      text: `${warmestRoom.room} averages ${warmestRoom.avg}°C`,
      room: warmestRoom.room,
    },
    {
      id: "coldest-room",
      icon: "home",
      title: "Coolest room overall",
      text: `${coldestRoom.room} averages ${coldestRoom.avg}°C`,
      room: coldestRoom.room,
    },
    {
      id: "stable",
      icon: "wave",
      title: "Most stable climate",
      text: `${mostStable.room} (σ = ${mostStable.stddev}°C)`,
      room: mostStable.room,
    },
    {
      id: "volatile",
      icon: "wave",
      title: "Most variable climate",
      text: `${mostVolatile.room} (σ = ${mostVolatile.stddev}°C)`,
      room: mostVolatile.room,
    },
    {
      id: "spread-wide",
      icon: "split",
      title: "Biggest room-to-room spread",
      text: `${widestDay.spread}°C on ${widestDay.date} (coolest ${widestDay.min}°C → warmest ${widestDay.max}°C)`,
    },
    {
      id: "spread-tight",
      icon: "split",
      title: "Most even day",
      text: `Only ${tightestDay.spread}°C between rooms on ${tightestDay.date}`,
    },
    {
      id: "coldest-day",
      icon: "calendar",
      title: "Coldest apartment day",
      text: `${coldestDay.avg}°C average on ${coldestDay.date}`,
    },
    {
      id: "warmest-day",
      icon: "calendar",
      title: "Warmest apartment day",
      text: `${warmestDay.avg}°C average on ${warmestDay.date}`,
    }
  );

  if (biggestSetback) {
    funFacts.push({
      id: "setback",
      icon: "moon",
      title: "Strongest day/night setback",
      text: `${biggestSetback.room}: days run ${biggestSetback.nightDayDelta}°C warmer than nights`,
      room: biggestSetback.room,
    });
  }

  if (correlations[0]) {
    funFacts.push({
      id: "corr",
      icon: "link",
      title: "Tightest room pair",
      text: `${correlations[0].a} ↔ ${correlations[0].b} (r = ${correlations[0].r})`,
    });
  }

  // Heating season heuristic: Oct–Apr monthly avg
  const heatingMonths = monthlyAll.filter((m) => {
    const mo = Number(m.month.slice(5));
    return mo >= 10 || mo <= 4;
  });
  const summerMonths = monthlyAll.filter((m) => {
    const mo = Number(m.month.slice(5));
    return mo >= 6 && mo <= 8;
  });
  if (heatingMonths.length && summerMonths.length) {
    funFacts.push({
      id: "season",
      icon: "leaf",
      title: "Seasonal swing",
      text: `Heating-season room average ${mean(heatingMonths.map((m) => m.avg)).toFixed(1)}°C vs summer ${mean(summerMonths.map((m) => m.avg)).toFixed(1)}°C`,
    });
  }

  // Pivot daily for multi-line chart
  const dailyPivot = apartmentDaily.map((d) => ({
    t: d.t,
    date: d.date,
    avg: d.avg,
    spread: d.spread,
    ...d.rooms,
  }));

  // Hour profile pivot
  const hourPivot = Array.from({ length: 24 }, (_, hour) => {
    const row = { hour };
    for (const room of rooms) {
      row[room] = hourProfile[room][hour]?.avg ?? null;
    }
    return row;
  });

  const weekdayPivot = Array.from({ length: 7 }, (_, dow) => {
    const row = {
      dow,
      label: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dow],
    };
    for (const room of rooms) {
      row[room] = weekdayProfile[room][dow]?.avg ?? null;
    }
    return row;
  });

  // Monthly pivot
  const monthKeys = [...new Set(monthlyAll.map((m) => m.month))].sort();
  const monthlyPivot = monthKeys.map((month) => {
    const row = { month };
    for (const room of rooms) {
      const hit = monthlyAll.find((m) => m.month === month && m.room === room);
      row[room] = hit?.avg ?? null;
      row[`${room}_min`] = hit?.min ?? null;
      row[`${room}_max`] = hit?.max ?? null;
    }
    row.avg = mean(rooms.map((r) => row[r]).filter((v) => v != null));
    if (row.avg != null) row.avg = +row.avg.toFixed(2);
    return row;
  });

  const meta = {
    generatedAt: new Date().toISOString(),
    source: sourceName,
    rooms,
    colors: Object.fromEntries(rooms.map((r) => [r, ROOM_COLORS[r] || "#666"])),
    firstTs: Math.min(...roomSummaries.map((r) => r.firstTs)),
    lastTs: Math.max(...roomSummaries.map((r) => r.lastTs)),
    totalRawPoints,
    roomCount: rooms.length,
  };

  const overview = {
    rooms: roomSummaries,
    kpis: {
      apartmentAvg: +mean(roomSummaries.map((r) => r.avg)).toFixed(2),
      warmestRoom: warmestRoom.room,
      coldestRoom: coldestRoom.room,
      recordLow: globalMinPoint.v,
      recordHigh: globalMaxPoint.v,
      avgComfortPct: +mean(roomSummaries.map((r) => r.comfortPct)).toFixed(1),
      totalSetpointChanges: roomSummaries.reduce((s, r) => s + r.setpointChanges, 0),
      daysCovered: apartmentDaily.length,
    },
  };

  fs.writeFileSync(path.join(OUT, "meta.json"), JSON.stringify(meta, null, 2));
  fs.writeFileSync(path.join(OUT, "overview.json"), JSON.stringify(overview, null, 2));
  fs.writeFileSync(path.join(OUT, "funFacts.json"), JSON.stringify(funFacts, null, 2));
  fs.writeFileSync(
    path.join(OUT, "charts.json"),
    JSON.stringify({
      daily: dailyPivot,
      monthly: monthlyPivot,
      byHour: hourPivot,
      byWeekday: weekdayPivot,
      correlations,
      distributions,
      apartmentDaily,
    })
  );

  console.log("\nDone.");
  console.log(`  Rooms: ${rooms.join(", ")}`);
  console.log(`  Points: ${totalRawPoints.toLocaleString("de-DE")}`);
  console.log(`  Output: ${OUT}`);
}

function slug(room) {
  return room
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function fmtDate(ms) {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(ms));
}

function pearson(xs, ys) {
  const n = xs.length;
  if (n < 3) return 0;
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx;
    const b = ys[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  const den = Math.sqrt(dx * dy);
  return den === 0 ? 0 : num / den;
}

main();
