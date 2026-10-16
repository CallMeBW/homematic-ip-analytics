import type { CSSProperties } from "react";

/** Opaque RGB of tipStyle.background (rgba(18, 24, 32, 0.94)). */
const TIP_BG = { r: 18, g: 24, b: 32 };

export const tipStyle = {
  background: "rgba(18, 24, 32, 0.94)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 10,
  padding: "10px 12px",
  boxShadow: "0 12px 40px rgba(0,0,0,0.28)",
  color: "#f4f1ea",
  fontSize: 12,
  lineHeight: 1.45,
};

type Rgb = { r: number; g: number; b: number };

function parseCssColor(color: string): Rgb | null {
  const c = color.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c);
  if (hex) {
    const h = hex[1];
    if (h.length === 3) {
      return {
        r: parseInt(h[0] + h[0], 16),
        g: parseInt(h[1] + h[1], 16),
        b: parseInt(h[2] + h[2], 16),
      };
    }
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }
  const rgb = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i.exec(c);
  if (rgb) {
    return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]) };
  }
  return null;
}

function relativeLuminance({ r, g, b }: Rgb): number {
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/** True when a swatch fill would vanish against the tip background (e.g. apartment #1a2332). */
export function tipDotNeedsRing(color: string): boolean {
  const parsed = parseCssColor(color);
  if (!parsed) return false;
  return contrastRatio(parsed, TIP_BG) < 1.75;
}

export function tipDotStyle(color: string): CSSProperties {
  const fill = color || "#fff";
  return {
    width: 8,
    height: 8,
    borderRadius: 99,
    background: fill,
    flexShrink: 0,
    ...(tipDotNeedsRing(fill)
      ? { boxShadow: "0 0 0 1px rgba(244, 241, 234, 0.65)" }
      : null),
  };
}
