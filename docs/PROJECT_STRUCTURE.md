# Project structure

MissionMesh is small on purpose: a browser-side single-page app, a Python server that
serves it and exposes AI endpoints, and a build script that strips TypeScript types.

```
missionmesh/
├── src/                      # Source of truth for the frontend
│   ├── index.html            # Page shell; loads /app.js as a module
│   ├── app.ts                # The whole SPA: routes, pages, UI, event handlers
│   ├── engine.ts             # Pure logic: seed data, matching, funding, routes, impact
│   ├── auth.ts               # Auth0 SPA SDK wrapper (PKCE, in-memory tokens)
│   ├── auth-bootstrap.ts     # Login / sign-up / onboarding UI injected around the SPA
│   ├── app.css               # Tailwind v4 entry: layers, theme tokens, source scan
│   ├── design.css            # MissionMesh design-system components and screens
│   ├── style.css             # Preserved legacy component CSS (lowest layer)
│   └── sample.svg            # Demo image used by the donation photo picker
├── dist/                     # Generated frontend, served by server.py (tracked on purpose)
├── scripts/
│   ├── build.mjs             # Copies src -> dist and strips TS types
│   └── run-python.mjs        # Runs .venv Python on Windows or Linux/macOS
├── tests/
│   ├── engine.test.mjs       # Deterministic engine tests (node, no framework)
│   ├── test_ai.py            # Backend/AI unit tests (unittest, fake Gemini client)
│   └── __init__.py           # Makes the test folder importable
├── docs/                     # Architecture and contributor documentation
├── server.py                 # HTTP server: static files from dist/ + /api/ai/* endpoints
├── ai_service.py             # Gemini calls, JSON schemas, response validation, error mapping
├── schema.sql                # Planned PostgreSQL/Supabase schema (not used at runtime)
├── package.json              # npm scripts; one runtime dependency (Auth0 SPA SDK)
├── requirements.txt          # Python dependency: google-genai
├── .env.example              # Environment variable names (no values)
└── README.md                 # Overview, setup, limitations
```

## Folder responsibilities

**`src/`** — everything a developer edits for frontend behaviour. `app.ts` is one large
file: it holds the router, every page renderer, event bindings, AI panel wiring, and
localStorage persistence. `engine.ts` holds no DOM code and is the only module with
automated test coverage, so keep new pure logic there.

**`dist/`** — build output. It is committed because hosts (and `tests/engine.test.mjs`)
read it directly. Never edit `dist/` by hand; run `npm run build`. The Auth0 SDK bundle
in `dist/auth0-spa-js.production.esm.js` is copied from `node_modules` by the build and
is not generated from project source.

**`scripts/`** — developer tooling only; nothing here runs in production except as part
of `npm run build` or `npm start`.

**`tests/`** — both suites. The engine suite imports `dist/engine.js`, so run
`npm run build` first (or use `npm run test:all`, which assumes a fresh build).

**`docs/`** — architecture, structure, and contributor guidance.

## Root files

`server.py` and `ai_service.py` stay at the repository root because the documented
start command is `python server.py` and because `server.py` resolves `dist/` relative to
its own location. Moving them into a package would change the start command, so that is
a deliberate later decision rather than part of routine cleanup.

`package.json`, `package-lock.json`, and `requirements.txt` stay at the root because npm
and pip expect them there.

## Where things live

| Concern | Location |
| --- | --- |
| Homepage / landing page | `src/app.ts` → `landing()` |
| Navigation shell and role switcher | `src/app.ts` → `shell()` |
| Business, nonprofit, volunteer, sponsor workspaces | `src/app.ts` → `business()`, `nonprofit()`, `volunteer()`, `sponsor()` |
| Mission creation and requirement review | `src/app.ts` → `createMission()`, `requirementsForm()` |
| Donation form (Quick Give) | `src/app.ts` → `quickGive()` |
| Matching results (community cart) | `src/app.ts` → `plan()` |
| Funding gap screen | `src/app.ts` → `funding()` |
| Route planning / dispatch / live tracking | `src/app.ts` → `dispatch()`, `routeView()`, `live()` |
| Map panel and location picker (Leaflet + OSM) | `src/app.ts` → `mapPanel()`, `initMap()`, `initLocationPicker()` |
| Impact dashboard | `src/app.ts` → `impactPage()`, `globalImpact()` |
| Reusable UI helpers (`I`, `btn`, `badge`, `stat`, cards) | top of `src/app.ts` |
| Matching, funding, routing, impact logic | `src/engine.ts` |
| Authentication (Auth0) | `src/auth.ts` + `src/auth-bootstrap.ts` |
| Gemini integration | `ai_service.py` |
| HTTP server and API routes | `server.py` |
| Data storage (browser) | `localStorage['missionmesh-v1']` in `src/app.ts` |
| Styles | `src/app.css`, `src/design.css`, `src/style.css` |
| Design system and mapping conventions | `docs/DESIGN_SYSTEM.md` |
| Tests | `tests/engine.test.mjs`, `tests/test_ai.py` |
| Deployment configuration | none in-repo; see "Deployment" in `README.md` |

## Generated vs source

| Generated | Source |
| --- | --- |
| `dist/*.js`, `dist/app.css`, `dist/style.css`, `dist/index.html`, `dist/sample.svg` | `src/*` via `npm run build` (CSS via Tailwind CLI) |
| `dist/auth0-spa-js.production.esm.js` | `node_modules/@auth0/auth0-spa-js/dist/` |
| `.venv/`, `node_modules/`, `__pycache__/` | local installs, git-ignored |
