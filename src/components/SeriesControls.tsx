import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { CalendarDays, Flame, Leaf } from "lucide-react";

export function useRoomVisibility(rooms: string[]) {
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());

  const visibleRooms = useMemo(
    () => rooms.filter((r) => !hidden.has(r)),
    [rooms, hidden]
  );

  function toggle(room: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(room)) next.delete(room);
      else {
        // Keep at least one room visible
        if (rooms.length - next.size <= 1) return prev;
        next.add(room);
      }
      return next;
    });
  }

  function showAll() {
    setHidden(new Set());
  }

  return { visibleRooms, hidden, toggle, showAll, isVisible: (r: string) => !hidden.has(r) };
}

export function RoomToggles({
  rooms,
  colors,
  isVisible,
  onToggle,
  onShowAll,
}: {
  rooms: string[];
  colors: Record<string, string>;
  isVisible: (room: string) => boolean;
  onToggle: (room: string) => void;
  onShowAll: () => void;
}) {
  const allOn = rooms.every((r) => isVisible(r));
  return (
    <div className="room-toggles">
      {rooms.map((room) => {
        const on = isVisible(room);
        return (
          <button
            key={room}
            type="button"
            className={on ? "room-toggle active" : "room-toggle"}
            style={{ ["--tog" as string]: colors[room] }}
            aria-pressed={on}
            onClick={() => onToggle(room)}
          >
            <span className="room-toggle__swatch" />
            {room}
          </button>
        );
      })}
      {!allOn ? (
        <button type="button" className="room-toggle room-toggle--all" onClick={onShowAll}>
          Show all
        </button>
      ) : null}
    </div>
  );
}

export type SeasonMode = "all" | "heating" | "offSeason";

export function SeasonToggles({
  value,
  onChange,
  heatingHint = "Detected seasons",
  offSeasonHint = "Outside seasons",
}: {
  value: SeasonMode;
  onChange: (v: SeasonMode) => void;
  heatingHint?: string;
  offSeasonHint?: string;
}) {
  const opts: Array<{ id: SeasonMode; label: string; hint: string; icon: LucideIcon }> = [
    { id: "all", label: "All year", hint: "Full export", icon: CalendarDays },
    { id: "heating", label: "Heating", hint: heatingHint, icon: Flame },
    { id: "offSeason", label: "Off-season", hint: offSeasonHint, icon: Leaf },
  ];
  return (
    <div className="season-toggles" role="tablist" aria-label="Season filter">
      {opts.map((o) => {
        const Icon = o.icon;
        return (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={value === o.id}
            className={value === o.id ? "season-toggle active" : "season-toggle"}
            onClick={() => onChange(o.id)}
            title={o.hint}
          >
            <span className="season-toggle__label">
              <Icon className="season-toggle__icon" aria-hidden size={14} strokeWidth={2} />
              {o.label}
            </span>
            <span>{o.hint}</span>
          </button>
        );
      })}
    </div>
  );
}
