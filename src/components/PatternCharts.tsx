import { useState } from "react";
import { ChartCard } from "./ChartCard";
import { ChartFrame, SoftTooltip } from "./chartTheme";
import { fmtMonth, fmtTemp, hourLabel } from "../lib/format";
import {
  RoomToggles,
  SeasonToggles,
  useRoomVisibility,
  type SeasonMode,
} from "./SeriesControls";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";

type Common = {
  rooms: string[];
  colors: Record<string, string>;
};

function pickSeasonal<T>(
  mode: SeasonMode,
  all: T,
  heating: T | undefined,
  offSeason: T | undefined
): T {
  if (mode === "heating" && heating) return heating;
  if (mode === "offSeason" && offSeason) return offSeason;
  return all;
}

export function HourlyProfileChart({
  rooms,
  colors,
  byHour,
  byHourHeating,
  byHourOffSeason,
  heatingHint,
  offSeasonHint,
}: Common & {
  byHour: Array<Record<string, number | null>>;
  byHourHeating?: Array<Record<string, number | null>>;
  byHourOffSeason?: Array<Record<string, number | null>>;
  heatingHint?: string;
  offSeasonHint?: string;
}) {
  const [season, setSeason] = useState<SeasonMode>("all");
  const { visibleRooms, toggle, showAll, isVisible } = useRoomVisibility(rooms);
  const data = pickSeasonal(season, byHour, byHourHeating, byHourOffSeason);

  return (
    <ChartCard
      title="Typical day (by hour)"
      subtitle="Diurnal fingerprint — switch heating vs summer season; toggle rooms to isolate lines"
    >
      <SeasonToggles
        value={season}
        onChange={setSeason}
        heatingHint={heatingHint}
        offSeasonHint={offSeasonHint}
      />
      <RoomToggles
        rooms={rooms}
        colors={colors}
        isVisible={isVisible}
        onToggle={toggle}
        onShowAll={showAll}
      />
      <ChartFrame height={300}>
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
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
          {visibleRooms.map((room) => (
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
  byWeekdayHeating,
  byWeekdayOffSeason,
  heatingHint,
  offSeasonHint,
}: Common & {
  byWeekday: Array<Record<string, number | string | null>>;
  byWeekdayHeating?: Array<Record<string, number | string | null>>;
  byWeekdayOffSeason?: Array<Record<string, number | string | null>>;
  heatingHint?: string;
  offSeasonHint?: string;
}) {
  const [season, setSeason] = useState<SeasonMode>("all");
  const { visibleRooms, toggle, showAll, isVisible } = useRoomVisibility(rooms);
  const data = pickSeasonal(season, byWeekday, byWeekdayHeating, byWeekdayOffSeason);

  return (
    <ChartCard
      title="Weekday vs weekend"
      subtitle="Season-aware weekday habits — hide rooms that clutter the comparison"
    >
      <SeasonToggles
        value={season}
        onChange={setSeason}
        heatingHint={heatingHint}
        offSeasonHint={offSeasonHint}
      />
      <RoomToggles
        rooms={rooms}
        colors={colors}
        isVisible={isVisible}
        onToggle={toggle}
        onShowAll={showAll}
      />
      <ChartFrame height={300}>
        <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
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
          {visibleRooms.map((room) => (
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
  const { visibleRooms, toggle, showAll, isVisible } = useRoomVisibility(rooms);

  return (
    <ChartCard
      title="Seasonal / monthly averages"
      subtitle="How the apartment climate drifts through the year"
    >
      <RoomToggles
        rooms={rooms}
        colors={colors}
        isVisible={isVisible}
        onToggle={toggle}
        onShowAll={showAll}
      />
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
          {visibleRooms.map((room) => (
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

const APARTMENT_KEY = "Apartment";

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
  const pillColor = colors[selected] ?? "#1a2332";
  const options = [APARTMENT_KEY, ...rooms.filter((r) => r !== APARTMENT_KEY)];
  return (
    <ChartCard
      title="Temperature distribution"
      subtitle="How often each temperature occurs (0.5°C bins)"
    >
      <div className="room-pills">
        {options.map((room) => (
          <button
            key={room}
            type="button"
            className={room === selected ? "pill active" : "pill"}
            style={{ ["--pill" as string]: colors[room] ?? "#1a2332" }}
            onClick={() => onSelect(room)}
          >
            {room === APARTMENT_KEY ? "Whole apartment" : room}
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
          <Bar dataKey="count" name="Samples" fill={pillColor} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ChartFrame>
    </ChartCard>
  );
}
