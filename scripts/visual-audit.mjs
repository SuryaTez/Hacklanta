#!/usr/bin/env node
/*
 * Visual audit + screenshots with real Chrome (no Playwright/Puppeteer install).
 *
 * Requires the app to be running: `npm start` in another terminal.
 * Usage:
 *   npm run audit:visual
 *   node scripts/visual-audit.mjs --out review-output/sprint3-after
 *   node scripts/visual-audit.mjs --viewports 390x844,1440x900
 *
 * For each page and viewport it captures a full-page PNG and records:
 * page errors, console errors, failed requests, horizontal overflow, and the
 * elements that overflow the viewport. Output: <out>/audit.json
 */
import {spawn} from 'node:child_process';
import {mkdirSync, writeFileSync} from 'node:fs';
import {setTimeout as wait} from 'node:timers/promises';

const BASE = process.env.AUDIT_BASE || 'http://127.0.0.1:3000';
const PORT = Number(process.env.AUDIT_CDP_PORT || 9333);
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const args = process.argv.slice(2);
const arg = name => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const outDir = arg('out') || 'review-output/sprint3-after';
const viewportArg = arg('viewports') || '390x844,768x1024,1440x900';
const viewports = viewportArg.split(',').map(v => {
  const [width, height] = v.split('x').map(Number);
  return {width, height};
});

mkdirSync(outDir, {recursive: true});

const profile = `${process.cwd().replace(/\\/g, '/')}/.freebuff/chrome-audit`;
const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--no-sandbox',
  '--disable-gpu',
  '--hide-scrollbars',
  '--window-size=1440,900',
  'about:blank',
], {stdio: 'ignore'});

async function json(path) {
  const response = await fetch(`http://127.0.0.1:${PORT}${path}`);
  return response.json();
}

async function waitForChrome() {
  for (let i = 0; i < 100; i++) {
    try {
      const targets = await json('/json/list');
      const page = targets.find(t => t.type === 'page');
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
let events = [];

socket.addEventListener('message', event => {
  const data = JSON.parse(event.data);
  if (data.id && pending.has(data.id)) {
    const {resolve, reject} = pending.get(data.id);
    pending.delete(data.id);
    data.error ? reject(new Error(data.error.message)) : resolve(data.result);
    return;
  }
  events.push(data);
});

function send(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, {resolve, reject});
    socket.send(JSON.stringify({id, method, params}));
  });
}

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true});
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Evaluation failed');
  return result.result.value;
}

await send('Page.enable');
await send('Runtime.enable');
await send('Log.enable');
await send('Network.enable');
await send('Emulation.setDeviceMetricsOverride', {width: 1440, height: 900, deviceScaleFactor: 1, mobile: false});

async function ready() {
  for (let i = 0; i < 60; i++) {
    try {
      if (await evaluate('document.readyState === "complete"')) return;
    } catch {}
    await wait(150);
  }
}

const measure = () => evaluate(`(() => {
  const vw = window.innerWidth;
  const de = document.documentElement;
  const offenders = [];
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('.leaflet-pane, .leaflet-container, .mobile-menu, .toast, #toast')) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.right > vw + 1 || r.left < -1) {
      offenders.push({
        tag: el.tagName.toLowerCase(),
        cls: String(el.className || '').slice(0, 70),
        left: Math.round(r.left),
        right: Math.round(r.right),
        width: Math.round(r.width)
      });
    }
  }
  const clipped = [];
  for (const el of document.querySelectorAll('h1, h2, h3, p, a, button, .badge, .stat strong')) {
    if (el.closest('.leaflet-container, .sr-only')) continue;
    if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflow !== 'visible') {
      clipped.push({tag: el.tagName.toLowerCase(), text: (el.textContent || '').trim().slice(0, 50)});
    }
  }
  return {
    title: document.title,
    mainHeading: document.querySelector('main h1, .landing-main h1')?.textContent?.trim() || null,
    activeNav: [...document.querySelectorAll('.nav-link.active, .mobile-nav a.active')].filter(el => el.offsetParent !== null).map(el => el.textContent.trim()),
    scrollWidth: de.scrollWidth,
    clientWidth: de.clientWidth,
    docHeight: Math.round(de.scrollHeight),
    overflowX: de.scrollWidth > vw + 1,
    offenders: offenders.slice(0, 12),
    clipped: clipped.slice(0, 8),
    brokenImages: [...document.images].filter(img => !img.complete || img.naturalWidth === 0).map(img => img.getAttribute('src'))
  };
})()`);

async function capture(name, url, viewport) {
  events = [];
  await send('Page.navigate', {url});
  await ready();
  await wait(1200);
  const metrics = await measure();
  const width = Math.min(Math.ceil(metrics.scrollWidth), 1600);
  const height = Math.min(Math.ceil(metrics.docHeight), 6000);
  // Expand the viewport to the document height instead of stitching with
  // captureBeyondViewport. Stitched captures mis-render rounded overflow
  // layers and place fixed bars over page content.
  await send('Emulation.setDeviceMetricsOverride', {
    width: viewport.width,
    height,
    deviceScaleFactor: 1,
    mobile: viewport.width < 500,
  });
  await wait(450);
  const shot = await send('Page.captureScreenshot', {format: 'png', captureBeyondViewport: false});
  await send('Emulation.setDeviceMetricsOverride', {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
    mobile: viewport.width < 500,
  });
  writeFileSync(`${outDir}/${name}.png`, Buffer.from(shot.data, 'base64'));
  const consoleErrors = events
    .filter(e => e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error')
    .map(e => e.params.args.map(a => a.value ?? a.description ?? a.type).join(' '));
  const exceptions = events
    .filter(e => e.method === 'Runtime.exceptionThrown')
    .map(e => e.params.exceptionDetails.text + ' ' + (e.params.exceptionDetails.exception?.description || ''));
  const failedRequests = events
    .filter(e => e.method === 'Network.loadingFailed' && !e.params.canceled)
    .map(e => `${e.params.type} ${e.params.errorText}`);
  return {...metrics, url, screenshot: `${outDir}/${name}.png`, consoleErrors, exceptions, failedRequests};
}

if (args.includes('--probe')) {
  await send('Emulation.setDeviceMetricsOverride', {width: 1440, height: 900, deviceScaleFactor: 1, mobile: false});
  await send('Page.navigate', {url: `${BASE}/`});
  await ready();
  await wait(1200);
  const probe = await evaluate(`(() => {
    const card = document.querySelector('.mission-preview');
    if (!card) return {error: 'preview card not found'};
    const out = [];
    for (const el of [card, ...card.querySelectorAll('*')]) {
      const cs = getComputedStyle(el);
      const before = getComputedStyle(el, '::before');
      const after = getComputedStyle(el, '::after');
      const solid = v => v !== 'rgba(0, 0, 0, 0)' && v !== 'none';
      if (solid(cs.backgroundColor) || solid(cs.backgroundImage) || solid(before.backgroundColor) || solid(before.backgroundImage) || solid(after.backgroundColor) || solid(after.backgroundImage)) {
        const r = el.getBoundingClientRect();
        out.push({
          tag: el.tagName.toLowerCase(),
          cls: String(el.className || '').slice(0, 55),
          bg: cs.backgroundColor,
          image: cs.backgroundImage.slice(0, 80),
          rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
          before: solid(before.backgroundColor) || solid(before.backgroundImage) ? {content: before.content, bg: before.backgroundColor, image: before.backgroundImage.slice(0, 60), size: before.width + 'x' + before.height, pos: before.position} : null,
          after: solid(after.backgroundColor) || solid(after.backgroundImage) ? {content: after.content, bg: after.backgroundColor, image: after.backgroundImage.slice(0, 60), size: after.width + 'x' + after.height, pos: after.position} : null
        });
      }
    }
    const points = [[1320, 450], [1300, 400], [1336, 500]].map(([x, y]) => ({x, y, stack: document.elementsFromPoint(x, y).slice(0, 6).map(el => { const s = getComputedStyle(el); return {tag: el.tagName.toLowerCase(), cls: String(el.className || '').slice(0, 50), bg: s.backgroundColor, shadow: s.boxShadow, pos: s.position, z: s.zIndex}; })}));
    return {card: (() => { const r = card.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; })(), layers: out, points};
  })()`);
  console.log(JSON.stringify(probe, null, 2));
  socket.close();
  chrome.kill();
  process.exit(0);
}

const missionId = await (async () => {
  await send('Page.navigate', {url: `${BASE}/`});
  await ready();
  await wait(800);
  const seeded = await evaluate(`Boolean(localStorage.getItem('missionmesh-v1'))`);
  if (!seeded) {
    await evaluate(`document.querySelector('[data-action="run-demo"]').click()`);
    await wait(1200);
  }
  return evaluate(`(() => {
    try {
      const db = JSON.parse(localStorage.getItem('missionmesh-v1') || 'null');
      if (!db) return null;
      const active = db.missions.find(m => m.status !== 'Completed') || db.missions[0];
      return active ? active.id : null;
    } catch { return null; }
  })()`);
})();

const m = missionId ? `/mission/${missionId}` : '/nonprofit';
const pages = [
  ['01-home', '/'],
  ['02-business', '/business'],
  ['03-quick-give', '/business/quick-give'],
  ['04-nonprofit', '/nonprofit'],
  ['05-mission-create', '/nonprofit/create'],
  ['06-community-cart', `${m}/plan`],
  ['07-sponsor', '/sponsor'],
  ['08-volunteer-dashboard', '/volunteer'],
  ['09-community-map', '/explore'],
  ['10-impact', '/impact'],
  ['11-how-it-works', '/how-it-works'],
  ['12-funding', `${m}/fund`],
];

const results = [];
for (const viewport of viewports) {
  await send('Emulation.setDeviceMetricsOverride', {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
    mobile: viewport.width < 500,
  });
  for (const [name, path] of pages) {
    const label = `${name}-${viewport.width === 390 ? 'mobile' : viewport.width === 768 ? 'tablet' : 'desktop'}`;
    const result = await capture(label, BASE + path, viewport);
    result.viewport = `${viewport.width}x${viewport.height}`;
    results.push(result);
    const flags = [
      result.overflowX ? 'OVERFLOW' : 'ok',
      result.consoleErrors.length ? `console:${result.consoleErrors.length}` : 'console:0',
      result.exceptions.length ? `js:${result.exceptions.length}` : 'js:0',
    ].join(' ');
    console.log(`${viewport.width}x${viewport.height}  ${path.padEnd(26)} ${flags}`);
  }
}

writeFileSync(`${outDir}/audit.json`, JSON.stringify(results, null, 2));
const overflow = results.filter(r => r.overflowX);
const errors = results.filter(r => r.consoleErrors.length || r.exceptions.length);
console.log(`\nPages captured: ${results.length}`);
console.log(`Horizontal overflow: ${overflow.length ? overflow.map(r => `${r.url}@${r.viewport}`).join(', ') : 'none'}`);
console.log(`Console/JS errors: ${errors.length ? errors.map(r => `${r.url}@${r.viewport}`).join(', ') : 'none'}`);
console.log(`Audit: ${outDir}/audit.json`);

socket.close();
chrome.kill();
await wait(400);
try {
  const {rmSync} = await import('node:fs');
  rmSync(profile, {recursive: true, force: true});
} catch {}
process.exit(errors.length || overflow.length ? 1 : 0);
