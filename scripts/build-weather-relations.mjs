#!/usr/bin/env node
/**
 * Join outdoor weather (München-Stadt) with indoor analytics → weatherRelations.json
 * Consumed by the Indoor × outdoor section on the main app.
 *
 *   npm run weather:relations
 *   (also runs after npm run weather)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { berlinParts } from "./lib/time.mjs";
import { mean } from "./lib/stats.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATA = path.join(ROOT, "public", "data");
const OUT = path.join(DATA, "weatherRelations.json");

const HOUR_MS = 3_600_000;
const OUTDOOR_COLOR = "#6b7c8f";

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(DATA, name), "utf8"));
}

function pearson(xs, ys) {
  const n = xs.length;
  if (n < 3) return null;
  let sx = 0,
    sy = 0,
    sxx = 0,
    syy = 0,
    sxy = 0;
  for (let i = 0; i < n; i++) {
    sx += xs[i];
    sy += ys[i];
    sxx += xs[i] * xs[i];
    syy += ys[i] * ys[i];
    sxy += xs[i] * ys[i];
  }
  const num = n * sxy - sx * sy;
  const den = Math.sqrt((n * sxx - sx * sx) * (n * syy - sy * sy));
  if (!den) return null;
  return +(num / den).toFixed(3);
}

function sampleScatter(points, max = 1200) {
  if (points.length <= max) return points;
  const step = points.length / max;
  const out = [];
  for (let i = 0; i < max; i++) out.push(points[Math.floor(i * step)]);
  return out;
}

function inAnySeason(dateKey, seasons) {
  for (const s of seasons) {
    if (dateKey >= s.start && dateKey <= s.end) return true;
  }
  return false;
}

function buildOutdoorDaily(hourly) {
  /** @type {Map<string, { temps: number[], t: number }>} */
  const byDay = new Map();
  /** @type {Map<number, number>} */
  const byHour = new Map();

  for (const h of hourly) {
    if (h.temp == null) continue;
    const hourKey = Math.floor(h.t / HOUR_MS) * HOUR_MS;
    byHour.set(hourKey, h.temp);
    const { dateKey } = berlinParts(h.t);
    let bucket = byDay.get(dateKey);
    if (!bucket) {
      bucket = { temps: [], t: hourKey };
      byDay.set(dateKey, bucket);
    }
    bucket.temps.push(h.temp);
  }

  /** @type {Map<string, { date: string, t: number, mean: number, min: number, max: number, n: number }>} */
  const daily = new Map();
  for (const [date, b] of byDay) {
    if (b.temps.length < 6) continue;
    const mn = Math.min(...b.temps);
    const mx = Math.max(...b.temps);
    const avg = mean(b.temps);
    daily.set(date, {
      date,
      t: b.t,
      mean: +avg.toFixed(2),
      min: +mn.toFixed(2),
      max: +mx.toFixed(2),
      n: b.temps.length,
    });
  }
  return { daily, byHour };
}

function main() {
  const weatherPath = path.join(DATA, "weather.json");
  if (!fs.existsSync(weatherPath)) {
    throw new Error("Missing public/data/weather.json — run npm run weather first.");
  }

  const weather = readJson("weather.json");
  const charts = readJson("charts.json");
  const overview = readJson("overview.json");
  const meta = readJson("meta.json");
  const seasons = overview.heatingSeasons ?? meta.heatingSeasons ?? [];

  const { daily: outdoorDaily, byHour: outdoorByHour } = buildOutdoorDaily(weather.hourly);
  const rooms = meta.rooms;

  const dualSeries = [];
  const deltaSeries = [];
  const scatterApt = [];
  const scatterRooms = Object.fromEntries(rooms.map((r) => [r, []]));
  const spreadScatter = [];

  for (const day of charts.apartmentDaily) {
    const od = outdoorDaily.get(day.date);
    if (!od) continue;
    const delta = +(day.avg - od.mean).toFixed(2);
    const heating = inAnySeason(day.date, seasons);

    dualSeries.push({
      t: day.t,
      date: day.date,
      indoor: day.avg,
      outdoor: od.mean,
      outdoorMin: od.min,
      outdoorMax: od.max,
      spread: day.spread,
      delta,
      heating,
    });
    deltaSeries.push({ t: day.t, date: day.date, delta, outdoor: od.mean, heating });
    scatterApt.push({
      outdoor: od.mean,
      indoor: day.avg,
      delta,
      spread: day.spread,
      date: day.date,
      heating,
    });
    spreadScatter.push({
      outdoor: od.mean,
      outdoorAbs: Math.abs(od.mean - 15),
      spread: day.spread,
      date: day.date,
      heating,
    });

    const dailyRow = charts.daily.find((d) => d.date === day.date);
    if (dailyRow) {
      for (const room of rooms) {
        const v = dailyRow[room];
        if (typeof v === "number") {
          scatterRooms[room].push({
            outdoor: od.mean,
            indoor: v,
            date: day.date,
            heating,
          });
        }
      }
    }
  }

  const corrApartment = pearson(
    scatterApt.map((p) => p.outdoor),
    scatterApt.map((p) => p.indoor)
  );
  const corrHeating = (() => {
    const pts = scatterApt.filter((p) => p.heating);
    return pearson(
      pts.map((p) => p.outdoor),
      pts.map((p) => p.indoor)
    );
  })();
  const corrOff = (() => {
    const pts = scatterApt.filter((p) => !p.heating);
    return pearson(
      pts.map((p) => p.outdoor),
      pts.map((p) => p.indoor)
    );
  })();

  const acEvents = [];
  for (const e of charts.acEffect?.coolingEvents ?? []) {
    const { dateKey } = berlinParts(e.t);
    const od = outdoorDaily.get(dateKey);
    const hourKey = Math.floor(e.t / HOUR_MS) * HOUR_MS;
    const outdoorAt = outdoorByHour.get(hourKey) ?? outdoorByHour.get(hourKey - HOUR_MS);
    acEvents.push({
      t: e.t,
      endT: e.endT,
      drop: e.drop,
      minutes: e.minutes,
      from: e.from,
      to: e.to,
      outdoorMax: od?.max ?? null,
      outdoorMean: od?.mean ?? null,
      outdoorAt: outdoorAt ?? null,
      date: dateKey,
    });
  }

  const deltas = dualSeries.map((d) => d.delta);
  const heatingDeltas = dualSeries.filter((d) => d.heating).map((d) => d.delta);
  const offDeltas = dualSeries.filter((d) => !d.heating).map((d) => d.delta);
  const coldOutdoorDays = dualSeries.filter((d) => d.outdoor < 0);
  const hotOutdoorDays = dualSeries.filter((d) => d.outdoorMax >= 28);

  const facts = [
    {
      id: "freeze",
      icon: "snowflake",
      title: "On sub-zero outdoor days",
      text:
        coldOutdoorDays.length > 0
          ? `Apartment averaged ${mean(coldOutdoorDays.map((d) => d.indoor))?.toFixed(1)}°C across ${
              coldOutdoorDays.length
            } days (outdoor mean < 0°C)`
          : "No sub-zero outdoor days in range",
      value:
        coldOutdoorDays.length > 0
          ? +mean(coldOutdoorDays.map((d) => d.indoor)).toFixed(1)
          : null,
    },
    {
      id: "heatwave",
      icon: "sun",
      title: "On outdoor ≥28°C days",
      text:
        hotOutdoorDays.length > 0
          ? `Apartment averaged ${mean(hotOutdoorDays.map((d) => d.indoor))?.toFixed(1)}°C · spread ${mean(
              hotOutdoorDays.map((d) => d.spread)
            )?.toFixed(1)}°C (${hotOutdoorDays.length} days)`
          : "No outdoor max ≥28°C days in range",
      value:
        hotOutdoorDays.length > 0
          ? +mean(hotOutdoorDays.map((d) => d.indoor)).toFixed(1)
          : null,
    },
    {
      id: "ac-weather",
      icon: "wind",
      title: "AC cool-downs vs heat",
      text:
        acEvents.filter((e) => e.outdoorMax != null).length > 0
          ? `${acEvents.length} Wohnzimmer cool-downs · avg outdoor max that day ${mean(
              acEvents.map((e) => e.outdoorMax).filter((v) => v != null)
            )?.toFixed(1)}°C`
          : "No AC cool-down events",
      value: acEvents.length,
    },
  ];

  const payload = {
    meta: {
      generatedAt: new Date().toISOString(),
      provider: "brightsky",
      station: weather.meta?.station ?? null,
      indoorSource: meta.source,
      firstTs: meta.firstTs,
      lastTs: meta.lastTs,
      rooms,
      colors: { ...meta.colors, Outdoor: OUTDOOR_COLOR },
    },
    kpis: {
      corrApartment,
      corrHeating,
      corrOff,
      meanDelta: mean(deltas) != null ? +mean(deltas).toFixed(1) : null,
      meanDeltaHeating: mean(heatingDeltas) != null ? +mean(heatingDeltas).toFixed(1) : null,
      meanDeltaOff: mean(offDeltas) != null ? +mean(offDeltas).toFixed(1) : null,
      joinedDays: dualSeries.length,
      outdoorHours: weather.hourly.length,
      station: weather.meta?.station?.name ?? "München-Stadt",
    },
    facts,
    dualSeries,
    deltaSeries,
    scatterApt: sampleScatter(scatterApt, 900),
    scatterRooms: Object.fromEntries(
      rooms.map((r) => [r, sampleScatter(scatterRooms[r], 700)])
    ),
    spreadScatter: sampleScatter(spreadScatter, 900),
    acEvents,
  };

  fs.writeFileSync(OUT, JSON.stringify(payload));
  console.log(
    `Wrote ${OUT} · ${dualSeries.length} joined days · r=${corrApartment} · ${acEvents.length} AC×weather events`
  );
}

main();
