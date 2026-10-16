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
  Line,
  XAxis,
  YAxis,
} from "recharts";

type Props = {
  detail: RoomDetail;
  summary: RoomSummary;
};

type MergedPoint = { t: number; actual?: number; setpoint?: number | null };

/** Merge actual samples with sparse/step setpoint via forward-fill (null clears). */
function mergeActualSetpoint(
  actual: Array<{ t: number; v: number }>,
  setpoint: Array<{ t: number; v: number | null }>
): MergedPoint[] {
  const sp = setpoint;
  let j = 0;
  let lastSp: number | null | undefined = undefined;
  return actual.map((p) => {
    while (j < sp.length && sp[j].t <= p.t) {
      lastSp = sp[j].v;
      j += 1;
    }
    return {
      t: p.t,
      actual: p.v,
      setpoint: lastSp === undefined ? undefined : lastSp,
    };
  });
}

export function RoomExplorer({ detail, summary }: Props) {
  const longMerged = useMemo(
    () => mergeActualSetpoint(detail.series.actual, detail.series.setpoint),
    [detail.series]
  );

  return (
    <div className="room-explorer">
      <div className="room-explorer__stats">
        <Stat label="Average" value={fmtTemp(summary.avg)} />
        <Stat label="Median" value={fmtTemp(summary.p50)} />
        <Stat label="Range" value={`${fmtTemp(summary.min)} – ${fmtTemp(summary.max)}`} />
        <Stat label="σ (volatility)" value={`${summary.stddev.toFixed(2)}°C`} />
        <Stat label="Comfort band" value={`${summary.comfortPct}%`} hint="20–22.5°C" />
        <Stat
          label="Avg heat-up"
          value={summary.avgHeatUpMinutes != null ? `${summary.avgHeatUpMinutes} min` : "—"}
          hint="heating season only"
        />
        <Stat
          label="Above setpoint"
          value={`${summary.overheatPct}%`}
          hint="heating season · actual > SP +0.5°"
        />
        <Stat label="Below setpoint" value={`${summary.underheatPct}%`} hint="heating season only" />
        <Stat label="Night / day" value={`${fmtTemp(summary.nightAvg)} / ${fmtTemp(summary.dayAvg)}`} />
        <Stat
          label="Setpoint changes"
          value={String(summary.setpointChanges)}
          hint={
            summary.heatingActivePct != null
              ? `${summary.heatingActivePct}% of days in heating season`
              : "heating season only"
          }
        />
      </div>

      <ChartCard
        title={`${detail.room} — full history`}
        subtitle="Setpoint only in heating seasons; brush to zoom"
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
              connectNulls={false}
            />
            <Brush dataKey="t" height={22} stroke={detail.color} />
          </AreaChart>
        </ChartFrame>
      </ChartCard>
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
