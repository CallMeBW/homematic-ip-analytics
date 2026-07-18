import { ChartCard } from "./ChartCard";
import { ChartFrame, SoftTooltip } from "./chartTheme";
import { fmtMonth, fmtTemp, hourLabel } from "../lib/format";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  Cell,
} from "recharts";

type Common = {
  rooms: string[];
  colors: Record<string, string>;
};

export function HourlyProfileChart({
  rooms,
  colors,
  byHour,
}: Common & { byHour: Array<Record<string, number | null>> }) {
  return (
    <ChartCard
      title="Typical day (by hour)"
      subtitle="Average actual temperature for each hour of the day — your diurnal climate fingerprint"
    >
      <ChartFrame height={300}>
        <LineChart data={byHour} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="rgba(26,35,50,0.08)" vertical={false} />
          <XAxis
            dataKey="hour"
            tickFormatter={hourLabel}
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
            labelFormatter={(l) => hourLabel(Number(l))}
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
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5, strokeWidth: 0 }}
            />
          ))}
        </LineChart>
      </ChartFrame>
    </ChartCard>
  );
}

export function WeekdayChart({
  rooms,
  colors,
  byWeekday,
}: Common & { byWeekday: Array<Record<string, number | string | null>> }) {
  return (
    <ChartCard
      title="Weekday vs weekend"
      subtitle="Do weekends run warmer? Hover a day to compare rooms"
    >
      <ChartFrame height={300}>
        <BarChart data={byWeekday} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="rgba(26,35,50,0.08)" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: "#5a6575", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis
            domain={["auto", "auto"]}
            tickFormatter={(v) => `${v}°`}
            width={42}
            tick={{ fill: "#5a6575", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <SoftTooltip valueFormatter={(v) => fmtTemp(v)} />
          <Legend />
          {rooms.map((room) => (
            <Bar key={room} dataKey={room} name={room} fill={colors[room]} radius={[4, 4, 0, 0]} maxBarSize={28} />
          ))}
        </BarChart>
      </ChartFrame>
    </ChartCard>
  );
}

export function MonthlyChart({
  rooms,
  colors,
  monthly,
}: Common & { monthly: Array<Record<string, number | string | null>> }) {
  return (
    <ChartCard
      title="Seasonal / monthly averages"
      subtitle="How the apartment climate drifts through the year"
    >
      <ChartFrame height={320}>
        <LineChart data={monthly} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="rgba(26,35,50,0.08)" vertical={false} />
          <XAxis
            dataKey="month"
            tickFormatter={(m) => fmtMonth(String(m))}
            tick={{ fill: "#5a6575", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            minTickGap={24}
          />
          <YAxis
            tickFormatter={(v) => `${v}°`}
            width={42}
            tick={{ fill: "#5a6575", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <SoftTooltip
            labelFormatter={(l) => fmtMonth(String(l))}
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
              strokeWidth={2.5}
              dot={{ r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          ))}
          <Line
            type="monotone"
            dataKey="avg"
            name="Apartment mean"
            stroke="#1a2332"
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={false}
          />
        </LineChart>
      </ChartFrame>
    </ChartCard>
  );
}

export function RoomRadar({ rooms }: { rooms: Array<{ room: string; color: string; avg: number; comfortPct: number; stddev: number; nightDayDelta: number | null }> }) {
  const maxAvg = Math.max(...rooms.map((r) => r.avg));
  const maxSd = Math.max(...rooms.map((r) => r.stddev));
  const data = [
    {
      metric: "Warmth",
      ...Object.fromEntries(rooms.map((r) => [r.room, +((r.avg / maxAvg) * 100).toFixed(1)])),
    },
    {
      metric: "Comfort %",
      ...Object.fromEntries(rooms.map((r) => [r.room, r.comfortPct])),
    },
    {
      metric: "Stability",
      ...Object.fromEntries(
        rooms.map((r) => [r.room, +((1 - r.stddev / maxSd) * 100).toFixed(1)])
      ),
    },
    {
      metric: "Day/night Δ",
      ...Object.fromEntries(
        rooms.map((r) => [
          r.room,
          Math.min(100, Math.abs(r.nightDayDelta ?? 0) * 40),
        ])
      ),
    },
  ];

  return (
    <ChartCard
      title="Room character radar"
      subtitle="Normalized traits — warmth, time in comfort band, stability, day/night swing"
    >
      <ChartFrame height={340}>
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
          <PolarGrid stroke="rgba(26,35,50,0.12)" />
          <PolarAngleAxis dataKey="metric" tick={{ fill: "#5a6575", fontSize: 12 }} />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
          <SoftTooltip valueFormatter={(v) => `${v.toFixed(0)}`} />
          <Legend />
          {rooms.map((r) => (
            <Radar
              key={r.room}
              name={r.room}
              dataKey={r.room}
              stroke={r.color}
              fill={r.color}
              fillOpacity={0.12}
              strokeWidth={2}
            />
          ))}
        </RadarChart>
      </ChartFrame>
    </ChartCard>
  );
}

export function DistributionChart({
  rooms,
  colors,
  distributions,
  selected,
  onSelect,
}: Common & {
  distributions: Record<string, Array<{ x: number; count: number }>>;
  selected: string;
  onSelect: (room: string) => void;
}) {
  const data = distributions[selected] ?? [];
  return (
    <ChartCard
      title="Temperature distribution"
      subtitle="How often each temperature occurs (0.5°C bins)"
    >
      <div className="room-pills">
        {rooms.map((room) => (
          <button
            key={room}
            type="button"
            className={room === selected ? "pill active" : "pill"}
            style={{ ["--pill" as string]: colors[room] }}
            onClick={() => onSelect(room)}
          >
            {room}
          </button>
        ))}
      </div>
      <ChartFrame height={280}>
        <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="rgba(26,35,50,0.08)" vertical={false} />
          <XAxis
            dataKey="x"
            tickFormatter={(v) => `${v}°`}
            tick={{ fill: "#5a6575", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            minTickGap={16}
          />
          <YAxis tick={{ fill: "#5a6575", fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
          <SoftTooltip
            labelFormatter={(l) => `${l}°C bin`}
            valueFormatter={(v) => `${v.toLocaleString("de-DE")} samples`}
          />
          <Bar dataKey="count" name="Samples" radius={[3, 3, 0, 0]}>
            {data.map((d) => (
              <Cell
                key={d.x}
                fill={d.x >= 20 && d.x <= 22.5 ? colors[selected] : `${colors[selected]}99`}
              />
            ))}
          </Bar>
        </BarChart>
      </ChartFrame>
    </ChartCard>
  );
}

export function CorrelationList({
  correlations,
}: {
  correlations: Array<{ a: string; b: string; r: number; n: number }>;
}) {
  return (
    <ChartCard
      title="Room correlations"
      subtitle="How closely daily averages move together (Pearson r)"
    >
      <ul className="corr-list">
        {correlations.map((c) => (
          <li key={`${c.a}-${c.b}`}>
            <div className="corr-list__pair">
              <strong>
                {c.a} ↔ {c.b}
              </strong>
              <span>{c.n} shared days</span>
            </div>
            <div className="corr-list__bar">
              <div style={{ width: `${Math.abs(c.r) * 100}%` }} />
            </div>
            <span className="corr-list__r">r = {c.r.toFixed(3)}</span>
          </li>
        ))}
      </ul>
    </ChartCard>
  );
}
