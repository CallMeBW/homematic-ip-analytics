export function mean(arr) {
  if (!arr.length) return null;
  let s = 0;
  for (let i = 0; i < arr.length; i++) s += arr[i];
  return s / arr.length;
}

export function stddev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  let s = 0;
  for (let i = 0; i < arr.length; i++) {
    const d = arr[i] - m;
    s += d * d;
  }
  return Math.sqrt(s / (arr.length - 1));
}

export function percentile(sorted, p) {
  if (!sorted.length) return null;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] * (hi - idx) + sorted[hi] * (idx - lo);
}

export function bucketMeans(buckets) {
  return buckets.map((arr, i) => ({
    i,
    avg: arr.length ? +mean(arr).toFixed(2) : null,
    n: arr.length,
  }));
}

/** Average values into fixed-width time buckets. */
export function bucketAverage(points, bucketMs) {
  if (!points.length) return [];
  const map = new Map();
  for (const p of points) {
    const key = Math.floor(p.t / bucketMs) * bucketMs;
    let b = map.get(key);
    if (!b) {
      b = { t: key, sum: 0, n: 0, min: p.v, max: p.v };
      map.set(key, b);
    }
    b.sum += p.v;
    b.n += 1;
    if (p.v < b.min) b.min = p.v;
    if (p.v > b.max) b.max = p.v;
  }
  return [...map.values()]
    .sort((a, b) => a.t - b.t)
    .map((b) => ({
      t: b.t,
      v: +(b.sum / b.n).toFixed(3),
      min: b.min,
      max: b.max,
      n: b.n,
    }));
}

/** Largest-Triangle-Three-Buckets downsampling for display series. */
export function lttb(data, threshold) {
  if (data.length <= threshold) return data.map((d) => ({ t: d.t, v: d.v }));
  const sampled = [];
  const bucketSize = (data.length - 2) / (threshold - 2);
  let a = 0;
  sampled.push({ t: data[0].t, v: data[0].v });
  for (let i = 0; i < threshold - 2; i++) {
    const rangeStart = Math.floor((i + 1) * bucketSize) + 1;
    const rangeEnd = Math.min(Math.floor((i + 2) * bucketSize) + 1, data.length);
    let sumX = 0;
    let sumY = 0;
    const rangeN = Math.max(1, rangeEnd - rangeStart);
    for (let k = rangeStart; k < rangeEnd; k++) {
      sumX += data[k].t;
      sumY += data[k].v;
    }
    const rangeAvgX = sumX / rangeN;
    const rangeAvgY = sumY / rangeN;
    const pointStart = Math.floor(i * bucketSize) + 1;
    const pointEnd = Math.min(Math.floor((i + 1) * bucketSize) + 1, data.length);
    let maxArea = -1;
    let nextA = pointStart;
    const pointAx = data[a].t;
    const pointAy = data[a].v;
    for (let j = pointStart; j < pointEnd; j++) {
      const area =
        Math.abs(
          (pointAx - rangeAvgX) * (data[j].v - pointAy) -
            (pointAx - data[j].t) * (rangeAvgY - pointAy)
        ) * 0.5;
      if (area > maxArea) {
        maxArea = area;
        nextA = j;
      }
    }
    sampled.push({ t: data[nextA].t, v: data[nextA].v });
    a = nextA;
  }
  sampled.push({ t: data[data.length - 1].t, v: data[data.length - 1].v });
  return sampled;
}

export function buildHistogram(values, binWidth = 0.5) {
  if (!values.length) return [];
  let lo = values[0];
  let hi = values[0];
  for (let i = 1; i < values.length; i++) {
    const v = values[i];
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const min = Math.floor(lo / binWidth) * binWidth;
  const max = Math.ceil(hi / binWidth) * binWidth;
  const bins = [];
  for (let x = min; x < max + binWidth / 2; x += binWidth) {
    bins.push({ x: +x.toFixed(2), count: 0 });
  }
  for (const v of values) {
    const idx = Math.min(bins.length - 1, Math.floor((v - min) / binWidth));
    bins[idx].count += 1;
  }
  return bins;
}
