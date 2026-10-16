import {
  Brush,
  ReferenceArea,
  useChartHeight,
  useMargin,
  usePlotArea,
} from "recharts";
import { fmtBrushDate } from "../lib/format";

const DEFAULT_HEIGHT = 28;
const DEFAULT_TRAVELLER = 10;
/** Approx width of `dd.mm.yy` at 11px. */
const LABEL_WIDTH = 58;

type BrushIndexes = { startIndex: number; endIndex: number };

type Point = { t: number };

type Props = {
  data: Point[];
  stroke: string;
  height?: number;
  travellerWidth?: number;
  brush: BrushIndexes;
  onBrushChange: (next: BrushIndexes) => void;
  selectLeft?: number;
  selectRight?: number;
};

/** Custom start/end labels that flip inside the selection when outer space is too tight. */
function BrushEdgeLabels({
  data,
  startIndex,
  endIndex,
  brushHeight,
  travellerWidth,
}: {
  data: Point[];
  startIndex: number;
  endIndex: number;
  brushHeight: number;
  travellerWidth: number;
}) {
  const plotArea = usePlotArea();
  const chartHeight = useChartHeight();
  const margin = useMargin();

  if (!plotArea || chartHeight == null || !margin || !data.length) return null;

  const n = data.length;
  const pointWidth = n > 0 ? plotArea.width / n : 0;
  const startX = plotArea.x + startIndex * pointWidth;
  const endX = plotArea.x + (endIndex + 1) * pointWidth;
  const labelY = chartHeight - margin.bottom - brushHeight / 2;

  const startOuter = startX - plotArea.x;
  const endOuter = plotArea.x + plotArea.width - endX;
  const startInside = startOuter <= LABEL_WIDTH;
  const endInside = endOuter <= LABEL_WIDTH;

  const startLabelX = startInside ? startX + travellerWidth + 4 : startX - 4;
  const endLabelX = endInside ? endX - travellerWidth - 4 : endX + travellerWidth + 4;

  const startText = data[startIndex] ? fmtBrushDate(data[startIndex].t) : "";
  const endText = data[endIndex] ? fmtBrushDate(data[endIndex].t) : "";

  return (
    <g className="zoom-brush-labels" pointerEvents="none">
      <text
        x={startLabelX}
        y={labelY}
        textAnchor={startInside ? "start" : "end"}
        dominantBaseline="middle"
        fontSize={11}
        fill="#5a6575"
      >
        {startText}
      </text>
      <text
        x={endLabelX}
        y={labelY}
        textAnchor={endInside ? "end" : "start"}
        dominantBaseline="middle"
        fontSize={11}
        fill="#5a6575"
      >
        {endText}
      </text>
    </g>
  );
}

/**
 * Brush + drag-select highlight. Pair with `useBrushZoom` chart mouse handlers.
 * Default Recharts brush texts are hidden via CSS; labels flip inside near the edges.
 */
export function ZoomBrush({
  data,
  stroke,
  height = DEFAULT_HEIGHT,
  travellerWidth = DEFAULT_TRAVELLER,
  brush,
  onBrushChange,
  selectLeft,
  selectRight,
}: Props) {
  return (
    <>
      {selectLeft != null && selectRight != null ? (
        <ReferenceArea
          x1={selectLeft}
          x2={selectRight}
          stroke={stroke}
          strokeOpacity={0.45}
          fill={stroke}
          fillOpacity={0.12}
        />
      ) : null}
      <Brush
        dataKey="t"
        height={height}
        stroke={stroke}
        travellerWidth={travellerWidth}
        startIndex={brush.startIndex}
        endIndex={brush.endIndex}
        onChange={onBrushChange}
        alwaysShowText={false}
      />
      <BrushEdgeLabels
        data={data}
        startIndex={brush.startIndex}
        endIndex={brush.endIndex}
        brushHeight={height}
        travellerWidth={travellerWidth}
      />
    </>
  );
}
