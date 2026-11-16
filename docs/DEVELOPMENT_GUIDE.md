# Development guide

## Prerequisites

- Node.js 22.13+ (the build uses `node:module`'s `stripTypeScriptTypes`)
- Python 3.12+
- `npm install` and a `.venv` with `requirements.txt` installed (see README)

## Start the project

```bash
npm install
python -m venv .venv
node scripts/run-python.mjs -m pip install -r requirements.txt
cp .env.example .env          # optional: add GEMINI_API_KEY
npm run build                 # TypeScript output + dist/app.css
npm run dev                   # build, then http://localhost:3000
# optional while editing source in another terminal:
npm run watch                 # rebuild TypeScript + CSS on src/ changes
npm run css:watch             # stylesheet-only watch
```

`npm run dev` and `npm start` both build all frontend assets first (including the `prestart` build), then use `scripts/run-python.mjs`,
which prefers `.venv/Scripts/python.exe` on Windows and `.venv/bin/python` elsewhere.

Always run `npm run build` after editing anything in `src/`; the server serves `dist/`,
not `src/`.

## Add a frontend page

1. Write a renderer in `src/app.ts` that returns an HTML string, reusing `shell()`,
   `title()`, `btn()`, `badge()`, and `stat()` so navigation and styling stay consistent.
2. Add a branch to `render()` keyed on the new path.
3. Add a navigation link inside `shell()` if the page belongs in the sidebar.
4. Add any event handlers in `bind()` (or a dedicated setup function) using the
   `data-action` convention, and call `save()`/`render()` when state changes.
5. Add the route to the table in `docs/ARCHITECTURE.md` and check the mobile layout.

Put pure calculations in `src/engine.ts` instead of `app.ts`, so they can be tested.

## Add a backend endpoint

1. For a JSON `POST`, register the path in the `routes` dict in `Handler.do_POST` and add
   a `handle_*` method that validates the payload and raises `AIServiceError` for bad
   input.
2. For a `GET`, add a branch in `Handler.do_GET` before the static-file fallback.
3. Reuse `send_json()` and the `{"error": {code, message, retryable}}` shape.
4. Keep secrets server-side; never return the API key, and prefer short sanitized
   messages over raw provider errors.
5. When moving logic into `ai_service.py`, keep it dependency-injectable (fake client in
   tests) and add a schema plus validator for any model output.

## Add a reusable UI component

Helpers live near the top of `src/app.ts` (`I()` for icons, `btn()`, `badge()`, `stat()`,
`a()`, `title()`, `missionCard()`, `resourceCard()`, `mapPanel()`). Add a small function
there that returns a string, take data as arguments rather than reading globals, and use
`esc()` for any interpolated user-supplied text.

Styles are layered: `src/app.css` (Tailwind entry, layer order, theme tokens),
`src/design.css` (MissionMesh components and screen refinements), and the preserved
`src/style.css` (legacy layer). Add reusable rules to `design.css` using `--mm-*` tokens.
For one-off layout, use complete Tailwind utility strings in the template (never class
fragments). Run `npm run css:watch` while iterating. See
[docs/DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) for tokens, components, breakpoints, and the
mapping/location rules.

## Add a location or map action

- Never hard-code coordinates for a new donation or mission. Use
  `resolveKnownCoordinates(address)` or `donationResource()`; store the returned
  `lat`, `lng`, `coordinatesResolved`, and `locationSource`.
- If coordinates are unverified, keep `coordinatesResolved: false` and show
  “Location not yet confirmed”. Do not plot the record or match it.
- Build outbound links with `googleMapsUrl()` / `googleDirectionsUrl()` (no API key).
- Keep the resource list usable without the map; markers and the list must come from the
  same filtered records.

## Add tests

- **Engine logic:** extend `tests/engine.test.mjs` with `assert` calls. It imports the
  built `dist/engine.js`, so build first: `npm run build && npm test`.
- **Backend / AI:** extend `tests/test_ai.py` (`unittest`, fake Gemini client — no quota
  used). Run with `npm run test:backend`.
- Both suites: `npm run test:all`.

## Build and verify a change

```bash
npm run build          # must succeed; regenerates dist/ and dist/app.css
npm run css            # stylesheet-only rebuild
npm test               # deterministic engine behaviour
npm run test:backend   # Python + AI validation
node scripts/run-python.mjs -m py_compile server.py ai_service.py
npm run dev            # then click through the flow that you changed
```

Minimum manual smoke path after touching matching or routing: `/nonprofit/create` →
build mission → community cart → fund gap → dispatch → volunteer route → complete stops →
impact. After touching auth, verify the Log in button starts the Auth0 redirect and that
demo mode still works without signing in.

## Work safely with Git

- Active branch is `staging`; `main` holds merged work. Do not switch, reset, rebase, or
  force-push as part of routine work.
- `dist/` is committed intentionally. Include the rebuilt output with frontend changes so
  hosts serving `dist/` stay in sync; do not hand-edit it.
- Never commit `.env`, `.venv/`, `node_modules/`, or `__pycache__/`.
- Before committing: `git status`, `git diff`, then run the build and both test suites.
- Keep commits small and behavioural; if a refactor is risky, ship it separately and
  document it first.

## Things to know before refactoring

- `app.ts` is one large file. Splitting it by page is the highest-value cleanup, but it is
  risky without a browser test suite; do it incrementally, one page at a time, moving pure
  logic into `engine.ts` first.
- `src/auth.ts` imports `./auth0-spa-js.production.esm.js`, which only exists in `dist/`
  (the build copies it from `node_modules`). Keep that in mind when reading `src/`.
- `src/app.css` intentionally omits Tailwind Preflight. Adding it would reset the legacy
  component sheet's form and heading styles; use utilities and `design.css` instead.
- Map tiles are a third-party network dependency. Do not replace the text resource list
  with a map-only interface, and keep OpenStreetMap attribution visible.
- Type stripping means there is **no type checking** in the build. A type error will not
  fail `npm run build`; only runtime behaviour will.
