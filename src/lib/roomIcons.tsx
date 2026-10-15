import type { LucideIcon } from "lucide-react";
import { Bath, BedDouble, DoorOpen, Monitor, Sofa } from "lucide-react";

/** Map room display names to Lucide icons (Wohnzimmer / Schlafzimmer / Büro / Bad). */
export function iconForRoom(room: string): LucideIcon {
  const n = room.normalize("NFC").toLowerCase();
  if (n.includes("wohn")) return Sofa;
  if (n.includes("schlaf")) return BedDouble;
  if (n.includes("büro") || n.includes("buero") || n.includes("office")) return Monitor;
  if (n.includes("bad") || n.includes("bath")) return Bath;
  return DoorOpen;
}
