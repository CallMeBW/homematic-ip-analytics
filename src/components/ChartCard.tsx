import type { CSSProperties, ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
};

export function ChartCard({ title, subtitle, children, className = "", style }: Props) {
  return (
    <section className={`chart-card ${className}`} style={style}>
      <header className="chart-card__head">
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </header>
      <div className="chart-card__body">{children}</div>
    </section>
  );
}
