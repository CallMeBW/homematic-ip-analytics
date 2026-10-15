import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ROOT = path.resolve(__dirname, "../..");
export const DATA = path.join(ROOT, "data");
export const RAW = path.join(DATA, "raw");
export const OUT = path.join(ROOT, "public", "data");

export const ROOM_ORDER = ["Wohnzimmer", "Schlafzimmer", "Büro", "Bad"];
export const ROOM_COLORS = {
  Wohnzimmer: "#e07a3d",
  Schlafzimmer: "#2f6f8f",
  Büro: "#3d8b6e",
  Bad: "#8b5a9e",
};
export const APARTMENT_KEY = "Apartment";
export const APARTMENT_COLOR = "#1a2332";
export const AC_ROOM = "Wohnzimmer";

export const HOUR = 60 * 60 * 1000;
export const DAY = 24 * HOUR;

/** Display series budgets (room deep-dive charts). */
export const DISPLAY_ACTUAL_POINTS = 800;
export const DISPLAY_GAP_POINTS = 600;
