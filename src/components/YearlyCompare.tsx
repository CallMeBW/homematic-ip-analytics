import { ChartColumn } from "lucide-react";
import { SectionHead } from "./SectionHead";
import { fmtTemp } from "../lib/format";
import type { YearlyClimate } from "../lib/types";

export function YearlyCompare({ yearly }: { yearly: YearlyClimate[] }) {
  if (!yearly?.length) return null;

  return (
    <section className="section yearly">
      <SectionHead icon={ChartColumn} title="Year by year">
        Extremes are true sample mins/maxes; median and average use hourly means
      </SectionHead>
      <div className="yearly__grid">
        {yearly.map((y) => (
          <article key={y.year} className="yearly__card">
            <header className="yearly__head">
              <h3>{y.year}</h3>
              <span className="yearly__days">{y.days} days</span>
            </header>
            <dl className="yearly__stats">
              <div>
                <dt>Min</dt>
                <dd className="yearly__val yearly__val--cool">{fmtTemp(y.min)}</dd>
              </div>
              <div>
                <dt>Median</dt>
                <dd className="yearly__val">{fmtTemp(y.median)}</dd>
              </div>
              <div>
                <dt>Max</dt>
                <dd className="yearly__val yearly__val--warm">{fmtTemp(y.max)}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}
