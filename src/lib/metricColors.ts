/**
 * Metric / role colors for charts where the series is NOT a room.
 * Must stay distinct from the room palette:
 *   Wohnzimmer #e07a3d · Schlafzimmer #2f6f8f · Büro #3d8b6e · Bad #8b5a9e
 */
export const METRIC = {
  apartment: "#1a2332",
  outdoor: "#6b7c8f",
  warmBand: "#b07a5c",
  coolBand: "#6a8494",
  spread: "#9a7b4f",
  delta: "#4d6572",
  heatingSeason: "#a67c52",
  offSeason: "#6a8494",
  brush: "#5a6575",
} as const;
