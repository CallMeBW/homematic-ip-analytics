import { useEffect, useMemo, useRef, useState } from "react";
import { ChartCard } from "./ChartCard";
import type { RoomSummary } from "../lib/types";
import { fmtTemp } from "../lib/format";

type Day = { date: string; avg: number };

const CELL = 11;
const GAP = 3;
const DOW_W = 36;
const STEP = CELL + GAP;
const DOW_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function HeatmapCalendar({
  room,
  color,
  days,
}: {
  room: string;
  color: string;
  days: Day[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);

  const model = useMemo(() => {
    if (!days.length) {
      return {
        grid: [] as Array<number | null>,
        weeks: 0,
        min: 0,
        max: 1,
        scaleLo: 0,
        scaleHi: 1,
        dates: [] as string[],
      };
    }
    const byDate = new Map(days.map((d) => [d.date, d.avg]));
    const sorted = [...days].sort((a, b) => (a.date < b.date ? -1 : 1));
    const temps = sorted.map((d) => d.avg).sort((a, b) => a - b);
    const min = temps[0];
    const max = temps[temps.length - 1];
    // Soft percentile scale: rare extremes don't squash mid-range contrast
    const scaleLo = percentile(temps, 0.05);
    const scaleHi = Math.max(scaleLo + 0.2, percentile(temps, 0.95));
    const start = new Date(`${sorted[0].date}T12:00:00`);
    const end = new Date(`${sorted[sorted.length - 1].date}T12:00:00`);
    const startDow = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - startDow);

    const grid: Array<number | null> = [];
    const dates: string[] = [];
    let week = 0;
    const cursor = new Date(start);
    while (true) {
      const y = cursor.getFullYear();
      const m = String(cursor.getMonth() + 1).padStart(2, "0");
      const d = String(cursor.getDate()).padStart(2, "0");
      const key = `${y}-${m}-${d}`;
      const dow = (cursor.getDay() + 6) % 7;
      const idx = week * 7 + dow;
      while (grid.length <= idx) {
        grid.push(null);
        dates.push("");
      }
      grid[idx] = byDate.has(key) ? (byDate.get(key) as number) : null;
      dates[idx] = key;
      cursor.setDate(cursor.getDate() + 1);
      if (dow === 6) {
        week += 1;
        if (cursor > end) break;
      }
      if (week > 120) break;
    }
    return { grid, weeks: week, min, max, scaleLo, scaleHi, dates };
  }, [days]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !model.weeks) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = model.weeks * STEP - GAP;
    const height = 7 * STEP - GAP;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const hot = darken(color, 0.18);

    for (let w = 0; w < model.weeks; w++) {
      for (let dow = 0; dow < 7; dow++) {
        const avg = model.grid[w * 7 + dow];
        const x = w * STEP;
        const y = dow * STEP;
        if (avg == null) {
          ctx.fillStyle = "rgba(26,35,50,0.04)";
        } else {
          const span = model.scaleHi - model.scaleLo;
          const raw = span <= 0 ? 0.5 : (avg - model.scaleLo) / span;
          const t = Math.min(1, Math.max(0, raw));
          // Ease slightly so mid temperatures separate more on screen
          const eased = Math.pow(t, 0.85);
          // Near-white → room color → slightly deeper room color (same hue family)
          ctx.fillStyle =
            eased < 0.72
              ? mix("#f3f6f8", color, eased / 0.72)
              : mix(color, hot, (eased - 0.72) / 0.28);
        }
        roundRect(ctx, x, y, CELL, CELL, 2);
        ctx.fill();
      }
    }
  }, [model, color]);

  function onMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const w = Math.floor(x / STEP);
    const dow = Math.floor(y / STEP);
    if (w < 0 || w >= model.weeks || dow < 0 || dow > 6) {
      setTip(null);
      return;
    }
    const idx = w * 7 + dow;
    const date = model.dates[idx];
    const avg = model.grid[idx];
    if (!date) {
      setTip(null);
      return;
    }
    setTip({
      x: e.clientX - rect.left + DOW_W + 12,
      y: e.clientY - rect.top - 8,
      text: avg == null ? `${date}: no data` : `${date}: ${fmtTemp(avg)}`,
    });
  }

  return (
    <ChartCard
      title={`${room} calendar heatmap`}
      subtitle={`Daily average · color stretch ${fmtTemp(model.scaleLo)} → ${fmtTemp(model.scaleHi)} (p5–p95; extremes clamp) — hover a day`}
    >
      <div className="heatmap">
        <div className="heatmap__dow" aria-hidden>
          {DOW_LABELS.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <div className="heatmap__canvas-wrap">
          <canvas
            ref={canvasRef}
            className="heatmap__canvas"
            onMouseMove={onMove}
            onMouseLeave={() => setTip(null)}
          />
          {tip ? (
            <div className="heatmap__tip" style={{ left: tip.x, top: tip.y }}>
              {tip.text}
            </div>
          ) : null}
        </div>
      </div>
    </ChartCard>
  );
}

const COMFORT_LO = 20;
const COMFORT_HI = 22.5;

export function RoomCompareBars({ rooms }: { rooms: RoomSummary[] }) {
  const scale = useMemo(() => {
    const lo = Math.min(...rooms.map((r) => r.p10));
    const hi = Math.max(...rooms.map((r) => r.p90));
    const pad = Math.max(0.4, (hi - lo) * 0.08);
    return { lo: lo - pad, hi: hi + pad };
  }, [rooms]);

  const ticks = useMemo(() => niceTicks(scale.lo, scale.hi, 5), [scale]);
  const toPct = (t: number) => ((t - scale.lo) / (scale.hi - scale.lo)) * 100;

  return (
    <ChartCard
      title="Room averages at a glance"
      subtitle="Temperature spread (p10–p90) · box is interquartile range · band is comfort 20–22.5°C"
    >
      <div className="compare-bars">
        <div className="compare-bars__axis" aria-hidden>
          <span className="compare-bars__axis-spacer" />
          <div className="compare-bars__axis-track">
            {ticks.map((t) => (
              <span key={t} className="compare-bars__tick" style={{ left: `${toPct(t)}%` }}>
                {fmtTemp(t)}
              </span>
            ))}
          </div>
          <span className="compare-bars__axis-end" />
        </div>

        <ul className="compare-bars__list">
          {rooms.map((r) => {
            const p25 = r.p25 ?? lerp(r.p10, r.p50, 0.5);
            const p75 = r.p75 ?? lerp(r.p50, r.p90, 0.5);
            const whiskerL = toPct(r.p10);
            const whiskerW = Math.max(0.5, toPct(r.p90) - whiskerL);
            const boxL = toPct(p25);
            const boxW = Math.max(0.5, toPct(p75) - boxL);
            const comfortL = toPct(COMFORT_LO);
            const comfortW = Math.max(0, toPct(COMFORT_HI) - comfortL);

            return (
              <li key={r.room} className="compare-bars__row">
                <div className="compare-bars__label">
                  <strong>{r.room}</strong>
                  <span className="compare-bars__avg" title="Mean">
                    {fmtTemp(r.avg)}
                  </span>
                </div>

                <div
                  className="compare-bars__track"
                  title={`${r.room}: p10 ${fmtTemp(r.p10)} · Q1 ${fmtTemp(p25)} · median ${fmtTemp(r.p50)} · Q3 ${fmtTemp(p75)} · p90 ${fmtTemp(r.p90)} · mean ${fmtTemp(r.avg)}`}
                >
                  <div
                    className="compare-bars__comfort"
                    style={{ left: `${comfortL}%`, width: `${comfortW}%` }}
                  />
                  <div
                    className="compare-bars__whisker"
                    style={{ left: `${whiskerL}%`, width: `${whiskerW}%`, background: r.color }}
                  />
                  <div
                    className="compare-bars__cap compare-bars__cap--lo"
                    style={{ left: `${whiskerL}%`, background: r.color }}
                  />
                  <div
                    className="compare-bars__cap compare-bars__cap--hi"
                    style={{ left: `${toPct(r.p90)}%`, background: r.color }}
                  />
                  <div
                    className="compare-bars__iqr"
                    style={{ left: `${boxL}%`, width: `${boxW}%`, background: r.color }}
                  />
                  <div className="compare-bars__median" style={{ left: `${toPct(r.p50)}%` }} />
                  <div
                    className="compare-bars__mean"
                    style={{ left: `${toPct(r.avg)}%`, borderColor: r.color }}
                    title={`Mean ${fmtTemp(r.avg)}`}
                  />
                </div>

                <ComfortRing pct={r.comfortPct} color={r.color} />
              </li>
            );
          })}
        </ul>

        <div className="compare-bars__legend" aria-hidden>
          <span>
            <i className="compare-bars__legend-box" /> IQR (p25–p75)
          </span>
          <span>
            <i className="compare-bars__legend-median" /> Median
          </span>
          <span>
            <i className="compare-bars__legend-mean" /> Mean
          </span>
          <span>
            <i className="compare-bars__legend-comfort" /> Comfort band
          </span>
          <span className="compare-bars__legend-ring">Ring = time in comfort</span>
        </div>
      </div>
    </ChartCard>
  );
}

function ComfortRing({ pct, color }: { pct: number; color: string }) {
  const r = 15;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(100, Math.max(0, pct));
  const dash = (clamped / 100) * c;
  return (
    <div className="comfort-ring" title={`${clamped}% of time in 20–22.5°C`}>
      <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden>
        <circle className="comfort-ring__track" cx="20" cy="20" r={r} />
        <circle
          className="comfort-ring__fill"
          cx="20"
          cy="20"
          r={r}
          stroke={color}
          strokeDasharray={`${dash} ${c - dash}`}
        />
      </svg>
      <span className="comfort-ring__value">{Math.round(clamped)}%</span>
    </div>
  );
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/** Roughly nice axis ticks between lo and hi. */
function niceTicks(lo: number, hi: number, count: number) {
  const span = hi - lo;
  if (span <= 0) return [lo];
  const raw = span / Math.max(1, count - 1);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm >= 5 ? 5 : norm >= 2 ? 2 : 1) * mag;
  const start = Math.ceil(lo / step) * step;
  const ticks: number[] = [];
  for (let t = start; t <= hi + 1e-9; t += step) {
    ticks.push(+t.toFixed(2));
  }
  return ticks.length ? ticks : [+lo.toFixed(1), +hi.toFixed(1)];
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function mix(a: string, b: string, t: number) {
  const pa = hex(a);
  const pb = hex(b);
  const u = Math.min(1, Math.max(0, t));
  const m = (i: number) => Math.round(pa[i] + (pb[i] - pa[i]) * u);
  return `rgb(${m(0)}, ${m(1)}, ${m(2)})`;
}

function darken(h: string, amount: number) {
  const [r, g, b] = hex(h);
  const f = 1 - amount;
  return `rgb(${Math.round(r * f)}, ${Math.round(g * f)}, ${Math.round(b * f)})`;
}

function hex(h: string): [number, number, number] {
  const s = h.replace("#", "");
  return [
    parseInt(s.slice(0, 2), 16),
    parseInt(s.slice(2, 4), 16),
    parseInt(s.slice(4, 6), 16),
  ];
}

function percentile(sorted: number[], p: number) {
  if (!sorted.length) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] * (hi - idx) + sorted[hi] * (idx - lo);
}
