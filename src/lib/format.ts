export function fmtTemp(v: number | null | undefined, digits = 1) {
  if (v == null || Number.isNaN(v)) return "—";
  return `${v.toFixed(digits)}°C`;
}

export function fmtDate(ms: number) {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    dateStyle: "medium",
  }).format(new Date(ms));
}

export function fmtDateTime(ms: number) {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(ms));
}

export function fmtMonth(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en", { month: "short", year: "2-digit" }).format(
    new Date(Date.UTC(y, m - 1, 1))
  );
}

export function hourLabel(h: number) {
  return `${String(h).padStart(2, "0")}:00`;
}
