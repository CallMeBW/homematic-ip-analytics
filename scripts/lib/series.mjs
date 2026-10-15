import { berlinParts } from "./time.mjs";
import { HOUR } from "./config.mjs";

/** Forward-fill setpoint onto actual timestamps (nearest hold). */
export function alignSeries(actual, setpoint) {
  if (!actual.length || !setpoint.length) return [];
  const sp = setpoint;
  let j = 0;
  const out = [];
  for (const a of actual) {
    while (j < sp.length - 1 && Math.abs(sp[j + 1].t - a.t) <= Math.abs(sp[j].t - a.t)) j++;
    let k = j;
    while (k < sp.length - 1 && sp[k + 1].t <= a.t) k++;
    while (k > 0 && sp[k].t > a.t) k--;
    const s = sp[k];
    if (Math.abs(s.t - a.t) > 24 * 60 * 60 * 1000 && s.t > a.t) continue;
    out.push({ t: a.t, actual: a.v, setpoint: s.v, gap: +(a.v - s.v).toFixed(3) });
  }
  return out;
}

export function detectSetpointChanges(setpoint, minDelta = 0.15) {
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

export function estimateHeatUpEvents(aligned, changes) {
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

/**
 * Sample a (possibly null) hourly series onto an arbitrary timeline via forward-fill.
 * Keeps chart payloads aligned with downsampled actual without dense hourly setpoints.
 */
export function sampleOntoTimeline(timelineTs, series) {
  if (!timelineTs.length || !series.length) {
    return timelineTs.map((t) => ({ t, v: null }));
  }
  let j = 0;
  return timelineTs.map((t) => {
    while (j < series.length - 1 && series[j + 1].t <= t) j++;
    const s = series[j];
    const v = s.t <= t ? s.v : null;
    return { t, v: v == null ? null : +Number(v).toFixed(2) };
  });
}

/** Keep change-points (+ endpoints) for stepAfter charts; drops flat runs. */
export function compressStepSeries(points) {
  if (!points.length) return [];
  const out = [{ t: points[0].t, v: points[0].v }];
  for (let i = 1; i < points.length; i++) {
    const prev = out[out.length - 1];
    const cur = points[i];
    const prevNull = prev.v == null;
    const curNull = cur.v == null;
    if (prevNull !== curNull || (!curNull && cur.v !== prev.v)) {
      out.push({ t: cur.t, v: cur.v });
    }
  }
  const last = points[points.length - 1];
  if (out[out.length - 1].t !== last.t) out.push({ t: last.t, v: last.v });
  return out;
}

/** Detect sharp cool-downs outside detected heating seasons (AC proxy). */
export function detectCoolingEvents(hourly, heatingSeasonDates, minDrop = 1.2, maxHours = 4) {
  if (!hourly?.length) return [];
  const events = [];
  let i = 0;
  while (i < hourly.length) {
    const start = hourly[i];
    const { dateKey } = berlinParts(start.t);
    if (heatingSeasonDates.has(dateKey)) {
      i += 1;
      continue;
    }
    let best = null;
    for (let j = i + 1; j < hourly.length; j++) {
      const hours = (hourly[j].t - start.t) / HOUR;
      if (hours > maxHours) break;
      if (hours < 0.4) continue;
      const drop = start.v - hourly[j].v;
      if (drop >= minDrop && (!best || drop > best.drop)) {
        best = {
          t: start.t,
          endT: hourly[j].t,
          from: +start.v.toFixed(2),
          to: +hourly[j].v.toFixed(2),
          drop: +drop.toFixed(2),
          minutes: Math.round(hours * 60),
        };
      }
    }
    if (best) {
      events.push(best);
      while (i < hourly.length && hourly[i].t < best.endT) i += 1;
    } else {
      i += 1;
    }
  }
  return events;
}

export function pivotHourProfiles(rooms, profiles) {
  return Array.from({ length: 24 }, (_, hour) => {
    const row = { hour };
    for (const room of rooms) {
      row[room] = profiles[room]?.[hour]?.avg ?? null;
    }
    return row;
  });
}

export function pivotWeekdayProfiles(rooms, profiles) {
  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return Array.from({ length: 7 }, (_, dow) => {
    const row = { dow, label: labels[dow] };
    for (const room of rooms) {
      row[room] = profiles[room]?.[dow]?.avg ?? null;
    }
    return row;
  });
}
