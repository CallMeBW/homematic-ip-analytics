import { useMemo } from "react";
import { ChartCard } from "./ChartCard";
import { ChartFrame, SoftTooltip } from "./chartTheme";
import { fmtDate, fmtDateTime, fmtTemp } from "../lib/format";
import type { RoomDetail, RoomSummary } from "../lib/types";
import {
  Area,
  AreaChart,
  Brush,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  Scatter,
  ScatterChart,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";

type Props = {
  detail: RoomDetail;
  summary: RoomSummary;
};

export function RoomExplorer({ detail, summary }: Props) {
  const recentMerged = useMemo(() => {
    const map = new Map<number, { t: number; actual?: number; setpoint?: number }>();
    for (const p of detail.recentHourly.actual) {
      map.set(p.t, { ...(map.get(p.t) || { t: p.t }), actual: p.v });
    }
    for (const p of detail.recentHourly.setpoint) {
      const row = map.get(p.t) || { t: p.t };
      row.setpoint = p.v;
      map.set(p.t, row);
    }
    return [...map.values()].sort((a, b) => a.t - b.t);
  }, [detail]);

  const longMerged = useMemo(() => {
    const map = new Map<number, { t: number; actual?: number; setpoint?: number; gap?: number }>();
    for (const p of detail.series.actual) {
      map.set(p.t, { t: p.t, actual: p.v });
    }
    for (const p of detail.series.setpoint) {
      const row = map.get(p.t) || { t: p.t };
      row.setpoint = p.v;
      map.set(p.t, row);
    }
    for (const p of detail.series.gap) {
      const row = map.get(p.t) || { t: p.t };
      row.gap = p.v;
      map.set(p.t, row);
    }
    return [...map.values()].sort((a, b) => a.t - b.t);
  }, [detail]);

  const heatUpScatter = detail.heatUps.map((h) => ({
    t: h.t,
    minutes: h.minutes,
    label: `${h.from}→${h.to}°C`,
  }));

  const rangeDays = [...detail.daily].sort((a, b) => b.range - a.range).slice(0, 12);

  return (
    <div className="room-explorer">
      <div className="room-explorer__stats">
        <Stat label="Average" value={fmtTemp(summary.avg)} />
        <Stat label="Median" value={fmtTemp(summary.p50)} />
        <Stat label="Range" value={`${fmtTemp(summary.min)} – ${fmtTemp(summary.max)}`} />
        <Stat label="σ (volatility)" value={`${summary.stddev.toFixed(2)}°C`} />
        <Stat label="Comfort band" value={`${summary.comfortPct}%`} hint="20–22.5°C" />
        <Stat label="Avg heat-up" value={summary.avgHeatUpMinutes != null ? `${summary.avgHeatUpMinutes} min` : "—"} />
        <Stat label="Above setpoint" value={`${summary.overheatPct}%`} hint="actual > setpoint +0.5°" />
        <Stat label="Below setpoint" value={`${summary.underheatPct}%`} />
        <Stat label="Night / day" value={`${fmtTemp(summary.nightAvg)} / ${fmtTemp(summary.dayAvg)}`} />
        <Stat label="Setpoint changes" value={String(summary.setpointChanges)} />
      </div>

      <ChartCard
        title={`${detail.room} — last 90 days (hourly)`}
        subtitle="Actual vs setpoint with hover readouts"
      >
        <ChartFrame height={340}>
          <LineChart data={recentMerged} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="rgba(26,35,50,0.08)" vertical={false} />
            <XAxis
              dataKey="t"
              type="number"
              domain={["dataMin", "dataMax"]}
              tickFormatter={(t) => fmtDate(Number(t))}
              minTickGap={40}
              tick={{ fill: "#5a6575", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v) => `${v}°`}
              width={42}
              tick={{ fill: "#5a6575", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <SoftTooltip
              labelFormatter={(l) => fmtDateTime(Number(l))}
              valueFormatter={(v) => fmtTemp(v)}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="actual"
              name="Actual"
              stroke={detail.color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              type="stepAfter"
              dataKey="setpoint"
              name="Setpoint"
              stroke="#1a2332"
              strokeWidth={1.5}
              strokeDasharray="5 3"
              dot={false}
            />
            <Brush dataKey="t" height={24} stroke={detail.color} tickFormatter={(t) => fmtDate(Number(t))} />
          </LineChart>
        </ChartFrame>
      </ChartCard>

      <div className="grid-2">
        <ChartCard
          title={`${detail.room} — full history`}
          subtitle="Downsampled for smooth browsing; brush to zoom eras"
        >
          <ChartFrame height={300}>
            <AreaChart data={longMerged} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`fill-${detail.room}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={detail.color} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={detail.color} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(26,35,50,0.08)" vertical={false} />
              <XAxis
                dataKey="t"
                type="number"
                domain={["dataMin", "dataMax"]}
                tickFormatter={(t) => fmtDate(Number(t))}
                minTickGap={40}
                tick={{ fill: "#5a6575", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) => `${v}°`}
                width={42}
                tick={{ fill: "#5a6575", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <SoftTooltip
                labelFormatter={(l) => fmtDateTime(Number(l))}
                valueFormatter={(v) => fmtTemp(v)}
              />
              <Area
                type="monotone"
                dataKey="actual"
                name="Actual"
                stroke={detail.color}
                fill={`url(#fill-${detail.room})`}
                strokeWidth={1.75}
                dot={false}
              />
              <Line
                type="stepAfter"
                dataKey="setpoint"
                name="Setpoint"
                stroke="#1a2332"
                strokeWidth={1.25}
                strokeDasharray="4 3"
                dot={false}
              />
              <Brush dataKey="t" height={22} stroke={detail.color} />
            </AreaChart>
          </ChartFrame>
        </ChartCard>

        <ChartCard
          title="Actual − setpoint gap"
          subtitle="Positive = warmer than target (often eco setpoints / solar gain)"
        >
          <ChartFrame height={300}>
            <AreaChart data={longMerged} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="rgba(26,35,50,0.08)" vertical={false} />
              <XAxis
                dataKey="t"
                type="number"
                domain={["dataMin", "dataMax"]}
                tickFormatter={(t) => fmtDate(Number(t))}
                minTickGap={40}
                tick={{ fill: "#5a6575", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) => `${v > 0 ? "+" : ""}${v}°`}
                width={48}
                tick={{ fill: "#5a6575", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <ReferenceLine y={0} stroke="rgba(26,35,50,0.35)" />
              <SoftTooltip
                labelFormatter={(l) => fmtDateTime(Number(l))}
                valueFormatter={(v) => `${v > 0 ? "+" : ""}${v.toFixed(2)}°C`}
              />
              <Area
                type="monotone"
                dataKey="gap"
                name="Gap"
                stroke="#d4652f"
                fill="rgba(212,101,47,0.18)"
                strokeWidth={1.5}
                dot={false}
              />
              <Brush dataKey="t" height={22} stroke="#d4652f" />
            </AreaChart>
          </ChartFrame>
        </ChartCard>
      </div>

      <div className="grid-2">
        <ChartCard title="Heat-up events" subtitle="Minutes to approach a raised setpoint (≥0.5°C bumps)">
          {heatUpScatter.length ? (
            <ChartFrame height={280}>
              <ScatterChart margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="rgba(26,35,50,0.08)" />
                <XAxis
                  dataKey="t"
                  type="number"
                  domain={["dataMin", "dataMax"]}
                  tickFormatter={(t) => fmtDate(Number(t))}
                  tick={{ fill: "#5a6575", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  dataKey="minutes"
                  name="Minutes"
                  unit=" min"
                  tick={{ fill: "#5a6575", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                />
                <ZAxis range={[60, 60]} />
                <SoftTooltip
                  labelFormatter={() => detail.room}
                  valueFormatter={(v, name) =>
                    name === "minutes" || name === "Minutes" ? `${v} min` : fmtDateTime(Number(v))
                  }
                />
                <Scatter data={heatUpScatter} fill={detail.color} name="Heat-up" />
              </ScatterChart>
            </ChartFrame>
          ) : (
            <p className="empty-note">Not enough clear heat-up events detected.</p>
          )}
        </ChartCard>

        <ChartCard title="Wildest intra-day swings" subtitle="Top days by min→max range inside this room">
          <ul className="swing-list">
            {rangeDays.map((d) => (
              <li key={d.date}>
                <span>{d.date}</span>
                <span className="swing-list__temps">
                  {fmtTemp(d.min)} → {fmtTemp(d.max)}
                </span>
                <strong>Δ {d.range.toFixed(1)}°C</strong>
              </li>
            ))}
          </ul>
        </ChartCard>
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="mini-stat">
      <span className="mini-stat__label">{label}</span>
      <span className="mini-stat__value">{value}</span>
      {hint ? <span className="mini-stat__hint">{hint}</span> : null}
    </div>
  );
}
