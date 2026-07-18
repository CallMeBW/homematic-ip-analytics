import { useEffect, useMemo, useState } from "react";
import { DailyProgressionChart, ApartmentSpreadChart } from "./components/DailyCharts";
import {
  CorrelationList,
  DistributionChart,
  HourlyProfileChart,
  MonthlyChart,
  RoomRadar,
  WeekdayChart,
} from "./components/PatternCharts";
import { HeatmapCalendar, RoomCompareBars } from "./components/Heatmap";
import { RoomExplorer } from "./components/RoomExplorer";
import { fmtDate, fmtTemp } from "./lib/format";
import {
  loadJson,
  type Charts,
  type FunFact,
  type Meta,
  type Overview,
  type RoomDetail,
} from "./lib/types";
import "./App.css";

type Bundle = {
  meta: Meta;
  overview: Overview;
  funFacts: FunFact[];
  charts: Charts;
};

export default function App() {
  const [data, setData] = useState<Bundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [roomSlug, setRoomSlug] = useState<string>("wohnzimmer");
  const [roomDetail, setRoomDetail] = useState<RoomDetail | null>(null);
  const [distRoom, setDistRoom] = useState<string>("Wohnzimmer");
  const [heatRoom, setHeatRoom] = useState<string>("Wohnzimmer");
  const [heatDays, setHeatDays] = useState<RoomDetail["daily"]>([]);

  useEffect(() => {
    Promise.all([
      loadJson<Meta>("/data/meta.json"),
      loadJson<Overview>("/data/overview.json"),
      loadJson<FunFact[]>("/data/funFacts.json"),
      loadJson<Charts>("/data/charts.json"),
    ])
      .then(([meta, overview, funFacts, charts]) => {
        setData({ meta, overview, funFacts, charts });
        setDistRoom(meta.rooms[0]);
        setHeatRoom(meta.rooms[0]);
        setRoomSlug(overview.rooms[0]?.slug ?? "wohnzimmer");
      })
      .catch((e: Error) =>
        setError(
          e.message +
            " — run npm run ingest after placing a Homematic IP zip in data/."
        )
      );
  }, []);

  useEffect(() => {
    if (!roomSlug) return;
    loadJson<RoomDetail>(`/data/rooms/${roomSlug}.json`)
      .then(setRoomDetail)
      .catch((e: Error) => console.error(e));
  }, [roomSlug]);

  useEffect(() => {
    if (!data) return;
    const slug = data.overview.rooms.find((r) => r.room === heatRoom)?.slug;
    if (!slug) return;
    loadJson<RoomDetail>(`/data/rooms/${slug}.json`).then((d) => setHeatDays(d.daily));
  }, [heatRoom, data]);

  const selectedSummary = useMemo(
    () => data?.overview.rooms.find((r) => r.slug === roomSlug),
    [data, roomSlug]
  );

  if (error) {
    return (
      <div className="boot-error">
        <h1>Data not ready</h1>
        <p>{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="boot-loading">
        <div className="spinner" />
        <p>Loading climate archive…</p>
      </div>
    );
  }

  const { meta, overview, funFacts, charts } = data;
  const { kpis } = overview;

  return (
    <div className="app">
      <div className="atmosphere" aria-hidden />
      <header className="hero">
        <p className="hero__eyebrow">Homematic IP · local analytics</p>
        <h1 className="hero__brand">Apartment Climate</h1>
        <p className="hero__lede">
          Thermostat history for {meta.rooms.join(", ")} —{" "}
          {fmtDate(meta.firstTs)} to {fmtDate(meta.lastTs)}.
        </p>
        <p className="hero__meta">
          Source <code>{meta.source}</code> · {meta.totalRawPoints.toLocaleString("de-DE")} samples ·{" "}
          {kpis.daysCovered} days
        </p>
      </header>

      <section className="kpi-strip">
        <Kpi label="Apartment avg" value={fmtTemp(kpis.apartmentAvg)} />
        <Kpi label="Record low" value={fmtTemp(kpis.recordLow)} tone="cool" />
        <Kpi label="Record high" value={fmtTemp(kpis.recordHigh)} tone="warm" />
        <Kpi label="Comfort share" value={`${kpis.avgComfortPct}%`} hint="time in 20–22.5°C" />
        <Kpi label="Warmest room" value={kpis.warmestRoom} />
        <Kpi label="Coolest room" value={kpis.coldestRoom} />
        <Kpi label="Setpoint tweaks" value={kpis.totalSetpointChanges.toLocaleString("de-DE")} />
      </section>

      <section className="fun-facts">
        <div className="section-head">
          <h2>Fun facts from your data</h2>
          <p>Highlights, extremes, and patterns worth knowing</p>
        </div>
        <div className="fun-facts__grid">
          {funFacts.map((f) => (
            <article key={f.id} className="fact">
              <h3>{f.title}</h3>
              <p>{f.text}</p>
              {f.room ? <span className="fact__room">{f.room}</span> : null}
            </article>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Temperature over time</h2>
          <p>Hover points for exact values · use the brush under charts to zoom</p>
        </div>
        <DailyProgressionChart rooms={meta.rooms} colors={meta.colors} daily={charts.daily} />
        <ApartmentSpreadChart apartmentDaily={charts.apartmentDaily} />
        <div className="grid-2">
          <RoomCompareBars rooms={overview.rooms} />
          <RoomRadar rooms={overview.rooms} />
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Rhythms & seasons</h2>
          <p>Hour-of-day fingerprints, weekday habits, monthly drift</p>
        </div>
        <div className="grid-2">
          <HourlyProfileChart rooms={meta.rooms} colors={meta.colors} byHour={charts.byHour} />
          <WeekdayChart rooms={meta.rooms} colors={meta.colors} byWeekday={charts.byWeekday} />
        </div>
        <MonthlyChart rooms={meta.rooms} colors={meta.colors} monthly={charts.monthly} />
        <div className="grid-2">
          <DistributionChart
            rooms={meta.rooms}
            colors={meta.colors}
            distributions={charts.distributions}
            selected={distRoom}
            onSelect={setDistRoom}
          />
          <CorrelationList correlations={charts.correlations} />
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Calendar heatmaps</h2>
          <p>Each cell is one day — hover to read the daily average</p>
        </div>
        <div className="room-pills">
          {meta.rooms.map((room) => (
            <button
              key={room}
              type="button"
              className={room === heatRoom ? "pill active" : "pill"}
              style={{ ["--pill" as string]: meta.colors[room] }}
              onClick={() => setHeatRoom(room)}
            >
              {room}
            </button>
          ))}
        </div>
        <HeatmapCalendar room={heatRoom} color={meta.colors[heatRoom]} days={heatDays} />
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Room deep-dive</h2>
          <p>Actual vs setpoint, heating gap, heat-up timing, wild days</p>
        </div>
        <div className="room-pills">
          {overview.rooms.map((r) => (
            <button
              key={r.slug}
              type="button"
              className={r.slug === roomSlug ? "pill active" : "pill"}
              style={{ ["--pill" as string]: r.color }}
              onClick={() => setRoomSlug(r.slug)}
            >
              {r.room}
            </button>
          ))}
        </div>
        {roomDetail && selectedSummary ? (
          <RoomExplorer detail={roomDetail} summary={selectedSummary} />
        ) : (
          <p className="empty-note">Loading room series…</p>
        )}
      </section>

      <footer className="footer">
        <p>
          Reusable pipeline: drop a new <code>HmIP_Export*.zip</code> into <code>data/</code>, run{" "}
          <code>npm run ingest</code>, then refresh. Generated {new Date(meta.generatedAt).toLocaleString("de-DE")}.
        </p>
      </footer>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "warm" | "cool";
}) {
  return (
    <div className={`kpi ${tone ? `kpi--${tone}` : ""}`}>
      <span className="kpi__label">{label}</span>
      <span className="kpi__value">{value}</span>
      {hint ? <span className="kpi__hint">{hint}</span> : null}
    </div>
  );
}
