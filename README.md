# MissionMesh

MissionMesh is a local-first community resource coordination demo. It connects nonprofit missions with business donations, sponsors, volunteers, and an impact summary. Matching, quantities, reservations, funding caps, and route state remain deterministic browser-side demo logic.

## Gemini mission intelligence

The optional AI layer runs only on the local Python server:

`browser -> /api/ai/mission/* -> server.py -> ai_service.py -> Google GenAI SDK -> Gemini`

Gemini can interpret a nonprofit's natural-language mission, explain the deterministic resource matches and readiness risks, and propose a refinement. Structured JSON schemas and server-side validation reject unsafe or malformed output. Gemini never reserves resources, changes funding, dispatches volunteers, or completes deliveries. A human must review editable fields and explicitly confirm a refinement.

The default is the stable `gemini-2.5-flash` model, selected for structured output, latency, and Free-tier-friendly cost. Change it with `GEMINI_MODEL` if your account has access to another supported model. Automated tests make no live request.

## Windows setup

1. Install Node.js and Python 3.12 or newer.
2. Install the Python dependency in an isolated environment:

   ```powershell
   py -m venv .venv
   .venv\Scripts\python.exe -m pip install -r requirements.txt
   ```

3. Copy `.env.example` to `.env` and set `GEMINI_API_KEY`. Keep `.env` private. `GEMINI_MODEL` is optional.
4. Build and run:

   ```powershell
   npm run build
   .venv\Scripts\python.exe server.py
   ```

5. Open [http://localhost:3000](http://localhost:3000). The server binds to `127.0.0.1` only.

Without a key, the site still works with the existing rule-based compiler and clearly reports that Gemini is unavailable. The key is never sent to the browser, localStorage, or logs.

## Tests

```powershell
npm test
npm run test:backend
npm run build
```

Backend tests use a fake Gemini client and do not consume API quota. A genuine request requires a configured key and should be run manually only when you approve the associated quota use. Free-tier rate limits and model availability are controlled by Google and can change.

## Current limitations

- This remains a local demo: browser localStorage is not a production database.
- Contributions and purchases are explicitly simulated; no payment is processed.
- Coordinates are resolved only for known addresses. Gemini cannot invent or verify custom coordinates.
- Food safety, allergens, inventory, and delivery feasibility still require human confirmation.
- There is no authentication, multi-user authorization, or public deployment protection.

## Auth0 login and provisional onboarding

MissionMesh now includes the official `@auth0/auth0-spa-js` SDK using Authorization Code Flow with PKCE. The public SPA domain and client ID are configured in `src/auth.ts`; no client secret is used in the browser. Tokens remain in the SDK's in-memory cache and are not written to localStorage.

From the home page, choose **Log in** or **Create account**. After Auth0 redirects back to localhost, first-time users choose Nonprofit, Business, Volunteer, or Sponsor and provide a display name, location, and role focus. The provisional profile is stored in localStorage under an isolated key and is associated with the Auth0 subject (`sub`). Role selection controls client navigation only and is not authorization.

The existing **Run Demo** flow remains separate and does not create an Auth0 identity. Provisional profiles are local to one browser/device until the planned Supabase integration. Auth0 must have `http://localhost:3000` configured as a callback URL, logout URL, and allowed web origin.
