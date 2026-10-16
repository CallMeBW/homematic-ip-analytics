import { useMemo, useState } from "react";
import { ChartCard } from "./ChartCard";
import { ChartFrame, SoftTooltip } from "./chartTheme";
import { ZoomBrush } from "./ZoomBrush";
import { fmtDate, fmtTemp } from "../lib/format";
import { METRIC } from "../lib/metricColors";
import { useBrushZoom } from "../lib/useBrushZoom";
import { RoomToggles, useRoomVisibility } from "./SeriesControls";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

type Props = {
  rooms: string[];
  colors: Record<string, string>;
  daily: Array<Record<string, number | string>>;
};

type ViewMode = "apartment" | "rooms";

export function DailyProgressionChart({ rooms, colors, daily }: Props) {
  const [mode, setMode] = useState<ViewMode>("apartment");
  const { visibleRooms, toggle, showAll, showFirst, isVisible } = useRoomVisibility(
    rooms,
    { initial: "first" }
  );
  const apartmentColor = colors.Apartment ?? METRIC.apartment;

  const series = useMemo(
    () => daily.map((d) => ({ t: Number(d.t), ...d })),
    [daily]
  );
  const zoom = useBrushZoom(series, `daily-${mode}`);

  return (
    <ChartCard
      title="Daily temperature progression"
      subtitle={
        mode === "apartment"
          ? "Apartment daily mean — drag on the chart to zoom · brush below to pan or zoom out"
          : "Drag on the chart to zoom · brush below to pan — toggle rooms to compare"
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
            if (mode !== "rooms") showFirst();
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
        <LineChart data={series} margin={{ top: 8, right: 12, left: 0, bottom: 0 }} {...zoom.chartHandlers}>
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
            disabled={zoom.selecting}
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
          <ZoomBrush
            data={series}
            stroke={METRIC.brush}
            brush={zoom.brush}
            onBrushChange={zoom.onBrushChange}
            selectLeft={zoom.selectLeft}
            selectRight={zoom.selectRight}
          />
        </LineChart>
      </ChartFrame>
    </ChartCard>
  );
}
