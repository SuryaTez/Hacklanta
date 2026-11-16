# Architecture

MissionMesh is a local-first demo: the browser owns all business data and the Python
server exists for static hosting plus optional Gemini assistance.

```
Browser (dist/)
  index.html ──> app.js ──> engine.js          (deterministic demo logic)
                     └───> auth-bootstrap.js ─> auth.js ─> Auth0 SPA SDK (PKCE)
  localStorage['missionmesh-v1']                 (missions, resources, funding, routes)
  localStorage['missionmesh-auth-profile-v1']    (provisional profile per Auth0 subject)

server.py (127.0.0.1:3000)
  GET  /                 static files from dist/ with SPA fallback to index.html
  GET  /api/ai/status    configuration probe (no secrets returned)
  POST /api/ai/mission/analyze | explain | refine
        └──> ai_service.py ──> Google GenAI SDK ──> Gemini
```

## Frontend architecture

- **No framework, no bundler.** `scripts/build.mjs` reads each `src/*.ts`, runs Node's
  `stripTypeScriptTypes` (type stripping only — no type checking, no minification), and
  rewrites the `./engine.ts`-style specifiers to `.js`. HTML, CSS, and SVG are copied.
  The Auth0 SDK bundle is copied from `node_modules`.
- **Entry point.** `src/index.html` loads `/app.js` as an ES module. `app.ts` runs its
  module body immediately: it restores state, installs listeners, and calls `render()`.
- **Routing.** Client-side, using `history.pushState` plus `window.onpopstate`. `render()`
  maps `location.pathname` to a page function. Known routes:

  | Path | Renderer |
  | --- | --- |
  | `/` | `landing()` |
  | `/nonprofit`, `/nonprofit/create` | `nonprofit()`, `createMission()` |
  | `/business`, `/business/quick-give` | `business()`, `quickGive()` |
  | `/volunteer`, `/volunteer/route/:id` | `volunteer()`, `routeView()` |
  | `/sponsor`, `/explore`, `/impact`, `/how-it-works` | `sponsor()`, `explore()`, `globalImpact()`, `how()` |
  | `/mission/:id/plan` \| `/fund` \| `/dispatch` \| `/live` \| `/impact` | `plan()`, `funding()`, `dispatch()`, `live()`, `impactPage()` |

  The server rewrites extension-less unknown paths to `index.html`, so deep links and
  hard refreshes work under the Python server.
- **Rendering model.** Each page returns an HTML string; `render()` assigns it to `#app`
  and then re-binds event handlers. Handlers are attached with `data-action`, `data-nav`,
  and `data-role` attributes plus form `submit` listeners. There is no virtual DOM, so
  any handler that changes state must call `save()` and/or `render()` explicitly.
- **Progressive enhancement hooks.** Two `MutationObserver`s re-apply mobile menu controls
  and optional AI panels after every render.
- **Styling.** Three source stylesheets: `src/app.css` (Tailwind v4 entry, cascade-layer
  order, theme tokens), `src/design.css` (MissionMesh components, shell, mapping, and
  screen refinements), and the preserved `src/style.css` imported into a lower `legacy`
  layer. The build emits one minified `dist/app.css`; Preflight is intentionally omitted.
  Mobile breakpoints collapse the sidebar into a header drawer plus bottom navigation.

## Backend architecture

`server.py` uses only the standard library:

- `SimpleHTTPRequestHandler` subclass serving `dist/` (SPA fallback for extension-less
  paths) and API routes in `do_GET` / `do_POST`.
- Guardrails: request bodies capped at 32 KB, 10 AI requests per minute per client IP,
  JSON-only bodies, and a generic 500 message so internals never leak.
- Errors are returned as `{"error": {"code", "message", "retryable"}}`, matching what the
  frontend `aiRequest()` reads.
- Binds to `127.0.0.1:3000` (local-only by design). `PORT`/host override is not
  implemented yet — see the deployment notes in the README.

`ai_service.py` isolates model access:

- `GeminiService` accepts an injected client, API key, model, and timeout, so tests run
  with a fake client and consume no quota.
- Each operation declares a JSON schema (`mission_schema`, `explanation_schema`,
  `refinement_schema`) and passes the response through a validator that rejects unknown
  categories, out-of-range numbers, HTML-like text, and hallucinated resource IDs.
- Model failures are mapped to stable codes (`AI_AUTH`, `AI_QUOTA`, `AI_TIMEOUT`,
  `AI_MODEL_UNAVAILABLE`, …) with sanitized messages.
- `refine()` copies only whitelisted fields onto a deep copy of the mission and restores
  protected fields (IDs, matches, contributions, route, status, coordinates), so AI output
  can never mutate reservations, funding, or dispatch state.

## API communication

All AI calls are `fetch` POSTs with `Content-Type: application/json`. The frontend never
receives the API key: `GET /api/ai/status` returns only `{configured, sdkAvailable,
ready, model}`. If a call fails, the UI shows the error and offers the rule-based path,
which is the same `compile()` + `match()` pipeline used in demo mode.

## Application state

Single object `db`, seeded by `seed()` and persisted to `localStorage['missionmesh-v1']`:

```
{version, date, role, resources[], missions[], users[], organizations[], volunteers[], impactRecords[]}
```

Mission records carry requirements, matches, contributions, route stops, and impact
values. `save()` writes the whole object; a `storage` event listener re-renders across
tabs. `Reset demo` reseeds the object.

Because state is browser-local, two users never see the same mission. `schema.sql` is the
planned relational shape for a shared database; no code connects to it yet.

## Matching engine (`src/engine.ts`)

Deterministic and DOM-free, so it is unit tested:

1. `compile(text, extra)` extracts people served, budget, deadline, storage, and dietary
   tags from natural language and proposes requirements (meal/supplies, drink,
   transportation). It resolves addresses only against the local demo gazetteer; unknown
   addresses receive no coordinates and `coordinatesResolved: false`, never another
   location's coordinates.
2. `match(mission, resources, volunteer)` filters candidates by category, reservation
   status, pickup-window overlap, refrigeration/dietary compatibility, and resolved
   coordinates, then ranks with `score()` (distance, quantity fit, availability, storage).
3. `optimize()` builds a nearest-neighbour pickup order at 20 mph with handling time and
   drops resources that cannot be collected before their window closes; `match()` retries
   after removing unreachable resources, which guarantees the route only contains
   collectable stops.
4. Cost and gap: community value of matched resources plus a purchase estimate for
   shortages gives `originalCost` and `gap`.
5. `fund()` caps contributions at the outstanding gap and the remaining budget, and
   flips status to `Funded` when the gap closes.
6. `completeStop()` advances the route; the last stop sets `Completed`.
7. `impact()` derives people served, food weight, value saved, cash spent, partners,
   hours, miles, waste, and CO₂ estimates. Environmental numbers are explicitly
   illustrative.

## Authentication

`src/auth.ts` wraps `@auth0/auth0-spa-js` with Authorization Code Flow + PKCE:

- Domain and client ID are public SPA settings, hard-coded in `src/auth.ts`
  (`authConfig` is exported for reuse). No client secret exists in the frontend.
- `cacheLocation: 'memory'` and `useRefreshTokens: false` keep tokens out of
  localStorage.
- `initializeAuth()` completes a redirect callback, then returns the user.
- `auth-bootstrap.ts` is the live auth UI: it adds Log in / Sign up buttons, renders a
  role onboarding screen for users without a local profile, stores the provisional
  profile under `missionmesh-auth-profile-v1` keyed by the Auth0 `sub`, and swaps the demo
  badge for the signed-in identity.
- Role selection only changes client navigation. There is no server-side authorization,
  no tenant scoping, and no protected API.

## External integrations

| Integration | Where | Notes |
| --- | --- | --- |
| Gemini (`google-genai`) | `ai_service.py` | Optional; server-side only; default model `gemini-2.5-flash`, override with `GEMINI_MODEL` |
| Auth0 | `src/auth.ts`, `src/auth-bootstrap.ts` | Public SPA client; needs the site origin as callback/logout/web origin |
| Leaflet 1.9.4 + OpenStreetMap tiles | `src/index.html`, `mapPanel()`, `initMap()` | Real Atlanta demo tiles; attribution retained; no invented fallback geometry |
| Google Maps URLs | `googleMapsUrl()`, `googleDirectionsUrl()` | No API key or billing; verified coordinates when available |
| Browser Geolocation | `action('locate-me')` | Only on explicit button press; manual map pin is the fallback |

## Mapping and location data

Locations carry `address`, optional `lat`/`lng`, `coordinatesResolved`, `locationSource`,
and the owning record ID. `resolveKnownCoordinates()` is a local, deterministic lookup
over a short Atlanta demo list; there is no geocoding vendor, API key, or billing.
Unknown addresses keep `coordinatesResolved: false` with no coordinates. The
requirements form shows a Leaflet click-to-pin picker and an explicit “use my current
location” action; matching and routing are blocked until a location is confirmed.

`initMap()` renders only records with verified coordinates, using category-specific
markers and popups with Google Maps links. It no longer substitutes synthetic geometry
when tiles fail. `quickGive()` resolves the entered pickup address instead of reusing a
fixed coordinate. The resource list, filters, and markers share one filtered data set.
Google Maps links use the documented no-key `maps/search` and `maps/dir` URLs; the Maps
Embed API is not integrated.

## Design boundaries worth preserving

- The AI layer never decides eligibility, quantities, reservations, funding, or
  assignments; the deterministic engine does. Keep that split when adding features.
- Rule-based compilation must keep working with no Gemini key, no network, and no SDK.
- `dist/` is committed and served as-is; a build must stay byte-stable for unchanged
  sources.
