import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  CalendarRange,
  CircleCheck,
  Clock3,
  Flame,
  Home,
  Moon,
  ScanSearch,
  SlidersHorizontal,
  Snowflake,
  Sun,
  TrendingUp,
} from "lucide-react";
import { DailyProgressionChart, ApartmentSpreadChart } from "./components/DailyCharts";
import {
  DistributionChart,
  HourlyProfileChart,
  MonthlyChart,
  WeekdayChart,
} from "./components/PatternCharts";
import { HeatmapCalendar, RoomCompareBars } from "./components/Heatmap";
import { FunFactsSection } from "./components/FunFacts";
import { RoomExplorer } from "./components/RoomExplorer";
import { YearlyCompare } from "./components/YearlyCompare";
import { AcEffectSection } from "./components/AcEffect";
import { HeatingSeasonsSection } from "./components/HeatingSeasons";
import { LazyMount } from "./components/LazyMount";
import { SectionHead } from "./components/SectionHead";
import { fmtDate, fmtTemp } from "./lib/format";
import { iconForRoom } from "./lib/roomIcons";
import { loadRoomDetail } from "./lib/roomData";
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
    loadRoomDetail(roomSlug)
      .then(setRoomDetail)
      .catch((e: Error) => console.error(e));
  }, [roomSlug]);

  useEffect(() => {
    if (!data) return;
    const slug = data.overview.rooms.find((r) => r.room === heatRoom)?.slug;
    if (!slug) return;
    loadRoomDetail(slug).then((d) => setHeatDays(d.daily));
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
          Homematic IP Thermostats · {meta.totalRawPoints.toLocaleString("de-DE")} samples ·{" "}
          {kpis.daysCovered} days
        </p>
      </header>

      <section className="kpi-strip">
        <Kpi icon={Snowflake} label="Record low" value={fmtTemp(kpis.recordLow)} tone="cool" />
        <Kpi icon={Home} label="Apartment avg" value={fmtTemp(kpis.apartmentAvg)} />
        <Kpi icon={Flame} label="Record high" value={fmtTemp(kpis.recordHigh)} tone="warm" />
        <Kpi
          icon={CircleCheck}
          label="Comfort share"
          value={`${kpis.avgComfortPct}%`}
          hint="time in 20–22.5°C"
        />
        <Kpi icon={Sun} label="Warmest room" value={kpis.warmestRoom} />
        <Kpi icon={Moon} label="Coolest room" value={kpis.coldestRoom} />
        <Kpi
          icon={SlidersHorizontal}
          label="Setpoint tweaks"
          value={kpis.totalSetpointChanges.toLocaleString("de-DE")}
          hint="during detected heating seasons"
        />
      </section>

      <YearlyCompare yearly={overview.yearly} />

      <HeatingSeasonsSection
        seasons={overview.heatingSeasons ?? meta.heatingSeasons ?? []}
        firstTs={meta.firstTs}
        lastTs={meta.lastTs}
      />

      <FunFactsSection facts={funFacts} />

      <LazyMount minHeight={720}>
        <section className="section">
          <SectionHead icon={TrendingUp} title="Temperature over time">
            Hover points for exact values · brush to zoom · toggle rooms on multi-line charts
          </SectionHead>
          <DailyProgressionChart rooms={meta.rooms} colors={meta.colors} daily={charts.daily} />
          <ApartmentSpreadChart apartmentDaily={charts.apartmentDaily} />
          <RoomCompareBars rooms={overview.rooms} />
        </section>
      </LazyMount>

      <LazyMount minHeight={900}>
        <section className="section">
          <SectionHead icon={Clock3} title="Rhythms & seasons">
            Hour-of-day and weekday patterns split by detected heating seasons vs off-season
          </SectionHead>
          <div className="grid-2">
            <HourlyProfileChart
              rooms={meta.rooms}
              colors={meta.colors}
              byHour={charts.byHour}
              byHourHeating={charts.byHourHeating}
              byHourOffSeason={charts.byHourOffSeason}
              heatingHint="Detected seasons"
              offSeasonHint="Outside seasons"
            />
            <WeekdayChart
              rooms={meta.rooms}
              colors={meta.colors}
              byWeekday={charts.byWeekday}
              byWeekdayHeating={charts.byWeekdayHeating}
              byWeekdayOffSeason={charts.byWeekdayOffSeason}
              heatingHint="Detected seasons"
              offSeasonHint="Outside seasons"
            />
          </div>
          <MonthlyChart rooms={meta.rooms} colors={meta.colors} monthly={charts.monthly} />
          <DistributionChart
            rooms={meta.rooms}
            colors={meta.colors}
            distributions={charts.distributions}
            selected={distRoom}
            onSelect={setDistRoom}
          />
        </section>
      </LazyMount>

      {charts.acEffect ? (
        <LazyMount minHeight={420}>
          <AcEffectSection ac={charts.acEffect} colors={meta.colors} />
        </LazyMount>
      ) : null}

      <LazyMount minHeight={280}>
        <section className="section">
          <SectionHead icon={CalendarRange} title="Calendar heatmaps">
            Each cell is one day — hover to read the daily average
          </SectionHead>
          <div className="room-pills">
            {meta.rooms.map((room) => {
              const RoomIcon = iconForRoom(room);
              return (
                <button
                  key={room}
                  type="button"
                  className={room === heatRoom ? "pill active" : "pill"}
                  style={{ ["--pill" as string]: meta.colors[room] }}
                  onClick={() => setHeatRoom(room)}
                >
                  <RoomIcon className="pill__icon" aria-hidden size={14} strokeWidth={2} />
                  {room}
                </button>
              );
            })}
          </div>
          <HeatmapCalendar room={heatRoom} color={meta.colors[heatRoom]} days={heatDays} />
        </section>
      </LazyMount>

      <LazyMount minHeight={720}>
        <section className="section">
          <SectionHead icon={ScanSearch} title="Room deep-dive">
            Actual vs setpoint in detected heating seasons; setpoint hidden in summer park
          </SectionHead>
          <div className="room-pills">
            {overview.rooms.map((r) => {
              const RoomIcon = iconForRoom(r.room);
              return (
                <button
                  key={r.slug}
                  type="button"
                  className={r.slug === roomSlug ? "pill active" : "pill"}
                  style={{ ["--pill" as string]: r.color }}
                  onClick={() => setRoomSlug(r.slug)}
                >
                  <RoomIcon className="pill__icon" aria-hidden size={14} strokeWidth={2} />
                  {r.room}
                </button>
              );
            })}
          </div>
          {roomDetail && selectedSummary ? (
            <RoomExplorer detail={roomDetail} summary={selectedSummary} />
          ) : (
            <p className="empty-note">Loading room series…</p>
          )}
        </section>
      </LazyMount>

      <footer className="footer">
        <p>
          Reusable pipeline: drop a new <code>HmIP_Export*.zip</code> into <code>data/</code>, run{" "}
          <code>npm run ingest</code>, then refresh. Generated{" "}
          {new Date(meta.generatedAt).toLocaleString("de-DE")}.
        </p>
      </footer>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  tone?: "warm" | "cool";
}) {
  return (
    <div className={`kpi ${tone ? `kpi--${tone}` : ""}`}>
      <span className="kpi__top">
        <Icon className="kpi__icon" aria-hidden size={15} strokeWidth={2} />
        <span className="kpi__label">{label}</span>
      </span>
      <KpiValue>{value}</KpiValue>
      {hint ? <span className="kpi__hint">{hint}</span> : null}
    </div>
  );
}

/** Shrink font until the value fits on one line inside the KPI tile. */
function KpiValue({ children }: { children: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const fit = () => {
      const parent = el.parentElement;
      if (!parent) return;
      const cs = getComputedStyle(parent);
      const avail =
        parent.clientWidth -
        parseFloat(cs.paddingLeft) -
        parseFloat(cs.paddingRight);
      const maxPx = 23.2; // ~1.45rem
      const minPx = 12;
      let size = maxPx;
      el.style.fontSize = `${size}px`;
      el.style.whiteSpace = "nowrap";
      while (el.scrollWidth > avail && size > minPx) {
        size -= 0.5;
        el.style.fontSize = `${size}px`;
      }
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el.parentElement!);
    return () => ro.disconnect();
  }, [children]);

  return (
    <span ref={ref} className="kpi__value">
      {children}
    </span>
  );
}
