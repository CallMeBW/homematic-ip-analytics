#!/usr/bin/env node
/**
 * Homematic IP export ingest
 * Drop a new HmIP_Export*.zip into data/ (or extract CSVs into data/raw/),
 * then run: npm run ingest
 */
import fs from "node:fs";
import path from "node:path";

import {
  AC_ROOM,
  APARTMENT_COLOR,
  APARTMENT_KEY,
  DAY,
  HOUR,
  OUT,
  RAW,
  ROOM_COLORS,
  ROOM_ORDER,
} from "./lib/config.mjs";
import { ensureDir, extractZipIfNeeded, parseCsvFile } from "./lib/io.mjs";
import {
  buildSeasonalProfiles,
  datesInHeatingSeasons,
  detectHeatingSeasons,
} from "./lib/seasons.mjs";
import {
  alignSeries,
  detectCoolingEvents,
  detectSetpointChanges,
  estimateHeatUpEvents,
  pivotHourProfiles,
  pivotWeekdayProfiles,
} from "./lib/series.mjs";
import {
  bucketAverage,
  bucketMeans,
  buildHistogram,
  mean,
  percentile,
  stddev,
} from "./lib/stats.mjs";
import { berlinParts, slug } from "./lib/time.mjs";

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
    (a, b) =>
      (ROOM_ORDER.indexOf(a) === -1 ? 99 : ROOM_ORDER.indexOf(a)) -
      (ROOM_ORDER.indexOf(b) === -1 ? 99 : ROOM_ORDER.indexOf(b))
  );

  const roomSummaries = [];
  const dailyAll = [];
  const monthlyAll = [];
  const hourProfile = {};
  const hourProfileHeating = {};
  const hourProfileOffSeason = {};
  const weekdayProfile = {};
  const weekdayProfileHeating = {};
  const weekdayProfileOffSeason = {};
  const distributions = {};
  const funFacts = [];
  const allActualByYear = new Map();
  const allActualVals = [];
  /** @type {Record<string, any[]>} */
  const hourlyByRoom = {};
  /** @type {any[]} */
  const roomContexts = [];
  let globalMinT = Infinity;
  let globalMaxT = -Infinity;
  let globalMinPoint = null;
  let globalMaxPoint = null;
  let totalRawPoints = 0;

  for (const room of rooms) {
    const { actual, setpoint, gaps } = byRoom[room];
    totalRawPoints += actual.length + setpoint.length;
    console.log(`Analyzing ${room}: ${actual.length} actual, ${setpoint.length} setpoint`);

    const hourlyActual = bucketAverage(actual, HOUR);
    const hourlySetpoint = bucketAverage(setpoint, HOUR);
    const dailyActual = bucketAverage(actual, DAY);
    const dailySetpoint = bucketAverage(setpoint, DAY);
    const aligned = alignSeries(hourlyActual, hourlySetpoint);
    hourlyByRoom[room] = hourlyActual;

    const changes = detectSetpointChanges(
      setpoint.filter((_, i, arr) => i === 0 || Math.abs(arr[i].v - arr[i - 1].v) >= 0.05)
    );
    const significantChangesAll = [];
    for (const ch of changes) {
      const last = significantChangesAll[significantChangesAll.length - 1];
      if (!last || Math.abs(ch.to - last.to) >= 0.15 || ch.t - last.t > HOUR) {
        significantChangesAll.push(ch);
      }
    }

    const vals = actual.map((p) => p.v);
    for (let i = 0; i < vals.length; i++) allActualVals.push(vals[i]);

    // Yearly climate from hourly buckets (cheap berlinParts).
    // Extremes use bucket min/max so brief raw spikes (e.g. 10.7°C) are not averaged away.
    for (const p of hourlyActual) {
      const { year } = berlinParts(p.t);
      let yearBucket = allActualByYear.get(year);
      if (!yearBucket) {
        yearBucket = { means: [], mins: [], maxs: [] };
        allActualByYear.set(year, yearBucket);
      }
      yearBucket.means.push(p.v);
      yearBucket.mins.push(p.min);
      yearBucket.maxs.push(p.max);
    }

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

    const comfortCount = vals.filter((v) => v >= 20 && v <= 22.5).length;
    const comfortPct = (100 * comfortCount) / vals.length;

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

    const byHour = bucketMeans(hourBuckets).map(({ i, avg: a, n }) => ({ hour: i, avg: a, n }));
    const byWeekday = bucketMeans(dowBuckets).map(({ i, avg: a, n }) => ({
      dow: i,
      label: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][i],
      avg: a,
      n,
    }));
    hourProfile[room] = byHour;
    weekdayProfile[room] = byWeekday;

    const coldestHour = byHour.filter((h) => h.avg != null).sort((a, b) => a.avg - b.avg)[0];
    const warmestHour = byHour.filter((h) => h.avg != null).sort((a, b) => b.avg - a.avg)[0];

    const monthMap = new Map();
    const roomDailyRows = [];
    for (const p of dailyActual) {
      const { monthKey, dateKey } = berlinParts(p.t);
      if (!monthMap.has(monthKey)) monthMap.set(monthKey, []);
      monthMap.get(monthKey).push(p.v);

      const row = {
        t: p.t,
        date: dateKey,
        room,
        actual: +p.v.toFixed(2),
        min: +p.min.toFixed(2),
        max: +p.max.toFixed(2),
      };
      dailyAll.push(row);
      roomDailyRows.push(row);
    }

    const spDailyMap = new Map(dailySetpoint.map((p) => [berlinParts(p.t).dateKey, p.v]));
    for (let i = 0; i < roomDailyRows.length; i++) {
      const row = roomDailyRows[i];
      if (!spDailyMap.has(row.date)) continue;
      row.setpoint = +spDailyMap.get(row.date).toFixed(2);
      row.gap = +(row.actual - row.setpoint).toFixed(2);
      const prev = i > 0 ? roomDailyRows[i - 1].setpoint : null;
      row.spDelta = prev != null ? +Math.abs(row.setpoint - prev).toFixed(2) : 0;
    }

    monthlyAll.push(
      ...[...monthMap.entries()]
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([month, arr]) => ({
          month,
          room,
          avg: +mean(arr).toFixed(2),
          min: +Math.min(...arr).toFixed(2),
          max: +Math.max(...arr).toFixed(2),
        }))
    );

    const heatDays = roomDailyRows.map((d) => ({
      date: d.date,
      t: d.t,
      avg: d.actual,
      min: d.min,
      max: d.max,
      range: +(d.max - d.min).toFixed(2),
    }));
    distributions[room] = buildHistogram(vals, 0.5);

    roomContexts.push({
      room,
      actual,
      setpoint,
      hourlyActual,
      hourlySetpoint,
      aligned,
      significantChangesAll,
      dailyActual,
      dailySetpoint,
      byHour,
      byWeekday,
      sorted,
      avg,
      sd,
      minV,
      maxV,
      minPt,
      maxPt,
      comfortPct,
      nightVals,
      dayVals,
      coldestHour,
      warmestHour,
      heatDays,
      gaps,
    });
  }

  const heatingSeasons = detectHeatingSeasons(dailyAll);
  const heatingSeasonDates = datesInHeatingSeasons(heatingSeasons);
  console.log(
    `Heating seasons: ${
      heatingSeasons.length
        ? heatingSeasons.map((s) => `${s.start} → ${s.end} (${s.days}d)`).join("; ")
        : "(none detected)"
    }`
  );

  for (const ctx of roomContexts) {
    const {
      room,
      actual,
      setpoint,
      hourlyActual,
      hourlySetpoint,
      aligned,
      significantChangesAll,
      dailyActual,
      dailySetpoint,
      sorted,
      avg,
      sd,
      minV,
      maxV,
      minPt,
      maxPt,
      comfortPct,
      nightVals,
      dayVals,
      coldestHour,
      warmestHour,
      heatDays,
      gaps,
    } = ctx;

    const {
      byHourHeating,
      byHourOffSeason,
      byWeekdayHeating,
      byWeekdayOffSeason,
    } = buildSeasonalProfiles(hourlyActual, heatingSeasonDates);
    hourProfileHeating[room] = byHourHeating;
    hourProfileOffSeason[room] = byHourOffSeason;
    weekdayProfileHeating[room] = byWeekdayHeating;
    weekdayProfileOffSeason[room] = byWeekdayOffSeason;

    for (const row of dailyAll) {
      if (row.room === room) row.heatingActive = heatingSeasonDates.has(row.date);
    }

    const alignedActive = aligned.filter((p) =>
      heatingSeasonDates.has(berlinParts(p.t).dateKey)
    );
    const underheat = alignedActive.filter((p) => p.gap < -0.5).length;
    const overheat = alignedActive.filter((p) => p.gap > 0.5).length;
    const underPct = alignedActive.length ? (100 * underheat) / alignedActive.length : 0;
    const overPct = alignedActive.length ? (100 * overheat) / alignedActive.length : 0;
    const avgGap = mean(alignedActive.map((p) => p.gap));

    const significantChanges = significantChangesAll.filter((ch) =>
      heatingSeasonDates.has(berlinParts(ch.t).dateKey)
    );
    const heatUps = estimateHeatUpEvents(alignedActive, significantChanges);
    const avgHeatUp =
      heatUps.length > 0 ? Math.round(mean(heatUps.map((h) => h.minutes))) : null;

    const heatingActiveDays = dailyActual.filter((d) =>
      heatingSeasonDates.has(berlinParts(d.t).dateKey)
    ).length;
    const heatingActivePct = dailyActual.length
      ? +((100 * heatingActiveDays) / dailyActual.length).toFixed(1)
      : 0;

    // Deep-dive chart uses daily averages (full multi-year span is too dense hourly).
    const spByDate = new Map(dailySetpoint.map((p) => [berlinParts(p.t).dateKey, p.v]));
    const actualDisplay = dailyActual.map((p) => ({ t: p.t, v: +p.v.toFixed(2) }));
    const setpointDisplay = dailyActual.map((p) => {
      const dateKey = berlinParts(p.t).dateKey;
      if (!heatingSeasonDates.has(dateKey) || !spByDate.has(dateKey)) {
        return { t: p.t, v: null };
      }
      return { t: p.t, v: +spByDate.get(dateKey).toFixed(2) };
    });
    const gapForChart = dailyActual.flatMap((p) => {
      const dateKey = berlinParts(p.t).dateKey;
      if (!heatingSeasonDates.has(dateKey) || !spByDate.has(dateKey)) return [];
      return [{ t: p.t, v: +(p.v - spByDate.get(dateKey)).toFixed(2) }];
    });

    fs.writeFileSync(
      path.join(OUT, "rooms", `${slug(room)}.json`),
      JSON.stringify({
        room,
        color: ROOM_COLORS[room] || "#666",
        series: {
          actual: actualDisplay,
          setpoint: setpointDisplay,
          gap: gapForChart,
        },
        daily: heatDays,
      })
    );

    roomSummaries.push({
      room,
      color: ROOM_COLORS[room] || "#666",
      slug: slug(room),
      points: actual.length,
      setpointPoints: setpoint.length,
      gaps,
      avg: +avg.toFixed(2),
      stddev: +sd.toFixed(2),
      min: minV,
      max: maxV,
      p10: +percentile(sorted, 0.1).toFixed(2),
      p25: +percentile(sorted, 0.25).toFixed(2),
      p50: +percentile(sorted, 0.5).toFixed(2),
      p75: +percentile(sorted, 0.75).toFixed(2),
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
      heatingActiveDays,
      heatingActivePct,
      firstTs: actual[0]?.t,
      lastTs: actual[actual.length - 1]?.t,
    });
  }

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

  distributions[APARTMENT_KEY] = buildHistogram(allActualVals, 0.5);

  const coolingEvents = detectCoolingEvents(
    hourlyByRoom[AC_ROOM] || [],
    heatingSeasonDates,
    1.2,
    4
  )
    .sort((a, b) => b.drop - a.drop)
    .slice(0, 60);

  const acEffect = {
    room: AC_ROOM,
    season: "summer-season",
    kpis: {
      coolingEvents: coolingEvents.length,
      avgCoolingDrop: coolingEvents.length
        ? +mean(coolingEvents.map((e) => e.drop)).toFixed(2)
        : null,
    },
    coolingEvents,
  };

  const dailyAvgsByYear = new Map();
  for (const d of apartmentDaily) {
    const year = Number(d.date.slice(0, 4));
    if (!dailyAvgsByYear.has(year)) dailyAvgsByYear.set(year, []);
    dailyAvgsByYear.get(year).push(d.avg);
  }
  const yearly = [...allActualByYear.keys()]
    .sort((a, b) => a - b)
    .map((year) => {
      const bucket = allActualByYear.get(year);
      const sortedMeans = [...bucket.means].sort((a, b) => a - b);
      const dailyAvgs = dailyAvgsByYear.get(year) || [];
      const dailySorted = [...dailyAvgs].sort((a, b) => a - b);
      return {
        year,
        min: +Math.min(...bucket.mins).toFixed(2),
        max: +Math.max(...bucket.maxs).toFixed(2),
        median: +percentile(sortedMeans, 0.5).toFixed(2),
        avg: +mean(bucket.means).toFixed(2),
        dailyMedian: dailySorted.length ? +percentile(dailySorted, 0.5).toFixed(2) : null,
        days: dailyAvgs.length,
        samples: bucket.means.length,
      };
    });
  const widestDay = apartmentDaily.reduce(
    (best, d) => (d.spread > best.spread ? d : best),
    apartmentDaily[0]
  );
  const tightestDay = apartmentDaily.reduce(
    (best, d) => (d.spread < best.spread ? d : best),
    apartmentDaily[0]
  );
  const coldestDay = apartmentDaily.reduce(
    (best, d) => (d.avg < best.avg ? d : best),
    apartmentDaily[0]
  );
  const warmestDay = apartmentDaily.reduce(
    (best, d) => (d.avg > best.avg ? d : best),
    apartmentDaily[0]
  );

  const warmestRoom = [...roomSummaries].sort((a, b) => b.avg - a.avg)[0];
  const coldestRoom = [...roomSummaries].sort((a, b) => a.avg - b.avg)[0];
  const mostStable = [...roomSummaries].sort((a, b) => a.stddev - b.stddev)[0];

  funFacts.push(
    {
      id: "stable",
      group: "apartment",
      icon: "wave",
      title: "Most stable climate",
      text: `${mostStable.room} (σ = ${mostStable.stddev}°C)`,
      room: mostStable.room,
    },
    {
      id: "spread-wide",
      group: "apartment",
      icon: "split",
      title: "Biggest room-to-room spread",
      text: `${widestDay.spread}°C on ${widestDay.date} (coolest ${widestDay.min}°C → warmest ${widestDay.max}°C)`,
    },
    {
      id: "spread-tight",
      group: "apartment",
      icon: "split",
      title: "Most even day",
      text: `Only ${tightestDay.spread}°C between rooms on ${tightestDay.date}`,
    },
    {
      id: "coldest-day",
      group: "apartment",
      icon: "calendar",
      title: "Coldest apartment day",
      text: `${coldestDay.avg}°C average on ${coldestDay.date}`,
    },
    {
      id: "warmest-day",
      group: "apartment",
      icon: "calendar",
      title: "Warmest apartment day",
      text: `${warmestDay.avg}°C average on ${warmestDay.date}`,
    }
  );

  const inSeasonAvgs = apartmentDaily
    .filter((d) => heatingSeasonDates.has(d.date))
    .map((d) => d.avg);
  const offSeasonAvgs = apartmentDaily
    .filter((d) => !heatingSeasonDates.has(d.date))
    .map((d) => d.avg);
  if (inSeasonAvgs.length && offSeasonAvgs.length) {
    funFacts.push({
      id: "season",
      group: "apartment",
      icon: "leaf",
      title: "Seasonal swing",
      text: `Heating seasons average ${mean(inSeasonAvgs).toFixed(1)}°C vs summer season ${mean(offSeasonAvgs).toFixed(1)}°C`,
    });
  }

  const dailyPivot = apartmentDaily.map((d) => ({
    t: d.t,
    date: d.date,
    avg: d.avg,
    spread: d.spread,
    ...d.rooms,
  }));

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
    colors: {
      ...Object.fromEntries(rooms.map((r) => [r, ROOM_COLORS[r] || "#666"])),
      [APARTMENT_KEY]: APARTMENT_COLOR,
    },
    firstTs: Math.min(...roomSummaries.map((r) => r.firstTs)),
    lastTs: Math.max(...roomSummaries.map((r) => r.lastTs)),
    totalRawPoints,
    roomCount: rooms.length,
    seasons: {
      heating: "Detected heating seasons (onset→offset)",
      offSeason: "Summer season (outside heating intervals)",
      intervals: heatingSeasons.map((s) => `${s.start} → ${s.end}`),
    },
    heatingSeasons,
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
    yearly,
    heatingSeasons,
  };

  fs.writeFileSync(path.join(OUT, "meta.json"), JSON.stringify(meta, null, 2));
  fs.writeFileSync(path.join(OUT, "overview.json"), JSON.stringify(overview, null, 2));
  fs.writeFileSync(path.join(OUT, "funFacts.json"), JSON.stringify(funFacts, null, 2));
  fs.writeFileSync(
    path.join(OUT, "charts.json"),
    JSON.stringify({
      daily: dailyPivot,
      monthly: monthlyPivot,
      byHour: pivotHourProfiles(rooms, hourProfile),
      byHourHeating: pivotHourProfiles(rooms, hourProfileHeating),
      byHourOffSeason: pivotHourProfiles(rooms, hourProfileOffSeason),
      byWeekday: pivotWeekdayProfiles(rooms, weekdayProfile),
      byWeekdayHeating: pivotWeekdayProfiles(rooms, weekdayProfileHeating),
      byWeekdayOffSeason: pivotWeekdayProfiles(rooms, weekdayProfileOffSeason),
      distributions,
      apartmentDaily,
      acEffect,
    })
  );

  console.log("\nDone.");
  console.log(`  Rooms: ${rooms.join(", ")}`);
  console.log(`  Points: ${totalRawPoints.toLocaleString("de-DE")}`);
  console.log(`  Output: ${OUT}`);
}

main();
