import { useMemo, useState } from "react";
import {
  Brush,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { ChartCard } from "./ChartCard";
import { ChartFrame, SoftTooltip } from "./chartTheme";
import { tipDotStyle, tipStyle } from "./tipStyles";
import { fmtDate, fmtDateTime, fmtTemp } from "../lib/format";
import { METRIC } from "../lib/metricColors";
import type { WeatherRelations } from "../lib/weatherTypes";

const OUTDOOR = METRIC.outdoor;
const INDOOR = METRIC.apartment;

function axisLabelStyle(extra: Record<string, unknown> = {}) {
  return {
    fill: "#5a6575",
    fontSize: 12,
    ...extra,
  };
}

/** Scatter hover: outdoor vs indoor as separate rows (ignore axis-name payload noise). */
function DayScatterTip({
  active,
  payload,
  groupName,
  groupColor,
}: {
  active?: boolean;
  payload?: Array<{
    name?: string;
    color?: string;
    payload?: { outdoor?: number; indoor?: number; date?: string; heating?: boolean };
  }>;
  groupName: string;
  groupColor: string;
}) {
  if (!active || !payload?.length) return null;
  const d = payload.find((p) => p.payload?.outdoor != null && p.payload?.indoor != null)?.payload;
  if (!d || d.outdoor == null || d.indoor == null) return null;

  return (
    <div style={tipStyle}>
      <div style={{ opacity: 0.7, marginBottom: 6 }}>{d.date ?? "Day"}</div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 3 }}>
        <span style={tipDotStyle(groupColor)} />
        <span style={{ opacity: 0.75 }}>{groupName}</span>
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 6 }}>
        <span style={tipDotStyle(OUTDOOR)} />
        <span style={{ opacity: 0.75 }}>Outdoors</span>
        <span style={{ marginLeft: "auto", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
          {fmtTemp(d.outdoor)}
        </span>
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 3 }}>
        <span style={tipDotStyle(INDOOR)} />
        <span style={{ opacity: 0.75 }}>Indoors</span>
        <span style={{ marginLeft: "auto", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
          {fmtTemp(d.indoor)}
        </span>
      </div>
    </div>
  );
}

type Bundle = WeatherRelations;

export function DualClimateChart({ data, colors }: { data: Bundle["dualSeries"]; colors: Record<string, string> }) {
  return (
    <ChartCard
      title="Indoor vs outdoor over time"
      subtitle="Apartment daily mean + München-Stadt outdoor mean — brush to zoom (same idea as daily progression, with weather)"
    >
      <ChartFrame height={400}>
        <ComposedChart data={data} margin={{ top: 8, right: 12, left: 8, bottom: 28 }}>
          <CartesianGrid stroke="rgba(26,35,50,0.08)" vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(t) => fmtDate(Number(t))}
            minTickGap={48}
            tick={{ fill: "#5a6575", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            label={{
              value: "Date →",
              position: "insideBottom",
              offset: -18,
              style: axisLabelStyle(),
            }}
          />
          <YAxis
            domain={["auto", "auto"]}
            tickFormatter={(v) => `${v}°`}
            width={52}
            tick={{ fill: "#5a6575", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            label={{
              value: "Temperature (°C)",
              angle: -90,
              position: "insideLeft",
              offset: 10,
              style: axisLabelStyle({ textAnchor: "middle" }),
            }}
          />
          <SoftTooltip
            labelFormatter={(l) => fmtDate(Number(l))}
            valueFormatter={(v) => fmtTemp(v)}
          />
          <Line
            type="monotone"
            dataKey="outdoor"
            name="Outdoor"
            stroke={colors.Outdoor ?? OUTDOOR}
            strokeWidth={1.75}
            dot={false}
            strokeDasharray="5 4"
          />
          <Line
            type="monotone"
            dataKey="indoor"
            name="Apartment"
            stroke={colors.Apartment ?? INDOOR}
            strokeWidth={2.25}
            dot={false}
          />
          <Brush dataKey="t" height={28} stroke={METRIC.brush} tickFormatter={(t) => fmtDate(Number(t))} travellerWidth={10} />
        </ComposedChart>
      </ChartFrame>
    </ChartCard>
  );
}

export function DeltaChart({ data }: { data: Bundle["deltaSeries"] }) {
  return (
    <ChartCard
      title="How much warmer is it indoors?"
      subtitle="Apartment mean minus street temperature each day — above 0°C means indoors is warmer than outdoors; below 0°C means the street is warmer"
    >
      <ChartFrame height={320}>
        <ComposedChart data={data} margin={{ top: 8, right: 12, left: 8, bottom: 28 }}>
          <CartesianGrid stroke="rgba(26,35,50,0.08)" vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(t) => fmtDate(Number(t))}
            minTickGap={48}
            tick={{ fill: "#5a6575", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            label={{
              value: "Date →",
              position: "insideBottom",
              offset: -18,
              style: axisLabelStyle(),
            }}
          />
          <YAxis
            domain={["auto", "auto"]}
            tickFormatter={(v) => `${v > 0 ? "+" : ""}${v}°`}
            width={56}
            tick={{ fill: "#5a6575", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            label={{
              value: "Indoors warmer by (°C)",
              angle: -90,
              position: "insideLeft",
              offset: 12,
              style: axisLabelStyle({ textAnchor: "middle" }),
            }}
          />
          <ReferenceLine y={0} stroke="rgba(26,35,50,0.25)" strokeDasharray="3 3" />
          <SoftTooltip
            labelFormatter={(l) => fmtDate(Number(l))}
            valueFormatter={(v) => {
              const n = Number(v);
              if (n > 0) return `${n.toFixed(1)}°C warmer indoors`;
              if (n < 0) return `${Math.abs(n).toFixed(1)}°C warmer outdoors`;
              return "same as outdoors";
            }}
          />
          <Line
            type="monotone"
            dataKey="delta"
            name="Indoors vs outdoors"
            stroke={METRIC.delta}
            strokeWidth={2}
            dot={false}
          />
          <Brush dataKey="t" height={28} stroke={METRIC.brush} tickFormatter={(t) => fmtDate(Number(t))} travellerWidth={10} />
        </ComposedChart>
      </ChartFrame>
    </ChartCard>
  );
}

export function CouplingScatter({
  apt,
  rooms,
  scatterRooms,
  colors,
  corrApartment,
}: {
  apt: Bundle["scatterApt"];
  rooms: string[];
  scatterRooms: Bundle["scatterRooms"];
  colors: Record<string, string>;
  corrApartment: number | null;
}) {
  const [mode, setMode] = useState<"apartment" | "rooms">("apartment");
  /** By-room starts with a single room so dots stay readable. */
  const [room, setRoom] = useState(rooms[0] ?? "");

  const points = mode === "apartment" ? apt : (scatterRooms[room] ?? []);
  const equalTempLine = useMemo(() => {
    if (!points.length) return null;
    let lo = Infinity;
    let hi = -Infinity;
    for (const p of points) {
      lo = Math.min(lo, p.outdoor, p.indoor);
      hi = Math.max(hi, p.outdoor, p.indoor);
    }
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo === hi) return null;
    // Slight pad so the dashed equal-temp line reaches the plot edges
    const pad = (hi - lo) * 0.04;
    const a = lo - pad;
    const b = hi + pad;
    return [
      { x: a, y: a },
      { x: b, y: b },
    ] as const;
  }, [points]);

  return (
    <ChartCard
      title="When outdoors changes, does indoors follow?"
      subtitle={`Each dot is one day (outdoor mean → indoor mean). Dashed line = equal indoor/outdoor · follow score ${corrApartment ?? "—"} (1 = lockstep)`}
    >
      <div className="room-pills" style={{ marginBottom: "0.75rem" }}>
        <button
          type="button"
          className={mode === "apartment" ? "pill active" : "pill"}
          onClick={() => setMode("apartment")}
        >
          Apartment
        </button>
        <button
          type="button"
          className={mode === "rooms" ? "pill active" : "pill"}
          onClick={() => setMode("rooms")}
        >
          By room
        </button>
      </div>
      {mode === "rooms" ? (
        <div className="room-pills" style={{ marginBottom: "0.75rem" }}>
          {rooms.map((r) => (
            <button
              key={r}
              type="button"
              className={r === room ? "pill active" : "pill"}
              style={{ ["--pill" as string]: colors[r] }}
              onClick={() => setRoom(r)}
            >
              {r}
            </button>
          ))}
        </div>
      ) : null}
      <ChartFrame height={360}>
        <ScatterChart margin={{ top: 8, right: 16, left: 8, bottom: 28 }}>
          <CartesianGrid stroke="rgba(26,35,50,0.08)" />
          <XAxis
            type="number"
            dataKey="outdoor"
            name="Outdoors"
            unit="°C"
            tick={{ fill: "#5a6575", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            label={{
              value: "Outdoors (°C) →",
              position: "insideBottom",
              offset: -18,
              style: axisLabelStyle(),
            }}
          />
          <YAxis
            type="number"
            dataKey="indoor"
            name="Indoors"
            unit="°C"
            width={52}
            tick={{ fill: "#5a6575", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            label={{
              value: "Indoors (°C)",
              angle: -90,
              position: "insideLeft",
              offset: 10,
              style: axisLabelStyle({ textAnchor: "middle" }),
            }}
          />
          <Tooltip
            cursor={{ strokeDasharray: "4 4", stroke: "rgba(26,35,50,0.25)" }}
            content={(props) => (
              <DayScatterTip
                active={props.active}
                payload={props.payload as never}
                groupName={mode === "rooms" ? room : "Apartment"}
                groupColor={
                  mode === "rooms" ? (colors[room] ?? INDOOR) : INDOOR
                }
              />
            )}
          />
          {equalTempLine ? (
            <ReferenceLine
              segment={equalTempLine}
              stroke="rgba(26,35,50,0.45)"
              strokeDasharray="6 5"
              strokeWidth={1.5}
              ifOverflow="hidden"
              label={{
                value: "equal temps",
                position: "insideTopLeft",
                fill: "#5a6575",
                fontSize: 11,
              }}
            />
          ) : null}
          {mode === "apartment" ? (
            <Scatter name="Apartment" data={apt} fill={INDOOR} fillOpacity={0.45} />
          ) : (
            <Scatter
              name={room}
              data={scatterRooms[room] ?? []}
              fill={colors[room] ?? INDOOR}
              fillOpacity={0.5}
            />
          )}
        </ScatterChart>
      </ChartFrame>
    </ChartCard>
  );
}

export function SpreadVsOutdoor({ data }: { data: Bundle["spreadScatter"] }) {
  return (
    <ChartCard
      title="Room spread vs outdoor"
      subtitle="Does the flat diverge more when the street is extreme? (apartment min–max spread)"
    >
      <ChartFrame height={340}>
        <ScatterChart margin={{ top: 8, right: 16, left: 8, bottom: 28 }}>
          <CartesianGrid stroke="rgba(26,35,50,0.08)" />
          <XAxis
            type="number"
            dataKey="outdoor"
            name="Outdoors"
            unit="°C"
            tick={{ fill: "#5a6575", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            label={{
              value: "Outdoors (°C) →",
              position: "insideBottom",
              offset: -18,
              style: axisLabelStyle(),
            }}
          />
          <YAxis
            type="number"
            dataKey="spread"
            name="Spread"
            unit="°C"
            width={56}
            tick={{ fill: "#5a6575", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            label={{
              value: "Room-to-room spread (°C)",
              angle: -90,
              position: "insideLeft",
              offset: 12,
              style: axisLabelStyle({ textAnchor: "middle" }),
            }}
          />
          <SoftTooltip valueFormatter={(v) => fmtTemp(v)} />
          <Legend verticalAlign="top" height={28} wrapperStyle={{ fontSize: 12, color: "#5a6575" }} />
          <Scatter
            data={data.filter((p) => p.heating)}
            name="Heating season"
            fill={METRIC.heatingSeason}
            fillOpacity={0.5}
          />
          <Scatter
            data={data.filter((p) => !p.heating)}
            name="Summer season"
            fill={METRIC.offSeason}
            fillOpacity={0.5}
          />
        </ScatterChart>
      </ChartFrame>
    </ChartCard>
  );
}

function AcEventTip({
  active,
  payload,
  color,
}: {
  active?: boolean;
  payload?: Array<{
    payload?: Bundle["acEvents"][number];
  }>;
  color: string;
}) {
  if (!active || !payload?.length) return null;
  const e = payload.find((p) => p.payload?.t != null)?.payload;
  if (!e) return null;
  return (
    <div style={tipStyle}>
      <div style={{ opacity: 0.7, marginBottom: 6 }}>{fmtDateTime(e.t)}</div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 3 }}>
        <span style={tipDotStyle(color)} />
        <span style={{ opacity: 0.75 }}>Indoor</span>
        <span style={{ marginLeft: "auto", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
          {fmtTemp(e.from)} → {fmtTemp(e.to)}
        </span>
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 3 }}>
        <span style={{ opacity: 0.75 }}>Cool-down</span>
        <span style={{ marginLeft: "auto", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
          −{e.drop.toFixed(1)}°C · {e.minutes} min
        </span>
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 3 }}>
        <span style={tipDotStyle(OUTDOOR)} />
        <span style={{ opacity: 0.75 }}>Outdoor max</span>
        <span style={{ marginLeft: "auto", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
          {fmtTemp(e.outdoorMax)}
        </span>
      </div>
    </div>
  );
}

export function AcWeatherScatter({ events, color }: { events: Bundle["acEvents"]; color: string }) {
  const pts = events.filter((e) => e.outdoorMax != null);
  return (
    <ChartCard
      title="AC cool-downs × outdoor heat"
      subtitle="Wohnzimmer cool-downs (room color) vs that day’s outdoor max — hover a point for date and details"
    >
      {pts.length ? (
        <ChartFrame height={360}>
          <ScatterChart margin={{ top: 8, right: 16, left: 8, bottom: 28 }}>
            <CartesianGrid stroke="rgba(26,35,50,0.08)" />
            <XAxis
              type="number"
              dataKey="outdoorMax"
              name="Outdoor max"
              unit="°C"
              tick={{ fill: "#5a6575", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              label={{
                value: "Outdoor max that day (°C) →",
                position: "insideBottom",
                offset: -18,
                style: axisLabelStyle(),
              }}
            />
            <YAxis
              type="number"
              dataKey="drop"
              name="Drop"
              unit="°C"
              width={56}
              tick={{ fill: "#5a6575", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              label={{
                value: "Indoor cool-down (°C)",
                angle: -90,
                position: "insideLeft",
                offset: 12,
                style: axisLabelStyle({ textAnchor: "middle" }),
              }}
            />
            <ZAxis dataKey="minutes" range={[40, 160]} />
            <Tooltip
              cursor={{ strokeDasharray: "4 4", stroke: "rgba(26,35,50,0.25)" }}
              content={(props) => (
                <AcEventTip
                  active={props.active}
                  payload={props.payload as never}
                  color={color}
                />
              )}
            />
            <Scatter data={pts} fill={color} name="Cool-down" />
          </ScatterChart>
        </ChartFrame>
      ) : (
        <p className="empty-note">No AC events with outdoor join.</p>
      )}
    </ChartCard>
  );
}

