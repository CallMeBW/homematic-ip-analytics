/**
 * Berlin calendar parts with per-hour cache.
 * Hourly/daily pipelines hit the same bucket repeatedly — avoid Intl per sample.
 */
const berlinFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Berlin",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  weekday: "short",
  hourCycle: "h23",
});

const DOW = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const HOUR_MS = 3_600_000;
/** @type {Map<number, ReturnType<typeof computeBerlinParts>>} */
const cache = new Map();

function computeBerlinParts(bucketMs) {
  const parts = berlinFmt.formatToParts(new Date(bucketMs));
  const get = (type) => parts.find((p) => p.type === type)?.value;
  const year = Number(get("year"));
  const month = Number(get("month"));
  const day = get("day");
  const hour = Number(get("hour"));
  const dateKey = `${year}-${String(month).padStart(2, "0")}-${day}`;
  return {
    dateKey,
    monthKey: `${year}-${String(month).padStart(2, "0")}`,
    hour,
    dow: DOW[get("weekday")] ?? 0,
    year,
    month,
  };
}

export function berlinParts(ms) {
  const key = Math.floor(ms / HOUR_MS);
  let hit = cache.get(key);
  if (hit) return hit;
  hit = computeBerlinParts(key * HOUR_MS);
  cache.set(key, hit);
  return hit;
}

export function clearBerlinCache() {
  cache.clear();
}

export function slug(room) {
  return room
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const fmtDateFmt = new Intl.DateTimeFormat("de-DE", {
  timeZone: "Europe/Berlin",
  dateStyle: "medium",
  timeStyle: "short",
});

export function fmtDate(ms) {
  return fmtDateFmt.format(new Date(ms));
}
