import { useState } from "react";
import { ChartCard } from "./ChartCard";
import { ChartFrame, SoftTooltip } from "./chartTheme";
import { fmtDate, fmtTemp } from "../lib/format";
import { METRIC } from "../lib/metricColors";
import { RoomToggles, useRoomVisibility } from "./SeriesControls";
import {
  Brush,
  CartesianGrid,
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

type ViewMode = "apartment" | "rooms";

export function DailyProgressionChart({ rooms, colors, daily }: Props) {
  const [mode, setMode] = useState<ViewMode>("apartment");
  const { visibleRooms, toggle, showAll, isVisible } = useRoomVisibility(rooms);
  const apartmentColor = colors.Apartment ?? METRIC.apartment;

  return (
    <ChartCard
      title="Daily temperature progression"
      subtitle={
        mode === "apartment"
          ? "Apartment daily mean — hover any day, drag the brush to zoom"
          : "Hover any day, drag the brush to zoom — toggle rooms to untangle overlapping lines"
      }
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
          onClick={() => {
            showAll();
            setMode("rooms");
          }}
        >
          By room
        </button>
      </div>
      {mode === "rooms" ? (
        <RoomToggles
          rooms={rooms}
          colors={colors}
          isVisible={isVisible}
          onToggle={toggle}
          onShowAll={showAll}
        />
      ) : null}
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
          {mode === "apartment" ? (
            <Line
              type="monotone"
              dataKey="avg"
              name="Apartment"
              stroke={apartmentColor}
              strokeWidth={2.25}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
              connectNulls
            />
          ) : (
            visibleRooms.map((room) => (
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
            ))
          )}
          <Brush
            dataKey="t"
            height={28}
            stroke={METRIC.brush}
            tickFormatter={(t) => fmtDate(Number(t))}
            travellerWidth={10}
          />
        </LineChart>
      </ChartFrame>
    </ChartCard>
  );
}
