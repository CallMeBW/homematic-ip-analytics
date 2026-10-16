export type WeatherRelations = {
  meta: {
    generatedAt: string;
    provider?: string;
    station: {
      dwdStationId: string;
      name: string;
      lat: number;
      lon: number;
      height: number;
      wmoStationId?: string;
    } | null;
    indoorSource: string;
    firstTs: number;
    lastTs: number;
    rooms: string[];
    colors: Record<string, string>;
  };
  kpis: {
    corrApartment: number | null;
    corrHeating: number | null;
    corrOff: number | null;
    meanDelta: number | null;
    meanDeltaHeating: number | null;
    meanDeltaOff: number | null;
    joinedDays: number;
    outdoorHours: number;
    station: string;
  };
  facts: Array<{
    id: string;
    icon: string;
    title: string;
    text: string;
    value?: number | null;
    room?: string;
  }>;
  dualSeries: Array<{
    t: number;
    date: string;
    indoor: number;
    outdoor: number;
    outdoorMin: number;
    outdoorMax: number;
    spread: number;
    delta: number;
    heating: boolean;
  }>;
  deltaSeries: Array<{
    t: number;
    date: string;
    delta: number;
    outdoor: number;
    heating: boolean;
  }>;
  scatterApt: Array<{
    outdoor: number;
    indoor: number;
    delta: number;
    spread: number;
    date: string;
    heating: boolean;
  }>;
  scatterRooms: Record<
    string,
    Array<{ outdoor: number; indoor: number; date: string; heating: boolean }>
  >;
  spreadScatter: Array<{
    outdoor: number;
    outdoorAbs: number;
    spread: number;
    date: string;
    heating: boolean;
  }>;
  acEvents: Array<{
    t: number;
    endT: number;
    drop: number;
    minutes: number;
    from: number;
    to: number;
    outdoorMax: number | null;
    outdoorMean: number | null;
    outdoorAt: number | null;
    date: string;
  }>;
};
