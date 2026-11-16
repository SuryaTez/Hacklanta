# Known issues — MissionMesh development checkpoint

This Sprint 1–3 checkpoint supports a portfolio/demo release. The issues below are open, not fixed. Funding and authentication behavior must not be described as production-ready.

## Sponsor funding can stall when nonprofit budget is $0

`fundable()` treats a matched mission with a positive funding gap as a sponsor opportunity. `fund()` also caps accepted sponsor contributions by the mission's remaining nonprofit budget. With a $28 gap and a $0 budget, the sponsor UI offers the mission but the engine accepts $0 and leaves the $28 gap unchanged.

Reproduce: Start from fresh demo data, create or match a food mission with the seeded 100-person resource coverage and set its budget to $0. Open its funding page or the sponsor workspace. The $28 gap is offered. Submit a simulated $28 contribution; no amount is recorded and the gap remains $28. A deterministic engine reproduction is: `seed()` → set the demo mission's `budget` to `0` → `match()` → `fundable()` returns `true` → `fund(mission, 28, 'Sponsor')` returns `0`.

Affected demo flow: Sponsors cannot close some legitimate-looking positive-gap opportunities, especially zero-budget missions. The seeded $28-gap mission with its normal budget, partial contributions, zero-gap school-supplies exclusion, and volunteer completion remain covered by tests.

Future correction: Decide whether sponsor funds are independent of nonprofit budget. If so, cap contributions by the outstanding gap only, and test zero-budget, partial, and overfunding cases in both engine and browser. If the budget is intentionally a funding cap, make `fundable()` and the UI enforce and explain that policy consistently. Do not silently report success when `fund()` returns zero.

## Auth0 login/logout rejection is not caught by the UI handler

`authClick()` in `src/auth-bootstrap.ts` calls asynchronous `login()` and `logout()` inside a synchronous `try/catch` without awaiting their promises. A rejected Auth0 operation bypasses that `catch`, so the intended error toast is not shown and the browser may report an unhandled promise rejection.

Reproduce: In a browser with Auth0 configured, make the Auth0 request fail (for example, disconnect the network), then click Log in or Log out. The returned promise can reject after `authClick()` has returned; the handler's `catch` cannot observe it. This is a code-path finding; a live Auth0 failure was not induced during this checkpoint.

Affected demo flow: Authentication error feedback may fail when Auth0 is unavailable. Demo-mode role navigation and local-first workflow tests do not exercise this failure path.

Future correction: Make the delegated click handler asynchronous and `await` login/logout inside its `try/catch` (or attach a rejection handler). Add a browser test that forces an Auth0 rejection and verifies a safe, visible error message without an unhandled rejection.

## Release boundary

The checkpoint records the current work; it does not certify payments, authentication, accessibility, or external map availability for production. The visual audit and screenshots remain local under `review-output/` and are intentionally ignored by Git.
