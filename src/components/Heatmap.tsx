import { useMemo } from "react";
import { ChartCard } from "./ChartCard";
import type { RoomSummary } from "../lib/types";
import { fmtTemp } from "../lib/format";

type Day = { date: string; avg: number };

export function HeatmapCalendar({
  room,
  color,
  days,
}: {
  room: string;
  color: string;
  days: Day[];
}) {
  const { cells, min, max, weeks } = useMemo(() => {
    if (!days.length) return { cells: [], min: 0, max: 1, weeks: 0 };
    const byDate = new Map(days.map((d) => [d.date, d.avg]));
    const sorted = [...days].sort((a, b) => (a.date < b.date ? -1 : 1));
    const min = Math.min(...sorted.map((d) => d.avg));
    const max = Math.max(...sorted.map((d) => d.avg));
    const start = new Date(`${sorted[0].date}T12:00:00`);
    const end = new Date(`${sorted[sorted.length - 1].date}T12:00:00`);
    // Align to Monday
    const startDow = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - startDow);
    const cells: Array<{ date: string; avg: number | null; week: number; dow: number }> = [];
    let week = 0;
    const cursor = new Date(start);
    while (cursor <= end || week < 2) {
      const y = cursor.getFullYear();
      const m = String(cursor.getMonth() + 1).padStart(2, "0");
      const d = String(cursor.getDate()).padStart(2, "0");
      const key = `${y}-${m}-${d}`;
      const dow = (cursor.getDay() + 6) % 7;
      cells.push({ date: key, avg: byDate.get(key) ?? null, week, dow });
      cursor.setDate(cursor.getDate() + 1);
      if (dow === 6) week += 1;
      if (cursor > end && dow === 6) break;
      if (week > 120) break;
    }
    return { cells, min, max, weeks: week + 1 };
  }, [days]);

  function colorFor(avg: number | null) {
    if (avg == null) return "transparent";
    const t = max === min ? 0.5 : (avg - min) / (max - min);
    return mix("#dbe4ea", color, 0.25 + t * 0.75);
  }

  return (
    <ChartCard
      title={`${room} calendar heatmap`}
      subtitle={`Daily average · scale ${fmtTemp(min)} → ${fmtTemp(max)} — hover a day`}
    >
      <div className="heatmap" style={{ ["--weeks" as string]: weeks }}>
        <div className="heatmap__dow">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <div className="heatmap__grid">
          {cells.map((c) => (
            <div
              key={c.date + c.week}
              className="heatmap__cell"
              style={{
                gridColumn: c.week + 1,
                gridRow: c.dow + 1,
                background: colorFor(c.avg),
              }}
              title={
                c.avg == null ? `${c.date}: no data` : `${c.date}: ${fmtTemp(c.avg)}`
              }
            />
          ))}
        </div>
      </div>
    </ChartCard>
  );
}

export function RoomCompareBars({ rooms }: { rooms: RoomSummary[] }) {
  const max = Math.max(...rooms.map((r) => r.avg));
  return (
    <ChartCard title="Room averages at a glance" subtitle="Mean actual temperature across the whole export">
      <ul className="compare-bars">
        {rooms.map((r) => (
          <li key={r.room}>
            <div className="compare-bars__label">
              <strong>{r.room}</strong>
              <span>{fmtTemp(r.avg)}</span>
            </div>
            <div className="compare-bars__track">
              <div
                style={{
                  width: `${(r.avg / max) * 100}%`,
                  background: r.color,
                }}
              />
            </div>
            <div className="compare-bars__meta">
              p10 {fmtTemp(r.p10)} · p90 {fmtTemp(r.p90)} · comfort {r.comfortPct}%
            </div>
          </li>
        ))}
      </ul>
    </ChartCard>
  );
}

function mix(a: string, b: string, t: number) {
  const pa = hex(a);
  const pb = hex(b);
  const m = (i: number) => Math.round(pa[i] + (pb[i] - pa[i]) * t);
  return `rgb(${m(0)}, ${m(1)}, ${m(2)})`;
}

function hex(h: string): [number, number, number] {
  const s = h.replace("#", "");
  return [
    parseInt(s.slice(0, 2), 16),
    parseInt(s.slice(2, 4), 16),
    parseInt(s.slice(4, 6), 16),
  ];
}
