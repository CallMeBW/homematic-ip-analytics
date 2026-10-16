import { useCallback, useEffect, useState } from "react";

type Point = { t: number };

type BrushIndexes = { startIndex: number; endIndex: number };

/** Nearest index for a timestamp in a sorted `{ t }` series. */
function indexNear(data: Point[], t: number): number {
  if (!data.length) return 0;
  let lo = 0;
  let hi = data.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (data[mid].t < t) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0 && Math.abs(data[lo - 1].t - t) <= Math.abs(data[lo].t - t)) return lo - 1;
  return lo;
}

/**
 * Controlled Recharts Brush + drag-to-select zoom on the chart plot.
 * Chart drag sets brush indexes; the brush stays available to pan / widen again.
 */
export function useBrushZoom(data: Point[], resetKey: string) {
  const last = Math.max(0, data.length - 1);
  const [brush, setBrush] = useState<BrushIndexes>({ startIndex: 0, endIndex: last });
  const [selectLeft, setSelectLeft] = useState<number | undefined>();
  const [selectRight, setSelectRight] = useState<number | undefined>();

  useEffect(() => {
    setBrush({ startIndex: 0, endIndex: Math.max(0, data.length - 1) });
    setSelectLeft(undefined);
    setSelectRight(undefined);
  }, [resetKey, data.length]);

  const onBrushChange = useCallback((next: BrushIndexes) => {
    if (next.startIndex == null || next.endIndex == null) return;
    setBrush({ startIndex: next.startIndex, endIndex: next.endIndex });
  }, []);

  const onMouseDown = useCallback((e: { activeLabel?: string | number }) => {
    if (e?.activeLabel == null) return;
    const t = Number(e.activeLabel);
    if (Number.isNaN(t)) return;
    setSelectLeft(t);
    setSelectRight(undefined);
  }, []);

  const onMouseMove = useCallback(
    (e: { activeLabel?: string | number }) => {
      if (selectLeft == null || e?.activeLabel == null) return;
      const t = Number(e.activeLabel);
      if (Number.isNaN(t)) return;
      setSelectRight(t);
    },
    [selectLeft]
  );

  const onMouseUp = useCallback(() => {
    if (selectLeft == null || selectRight == null || selectLeft === selectRight) {
      setSelectLeft(undefined);
      setSelectRight(undefined);
      return;
    }
    const a = Math.min(selectLeft, selectRight);
    const b = Math.max(selectLeft, selectRight);
    let startIndex = indexNear(data, a);
    let endIndex = indexNear(data, b);
    if (endIndex < startIndex) [startIndex, endIndex] = [endIndex, startIndex];
    // Ignore tiny selections (single day / accidental click)
    if (endIndex - startIndex < 2) {
      setSelectLeft(undefined);
      setSelectRight(undefined);
      return;
    }
    setBrush({ startIndex, endIndex });
    setSelectLeft(undefined);
    setSelectRight(undefined);
  }, [data, selectLeft, selectRight]);

  const selecting = selectLeft != null && selectRight != null;

  return {
    brush,
    onBrushChange,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    selectLeft,
    selectRight,
    selecting,
  };
}
