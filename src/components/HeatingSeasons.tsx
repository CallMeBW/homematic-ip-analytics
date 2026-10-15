import { Flame } from "lucide-react";
import { SectionHead } from "./SectionHead";
import { fmtDate } from "../lib/format";
import type { HeatingSeason } from "../lib/types";

type Props = {
  seasons: HeatingSeason[];
  firstTs: number;
  lastTs: number;
};

function fmtIso(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(Date.UTC(y, m - 1, d, 12)));
}

export function HeatingSeasonsSection({ seasons, firstTs, lastTs }: Props) {
  if (!seasons?.length) return null;

  const span = Math.max(lastTs - firstTs, 1);
  const totalDays = seasons.reduce((s, x) => s + x.days, 0);

  return (
    <section className="section heating-seasons">
      <SectionHead icon={Flame} title="Heating seasons">
        One continuous interval per winter (onset → offset from apartment valve/setpoint
        behaviour). Charts and setpoint stats use these dates — not a fixed Oct–Apr calendar.
      </SectionHead>

      <div className="heating-seasons__timeline" aria-hidden>
        <div className="heating-seasons__track">
          {seasons.map((s) => {
            const left = ((s.startTs - firstTs) / span) * 100;
            const width = ((s.endTs - s.startTs + 86_400_000) / span) * 100;
            return (
              <div
                key={s.start}
                className="heating-seasons__bar"
                style={{
                  left: `${Math.max(0, left)}%`,
                  width: `${Math.min(100 - Math.max(0, left), Math.max(width, 0.8))}%`,
                }}
                title={`${s.start} → ${s.end}`}
              />
            );
          })}
        </div>
        <div className="heating-seasons__axis">
          <span>{fmtDate(firstTs)}</span>
          <span>{fmtDate(lastTs)}</span>
        </div>
      </div>

      <div className="heating-seasons__grid">
        {seasons.map((s, i) => (
          <article key={s.start} className="heating-seasons__card">
            <header className="heating-seasons__head">
              <h3>Season {i + 1}</h3>
              <span className="heating-seasons__days">{s.days} days</span>
            </header>
            <p className="heating-seasons__range">
              {fmtIso(s.start)}
              <span aria-hidden> → </span>
              {fmtIso(s.end)}
            </p>
          </article>
        ))}
        <article className="heating-seasons__card heating-seasons__card--meta">
          <header className="heating-seasons__head">
            <h3>Coverage</h3>
            <span className="heating-seasons__days">{seasons.length} winters</span>
          </header>
          <p className="heating-seasons__range">
            {totalDays} heating days in the export · everything else is off-season
          </p>
        </article>
      </div>
    </section>
  );
}
