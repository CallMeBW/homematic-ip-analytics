import { ChartColumn } from "lucide-react";
import { SectionHead } from "./SectionHead";
import { fmtTemp } from "../lib/format";
import type { YearlyClimate } from "../lib/types";

function deltaText(v: number | undefined) {
  if (v == null) return null;
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(1)}°`;
}

function deltaClass(v: number | undefined) {
  if (v == null || v === 0) return "yearly__delta";
  return v > 0 ? "yearly__delta yearly__delta--warm" : "yearly__delta yearly__delta--cool";
}

export function YearlyCompare({ yearly }: { yearly: YearlyClimate[] }) {
  if (!yearly?.length) return null;

  return (
    <section className="section yearly">
      <SectionHead icon={ChartColumn} title="Year by year">
        Apartment extremes and median from all room samples (Berlin calendar years)
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
                <dd className="yearly__val yearly__val--cool">
                  {fmtTemp(y.min)}
                  {y.deltaMin != null ? (
                    <span className={deltaClass(y.deltaMin)}>{deltaText(y.deltaMin)}</span>
                  ) : null}
                </dd>
              </div>
              <div>
                <dt>Median</dt>
                <dd className="yearly__val">
                  {fmtTemp(y.median)}
                  {y.deltaMedian != null ? (
                    <span className={deltaClass(y.deltaMedian)}>{deltaText(y.deltaMedian)}</span>
                  ) : null}
                </dd>
              </div>
              <div>
                <dt>Max</dt>
                <dd className="yearly__val yearly__val--warm">
                  {fmtTemp(y.max)}
                  {y.deltaMax != null ? (
                    <span className={deltaClass(y.deltaMax)}>{deltaText(y.deltaMax)}</span>
                  ) : null}
                </dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}
