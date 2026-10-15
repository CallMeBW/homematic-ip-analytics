import { Wind } from "lucide-react";
import { ChartCard } from "./ChartCard";
import { ChartFrame, SoftTooltip } from "./chartTheme";
import { SectionHead } from "./SectionHead";
import { fmtDate, fmtDateTime, fmtTemp } from "../lib/format";
import type { AcEffectData } from "../lib/types";
import {
  CartesianGrid,
  Scatter,
  ScatterChart,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";

type Props = {
  ac: AcEffectData;
  colors: Record<string, string>;
};

export function AcEffectSection({ ac, colors }: Props) {
  const acRoom = ac.room;
  const coolingScatter = ac.coolingEvents.map((e) => ({
    t: e.t,
    drop: e.drop,
    minutes: e.minutes,
  }));

  return (
    <section className="section">
      <SectionHead icon={Wind} title={`AC effect · ${acRoom}`}>
        Sharp Wohnzimmer cool-downs outside detected heating seasons (≥1.2°C within 4 hours) — a
        proxy for AC cycles
      </SectionHead>

      <ChartCard
        title="Cool-down events"
        subtitle={`${ac.coolingEvents.length} events · avg drop ${
          ac.kpis.avgCoolingDrop != null ? `${ac.kpis.avgCoolingDrop.toFixed(1)}°C` : "—"
        }`}
      >
        {coolingScatter.length ? (
          <>
            <ChartFrame height={300}>
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
                  dataKey="drop"
                  name="Drop"
                  unit="°C"
                  tick={{ fill: "#5a6575", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={42}
                />
                <ZAxis dataKey="minutes" range={[40, 140]} />
                <SoftTooltip
                  labelFormatter={() => acRoom}
                  valueFormatter={(v, name) => {
                    if (name === "drop" || name === "Drop") return `${Number(v).toFixed(1)}°C`;
                    if (name === "minutes" || name === "Minutes") return `${v} min`;
                    return fmtDateTime(Number(v));
                  }}
                />
                <Scatter data={coolingScatter} fill={colors[acRoom]} name="Cool-down" />
              </ScatterChart>
            </ChartFrame>
            <ul className="swing-list ac-event-list">
              {ac.coolingEvents.slice(0, 10).map((e) => (
                <li key={`${e.t}-${e.endT}`}>
                  <span>{fmtDateTime(e.t)}</span>
                  <span className="swing-list__temps">
                    {fmtTemp(e.from)} → {fmtTemp(e.to)}
                  </span>
                  <strong>
                    −{e.drop.toFixed(1)}°C · {e.minutes} min
                  </strong>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="empty-note">No clear cool-down events detected.</p>
        )}
      </ChartCard>
    </section>
  );
}
