import { ChartCard } from "./ChartCard";
import { ChartFrame, SoftTooltip } from "./chartTheme";
import { fmtDate, fmtTemp } from "../lib/format";
import {
  AreaChart,
  Brush,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";

type Props = {
  rooms: string[];
  colors: Record<string, string>;
  daily: Array<Record<string, number | string>>;
};

export function DailyProgressionChart({ rooms, colors, daily }: Props) {
  return (
    <ChartCard
      title="Daily temperature progression"
      subtitle="Apartment rooms over the full export — hover any day, drag the brush to zoom"
    >
      <ChartFrame height={380}>
        <LineChart data={daily} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
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
          />
          <YAxis
            domain={["auto", "auto"]}
            tickFormatter={(v) => `${v}°`}
            width={42}
            tick={{ fill: "#5a6575", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <SoftTooltip
            labelFormatter={(l) => fmtDate(Number(l))}
            valueFormatter={(v) => fmtTemp(v)}
          />
          <Legend />
          {rooms.map((room) => (
            <Line
              key={room}
              type="monotone"
              dataKey={room}
              name={room}
              stroke={colors[room]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
              connectNulls
            />
          ))}
          <Brush
            dataKey="t"
            height={28}
            stroke="#1f6f8b"
            tickFormatter={(t) => fmtDate(Number(t))}
            travellerWidth={10}
          />
        </LineChart>
      </ChartFrame>
    </ChartCard>
  );
}

export function ApartmentSpreadChart({
  apartmentDaily,
}: {
  apartmentDaily: Array<{ t: number; date: string; avg: number; min: number; max: number; spread: number }>;
}) {
  return (
    <ChartCard
      title="Apartment daily band"
      subtitle="Min–max across rooms each day, with mean — how uneven was the flat?"
    >
      <ChartFrame height={320}>
        <AreaChart data={apartmentDaily} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
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
          />
          <YAxis
            tickFormatter={(v) => `${v}°`}
            width={42}
            tick={{ fill: "#5a6575", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <SoftTooltip
            labelFormatter={(l) => fmtDate(Number(l))}
            valueFormatter={(v, name) =>
              name === "Room spread" ? `${v.toFixed(2)}°C` : fmtTemp(v)
            }
          />
          <Line
            type="monotone"
            dataKey="max"
            name="Warmest room"
            stroke="#d4652f"
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3 }}
          />
          <Line
            type="monotone"
            dataKey="min"
            name="Coolest room"
            stroke="#1f6f8b"
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3 }}
          />
          <Line
            type="monotone"
            dataKey="avg"
            name="Apartment mean"
            stroke="#1a2332"
            strokeWidth={2.25}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="spread"
            name="Room spread"
            stroke="#8b5a9e"
            strokeWidth={1.25}
            strokeDasharray="4 4"
            dot={false}
          />
          <Brush dataKey="t" height={24} stroke="#1f6f8b" tickFormatter={(t) => fmtDate(Number(t))} />
        </AreaChart>
      </ChartFrame>
    </ChartCard>
  );
}
