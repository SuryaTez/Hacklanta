# MissionMesh design system

Sprint 3 turns the hackathon UI into a deliberate product interface. The brand stays
deep teal, forest green, mint, and warm white; the structure is calmer, more editorial,
and more legible across all four workspaces.

This document is the source of truth for colours, type, components, responsive rules,
accessibility, mapping, and Tailwind conventions.

## 1. Tailwind CSS v4 integration

MissionMesh still ships a framework-free TypeScript SPA. Tailwind is a CSS build step,
not a runtime framework.

```
src/app.css        Tailwind entry: layer order, theme tokens, source registration
src/style.css      Original component CSS (kept, imported into the legacy layer)
src/design.css     MissionMesh component layer and screen refinements
dist/app.css       Generated, minified production stylesheet
```

`npm run build` runs `scripts/build.mjs` (TypeScript stripping, HTML/SVG copies) and then
`tailwindcss -i src/app.css -o dist/app.css --minify`. `src/index.html` loads `/app.css`
only; the two source stylesheets are compiled into it, so they are never loaded unlayered
and cannot fight the cascade.

### Cascade layers

`src/app.css` declares:

```css
@layer theme, legacy, components, utilities;
@import "tailwindcss/theme.css" layer(theme);
@import "tailwindcss/utilities.css" layer(utilities);
@import "./style.css" layer(legacy);
@import "./design.css" layer(components);
@source "./*.{ts,html}";
```

- **No Preflight reset.** The legacy sheet was written without a reset; importing
  Tailwind's Preflight would restyle headings, buttons, and form controls underneath it.
  Utilities are therefore additive, and the existing cascade stays predictable.
- **Utilities win** over both component layers because they are declared last.
- **Legacy stays intact** in the `legacy` layer until a screen has been fully proven in
  the component layer.
- `@source "./*.{ts,html}"` scans `src/app.ts` and `src/index.html`. Tailwind sees complete
  class names written in template strings. New markup must use complete strings such as
  `class="grid gap-6"`. Do **not** build classes from fragments
  (`` `text-${color}` ``); Tailwind cannot detect those reliably.

Watch mode:

```bash
npm run css:watch   # rebuild dist/app.css on change
npm run dev         # one CSS build, then start the Python server
```

Do not load a Tailwind CDN script. The committed `dist/app.css` is the production file.

## 2. Colour tokens

Semantic tokens live in `@theme` (`src/app.css`) and as `--mm-*` aliases in
`src/design.css`. Use the token, never a raw hex, in new components.

| Token | Value | Use |
| --- | --- | --- |
| `--mm-deep` / `--color-deep` | `#0d302e` | Sidebar, hero panels, primary text emphasis |
| `--mm-deep-soft` | `#173f3b` | Hover on deep surfaces |
| `--mm-forest` / `--color-forest` | `#198567` | Primary actions, progress, links |
| `--mm-forest-dark` | `#126a52` | Primary hover |
| `--mm-mint` / `--color-mint` | `#c7ebd8` | Active nav detail, inverse buttons |
| `--mm-mint-soft` | `#e8f5ee` | Icon tiles, coverage chips, callouts |
| `--mm-warm` / `--color-warm` | `#f8f9f5` | Application background |
| `--mm-white` | `#ffffff` | Cards, inputs, topbar |
| `--mm-ink` / `--color-ink` | `#142b28` | Body and heading text |
| `--mm-muted` / `--color-muted` | `#5f716b` | Secondary text |
| `--mm-line` / `--color-line` | `#dbe5df` | Borders and dividers |
| `--mm-amber` / `--mm-amber-soft` | `#8a5a1f` / `#f6efe2` | Partial coverage, location warnings |
| `--mm-danger` | `#a4442f` | Destructive/error text only |

The old purple accent is retired. Existing `.purple` buttons now render deep teal, and
`Gemini` / AI panels use mint and forest accents.

Status meanings:

- Green (`--mm-forest`) = verified, covered, or primary action.
- Amber = partial coverage, unconfirmed location, needs review.
- Neutral sage = preference or informational state.
- No colour is used as the only carrier of meaning; labels and text always accompany it.

## 3. Typography

- **Display:** `Plus Jakarta Sans` (headlines, metrics, fund amounts).
- **Interface:** `Inter` (body, labels, controls).
- Loaded from Google Fonts with `display=swap` and system fallbacks, preconnected in
  `src/index.html`. The fallback stack is
  `"Plus Jakarta Sans", "Manrope", ui-sans-serif, system-ui, sans-serif` and
  `"Inter", "DM Sans", ui-sans-serif, system-ui, sans-serif`.
- Two families only.

| Role | Size | Weight | Notes |
| --- | --- | --- | --- |
| Display / hero | `clamp(44px, 4.9vw, 68px)` | 700 | tight `-0.048em`, fixed line breaks |
| Page title | `clamp(30px, 3vw, 42px)` | 700 | `-0.035em` |
| Section heading | `clamp(21px, 1.9vw, 27px)` | 700 | |
| Card title | 16–18px | 600 | |
| Body | 13.5–14.5px | 400 | 1.6–1.65 line height |
| Label / eyebrow | 9–11px | 600 | uppercase, `0.12–0.15em` tracking |
| Caption / helper | 10–11.5px | 400 | muted |
| Numeric metric | 23–28px | 700 | tabular by font default; do not fake data |

Avoid more than three type sizes in a single card. Supporting copy is muted; a heading is
never the only way to understand a control.

## 4. Spacing, shape, and elevation

- Base spacing rhythm: 4, 8, 12, 16, 20, 24, 32, 40, 56, 64 px.
- Page padding: 32px desktop, 20–24px tablet, 14px mobile.
- Section separation: 38px desktop, 28px mobile.
- Card padding: 24px desktop, 18px mobile.
- Control height: 42px (34px compact, 48px large).
- Radii: 9px controls, 12–14px cards, 18px hero/product panels, 999px badges.
- Borders: 1px `--mm-line`; dashed borders only for empty/create affordances.
- Elevation is restrained: `--mm-shadow` at rest, `--mm-shadow-lift` on interactive hover.
  No stacked glows or floating decorative shapes.

## 5. Components

Implemented as reusable helpers and CSS component classes:

| Component | Source | Notes |
| --- | --- | --- |
| Primary / secondary / outline / text buttons | `btn()` + `.btn` | 42px min height, visible focus, press feedback |
| Icon button / chip | `.btn.chip`, `.map-focus` | Real buttons only |
| Navigation item | `shell()` + `.nav-link` | Active bar plus background; `aria-pressed` role switch |
| Status badge | `badge()` + `.badge` | Text labels, never colour alone |
| Mission card | `missionCard()` + `.mission-card` | Deep-teal cover, coverage bar, one action |
| Resource card | `resourceCard()` + `.resource-card` | Demo label, pickup window, Google Maps link, optional map focus |
| Impact metric bar | `stats-grid` + `stat()` | One bordered bar with dividers instead of repeated cards |
| Form field / select / checkbox | `label`, inputs, `.checks` | Persistent labels, 42px controls, focus ring |
| Alert | `.safety` | Used for confirmation, simulation, and unverified data |
| Empty state | `.empty` | Dashed neutral panel with one sentence |
| Stepper | `steps()` + `.mission-steps` | Current/completed states, scrollable on mobile |
| Tabs | `.tabs` buttons | Real filtering, `selected` state |
| Map panel | `mapPanel()` + Leaflet | Header, legend, attribution, list fallback |
| Location picker | `#location-picker` | Click-to-place pin or explicit geolocation |

No inert controls: every button and link performs a real state change, navigation, or
external map action. Simulated contributions remain labelled as simulated.

## 6. Layout and responsive behaviour

- Application shell: 264px deep-teal sidebar, sticky 64px topbar, 1400px content max.
- Marketing pages use a dedicated header, 1320px content, and no app sidebar.
- Breakpoints: 1200px, 1024px, 900px, 650px, 430px.
- At 900px the sidebar narrows to 208px; at 650px it is replaced by a 4-item bottom bar
  and an accessible header menu. Main content reserves bottom space so the fixed nav
  never covers content.
- Grids collapse in this order: 2-up metrics → 1-up; plan/fund/dispatch/explore → 1-up;
  mission preview stacks under the hero copy; route panel stacks above its map.
- Tables and dense lists become stacked cards; no horizontal page overflow at 390px.
- Mobile controls stay at least 42px tall; body text is 14px or larger.

## 7. Accessibility decisions

- WCAG 2.2 AA target. Body and muted text meet contrast on warm white; primary buttons use
  white on `#198567`.
- Visible focus: 2px forest outline, 2px offset; no `outline: none` without replacement.
- Skip link is present in static HTML and as a defensive runtime control.
- Semantic landmarks: header/nav/main/footer, labelled workspace and primary navigation.
- One `h1` per page; sections use `h2`, cards use `h3`.
- Every form control has a persistent `<label>`; errors are announced by the existing
  status region. Required states are native.
- Mobile menu closes on Escape and restores `aria-expanded`.
- Map markers set Leaflet `title`/`alt`; every map location is also available in the text
  resource list.
- `prefers-reduced-motion` disables transitions and smooth scrolling.
- Icon-only buttons carry accessible names; decorative icons are `aria-hidden`.

## 8. Maps and location data

### Provider

Leaflet 1.9.4 with **OpenStreetMap standard tiles**, loaded from unpkg. The map shows real
streets and neighbourhoods for the seeded Atlanta demo. Attribution is rendered in
Leaflet's control and repeated in the map footer. OSM tile usage policy applies; this demo
is low-volume and must not be republished at scale without a dedicated tile provider.

The old schematic SVG fallback is removed because it depicted invented geography. If
tiles fail, the container shows a plain message and the verified resource list remains
fully usable.

### Location model

Every mission/resource carries:

- `address` — human-readable text, preserved exactly as entered.
- `lat` / `lng` — present only when verified or explicitly selected.
- `coordinatesResolved` — `true` for the local demo gazetteer or a chosen pin.
- `locationSource` — `demo-address`, `demo-record`, `confirmed-pin`, `map-pin`,
  `browser-location`, or `unverified`.
- `id` / `missionId` / `resourceId` — the associated record.

Address resolution is local and deterministic (`knownCoordinates` in `src/engine.ts`).
There is **no geocoding vendor, API key, billing, or network request**. An unknown address
is never assigned the shelter's coordinates. It stays unverified, is not plotted, and is
not matched or routed until the nonprofit places a pin or explicitly shares a location.

`compile()` stores unresolved coordinates as `undefined`; `match()` returns an empty plan
for an unresolved mission. The requirements form shows a "Location not yet confirmed"
panel with a Leaflet click-to-pin picker and an explicit “Use my current location” button
(browser permission is requested only on that click).

Quick Give uses `resolveKnownCoordinates()`; it does not hard-code a location.

### Google Maps

- No API key is required or used. Resource cards and marker popups open
  `https://www.google.com/maps/search/?api=1&query=<lat>,<lng>` (six decimals).
- Route stops and the volunteer route use
  `https://www.google.com/maps/dir/?api=1&destination=<lat>,<lng>`.
- If coordinates are unverified, the map link is omitted; the UI says
  “Location not yet confirmed.”
- Google Maps may choose a different road than MissionMesh's nearest-neighbour estimate;
  both the dispatch screen and route helper say so.
- The Maps Embed API is intentionally **not** integrated (it requires a billing-enabled
  Google Cloud project and a dedicated key). If it is added later, use a separate key
  restricted to the Embed API and the site's origins, never the Gemini key, and keep the
  no-key links as the fallback.

### Markers

| Marker | Meaning |
| --- | --- |
| `.pin-business` | Donated goods from a business demo record |
| `.pin-nonprofit` | Nonprofit-held resource |
| `.pin-volunteer` | Volunteer/transportation capacity |
| `.pin-mission` | Mission with a funding gap |
| `.pin-pickup` | Numbered volunteer pickup |
| `.pin-delivery` | Final delivery |

Markers are placed only from stored coordinates. Selecting “Show on map” in the resource
list opens the correct popup and highlights the card. Category filters and the list share
one filtered data set.

## 9. Styling new screens

1. Prefer existing helpers and component classes (`panel`, `btn`, `badge`, `stat`,
   `mission-steps`, `map-panel`) before inventing a new pattern.
2. Use tokens (`var(--mm-*)` or Tailwind `bg-forest`, `text-ink`, `border-line`) instead of
   raw values.
3. For one-off layout, use complete Tailwind utility class strings in the template. Keep
   the class string static; do not concatenate fragments.
4. Put new reusable rules in `src/design.css` under the relevant section, not at the end
   of the legacy sheet.
5. Use semantic elements, persistent labels, one primary action per region, and real
   state. Add `aria-label` for icon-only controls.
6. Test the four required widths (390, 768, 1024, 1440) and both keyboard and reduced
   motion before calling a screen done.
7. Run `npm run build`, `npm test`, `npm run test:backend`, and the browser harnesses.

## 10. Known design limitations

- The demo's address list is intentionally small; manual pin placement is the fallback.
- No reverse geocoding: a placed pin keeps the typed address text.
- OpenStreetMap tiles need network access; the list remains usable without them.
- Fonts are loaded from Google Fonts with fallbacks; no webfont is self-hosted.
- The legacy component layer still holds screens not yet individually redesigned; new
  work should migrate rules into `design.css` only when a screen is verified.
