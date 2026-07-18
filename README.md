# Homematic IP · Apartment Climate

Local analytics site for Homematic IP thermostat exports. Drop in a new export zip whenever you like — no cloud deployment required.

## Quick start

```bash
npm install
npm run ingest   # parses data/*.zip → public/data/
npm run dev      # http://localhost:5173
```

## Updating data

1. Export from the Homematic IP app / portal as a zip of CSVs.
2. Place the zip in `data/` (any `*.zip`; newest wins). You can also extract CSVs directly into `data/raw/`.
3. Run `npm run ingest`.
4. Refresh the site.

Raw CSVs and the zip stay local. Processed JSON under `public/data/` is regenerated on each ingest.

## What you get

- Overview KPIs and dozens of fun facts (records, room character, seasonal swing, …)
- Daily multi-room progression with brush zoom + hover tooltips
- Apartment min–max band and room-to-room spread
- Hour-of-day, weekday, and monthly patterns
- Temperature histograms, correlations, calendar heatmaps
- Per-room deep dive: actual vs setpoint, heating gap, heat-up timing, wildest days

## Stack

Vite + React + TypeScript + Recharts. Ingest is a plain Node script (`scripts/ingest.mjs`).

## Privacy

Thermostat history never leaves your machine unless you push the repo with data included. By default `data/raw/` and large zips are gitignored; processed summary JSON can be committed if you want the demo to work out of the box.
