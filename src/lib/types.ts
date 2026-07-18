export type Meta = {
  generatedAt: string;
  source: string;
  rooms: string[];
  colors: Record<string, string>;
  firstTs: number;
  lastTs: number;
  totalRawPoints: number;
  roomCount: number;
};

export type RoomSummary = {
  room: string;
  color: string;
  slug: string;
  points: number;
  avg: number;
  stddev: number;
  min: number;
  max: number;
  p10: number;
  p50: number;
  p90: number;
  minAt: number;
  maxAt: number;
  comfortPct: number;
  underheatPct: number;
  overheatPct: number;
  avgGap: number | null;
  nightAvg: number | null;
  dayAvg: number | null;
  nightDayDelta: number | null;
  coldestHour: number | null;
  warmestHour: number | null;
  setpointChanges: number;
  avgHeatUpMinutes: number | null;
  firstTs: number;
  lastTs: number;
};

export type Overview = {
  rooms: RoomSummary[];
  kpis: {
    apartmentAvg: number;
    warmestRoom: string;
    coldestRoom: string;
    recordLow: number;
    recordHigh: number;
    avgComfortPct: number;
    totalSetpointChanges: number;
    daysCovered: number;
  };
};

export type FunFact = {
  id: string;
  icon: string;
  title: string;
  text: string;
  value?: number;
  room?: string;
};

export type Charts = {
  daily: Array<Record<string, number | string>>;
  monthly: Array<Record<string, number | string | null>>;
  byHour: Array<Record<string, number | null>>;
  byWeekday: Array<Record<string, number | string | null>>;
  correlations: Array<{ a: string; b: string; r: number; n: number }>;
  distributions: Record<string, Array<{ x: number; count: number }>>;
  apartmentDaily: Array<{
    t: number;
    date: string;
    avg: number;
    min: number;
    max: number;
    spread: number;
  }>;
};

export type RoomDetail = {
  room: string;
  color: string;
  series: {
    actual: Array<{ t: number; v: number }>;
    setpoint: Array<{ t: number; v: number }>;
    gap: Array<{ t: number; v: number }>;
  };
  recentHourly: {
    actual: Array<{ t: number; v: number }>;
    setpoint: Array<{ t: number; v: number }>;
  };
  daily: Array<{ date: string; t: number; avg: number; min: number; max: number; range: number }>;
  byHour: Array<{ hour: number; avg: number | null; n: number }>;
  byWeekday: Array<{ dow: number; label: string; avg: number | null; n: number }>;
  setpointChanges: Array<{ t: number; from: number; to: number; delta: number }>;
  heatUps: Array<{ t: number; minutes: number; from: number; to: number }>;
};

export async function loadJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url}`);
  return res.json() as Promise<T>;
}
