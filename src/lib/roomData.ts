import { loadJson, type RoomDetail } from "./types";

const cache = new Map<string, Promise<RoomDetail>>();

/** Shared room JSON loader — explorer + heatmap reuse one fetch per slug. */
export function loadRoomDetail(slug: string): Promise<RoomDetail> {
  let pending = cache.get(slug);
  if (!pending) {
    pending = loadJson<RoomDetail>(`/data/rooms/${slug}.json`);
    cache.set(slug, pending);
  }
  return pending;
}
