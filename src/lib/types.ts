export type HeatingSeason = {
  start: string;
  end: string;
  startTs: number;
  endTs: number;
  days: number;
};

export type Meta = {
  generatedAt: string;
  source: string;
  rooms: string[];
  colors: Record<string, string>;
  firstTs: number;
  lastTs: number;
  totalRawPoints: number;
  roomCount: number;
  seasons?: {
    heating: string;
    offSeason: string;
    intervals: string[];
  };
  heatingSeasons?: HeatingSeason[];
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
  p25: number;
  p50: number;
  p75: number;
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
  heatingActiveDays?: number;
  heatingActivePct?: number;
  firstTs: number;
  lastTs: number;
};

export type YearlyClimate = {
  year: number;
  min: number;
  max: number;
  median: number;
  avg: number;
  dailyMedian: number | null;
  days: number;
  samples: number;
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
  yearly: YearlyClimate[];
  heatingSeasons?: HeatingSeason[];
};

export type FunFact = {
  id: string;
  group?: "apartment" | "rooms" | string;
  icon: string;
  title: string;
  text: string;
  value?: number;
  room?: string;
};

export type AcEffectData = {
  room: string;
  season: string;
  kpis: {
    coolingEvents: number;
    avgCoolingDrop: number | null;
  };
  coolingEvents: Array<{
    t: number;
    endT: number;
    from: number;
    to: number;
    drop: number;
    minutes: number;
  }>;
};

export type Charts = {
  daily: Array<Record<string, number | string>>;
  monthly: Array<Record<string, number | string | null>>;
  byHour: Array<Record<string, number | null>>;
  byHourHeating?: Array<Record<string, number | null>>;
  byHourOffSeason?: Array<Record<string, number | null>>;
  byWeekday: Array<Record<string, number | string | null>>;
  byWeekdayHeating?: Array<Record<string, number | string | null>>;
  byWeekdayOffSeason?: Array<Record<string, number | string | null>>;
  distributions: Record<string, Array<{ x: number; count: number }>>;
  apartmentDaily: Array<{
    t: number;
    date: string;
    avg: number;
    min: number;
    max: number;
    spread: number;
  }>;
  acEffect?: AcEffectData;
};

export type RoomDetail = {
  room: string;
  color: string;
  series: {
    actual: Array<{ t: number; v: number }>;
    setpoint: Array<{ t: number; v: number | null }>;
    gap: Array<{ t: number; v: number }>;
  };
  recentHourly: {
    actual: Array<{ t: number; v: number }>;
    setpoint: Array<{ t: number; v: number | null }>;
  };
  daily: Array<{ date: string; t: number; avg: number; min: number; max: number; range: number }>;
};

export async function loadJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url}`);
  return res.json() as Promise<T>;
}
