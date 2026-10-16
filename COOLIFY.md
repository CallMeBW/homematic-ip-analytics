# Coolify Deployment — Apartment Stats

https://apartment-stats.brianwirth.de — Homematic IP apartment climate analytics (Authentik: `apartment-stats-users`, `usrfish@gmail.com`).

## Stack

| Item | Value |
|------|--------|
| GitHub | `git@github.com:CallMeBW/homematic-ip-analytics.git` (`main`) |
| Build pack | Docker Compose (`docker-compose.yml`) |
| Web | nginx serving Vite `dist/` (port 80) |
| Domain | `https://apartment-stats.brianwirth.de` |
| Authentik slug | `apartment-stats` / group `apartment-stats-users` (forward-auth) |

## Coolify IDs

Fill after first create (`python3 scripts/create_coolify_app.py`):

| Item | Value |
|------|--------|
| Application UUID | `w1ilk8ijbcz3ljywzmsxklpm` |
| Private key UUID | `vs51yu411q5oy4ifzm4m0u53` |
| Server UUID | `bcr6ur88n80qpm4fxb7r1kna` |

## Environment variables (Coolify UI — never commit secrets)

| Variable | Required | Notes |
|----------|----------|-------|
| `AUTHENTIK_TOKEN` | Yes | Docker Proxy Outpost token — `python3 setup_authentik.py --sync-coolify` |

## Authentik setup

```bash
source ~/.config/brian/secrets.env
export COOLIFY_APARTMENT_STATS_APP_UUID=<uuid>
python3 setup_authentik.py --sync-coolify
```

Creates/updates:

- Web: proxy provider `apartment-stats` (forward-auth)
- Group `apartment-stats-users` with allowlisted email
- Syncs `AUTHENTIK_TOKEN` into Coolify

## Auto-deploy

Push to **`main`** → GitHub webhook → Coolify build/deploy (configure webhook in Coolify UI after create).

## Manual redeploy

```bash
curl -sS -X POST "$COOLIFY_BASE_URL/api/v1/deploy" \
  -H "Authorization: Bearer $COOLIFY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"uuid":"<app-uuid>"}'
```

## Data

`public/data/*.json` is committed and baked into the image. Raw Homematic zips stay local (`data/*.zip` gitignored). Re-run `npm run ingest` / `npm run weather` locally, commit updated JSON, then push.

## Homepage

Docker labels on `web` register the tile. Favicon: `homepage/images/apartment-stats.svg`.
