import { Tooltip } from "recharts";
import type { ReactNode } from "react";
import { ResponsiveContainer } from "recharts";
import { tipStyle } from "./tipStyles";

export { tipStyle } from "./tipStyles";

type TipProps = {
  active?: boolean;
  payload?: Array<{ dataKey?: string | number; name?: string; value?: number | string; color?: string }>;
  label?: unknown;
  labelFormatter?: (label: unknown) => string;
  valueFormatter?: (value: number, name: string) => string;
};

export function ChartTip({
  active,
  payload,
  label,
  labelFormatter,
  valueFormatter,
}: TipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div style={tipStyle}>
      <div style={{ opacity: 0.7, marginBottom: 6 }}>
        {labelFormatter ? labelFormatter(label) : String(label ?? "")}
      </div>
      {payload.map((p) => (
        <div
          key={String(p.dataKey)}
          style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 3 }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 99,
              background: p.color || "#fff",
              flexShrink: 0,
            }}
          />
          <span style={{ opacity: 0.75 }}>{p.name}</span>
          <span style={{ marginLeft: "auto", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
            {valueFormatter
              ? valueFormatter(Number(p.value), String(p.name))
              : String(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function SoftTooltip({
  labelFormatter,
  valueFormatter,
}: {
  labelFormatter?: (label: unknown) => string;
  valueFormatter?: (value: number, name: string) => string;
}) {
  return (
    <Tooltip
      content={(props) => (
        <ChartTip
          active={props.active}
          payload={props.payload as unknown as TipProps["payload"]}
          label={props.label}
          labelFormatter={labelFormatter}
          valueFormatter={valueFormatter}
        />
      )}
      cursor={{ stroke: "rgba(26,35,50,0.25)", strokeWidth: 1, strokeDasharray: "4 4" }}
    />
  );
}

export function ChartFrame({ children, height = 320 }: { children: ReactNode; height?: number }) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        {children as never}
      </ResponsiveContainer>
    </div>
  );
}
