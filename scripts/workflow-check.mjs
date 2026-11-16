#!/usr/bin/env node
/*
 * End-to-end workflow verification in real Chrome (no Playwright install).
 * Requires `npm start` to be running. Run with: npm run test:workflow
 *
 * Fresh demo data is seeded at the start (localStorage is cleared), then:
 *   1. Business creates a donation from Quick Give
 *   2. Nonprofit creates a school-supplies mission
 *   3. Matching and the funding gap render from engine data
 *   4. Sponsor funds the seeded food mission's positive gap
 *   5. Volunteer accepts the route and completes every stop
 *   6. Mission completion reaches the impact page
 * It also checks role switching, the logo link, and the mobile menu.
 */
import {spawn} from 'node:child_process';
import {mkdirSync, writeFileSync} from 'node:fs';
import {setTimeout as wait} from 'node:timers/promises';

const BASE = process.env.AUDIT_BASE || 'http://127.0.0.1:3000';
const PORT = Number(process.env.AUDIT_CDP_PORT || 9334);
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const outIndex = process.argv.indexOf('--out');
const outDir = outIndex >= 0 ? process.argv[outIndex + 1] : 'review-output/sprint3-after';
if (!outDir) throw new Error('--out requires a directory');
mkdirSync(outDir, {recursive: true});

const profile = `${process.cwd().replace(/\\/g, '/')}/.freebuff/chrome-workflow`;
const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--no-sandbox',
  '--disable-gpu',
  '--hide-scrollbars',
  '--window-size=1280,900',
  'about:blank',
], {stdio: 'ignore'});

async function json(path) {
  const response = await fetch(`http://127.0.0.1:${PORT}${path}`);
  return response.json();
}
async function waitForChrome() {
  for (let i = 0; i < 100; i++) {
    try {
      const page = (await json('/json/list')).find(t => t.type === 'page');
      if (page) return page;
    } catch {}
    await wait(150);
  }
  throw new Error('Chrome DevTools endpoint did not start.');
}

const page = await waitForChrome();
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, {once: true});
  socket.addEventListener('error', reject, {once: true});
});
let nextId = 1;
const pending = new Map();
const consoleErrors = [];

socket.addEventListener('message', event => {
  const data = JSON.parse(event.data);
  if (data.id && pending.has(data.id)) {
    const {resolve, reject} = pending.get(data.id);
    pending.delete(data.id);
    data.error ? reject(new Error(data.error.message)) : resolve(data.result);
    return;
  }
  if (data.method === 'Runtime.exceptionThrown') consoleErrors.push(data.params.exceptionDetails.text);
  if (data.method === 'Runtime.consoleAPICalled' && data.params.type === 'error') {
    consoleErrors.push(data.params.args.map(a => a.value ?? a.description ?? a.type).join(' '));
  }
});

const send = (method, params = {}) => {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, {resolve, reject});
    socket.send(JSON.stringify({id, method, params}));
  });
};

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true});
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'evaluation failed');
  return result.result.value;
}
async function ready() {
  for (let i = 0; i < 80; i++) {
    if (await evaluate('document.readyState === "complete"')) return;
    await wait(120);
  }
}
async function waitGone(selector, timeout = 12000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (!(await evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`))) return true;
    await wait(200);
  }
  return false;
}

const results = [];
function check(name, ok, detail = '') {
  results.push({name, ok, detail});
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}

const q = selector => evaluate(`document.querySelector(${JSON.stringify(selector)})?.textContent?.replace(/\\s+/g, ' ').trim() || ''`);
const count = selector => evaluate(`document.querySelectorAll(${JSON.stringify(selector)}).length`);
const click = selector => evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.click(); return true; })()`);
const fill = (selector, value) => evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.value = ${JSON.stringify(String(value))}; el.dispatchEvent(new Event('input', {bubbles: true})); el.dispatchEvent(new Event('change', {bubbles: true})); return true; })()`);
const nav = async path => {
  await evaluate(`history.pushState({}, '', ${JSON.stringify(path)}); window.dispatchEvent(new PopStateEvent('popstate'));`);
  await wait(500);
};
const pathname = () => evaluate('location.pathname');
const db = () => evaluate(`JSON.parse(localStorage.getItem('missionmesh-v1') || '{}')`);
async function shot(name) {
  const capture = await send('Page.captureScreenshot', {format: 'png'});
  writeFileSync(`${outDir}/${name}.png`, Buffer.from(capture.data, 'base64'));
}

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', {width: 1280, height: 900, deviceScaleFactor: 1, mobile: false});

// Fresh seed.
await send('Page.navigate', {url: `${BASE}/`});
await ready();
await evaluate('localStorage.clear()');
await send('Page.navigate', {url: `${BASE}/business`});
await ready();
await wait(900);

check('Business dashboard renders seeded listing', (await count('.donation-row')) >= 1, `${await count('.donation-row')} rows`);

// 1. Business creates a donation.
await click('[data-nav="/business/quick-give"]');
await wait(500);
check('Quick Give opens', (await pathname()) === '/business/quick-give');
await click('[data-action="add-item"]');
await wait(300);
await fill('[data-item="0"][data-key="name"]', 'Veggie sandwich trays');
await fill('[data-item="0"][data-key="description"]', 'Prepared sandwich trays');
await fill('[data-item="0"][data-key="quantity"]', '12');
await fill('[data-item="0"][data-key="unit"]', 'trays');
await fill('#donation-form [name="title"]', 'Lunch trays for the community');
await fill('#donation-form [name="instructions"]', 'Loading dock at the rear entrance.');
await evaluate(`(() => { for (const cb of document.querySelectorAll('#donation-form input[type="checkbox"]')) cb.checked = true; return true; })()`);
await evaluate(`document.querySelector('#donation-form').requestSubmit()`);
await wait(1200);
const afterDonation = await db();
check('Donation posts and returns to the business dashboard', (await pathname()) === '/business');
check('Donation item persists in browser data', (afterDonation.resources || []).some(r => r.name === 'Veggie sandwich trays'), `${(afterDonation.resources || []).length} resources`);
check('Business page shows the new listing', (await q('#app')).includes('Veggie sandwich trays'));

// 2. Nonprofit creates a school-supplies mission.
await nav('/nonprofit/create');
await fill('#goal', 'Provide school supplies for 40 students by 7 PM. We have $50.');
await fill('#mission-form [name="budget"]', '50');
await fill('#mission-form [name="deadline"]', '19:00');
await evaluate(`document.querySelector('#mission-form').requestSubmit()`);
await wait(300);
await waitGone('.processing-overlay');
await wait(500);
check('Requirements review appears after compiling', (await count('#requirements-form')) === 1);
check('School-supplies mission hides food-only fields', !(await q('#requirements-form')).includes('Dietary requirements') && !(await q('#requirements-form')).includes('Refrigeration available'), 'no diet/refrigeration controls');
await fill('#requirements-form [name="title"]', 'School supplies for 40 students');
await evaluate(`(() => { for (const cb of document.querySelectorAll('#requirements-form input[type="checkbox"]')) cb.checked = true; return true; })()`);
await evaluate(`document.querySelector('#requirements-form').requestSubmit()`);
await wait(300);
await waitGone('.processing-overlay');
await wait(700);
const planPath = await pathname();
check('Mission advances to the community cart', /^\/mission\/[^/]+\/plan$/.test(planPath), planPath);
check('Matching returns engine-generated matches', (await count('.match-card')) >= 1, `${await count('.match-card')} matches`);
check('Funding gap is shown from engine data', (await q('.plan-layout')).includes('Remaining funding gap'));
check('Cart shows labelled coverage, not invented inventory', (await q('.coverage-list')).length > 0);
await shot('workflow-school-supplies-cart');
const schoolData = await db();
const schoolMission = (schoolData.missions || []).find(m => m.title === 'School supplies for 40 students');
check('School-supplies mission has zero funding gap', Boolean(schoolMission) && schoolMission.gap === 0, schoolMission ? `$${schoolMission.gap}` : 'missing');
await nav('/sponsor');
check('Zero-gap mission is absent from sponsor opportunities', !(await q('.sponsor-list')).includes('School supplies for 40 students'));
await nav(`/mission/${schoolMission.id}/fund`);
check('Zero-gap funding view has no contribution form', (await count('#fund-form')) === 0);

// 3. Sponsor funds the seeded food mission.
const data = await db();
const food = (data.missions || []).find(m => m.id === 'demo') || (data.missions || []).find(m => /Dinner/i.test(m.title));
check('Seeded food mission still exists with a positive gap', Boolean(food) && food.status !== 'Completed', food ? food.status : 'missing');
await nav(`/mission/${food.id}/fund`);
const gapText = await q('.fund-amount');
check('Funding page states a positive remaining gap', /\$\d/.test(gapText), gapText);
await fill('#fund-form [name="sponsor"]', 'Test sponsor');
await fill('#fund-custom', '10');
await evaluate(`(() => { for (const cb of document.querySelectorAll('#fund-form input[type="checkbox"]')) cb.checked = true; return true; })()`);
await evaluate(`document.querySelector('#fund-form').requestSubmit()`);
await wait(1100);
check('Partial contribution leaves the correct remaining gap', (await q('.fund-amount')) === '$18' && (await count('#fund-form')) === 1, await q('.fund-amount'));
const partialData = await db();
check('Partial contribution is recorded once', (partialData.missions || []).find(m => m.id === food.id)?.contributions?.length === 1);
await fill('#fund-form [name="sponsor"]', 'Second sponsor');
await fill('#fund-custom', '18');
await evaluate(`(() => { for (const cb of document.querySelectorAll('#fund-form input[type="checkbox"]')) cb.checked = true; return true; })()`);
await evaluate(`document.querySelector('#fund-form').requestSubmit()`);
await wait(1100);
check('Simulated contribution closes the gap', !(await evaluate(`Boolean(document.querySelector('#fund-form'))`)) && (await q('#app')).includes('everything required'));
const dataAfterFund = await db();
check('Both contributions are recorded in the ledger', (dataAfterFund.missions || []).find(m => m.id === food.id)?.contributions?.length === 2);
await shot('workflow-funded');

// 4. Volunteer accepts the route.
await nav(`/mission/${food.id}/dispatch`);
check('Delivery plan lists every route stop', (await count('.route-stop-list > div')) >= 3, `${await count('.route-stop-list > div')} stops`);
const started = await click('[data-action="start-route"]');
await wait(900);
check('Route starts and opens the volunteer route', started && (await pathname()).startsWith('/volunteer/route/'), await pathname());
check('Route page shows a pickup or delivery action', (await count('[data-action="complete-stop"]')) === 1);
await shot('workflow-route');

// 5. Complete every stop.
let stops = 0;
for (let i = 0; i < 12; i++) {
  const current = await pathname();
  if (current.endsWith('/impact')) break;
  const clicked = await click('[data-action="complete-stop"]');
  if (!clicked) break;
  stops++;
  await wait(700);
}
check('Every pickup is completed and mission reaches impact', (await pathname()).endsWith('/impact'), `${stops} stops clicked`);
check('Impact page renders the completed mission', (await count('.impact-hero')) === 1);
check('Impact shows recorded people supported', /\d/.test(await q('.stats-grid')));
await shot('workflow-impact');

// 6. Impact dashboard reflects the recorded outcome.
await nav('/impact');
check('Community impact shows a non-empty outcome after completion', (await q('#app')).includes('People supported') && !(await q('#app')).includes('No outcomes recorded yet'));

// 7. Food mission plan still matches (Sprint 1/2 regression).
await nav(`/mission/${food.id}/plan`);
check('Seeded food mission still has matches', (await count('.match-card')) >= 3, `${await count('.match-card')} matches`);

// 8. Navigation: logo, role switch, mobile menu.
await click('.brand');
await wait(400);
check('Logo returns to the homepage', (await pathname()) === '/');
await nav('/nonprofit');
await click('[data-role="Sponsor"]');
await wait(500);
check('Role switch opens the sponsor workspace', (await pathname()) === '/sponsor', await pathname());
await send('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 1, mobile: true});
await nav('/business');
await click('.mobile-menu-toggle');
await wait(250);
const menuOpen = await evaluate(`(() => { const menu = document.getElementById('mobile-menu'); return Boolean(menu) && !menu.hidden; })()`);
check('Mobile menu opens', menuOpen);
await click('.mobile-menu-backdrop');
await wait(250);
const menuClosed = await evaluate(`(() => { const menu = document.getElementById('mobile-menu'); return Boolean(menu) && menu.hidden; })()`);
check('Mobile menu closes from the backdrop', menuClosed);

check('No browser console or JS errors during the workflow', consoleErrors.length === 0, consoleErrors.slice(0, 2).join(' | '));

const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} workflow checks passed`);
writeFileSync(`${outDir}/workflow-audit.json`, JSON.stringify(results, null, 2));

socket.close();
chrome.kill();
await wait(400);
try {
  const {rmSync} = await import('node:fs');
  rmSync(profile, {recursive: true, force: true});
} catch {}
process.exit(failed.length ? 1 : 0);
