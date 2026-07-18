# Data drop zone

1. Place a Homematic IP export zip here (e.g. `HmIP_Export.zip`).
2. Run `npm run ingest` from the project root.
3. Refresh the local site.

CSVs can also be extracted manually into `raw/` — the ingest script will use them if no zip is present.

Raw exports are gitignored; processed analytics live in `public/data/`.
