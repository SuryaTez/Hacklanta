# MissionMesh

MissionMesh is a community resource coordination platform: a nonprofit describes an outcome
("feed 100 people tonight by 7 PM"), and the app assembles a plan from local business
surplus, volunteer capacity, and a funding gap that sponsors can close. It was originally
built for Hacklanta and now runs as a local-first demo with optional Gemini assistance and
Auth0 sign-in.

## What it does

- **Nonprofit workspace** — compile a natural-language mission into editable requirements.
- **Community cart** — deterministic matching by category, distance, quantity, pickup
  window, refrigeration, and dietary compatibility, with a nearest-neighbour route.
- **Close the gap** — simulated sponsor contributions, capped at the outstanding gap.
- **Business workspace** — Quick Give donation listings with photo preview and validation.
- **Volunteer workspace** — availability, assigned route, per-stop completion.
- **Impact** — people served, food rescued, value reused, miles, and illustrative CO₂.
- **Explore** — real OpenStreetMap map (Leaflet), category filters, coordinate-verified pins,
  pickup windows, and no-key Google Maps links for each location.

All demo data lives in the browser; nothing is sent to a database.

## Technology stack

- **Frontend:** TypeScript + plain HTML/CSS (no framework, no bundler), Tailwind CSS v4
  as a build-time stylesheet compiler, Leaflet from unpkg.
- **Build:** Node.js script using `node:module`'s `stripTypeScriptTypes` (types stripped,
  not checked, no minification) plus the Tailwind CLI.
- **Backend:** Python 3.12 standard library HTTP server.
- **AI:** `google-genai` (Gemini), optional and server-side only.
- **Auth:** `@auth0/auth0-spa-js` with Authorization Code Flow + PKCE.
- **Storage:** browser `localStorage` (no live database yet).

## Architecture

```
src/*.ts ──npm run build──> dist/*.js ──served by──> server.py (127.0.0.1:3000)
                                                         └── /api/ai/* ──> ai_service.py ──> Gemini
```

Full detail: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) ·
file map: [docs/PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md) ·
design system: [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) ·
contributor guide: [docs/DEVELOPMENT_GUIDE.md](docs/DEVELOPMENT_GUIDE.md).

## Setup

Requirements: Node.js 22.13 or newer (for `stripTypeScriptTypes`) and Python 3.12 or newer.

```bash
npm install
python -m venv .venv
node scripts/run-python.mjs -m pip install -r requirements.txt
cp .env.example .env          # optional: add your Gemini key
npm run build
npm run dev
```

Then open <http://localhost:3000>. On Windows, `py -m venv .venv` and
`.venv\Scripts\python.exe -m pip install -r requirements.txt` work the same way;
`scripts/run-python.mjs` prefers `.venv/Scripts/python.exe` on Windows and
`.venv/bin/python` on Linux/macOS, so the npm scripts are platform-independent.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | No | Server-side Gemini key. Without it the app runs in rule-based mode. |
| `GEMINI_MODEL` | No | Overrides the default `gemini-2.5-flash`. |

Values live only in `.env` (git-ignored). The key is never sent to the browser, written to
localStorage, or logged; `GET /api/ai/status` returns only whether AI is configured.

Auth0 settings are public SPA values (domain and client ID) and live in `src/auth.ts`.
No client secret is used or stored.

## Development commands

| Command | What it does |
| --- | --- |
| `npm run build` | Regenerate `dist/` (TypeScript + `dist/app.css`) after any `src/` change |
| `npm run css` | Rebuild only the Tailwind stylesheet (`src/app.css` → `dist/app.css`) |
| `npm run css:watch` | Rebuild only the stylesheet while iterating on CSS |
| `npm run watch` | Rebuild TypeScript + CSS when any `src/` file changes (serve separately) |
| `npm run audit:visual` | With `npm start` running, capture every page at 390/768/1440 with Chrome and report overflow/console errors to `review-output/sprint3-after/` |
| `npm run test:workflow` | With `npm start` running, drive donation → mission → matching → funding → route → impact in Chrome and check each step |
| `npm run dev` / `npm start` | Build all frontend assets, then start the Python server on `127.0.0.1:3000` |
| `npm test` | Deterministic engine suite (`tests/engine.test.mjs`, needs a fresh build) |
| `npm run test:backend` | Python + AI validation suite (`tests/test_ai.py`, fake Gemini client) |
| `npm run test:all` | Both suites |

## Demo mode

`Run Demo` and `Reset demo` reseed the workspace with eight Atlanta resources, one mission,
and one volunteer, then persist to `localStorage['missionmesh-v1']`. Demo mode needs no
account and no Gemini key. The rule-based compiler in `src/engine.ts` extracts people,
budget, deadline, refrigeration, and dietary tags from the mission text; matched
quantities, funding caps, route order, and impact values are all deterministic and covered
by `tests/engine.test.mjs`.

Contributions and purchases are simulated. No payment is processed.

## Authentication (provisional)

`Log in` / `Create account` start an Auth0 redirect (PKCE, tokens cached in memory only).
First-time users pick a role and a display name; the profile is stored per Auth0 `sub`
under `localStorage['missionmesh-auth-profile-v1']`. Role selection only changes client
navigation — it is not authorization.

Auth0 must list the site origin (`http://localhost:3000` locally) as an allowed callback
URL, logout URL, and web origin.

## Known limitations

- No shared database: state is per-browser `localStorage`. `schema.sql` is a planned
  PostgreSQL/Supabase shape and is not used by any code.
- No server-side authorization or tenant scoping; Auth0 roles grant no permissions.
- Payments, purchases, and photo-based surplus scanning are simulated.
- Coordinates resolve only for a small local demo address list. Unknown addresses stay
  unverified, are never given another location's coordinates, and are excluded from
  matching until the nonprofit places a pin or explicitly shares a location. No
  geocoding service or API key is used.
- The Google Maps Embed API is not integrated; all map actions use no-key Google Maps
  URLs. OSM tiles and Leaflet load from third-party CDNs and need network access; the
  resource list remains usable without them.
- Food safety, allergens, and delivery feasibility still require human confirmation.
- The build strips types without checking them, so type errors surface only at runtime.

## Deployment overview

Nothing is deployed today and no host configuration is checked in (no `.replit`,
`Procfile`, or Dockerfile). The intended shape is unchanged:

1. `npm install && npm run build` produces `dist/`.
2. Start `server.py`, which serves `dist/` as static files (with SPA fallback) and the
   `/api/ai/*` endpoints.
3. Set `GEMINI_API_KEY` (and optionally `GEMINI_MODEL`) in the host's environment.

`server.py` currently binds `127.0.0.1:3000` with the port hard-coded. A public host needs
that binding and port made configurable, and Auth0 needs to allow the public origin.
`dist/` is committed so a host can serve it without running the build, but it must be
regenerated (`npm run build`) whenever `src/` changes.
