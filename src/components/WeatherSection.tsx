import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  CloudSun,
  Link2,
  Snowflake,
  Sun,
  Thermometer,
  Timer,
  Waves,
} from "lucide-react";
import { LazyMount } from "./LazyMount";
import { SectionHead } from "./SectionHead";
import { loadJson } from "../lib/types";
import type { WeatherRelations } from "../lib/weatherTypes";
import {
  AcWeatherScatter,
  CouplingScatter,
  DeltaChart,
  DualClimateChart,
  SpreadVsOutdoor,
} from "./WeatherCharts";

/**
 * Indoor × outdoor section. Loads weatherRelations.json only after LazyMount
 * brings it near the viewport (keeps initial main-app payload light).
 */
export function WeatherSection() {
  const [data, setData] = useState<WeatherRelations | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadJson<WeatherRelations>("/data/weatherRelations.json")
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <section className="section">
        <SectionHead icon={CloudSun} title="Indoor × outdoor">
          Outdoor join not available yet
        </SectionHead>
        <p className="empty-note">
          Run <code>npm run weather</code> after ingest to fetch München-Stadt
          temps and build the outdoor relations. ({error})
        </p>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="section">
        <SectionHead icon={CloudSun} title="Indoor × outdoor">
          Loading München weather join…
        </SectionHead>
        <p className="empty-note">Fetching outdoor relations…</p>
      </section>
    );
  }

  const { meta, kpis, facts } = data;
  const station = meta.station?.name ?? kpis.station;

  return (
    <>
      <section className="section">
        <SectionHead icon={CloudSun} title="Indoor × outdoor">
          Apartment climate vs {station} (DWD) — how the flat tracks München weather
        </SectionHead>

        <div className="kpi-strip" style={{ marginTop: "0.25rem", marginBottom: "1.25rem" }}>
          <MiniKpi
            icon={Thermometer}
            label="Indoors warmer by"
            value={
              kpis.meanDelta != null
                ? `${Math.abs(kpis.meanDelta).toFixed(1)}°C ${
                    kpis.meanDelta >= 0 ? "warmer" : "cooler"
                  }`
                : "—"
            }
            hint="vs street, all days"
          />
          <MiniKpi
            icon={Snowflake}
            label="In heating season"
            value={
              kpis.meanDeltaHeating != null
                ? `${Math.abs(kpis.meanDeltaHeating).toFixed(1)}°C ${
                    kpis.meanDeltaHeating >= 0 ? "warmer" : "cooler"
                  }`
                : "—"
            }
            hint="apartment vs outdoors"
            tone="cool"
          />
          <MiniKpi
            icon={Sun}
            label="In summer season"
            value={
              kpis.meanDeltaOff != null
                ? `${Math.abs(kpis.meanDeltaOff).toFixed(1)}°C ${
                    kpis.meanDeltaOff >= 0 ? "warmer" : "cooler"
                  }`
                : "—"
            }
            hint="apartment vs outdoors"
            tone="warm"
          />
        </div>

        {facts.length ? (
          <div className="fun-facts__grid" style={{ marginBottom: "1.25rem" }}>
            {facts.map((f) => (
              <article key={f.id} className="fact">
                <h4>{f.title}</h4>
                <p>{f.text}</p>
              </article>
            ))}
          </div>
        ) : null}
      </section>

      <LazyMount minHeight={720}>
        <section className="section">
          <SectionHead icon={Waves} title="Indoor vs outdoor temps">
            Dual indoor/outdoor series and how much warmer the flat stays
          </SectionHead>
          <DualClimateChart data={data.dualSeries} colors={meta.colors} />
          <DeltaChart data={data.deltaSeries} />
        </section>
      </LazyMount>

      <LazyMount minHeight={420}>
        <section className="section">
          <SectionHead icon={Link2} title="Does the flat follow the weather?">
            When München warms or cools, how much does each room move with it?
          </SectionHead>
          <CouplingScatter
            apt={data.scatterApt}
            rooms={meta.rooms}
            scatterRooms={data.scatterRooms}
            colors={meta.colors}
            corrApartment={kpis.corrApartment}
          />
          <SpreadVsOutdoor data={data.spreadScatter} />
        </section>
      </LazyMount>

      <LazyMount minHeight={360}>
        <section className="section">
          <SectionHead icon={Timer} title="AC × heat outside">
            Wohnzimmer cool-downs vs that day’s outdoor max
          </SectionHead>
          <AcWeatherScatter
            events={data.acEvents}
            color={meta.colors["Wohnzimmer"] ?? "#e07a3d"}
          />
        </section>
      </LazyMount>
    </>
  );
}

function MiniKpi({
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
      <span className="kpi__value">{value}</span>
      {hint ? <span className="kpi__hint">{hint}</span> : null}
    </div>
  );
}
