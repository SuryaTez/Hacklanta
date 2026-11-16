import { seed, compile, match, optimize, fund, completeStop, impact, outstanding, funded, fundable, shortages, coverage, rejections, missionContext, focusLabel, routeSummary, fundedNote, uid, example, money, time, distance, shelter, normalizeDonationCategory, validateDonation, validateDonationImage, donationResource, resolveKnownCoordinates, googleMapsUrl, googleDirectionsUrl, hasVerifiedCoordinates } from './engine.js';
import './auth-bootstrap.js';
const $ = (s)=>document.querySelector(s);
const esc = (s)=>String(s ?? '').replace(/[&<>"']/g, (c)=>({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        })[c]);
let db;
try {
    db = JSON.parse(localStorage.getItem('missionmesh-v1') || 'null') || seed();
} catch  {
    db = seed();
}
let role = db.role || 'Nonprofit', path = location.pathname, scan = [], photo = '', scanned = false, draft = null, filter = 'All resources', busy = false;
let map = null, pickerMap = null, mapMarkers = {}, availabilityFilter = 'All';
const iconPaths = {
    mesh: 'M5 4h5v5H5z M14 4h5v5h-5z M5 13h5v5H5z M14 13h5v5h-5z M10 6.5h4 M10 15.5h4 M7.5 9v4 M16.5 9v4',
    home: 'm3 10 9-7 9 7 M5 9v12h14V9 M9 21v-8h6v8',
    grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
    map: 'm3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z M9 3v15 M15 6v15',
    spark: 'm12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z',
    arrow: 'M4 12h16 m-6-6 6 6-6 6',
    plus: 'M12 5v14 M5 12h14',
    check: 'm5 12 4 4 10-10',
    leaf: 'M20 3C7 2 2 8 5 16s15 6 15-13Z M5 20l11-12',
    heart: 'M12 21 3 12C-3 4 7-1 12 6c5-7 15-2 9 6z',
    truck: 'M2 5h12v12H2z M14 9h5l3 5v3h-8 M5 17a2 2 0 1 0 0 .1 M18 17a2 2 0 1 0 0 .1',
    people: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M2 21v-3a7 7 0 0 1 14 0v3 M17 4a4 4 0 0 1 0 7 M18 14a6 6 0 0 1 4 6',
    clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M12 7v5l3 2',
    chevron: 'm9 5 7 7-7 7',
    camera: 'M3 6h4l2-3h6l2 3h4v14H3z M12 9a4 4 0 1 0 0 8 4 4 0 0 0 0-8',
    box: 'm3 7 9-4 9 4-9 5z M3 7v10l9 4 9-4V7 M12 12v9',
    coin: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M15 8h-4a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4H9 M12 6v12',
    bell: 'M5 17h14l-2-3V9a5 5 0 0 0-10 0v5z M10 21h4',
    download: 'M12 3v12 m-5-5 5 5 5-5 M4 16v5h16v-5',
    reset: 'M4 10a8 8 0 1 1 2 8 M4 3v7h7'
};
const I = (name, size = 20)=>`<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${iconPaths[name] || iconPaths.box}"/></svg>`;
const a = (p, label, cls = '')=>`<a href="${p}" data-nav="${p}" class="${cls}">${label}</a>`;
const btn = (label, action, cls = 'primary', attrs = '')=>`<button class="btn ${cls}" data-action="${action}" ${attrs}>${label}</button>`;
const badge = (s, cls = '')=>`<span class="badge ${cls}">${esc(s)}</span>`;
function save() {
    db.role = role;
    try {
        localStorage.setItem('missionmesh-v1', JSON.stringify(db));
    } catch  {
        toast('Browser storage is full. Your current session is still available.');
    }
}
function toast(s) {
    $('#toast').textContent = s;
    $('#toast').classList.add('show');
    setTimeout(()=>$('#toast').classList.remove('show'), 4000);
}
function go(p) {
    path = p;
    history.pushState({}, '', p);
    window.scrollTo(0, 0);
    render();
}
window.onpopstate = ()=>{
    path = location.pathname;
    render();
};
window.addEventListener('storage', (e)=>{
    if (e.key === 'missionmesh-v1') {
        try {
            db = JSON.parse(e.newValue);
            render();
        } catch  {}
    }
});
const current = ()=>{
    const id = path.startsWith('/volunteer/route/') ? path.split('/')[3] : path.startsWith('/mission/') ? path.split('/')[2] : null;
    return id ? db.missions.find((m)=>m.id === id) : db.missions[db.missions.length - 1];
};
const total = (key)=>db.impactRecords.reduce((s, i)=>s + (i[key] || 0), 0);
function title(kicker, heading, description, cta = '') {
    return `<div class="page-heading"><div><div class="eyebrow">${kicker}</div><h1>${heading}</h1><p>${description}</p></div>${cta}</div>`;
}
function shell(body, landing = false) {
    const baseRole = path.startsWith('/business') ? 'Business' : path.startsWith('/nonprofit') ? 'Nonprofit' : path.startsWith('/volunteer') ? 'Volunteer' : path.startsWith('/sponsor') ? 'Sponsor' : path.startsWith('/mission/') ? path.endsWith('/fund') ? 'Sponsor' : 'Nonprofit' : role;
    const nav = [];
    if (baseRole === 'Business') nav.push([
        'grid',
        '/business',
        'Overview',
        'Home'
    ], [
        'box',
        '/business/quick-give',
        'Quick Give',
        'Give'
    ]);
    else if (baseRole === 'Nonprofit') nav.push([
        'grid',
        '/nonprofit',
        'Overview',
        'Home'
    ], [
        'spark',
        '/nonprofit/create',
        'Mission compiler',
        'Create'
    ]);
    else if (baseRole === 'Volunteer') nav.push([
        'truck',
        '/volunteer',
        'Delivery dashboard',
        'Routes'
    ]);
    else nav.push([
        'heart',
        '/sponsor',
        'Funding overview',
        'Funding'
    ]);
    nav.push([
        'map',
        '/explore',
        'Community map',
        'Explore'
    ], [
        'heart',
        '/impact',
        'Community impact',
        'Impact'
    ], [
        'people',
        '/how-it-works',
        'How it works',
        'How'
    ]);
    const isActive = (p)=>path === p || p === '/nonprofit' && path.startsWith('/mission/') && baseRole === 'Nonprofit' || p === '/sponsor' && path.startsWith('/mission/') && baseRole === 'Sponsor' || p === '/volunteer' && path.startsWith('/volunteer/route/');
    const pageNames = {
        '/': 'Home',
        '/business': 'Business overview',
        '/business/quick-give': 'Quick Give',
        '/nonprofit': 'Nonprofit overview',
        '/nonprofit/create': 'Mission compiler',
        '/volunteer': 'Delivery dashboard',
        '/sponsor': 'Funding overview',
        '/explore': 'Community map',
        '/impact': 'Community impact',
        '/how-it-works': 'How it works'
    };
    const pageName = pageNames[path] || (path.endsWith('/plan') ? 'Community cart' : path.endsWith('/fund') ? 'Mission funding' : path.endsWith('/dispatch') ? 'Delivery plan' : path.endsWith('/live') ? 'Live mission' : path.endsWith('/impact') ? 'Mission impact' : path.startsWith('/volunteer/route/') ? 'Volunteer route' : baseRole + ' workspace');
    const sidebarNav = `${nav.slice(0, 2).map(([i, p, l])=>a(p, `${I(i)}<span>${l}</span>`, `nav-link ${isActive(p) ? 'active' : ''}`)).join('')}`;
    const discoverNav = `${nav.slice(2).map(([i, p, l])=>a(p, `${I(i)}<span>${l}</span>`, `nav-link ${isActive(p) ? 'active' : ''}`)).join('')}`;
    const mobileNav = nav.map(([i, p, l, s])=>a(p, `${I(i)}<span>${s}</span>`, isActive(p) ? 'active' : '')).join('');
    if (landing) return `<div class="landing-shell"><header class="landing-nav"><a href="/" data-nav="/" class="landing-brand">${I('mesh', 28)}<span>MISSION<span class="brand-light">MESH</span></span></a><nav class="landing-links" aria-label="Primary"><a href="/how-it-works" data-nav="/how-it-works">How it works</a><a href="/explore" data-nav="/explore">Community map</a><a href="/impact" data-nav="/impact">Impact</a><a href="/sponsor" data-nav="/sponsor">For sponsors</a></nav><details class="landing-menu"><summary>Menu</summary><div class="landing-menu-panel"><a href="/how-it-works" data-nav="/how-it-works">How it works</a><a href="/explore" data-nav="/explore">Community map</a><a href="/impact" data-nav="/impact">Impact</a><a href="/sponsor" data-nav="/sponsor">For sponsors</a><div class="landing-menu-auth"><button type="button" class="btn text" data-auth="login">Log in</button><button type="button" class="btn outline" data-auth="signup">Create account</button></div></div></details><div class="top-actions landing-actions"><button class="btn primary demo-cta" data-action="run-demo">Explore demo ${I('arrow', 17)}</button></div></header><main class="landing-main">${body}</main><footer class="landing-footer"><div class="landing-footer-inner"><div><div class="footer-brand">${I('mesh', 22)} MISSIONMESH</div><p class="footer-tagline">One mission. A whole community behind it. Coordinate surplus, volunteers, and the true funding gap in one shared plan.</p><p class="footer-note">${I('box', 14)} Local-first demo · data stays in this browser</p></div><div><h3>Product</h3><a href="/how-it-works" data-nav="/how-it-works">How it works</a><a href="/nonprofit/create" data-nav="/nonprofit/create">Mission compiler</a><a href="/explore" data-nav="/explore">Community map</a><a href="/impact" data-nav="/impact">Impact estimates</a></div><div><h3>Workspaces</h3><a href="/business" data-nav="/business">Businesses</a><a href="/nonprofit" data-nav="/nonprofit">Nonprofits</a><a href="/sponsor" data-nav="/sponsor">Sponsors</a><a href="/volunteer" data-nav="/volunteer">Volunteers</a></div><div><h3>Good to know</h3><a href="/how-it-works" data-nav="/how-it-works">Deterministic matching</a><a href="/how-it-works" data-nav="/how-it-works">Human approval</a><a href="/how-it-works" data-nav="/how-it-works">Simulated payments</a><a href="/how-it-works" data-nav="/how-it-works">Demo &amp; data notes</a></div></div><div class="landing-legal"><span>© 2026 MissionMesh · Hacklanta community demo</span><span>Estimates are calculated by this app. Contributions are simulated; no payment is processed.</span></div></footer></div>`;
    return `<div class="layout"><aside class="sidebar"><a href="/" data-nav="/" class="brand">${I('mesh', 26)}<span>MISSION<span class="brand-light">MESH</span></span></a><div class="workspace"><div class="workspace-icon">H</div><div><strong>Atlanta community</strong><small>Connected for good</small></div><span class="online-dot" aria-label="Demo workspace online"></span></div><nav class="side-nav" aria-label="Workspace navigation"><div class="nav-caption">YOUR WORKSPACE</div>${sidebarNav}<div class="nav-caption">DISCOVER</div>${discoverNav}</nav><div class="sidebar-bottom"><div class="community-note"><span class="note-icon">${I('leaf', 18)}</span><strong>A little surplus.<br>A lot of possibility.</strong><p>Every listing you confirm becomes a real option for a nearby mission.</p>${a('/business/quick-give', 'Share a resource ' + I('arrow', 14), 'note-link')}</div><div class="sidebar-utility">${btn(I('reset', 15) + ' Reset demo', 'reset', 'text')}<div class="profile"><div class="avatar">VP</div><div><strong>Demo workspace</strong><small>All four roles unlocked</small></div>${I('chevron', 15)}</div></div></div></aside><div class="main-wrap"><header class="topbar"><a href="/" data-nav="/" class="mobile-brand">${I('mesh', 20)}<span>MISSION<span class="brand-light">MESH</span></span></a><div class="crumb"><span class="crumb-location">${I('map', 14)} Atlanta, GA</span><span class="divider">/</span><strong>${pageName}</strong></div><div class="top-actions"><span class="demo-dot">Demo mode</span><div class="role-switch" aria-label="Switch demo role">${[
        'Business',
        'Nonprofit',
        'Volunteer',
        'Sponsor'
    ].map((r)=>`<button type="button" data-role="${r}" class="${baseRole === r ? 'selected' : ''}" aria-pressed="${baseRole === r}">${r}</button>`).join('')}</div></div></header><main>${body}<footer class="app-footer"><span class="footer-brand-small">MISSIONMESH</span><span>Tell us the outcome. The community assembles the plan.</span><span>Atlanta demo · Local browser persistence</span></footer></main></div><nav class="mobile-nav" aria-label="Primary navigation">${mobileNav}</nav></div>`;
}
function stat(icon, value, label, note = '', cls = '') {
    return `<div class="stat ${cls}"><div class="stat-top"><span class="icon-tile">${I(icon)}</span>${note ? `<small>${note}</small>` : ''}</div><strong>${value}</strong><span>${label}</span></div>`;
}
function landing() {
    return shell(`<section class="home-hero"><div class="hero-copy"><div class="eyebrow hero-eyebrow">${I('mesh', 15)} Community logistics · Atlanta demo</div><h1>One mission.<br>A whole community<br><em>behind it.</em></h1><p class="hero-lead">MissionMesh turns a stated community need into an editable plan — surplus resources matched by real constraints, volunteers routed, and only the true funding gap put in front of sponsors.</p><div class="actions"><button class="btn primary lg" data-action="run-demo">Explore Demo ${I('arrow', 18)}</button><a href="/how-it-works" data-nav="/how-it-works" class="btn secondary">How MissionMesh works</a></div><p class="hero-note">Explore Demo resets this browser’s demo data and opens the Business workspace. Nothing is uploaded or charged.</p><dl class="hero-facts"><div><dt>Matching</dt><dd>Deterministic, explained</dd></div><div><dt>Approval</dt><dd>Human, at every step</dd></div><div><dt>Payments</dt><dd>Simulated only</dd></div></dl></div><aside class="mission-preview" aria-label="Example MissionMesh mission plan"><div class="mission-preview-head"><div><span class="badge preview-badge">Example mission</span><h2>Dinner for 100 people</h2><p>Hope Community Shelter · due 7:00 PM</p></div>${I('mesh', 30)}</div><div class="mission-preview-body"><div class="preview-coverage"><span>Community cart</span><strong>80 of 100 servings</strong></div><div class="preview-progress" role="img" aria-label="80 of 100 meal servings covered"><i style="width:80%"></i></div><div class="preview-lines"><div class="preview-line"><strong>Sunrise Restaurant</strong><span>40 servings</span><small>Prepared meals · refrigerated</small></div><div class="preview-line"><strong>FreshMart Grocery</strong><span>35 servings</span><small>Produce &amp; salad ingredients</small></div><div class="preview-line"><strong>Little Grain Bakery</strong><span>5 servings</span><small>Bread &amp; pastry · room temperature</small></div><div class="preview-line"><strong>Hope Shelter refill</strong><span>76 drinks</span><small>Drinking water · pickup 4–6:30 PM</small></div></div><div class="preview-gap"><div><span>Remaining purchase gap</span><strong>$28</strong></div><span class="preview-gap-note">Covers shortfall only</span></div></div><div class="preview-label">${I('box', 13)} Illustrative example built from seeded demo data — not real community outcomes.</div></aside></section><section class="role-strip" aria-labelledby="roles-title"><h2 class="sr-only" id="roles-title">Four connected workspaces</h2>${[
        [
            '01',
            'Nonprofit',
            'spark',
            'Start with the outcome.',
            'Describe the need. Review every requirement before searching.',
            '/nonprofit',
            'nonprofit'
        ],
        [
            '02',
            'Business',
            'box',
            'Share what is actually spare.',
            'Confirm quantities, storage, and pickup windows. No photo analysis.',
            '/business',
            'business'
        ],
        [
            '03',
            'Sponsor',
            'heart',
            'Fund only the missing piece.',
            'See the verified gap and a ledger of simulated contributions.',
            '/sponsor',
            'sponsor'
        ],
        [
            '04',
            'Volunteer',
            'truck',
            'Deliver the last mile.',
            'Follow an ordered route and confirm every pickup and delivery.',
            '/volunteer',
            'volunteer'
        ]
    ].map(([n, title, i, h, p, url, cls])=>`<a class="role-tile ${cls}" href="${url}" data-nav="${url}"><span class="role-index">${n} · FOR ${title === 'Business' ? 'BUSINESSES' : title.toUpperCase() + 'S'}</span><span class="role-icon">${I(i, 22)}</span><h3>${h}</h3><p>${p}</p><span class="role-link">Open ${title.toLowerCase()} workspace ${I('arrow', 14)}</span></a>`).join('')}</section><section class="workflow-section" aria-labelledby="flow-title"><div class="section-head"><div><div class="eyebrow">THE SHARED WORKFLOW</div><h2 id="flow-title">Need → Match → Fund → Deliver → Impact</h2></div><a href="/how-it-works" data-nav="/how-it-works" class="subtle-link">Read the full workflow ${I('arrow', 15)}</a></div><ol class="flow"><li><span>01 · Need</span><strong>Name an outcome</strong><p>A nonprofit describes what should happen, not a shopping list.</p></li><li><span>02 · Match</span><strong>Assemble real resources</strong><p>Rules check category, quantity, pickup windows, storage, and diet.</p></li><li><span>03 · Fund</span><strong>Close only the gap</strong><p>Sponsors see the true shortfall. Fully covered missions are never fundable.</p></li><li><span>04 · Deliver</span><strong>Move it together</strong><p>A volunteer route orders stops and records each confirmation.</p></li><li><span>05 · Impact</span><strong>Show the outcome</strong><p>App-calculated estimates stay labeled as estimates, not audited results.</p></li></ol></section><section class="closing-cta"><div><h2>Start with one real need.</h2><p>See the full loop with seeded data, or open a workspace and build from scratch.</p></div><div class="actions"><button class="btn primary" data-action="run-demo">Explore Demo ${I('arrow', 17)}</button><a href="/nonprofit/create" data-nav="/nonprofit/create" class="btn outline-inverse">Create a mission</a></div></section>`, true);
}
function missionCard(m) {
    const covered = m.originalCost ? Math.round(m.communityValue / m.originalCost * 100) : 0;
    const partners = [
        ...new Set(m.matches.map((x)=>db.resources.find((r)=>r.id === x.resourceId)?.provider).filter(Boolean))
    ];
    const initials = (name)=>name.split(/\s+/).filter(Boolean).slice(0, 2).map((x)=>x[0].toUpperCase()).join('');
    const avatarList = partners.slice(0, 3).map((name)=>`<span title="${esc(name)}">${esc(initials(name))}</span>`).join('');
    const extra = partners.length > 3 ? `<span title="${esc(partners.slice(3).join(', '))}">+${partners.length - 3}</span>` : '';
    return `<article class="mission-card"><div class="mission-cover"><div class="mission-cover-art">${I('people', 54)}<span class="cover-leaf">${I('leaf', 60)}</span><span class="cover-box">${I('box', 44)}</span></div>${badge(m.status === 'Completed' ? 'Completed' : m.status === 'Draft' ? 'Planning' : m.status, 'mint')}</div><div class="mission-card-body"><div class="meta">COMMUNITY ${focusLabel(m).toUpperCase()} <span>Today</span></div><h3>${esc(m.title)}</h3><p>${I('map', 15)} ${esc((m.address || 'Location not confirmed').split(',')[0])}</p><div class="mission-detail"><span>${I('clock', 15)} By ${time(m.deadline)}</span><span>${I('people', 15)} ${m.people} people</span></div><div class="progress-label"><span>Community coverage</span><strong>${covered}%</strong></div><div class="progress"><i style="width:${covered}%"></i></div><div class="mission-card-foot"><div class="partner-avatars">${avatarList}${extra}</div>${a(`/mission/${m.id}/${m.status === 'Completed' ? 'impact' : m.status === 'In progress' ? 'live' : 'plan'}`, 'View mission ' + I('arrow', 16), 'subtle-link')}</div></div></article>`;
}
function nonprofit() {
    const active = db.missions.filter((m)=>m.status !== 'Completed');
    const completed = db.impactRecords.length;
    const reused = total('estimatedValueSaved');
    const openGap = active.reduce((s, m)=>s + outstanding(m), 0);
    return shell(`${title('NONPROFIT WORKSPACE', 'Good afternoon, Hope Shelter <span class="wave">☀</span>', 'Big things happen when the community comes together.', a('/nonprofit/create', I('plus') + ' Create Mission', 'btn primary'))}<div class="stats-grid">${stat('spark', String(active.length), 'Active missions', 'In this demo')}${stat('check', String(completed), 'Completed missions', 'Recorded outcomes')}${stat('box', money(reused), 'Community resources used', 'From completed missions')}${stat('coin', money(openGap), 'Open funding gaps', 'Across active missions')}</div><section class="compiler-banner"><div class="compiler-icon">${I('spark', 33)}</div><div><span class="eyebrow">YOUR GOAL. OUR CONNECTIONS.</span><h2>What does your community need today?</h2><p>Describe the outcome. We’ll find the resources, people, and path to make it happen.</p></div>${a('/nonprofit/create', 'Build a mission ' + I('arrow'), 'btn primary')}</section><section class="section"><div class="section-head"><div><h2>Your missions <span class="count">${active.length}</span></h2><p>From a good idea to a real-world outcome.</p></div><div class="tabs">${btn('Active', 'tab-active', 'text selected')}${btn('Completed', 'tab-completed', 'text')}</div></div><div class="missions-grid" id="mission-list">${active.length ? active.map(missionCard).join('') : '<div class="empty">Create your first community mission.</div>'}<a href="/nonprofit/create" data-nav="/nonprofit/create" class="create-card"><span>${I('plus', 28)}</span><h3>Good starts with a goal.</h3><p>What could your community<br>make possible together?</p><strong>Create a new mission ${I('arrow', 16)}</strong></a></div></section><section class="resources-section"><div class="section-head"><div><h2>Good things, close by.</h2><p>Fresh resources ready for a purpose.</p></div>${a('/explore', 'Explore community ' + I('arrow'), 'subtle-link')}</div><div class="resource-row">${db.resources.filter((r)=>r.status === 'Available' && [
            'meal',
            'drink'
        ].includes(r.category)).slice(0, 3).map(resourceCard).join('')}</div></section><div class="bottom-callout">${I('leaf', 30)}<p>Your community already has more than you think.<br><strong>Let’s put it to work.</strong></p><span>${new Set(db.resources.map((r)=>r.organizationId)).size} demo partners. One shared purpose.</span></div>`);
}
function resourceCard(r, mapAction = false) {
    const resolved = hasVerifiedCoordinates(r);
    const maps = resolved ? googleMapsUrl(r) : '';
    const funding = r.category === 'funding';
    const typeLabel = {
        meal: 'Food',
        drink: 'Drink',
        supplies: 'Supplies',
        transportation: 'Transport',
        space: 'Space',
        funding: 'Funding'
    }[r.category] || r.category;
    const icon = r.category === 'meal' ? 'leaf' : r.category === 'transportation' ? 'truck' : r.category === 'drink' || r.category === 'space' ? 'box' : r.category === 'funding' ? 'coin' : 'people';
    return `<article class="resource-card" data-map-item="${esc(r.id)}">
    <span class="resource-icon ${r.category}">${I(icon, 24)}</span>
    <div class="resource-copy">
      <div class="resource-kicker"><small>${esc(r.provider)}</small><span class="demo-tag">Demo record</span></div>
      <h3>${esc(r.name)}</h3>
      <p class="resource-facts">${typeLabel} · ${r.quantity} ${esc(r.unit)}</p>
      <p class="resource-address">${I('map', 12)} ${resolved ? esc(r.address || 'Address verified') : 'Location not yet confirmed'}</p>
      <span class="availability">${I('clock', 13)} ${funding ? 'Mission deadline' : `Pickup ${time(r.availableFrom)}–${time(r.availableUntil)}`}</span>
      <div class="resource-links">${funding ? `<a class="map-link" href="/mission/${esc(r.id)}/fund" data-nav="/mission/${esc(r.id)}/fund">View funding gap ${I('arrow', 13)}</a>` : maps ? `<a class="map-link" href="${maps}" target="_blank" rel="noopener">Open in Google Maps ${I('arrow', 13)}</a>` : `<span class="location-warning">${I('map', 13)} Location not yet confirmed</span>`}${mapAction && resolved ? `<button type="button" class="map-focus" data-map-focus="${esc(r.id)}">Show on map</button>` : ''}</div>
      ${mapAction ? `<details class="resource-details"><summary>View details</summary><dl>
        <div><dt>Type</dt><dd>${typeLabel} · ${r.quantity} ${esc(r.unit)}</dd></div>
        <div><dt>Address</dt><dd>${resolved ? esc(r.address) : 'Not confirmed'}</dd></div>
        <div><dt>Availability</dt><dd>${funding ? `Needed by ${time(r.availableUntil)}` : `${time(r.availableFrom)}–${time(r.availableUntil)}`}</dd></div>
        ${funding ? '' : `<div><dt>Storage</dt><dd>${esc(r.storageType)}</dd></div>`}
        ${!funding && r.dietaryTags?.length ? `<div><dt>Dietary</dt><dd>${r.dietaryTags.map(esc).join(', ')}</dd></div>` : ''}
      </dl></details>` : ''}
    </div>
    <span class="free">${funding ? 'GAP' : 'FREE'}</span>
  </article>`;
}
function business() {
    const own = db.resources.filter((r)=>r.organizationId === 'org-sunrise');
    const active = own.filter((r)=>![
            'Delivered',
            'Collected'
        ].includes(r.status));
    const delivered = own.filter((r)=>[
            'Delivered',
            'Collected'
        ].includes(r.status));
    const available = active.filter((r)=>r.status === 'Available');
    const units = available.reduce((s, r)=>s + r.quantity, 0);
    const value = active.reduce((s, r)=>s + r.estimatedValue, 0);
    const next = active.length ? Math.min(...active.map((r)=>r.availableUntil)) : null;
    return shell(`${title('BUSINESS WORKSPACE', 'Good afternoon, Sunrise Restaurant', 'A little left over can go a long way.', a('/business/quick-give', I('plus') + ' Create donation', 'btn primary'))}
  <div class="stats-grid">
    ${stat('box', String(active.length), 'Active listings', active.length ? 'Confirmed and live' : 'Nothing live right now')}
    ${stat('leaf', String(units), 'Items available', `${available.length} ${available.length === 1 ? 'listing' : 'listings'} ready to match`)}
    ${stat('clock', next !== null ? time(next) : '—', 'Next pickup deadline', next !== null ? 'Earliest active window' : 'No pickup scheduled')}
    ${stat('coin', money(value), 'Estimated value available', 'Available inventory only')}
  </div>
  <section class="ops-panel">
    <div><span class="eyebrow">PICKUP OPERATIONS</span><h2>${active.length ? 'Today’s active pickup windows' : 'No active pickups'}</h2><p>${active.length ? 'Pickup details are shared with matched missions. Confirm the window before a volunteer arrives.' : 'Post today’s surplus with a clear pickup window so nearby missions can plan.'}</p></div>
    <div class="ops-pickups">${active.slice(0, 3).map((r)=>`<span><strong>${esc(r.name)}</strong><small>${time(r.availableFrom)}–${time(r.availableUntil)}</small></span>`).join('') || '<span><strong>No window</strong><small>Create a donation to add one</small></span>'}</div>
    ${a('/business/quick-give', 'New listing ' + I('arrow', 14), 'btn outline')}
  </section>
  <div class="section-head"><div><h2>Active donations <span class="count">${active.length}</span></h2><p>Inventory confirmed by your team and available to missions.</p></div>${badge('Atlanta community', 'mint')}</div>
  <div class="donation-list">${active.map((r)=>`<article class="donation-row">
    <span class="resource-icon ${r.category}">${I(r.category === 'drink' ? 'box' : r.category === 'transportation' ? 'truck' : 'leaf', 26)}</span>
    <div><h3>${esc(r.name)}</h3><p>${r.quantity} ${esc(r.unit)} · ${esc(r.storageType)}</p><small>${esc(r.address)}</small></div>
    <div><small>PICKUP WINDOW</small><strong>${time(r.availableFrom)}–${time(r.availableUntil)}</strong></div>
    <div>${badge(r.status, r.status === 'Available' ? 'mint' : 'lavender')}<p>${r.status === 'Available' ? 'Ready to match' : r.missionId ? 'Reserved by a mission' : 'Not currently available'}</p></div>
  </article>`).join('') || '<div class="empty">Nothing active right now. Have surplus to share? Create a donation to get started.</div>'}</div>
  <section class="section">
    <div class="section-head"><div><h2>Delivered donations</h2><p>Completed handoffs from this browser demo.</p></div></div>
    <div class="donation-list">${delivered.map((r)=>`<article class="donation-row">
      <span class="resource-icon">${I('check', 22)}</span>
      <div><h3>${esc(r.name)}</h3><p>${r.quantity} ${esc(r.unit)} · ${esc(r.provider)}</p><small>${esc(r.address)}</small></div>
      <div><small>STATUS</small><strong>Delivered</strong></div>
      <div>${badge('Completed', 'mint')}<p>${money(r.estimatedValue)} recorded</p></div>
    </article>`).join('') || '<div class="empty">No delivered donations yet. Completed listings will appear here after a mission is finished.</div>'}</div>
  </section>`);
}
function quickGive() {
    return shell(`${title('QUICK GIVE', 'Share surplus with your community.', 'Create an accurate listing in a few clear steps.')}
<div class="give-layout">
  <section class="give-main">
    <section class="panel give-items">
      <div class="step-heading"><span>1</span><div><h2>Describe what you are sharing</h2><p>Add items manually or load editable examples. Nothing is inferred from a photo.</p></div>${badge('Manual confirmation', 'lavender')}</div>
      <div class="give-photo-row">
        <label class="upload give-upload" for="photo">${photo ? `<img src="${esc(photo)}" alt="Selected donation photo"><span class="helper">Selected photo preview</span>` : `<span class="upload-icon">${I('camera', 30)}</span><h3>Add a photo</h3><span class="photo-optional">Optional</span><p>JPG, PNG or WebP · up to 5 MB</p><span class="btn outline">Choose image</span>`}<input type="file" id="photo" accept="image/jpeg,image/png,image/webp" capture="environment" hidden></label>
        <div class="give-photo-actions"><strong>Start with an item list</strong><p>Examples are clearly labeled and must be reviewed by the donor before posting.</p><div class="actions">${btn('Add item manually', 'add-item', 'outline')}${!scan.length ? btn('Load editable examples', 'example-items', 'text') : ''}${btn('Use sample photo', 'sample', 'text')}${photo ? btn('Remove photo', 'remove-photo', 'text') : ''}</div><p class="helper">No computer vision is running. Every name, quantity, category, and safety detail comes from you.</p></div>
      </div>
      ${scan.length ? `<div class="analysis-head"><div>${I('box')} <strong>${scan.length} donation ${scan.length === 1 ? 'item' : 'items'} · editable</strong></div>${badge('Donor confirmed', 'mint')}</div>
      <div id="scan-items">${scan.map((x, i)=>`<div class="scan-row">
        <label>Item<input data-item="${i}" data-key="name" value="${esc(x.name)}" required></label>
        <label>Description<input data-item="${i}" data-key="description" value="${esc(x.description || '')}"></label>
        <label>Qty<input type="number" min="0.01" step="any" data-item="${i}" data-key="quantity" value="${x.quantity}"></label>
        <label>Unit<input data-item="${i}" data-key="unit" value="${esc(x.unit)}" required></label>
        <label>Category<select data-item="${i}" data-key="category">${[
            'meal',
            'drink',
            'supplies',
            'space',
            'transportation'
        ].map((c)=>`<option ${normalizeDonationCategory(x.category) === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
        <button class="remove" data-remove="${i}" aria-label="Remove ${esc(x.name || 'item')}">×</button>
      </div>`).join('')}</div>${btn(I('plus', 16) + ' Add another item', 'add-item', 'text')}` : `<div class="give-empty">${I('box', 28)}<div><strong>No items added yet.</strong><p>Add an item manually or load the editable examples to see the full listing shape.</p></div></div>`}
    </section>
  </section>
  <section class="panel give-details">
    <div class="step-heading"><span>2</span><div><h2>Pickup &amp; safety details</h2><p>These facts control matching and pickup safety.</p></div></div>
    <p class="form-required-note">Items are added in step 1. A <span class="req">*</span> marks a required field.</p>
    <form id="donation-form">
      <div class="form-section"><h3>Listing</h3><div class="field-grid">
        <label>Business name *<input name="business" value="Sunrise Restaurant" required></label>
        <label>Donation title *<input name="title" placeholder="Prepared meals for the community" required></label>
      </div></div>
      <div class="form-section"><h3>Pickup</h3><div class="field-grid">
        <label>Available from *<input name="from" type="time" value="16:00" required></label>
        <label>Available until *<input name="until" type="time" value="18:00" required></label>
        <label>Use-by or expiration date<input name="useBy" type="date"></label>
        <label>Pickup address *<input name="address" value="675 Ponce de Leon Ave NE, Atlanta, GA" required></label>
      </div></div>
      <div class="form-section"><h3>Storage &amp; food safety <span>skip if not food</span></h3>
        <label>Storage requirement<select name="storage"><option>Refrigerated</option><option>Room temperature</option><option>Frozen</option></select></label>
        <fieldset><legend>Dietary information · confirm what applies</legend><div class="checks">${[
        'Vegetarian',
        'Vegan',
        'Halal',
        'Gluten Free',
        'Contains Nuts',
        'Other'
    ].map((x)=>`<label><input type="checkbox" name="diet" value="${x}"> ${x}</label>`).join('')}</div></fieldset>
        <label>Known allergens <span class="label-note">food items only</span><textarea name="allergens" placeholder="List known allergens, or state that none are known."></textarea></label>
      </div>
      <div class="form-section"><h3>Handoff</h3><label>Pickup instructions *<textarea name="instructions" placeholder="Packaging, loading instructions, contact details…" required></textarea></label></div>
      <label class="check-confirm"><input type="checkbox" name="confirm" required> <span>I confirm the item names, quantities, allergens, storage, pickup window, and use-by information.</span></label>
      <div class="safety">${I('heart', 18)}<p>MissionMesh does not infer food safety or allergens from photos. The donor is responsible for every confirmation above.</p></div>
      <p id="donation-error" class="form-error" role="alert" hidden></p>
      <button class="btn primary full" ${!scan.length ? 'disabled' : ''}>Confirm &amp; Post Donation ${I('arrow')}</button>
      <p class="helper center">${scan.length ? `${scan.length} ${scan.length === 1 ? 'item' : 'items'} ready to post.` : 'Add at least one item before posting.'}</p>
    </form>
  </section>
</div>`);
}
function createMission() {
    return shell(`${title('MISSION COMPILER', 'Start with what you want to make possible.', 'Your community may already have what it takes. Tell us the outcome.')}<div class="create-layout"><section class="panel mission-input"><div class="ai-header">${I('spark', 26)}<h2>What outcome are you trying to accomplish?</h2></div><form id="mission-form"><label class="sr-only" for="goal">Mission outcome</label><textarea id="goal" name="goal" rows="5" placeholder="${example}" required>${example}</textarea><div class="examples"><small>TRY A GOAL</small>${btn('Dinner for 100', 'example-food', 'chip')}${btn('School supplies for 40', 'example-supply', 'chip')}</div><div class="field-grid"><label>Mission location<input name="address" value="${shelter.address}" required></label><label>Maximum budget ($)<input name="budget" type="number" min="0" placeholder="From your goal"></label><label>Deadline<input name="deadline" type="time"></label></div><button class="btn primary full">${I('spark')} Build My Mission ${I('arrow')}</button><p class="helper center">Demo compiler extracts quantities, budget, deadline, and storage. You approve the plan.</p></form></section><aside class="mission-aside"><span class="eyebrow">FROM OUTCOME TO ACTION</span><h2>One goal.<br>Many possibilities.</h2>${[
        [
            'spark',
            'Understand your goal',
            'Turn your words into clear requirements.'
        ],
        [
            'box',
            'Find what’s already here',
            'Match resources by need, distance, and availability.'
        ],
        [
            'truck',
            'Make it happen',
            'Coordinate pickups and fund only the gap.'
        ]
    ].map(([i, h, p])=>`<div>${I(i, 24)}<section><h3>${h}</h3><p>${p}</p></section></div>`).join('')}<div class="aside-quote">“Tell us the outcome.<br>MissionMesh assembles the community.”</div></aside></div>${draft ? requirementsForm(draft) : ''}`);
}
function requirementsForm(m) {
    const ctx = missionContext(m);
    const unsupported = m.requirements.find((r)=>r.category === 'unsupported');
    return `<section class="panel requirements" id="requirements"><div class="section-head"><div><span class="eyebrow">MISSION DRAFT · HUMAN APPROVAL</span><h2>Here’s what your mission needs.</h2><p>Review and edit before searching community resources.</p></div>${badge('Ready for your review', 'lavender')}</div><form id="requirements-form"><div class="field-grid"><label>Mission title<input name="title" value="${esc(m.title)}" required></label><label>People served<input name="people" type="number" min="1" max="10000" value="${m.people}" required></label><label>Budget ($)<input name="budget" type="number" min="0" value="${m.budget}" required></label><label>Deadline<input name="deadline" type="time" value="${String(Math.floor(m.deadline / 60)).padStart(2, '0')}:${String(m.deadline % 60).padStart(2, '0')}" required></label></div><label>Delivery address<input name="address" value="${esc(m.address)}" required></label><div class="location-status ${m.coordinatesResolved === false ? 'unconfirmed' : 'confirmed'}"><div class="location-status-head"><span class="location-dot"></span><strong>${m.coordinatesResolved === false ? 'Location not yet confirmed' : 'Location confirmed'}</strong></div><p>${m.coordinatesResolved === false ? 'This address is not in the local demo address list, so no coordinates were attached. Confirm a delivery pin below — no geocoding service or API key is used.' : 'Demo coordinates are attached to this address. Matching and routing can use them.'}</p>${m.coordinatesResolved === false ? `<div id="location-picker" class="location-picker" aria-label="Click the map to place the delivery location pin"></div><div class="location-actions"><button type="button" class="btn outline" data-action="locate-me">Use my current location</button><span id="location-pick-status" class="helper" aria-live="polite">Click the map to place the delivery pin, or use your current location.</span></div>` : ''}</div>${m.clarification ? `<div class="safety">${I('spark', 18)}<p>${esc(m.clarification)}</p></div>` : ''}${unsupported ? `<div class="safety">${I('heart', 18)}<p>MissionMesh has no verified ${esc(unsupported.label || unsupported.category)} inventory category. This need stays on the plan as “needs human confirmation” and is never costed or funded automatically.</p></div>` : ''}<div class="requirement-list">${m.requirements.map((r, i)=>`<div>${I(r.category === 'transportation' ? 'truck' : 'box')}<strong>${esc(r.label || r.category)}</strong>${r.category === 'transportation' ? `<input type="hidden" name="quantity-${i}" value="${r.quantity}"><span>${r.quantity} ${esc(r.unit)} · ${r.priority}</span>` : `<input aria-label="${esc(r.label || r.category)} quantity" name="quantity-${i}" type="number" min="1" value="${r.quantity}" required><span>${esc(r.unit)} · ${r.priority}</span>`}</div>`).join('')}</div>${ctx.food ? `<label class="check-confirm"><input type="checkbox" name="fridge" ${m.refrigeration ? 'checked' : ''}> Refrigeration available at the delivery location</label><fieldset><legend>Dietary requirements</legend><div class="checks">${[
        'Vegetarian',
        'Vegan',
        'Halal',
        'Gluten Free'
    ].map((t)=>`<label><input type="checkbox" name="diet" value="${t}" ${m.dietaryTags.includes(t) ? 'checked' : ''}> ${t}</label>`).join('')}</div></fieldset>` : `<p class="helper">This is a non-food mission, so dietary and refrigeration fields are hidden. Any values already stored on the mission are preserved.</p>`}<button class="btn primary">Find Community Resources ${I('arrow')}</button></form></section>`;
}
function steps(m, stage) {
    return `<div class="mission-steps">${[
        'Requirements',
        'Community cart',
        'Close the gap',
        'Delivery plan',
        'Impact'
    ].map((x, i)=>`<span class="${i === stage ? 'current' : i < stage ? 'done' : ''}"><b>${i < stage ? '✓' : i + 1}</b>${x}</span>`).join('')}</div>`;
}
function coverageSummary(m) {
    return `<div class="coverage-list">${coverage(m).map((r)=>{
        const pct = r.required ? Math.min(100, r.matched / r.required * 100) : 0;
        const label = r.status === 'covered' ? `${Math.round(r.required)} ${esc(r.unit)} covered` : r.status === 'partial' ? `${Math.round(r.matched)} of ${Math.round(r.required)} ${esc(r.unit)}` : r.status === 'missing' ? `0 of ${Math.round(r.required)} ${esc(r.unit)}` : `${Math.round(r.required)} ${esc(r.unit)} to confirm`;
        const note = r.status === 'partial' ? `Still needed: ${Math.round(r.remaining)} ${esc(r.unit)}` : r.status === 'missing' ? 'No eligible community donation matches yet.' : r.status === 'needs_confirmation' ? `MissionMesh has no verified ${esc(r.label)} inventory. Coordinate this need with a verified partner.` : 'Fully covered by eligible donations.';
        return `<div class="coverage-item"><div class="progress-label"><span>${esc(r.label)}${r.priority === 'preferred' ? ' <small>preferred</small>' : ''}</span><strong>${label}</strong></div>${r.status === 'needs_confirmation' ? '' : `<div class="progress ${r.status === 'covered' ? '' : 'purple-bar'}"><i style="width:${pct}%"></i></div>`}<span class="helper">${note}</span></div>`;
    }).join('')}</div>`;
}
function rejectionPanel(m) {
    const list = rejections(m, db.resources);
    if (!list.length) return '';
    const labels = {
        category_mismatch: 'Wrong resource category',
        reserved_elsewhere: 'Reserved by another mission',
        expired: 'Pickup availability ended',
        pickup_window_conflict: 'Pickup window conflict',
        storage_mismatch: 'Storage mismatch',
        dietary_mismatch: 'Dietary incompatibility',
        location_unverified: 'Unverified pickup location',
        unavailable_status: 'Not currently available',
        route_conflict: 'Could not fit the route',
        not_needed: 'Not needed'
    };
    const groups = {};
    for (const r of list)(groups[r.reasonCode] ??= []).push(r);
    return `<details class="rejection-panel"><summary>Why other resources were not selected (${list.length})</summary><ul>${Object.keys(groups).map((code)=>`<li><strong>${labels[code] || code}</strong> — ${groups[code].slice(0, 3).map((x)=>`${esc(x.provider)} · ${esc(x.name)}: ${esc(x.explanation)}`).join(' ')}${groups[code].length > 3 ? ` +${groups[code].length - 3} more.` : ''}</li>`).join('')}</ul></details>`;
}
function plan() {
    const m = current();
    if (!m) return createMission();
    if (!m.matches.length && m.status === 'Draft') {
        match(m, db.resources, db.volunteers[0]);
        save();
    }
    const gaps = coverage(m).filter((r)=>r.status === 'partial' || r.status === 'missing');
    return shell(`${steps(m, 1)}${title('COMMUNITY CART', 'Your mission. Assembled.', 'The right resources, connected to the right outcome.', badge('Deterministic matching', 'lavender'))}<div class="plan-layout"><section><div class="panel goal-summary"><span class="icon-tile">${I('people', 26)}</span><div><h2>${esc(m.title)}</h2><p>${esc(m.address)} · By ${time(m.deadline)} · Budget ${money(m.budget)}</p></div></div>${btn('Edit requirements', 'edit-mission', 'outline', m.contributions.length ? 'disabled' : '')}${gaps.length ? `<div class="safety" style="margin-top:14px">${I('clock', 18)}<p><strong>Still needed:</strong> ${gaps.map((r)=>`${Math.round(r.remaining)} ${esc(r.unit)} ${esc(r.label)}`).join(' · ')}. Funding covers estimated purchase cost only; matching, sourcing, and pickup still need to be arranged.</p></div>` : ''}<div class="match-list" style="margin-top:18px">${m.matches.map((x)=>{
        const r = db.resources.find((r)=>r.id === x.resourceId);
        return `<article class="match-card"><div class="match-card-top"><span class="resource-icon ${r.category}">${I(r.category === 'transportation' ? 'truck' : r.category === 'meal' ? 'leaf' : 'box', 28)}</span><div><h3>${esc(r.provider)}</h3><p>${esc(r.name)} · ${x.allocatedQuantity} ${esc(r.unit)}</p></div><strong class="free">FREE</strong></div><div class="match-meta"><span>${I('map', 14)} ${distance(r, m).toFixed(1)} mi</span><span>${I('clock', 14)} Until ${time(r.availableUntil)}</span>${badge(r.category === 'transportation' ? 'Volunteer available' : 'Matched', 'mint')}<span class="score">${x.matchScore}% fit</span></div><p class="match-reason">${I('spark', 16)} ${esc(x.reason)}</p>${x.reasons?.length ? `<ul class="match-facts">${x.reasons.map((t)=>`<li>${esc(t)}</li>`).join('')}</ul>` : ''}</article>`;
    }).join('') || '<div class="empty">We found no complete match yet. Try fewer restrictions, adjust the deadline, or invite local donors.</div>'}</div>${rejectionPanel(m)}<div class="safety">${I('heart', 18)}<p>${m.requirements[0].category === 'meal' ? 'Food matches describe fit and availability. Donors and nonprofits must verify handling, allergens, and storage before accepting food.' : 'Matches describe fit, condition, and availability. Donors and nonprofits must verify quantities and pickup details before accepting resources.'}</p></div></section><aside><div class="panel cost-panel"><span class="eyebrow">MISSION SUMMARY</span><p class="cost-mission">${esc(m.title)}</p><h2>Only the shortfall needs funding.</h2><div class="cost-line"><span>Estimated original cost</span><s>${money(m.originalCost)}</s></div><div class="cost-line green"><span>Covered by community</span><strong>−${money(m.communityValue)}</strong></div><div class="gap-total"><span>Remaining funding gap</span><strong>${money(outstanding(m))}</strong><small>${m.originalCost ? Math.round(m.communityValue / m.originalCost * 100) : 0}% covered by existing resources</small></div><div class="coverage"><h3>Resource coverage</h3>${coverageSummary(m)}</div>${outstanding(m) > 0 ? a(`/mission/${m.id}/fund`, 'Review Plan & Fund Gap ' + I('arrow', 18), 'btn primary full') : a(`/mission/${m.id}/dispatch`, 'Continue to delivery plan ' + I('arrow', 18), 'btn primary full')}<p class="helper center">${outstanding(m) > 0 ? 'You review the plan before any funding.' : 'No funding gap remains. Continue to plan delivery.'}</p></div><div class="route-note">${I('spark', 22)}<div><h3>Why these matches?</h3><p>Category and availability are required. Distance, quantity, pickup urgency, dietary needs, and storage determine fit.${m.requirements[0].category === 'meal' ? ' Bakery portions supplement meals; shelter refills complete drinks.' : ''}</p></div></div></aside></div>`);
}
function funding() {
    const m = current();
    if (!m) return createMission();
    const left = outstanding(m);
    const miss = shortages(m);
    const confirmNeeds = coverage(m).filter((r)=>r.humanConfirmation);
    return shell(`${steps(m, 2)}${title('CLOSE THE GAP', left ? 'So close. Let’s make it whole.' : 'Funding complete. Possibility unlocked.', esc(m.title))}<div class="fund-layout"><section class="panel funding-card"><div class="fund-circle">${I(left ? 'heart' : 'check', 45)}</div><span class="eyebrow">${Math.round((m.originalCost - left) / (m.originalCost || 1) * 100)}% FINANCIALLY RESOURCED</span><h2>${left ? 'A small contribution.<br>A complete mission.' : 'This mission now has<br>everything required.'}</h2>${confirmNeeds.length ? `<div class="safety">${I('heart', 18)}<p>Needs human confirmation: ${confirmNeeds.map((r)=>`${Math.round(r.required)} ${esc(r.unit)} ${esc(r.label)}`).join(' · ')}. MissionMesh has no verified inventory for this need, so it is not matched, costed, or funded automatically.</p></div>` : ''}<p>Your community contributed ${money(m.communityValue)} in resources.<br>${left ? `${miss.map((x)=>`${Math.ceil(x.missing)} additional ${x.category === 'meal' ? 'meal portions' : x.unit}`).join(', ') || 'The resource requirements are covered.'} is what’s left to fund.` : funded(m) > 0 && miss.length ? `${miss.map((x)=>`${Math.ceil(x.missing)} ${esc(x.unit)} ${esc(x.label || x.category)}`).join(', ')} funded by sponsors; purchases are simulated in this demo.` : 'The resource requirements are covered.'}</p><div class="fund-amount">${money(left)}</div><span class="helper">${left ? 'Remaining gap' : 'Fully funded · simulated contributions'}</span>${left ? `<form id="fund-form"><label>Sponsor name<input name="sponsor" placeholder="Your name or organization" value="Community sponsor" required></label><div class="fund-options">${[
        5,
        10,
        20
    ].map((v)=>btn(money(v), 'fund-' + v, 'outline', 'type="button"')).join('')}</div><label>Custom contribution ($)<input id="fund-custom" name="amount" type="number" min="0.01" max="${left}" step="0.01" value="${left}" required></label><label class="check-confirm"><input name="approve" type="checkbox" required> I have reviewed the plan and approve a simulated contribution.</label><button class="btn primary full">Fund Full Gap — ${money(left)} ${I('arrow', 18)}</button></form>` : a(`/mission/${m.id}/dispatch`, 'Generate Delivery Plan ' + I('arrow'), 'btn primary full')}<p class="helper center">A contribution covers estimated purchase cost only. Items still need to be sourced, picked up, and delivered.</p><p class="simulation-label">${I('coin', 15)} Demo payments only · no money is charged</p></section><aside><section class="panel"><h2>Every dollar has a destination.</h2><div class="fund-breakdown"><div><span>Community resource value</span><strong>${money(m.communityValue)}</strong></div><div><span>Estimated purchase cost</span><strong>${money(m.gap)}</strong></div><div><span>Contributed so far</span><strong>${money(m.gap - left)}</strong></div><div><span>Nonprofit budget available</span><strong>${money(m.budget)}</strong></div></div><p class="helper">The budget is a limit, not a payment. Donations are reserved when the funded route starts. Contributions above the gap are capped.</p></section><section class="panel contributions"><h3>A community, coming together.</h3>${m.contributions.map((x)=>`<div>${I('heart', 18)}<span>${esc(x.sponsorName)}<small>Simulated contribution</small></span><strong>${money(x.amount)}</strong></div>`).join('') || '<p>Be the first to help finish this mission.</p>'}</section></aside></div>`);
}
function mapPanel(items, cls = '') {
    const valid = items.filter(hasVerifiedCoordinates);
    return `<div class="map-panel ${cls}" id="mission-map"><div class="map-toolbar"><span class="map-area">${I('map', 14)} Demo area: Atlanta, GA</span><span class="map-legend">${path === '/explore' ? `<span><i class="pin-dot pin-nonprofit"></i>Nonprofit</span><span><i class="pin-dot pin-business"></i>Business</span><span><i class="pin-dot pin-volunteer"></i>Volunteer</span><span><i class="pin-dot pin-mission"></i>Mission</span>` : `<span><i class="pin-dot pin-pickup"></i>Pickup</span><span><i class="pin-dot pin-delivery"></i>Final delivery</span>`}</span></div><div id="map-canvas" class="map-canvas" role="region" aria-label="Map of Atlanta demo locations. Every address is also available in the resource list."><div class="map-placeholder">${valid.length ? 'Loading OpenStreetMap tiles…' : 'No verified coordinates to display.'}</div></div><div class="map-foot"><span>${I('box', 13)} Seeded demo data · not real organizations</span><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a></div></div>`;
}
function dispatch() {
    const m = current();
    if (!m) return createMission();
    return shell(`${steps(m, 3)}${title('DELIVERY PLAN', 'Good things are on the way.', 'A nearest-neighbor route connects your pickups to the final delivery.', a(`/mission/${m.id}/live`, 'Live tracking ' + I('arrow'), 'btn outline'))}<div class="dispatch-layout"><section>${mapPanel(m.route)}<div class="route-metrics">${stat('map', `${m.distance} mi`, 'Estimated road distance')}${stat('clock', `${m.duration} min`, 'Estimated duration')}${stat('box', String(m.route.length), 'Total stops')}</div><p class="helper">Travel estimates use straight-line distance × 1.35 at 20 mph, plus handling time. Google Maps may choose a different road route. Confirm traffic, pickup windows, and handling needs before departure.</p></section><aside class="panel"><span class="eyebrow">YOUR DELIVERY CREW</span><div class="volunteer-person"><div class="avatar large">AM</div><div><h2>${esc(db.volunteers[0].name)}</h2><p>${esc(db.volunteers[0].vehicleType)} · ${esc(db.volunteers[0].capacity)} capacity</p></div></div><label>Assigned volunteer<select id="assign-volunteer"><option>Alex Morgan</option><option ${m.manualPickup ? 'selected' : ''}>Manual pickup by nonprofit</option></select></label><div class="route-stop-list">${m.route.map((s, i)=>{
        const res = db.resources.find((r)=>r.id === s.resourceId);
        const window1 = res ? `${time(res.availableFrom)}–${time(res.availableUntil)}` : '';
        const maps = googleDirectionsUrl(s);
        return `<div><b>${i + 1}</b><section><strong>${esc(s.provider)}</strong><p>${esc(s.name)}</p><small>${esc(s.address)}</small><small>Arrive ${time(s.scheduledTime)}${window1 ? ` · Pickup ${window1}` : ''}</small>${maps ? `<a class="stop-link" href="${maps}" target="_blank" rel="noopener">Directions ${I('arrow', 12)}</a>` : ''}</section>${s.completedAt ? I('check', 18) : ''}</div>`;
    }).join('')}</div><div class="deadline-note">${I('clock', 18)} Mission deadline: ${time(m.deadline)}</div>${outstanding(m) > 0 ? a(`/mission/${m.id}/fund`, 'Fund remaining gap first', 'btn primary full') : btn(m.status === 'Completed' ? 'View completed mission' : 'Accept & Start Route ' + I('arrow'), 'start-route', 'primary full', m.route.at(-1)?.scheduledTime > m.deadline ? 'disabled' : '')} ${m.route.at(-1)?.scheduledTime > m.deadline ? '<p class="safety">Route cannot finish by the deadline. Edit the mission deadline before dispatch.</p>' : ''}</aside></div>`);
}
function volunteer() {
    const v = db.volunteers[0];
    const missions = db.missions.filter((m)=>m.status !== 'Draft' && m.status !== 'Completed');
    const assigned = missions.find((m)=>m.status === 'In progress' && m.route.length);
    const completedStops = assigned ? assigned.route.filter((s)=>s.completedAt).length : 0;
    const nextStop = assigned ? assigned.route.find((s)=>!s.completedAt) : null;
    return shell(`${title('VOLUNTEER WORKSPACE', 'A few miles. A big difference.', 'Your time connects good intentions to real outcomes.')}
  <div class="volunteer-layout">
    <section class="panel volunteer-availability"><h2>Your availability</h2><p class="helper">Dispatch checks this window and your carrying capacity against every route.</p><form id="volunteer-form">
      <label>Name<input name="name" value="${esc(v.name)}" required></label>
      <label>Vehicle<select name="vehicle">${[
        'SUV',
        'Car',
        'Van',
        'Bicycle'
    ].map((x)=>`<option ${v.vehicleType === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
      <label>Carrying capacity<select name="capacity">${[
        'Large',
        'Medium',
        'Small'
    ].map((x)=>`<option ${v.capacity === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
      <div class="field-grid"><label>Available from<input name="from" type="time" value="${String(Math.floor(v.availableFrom / 60)).padStart(2, '0')}:${String(v.availableFrom % 60).padStart(2, '0')}" required></label><label>Available until<input name="until" type="time" value="${String(Math.floor(v.availableUntil / 60)).padStart(2, '0')}:${String(v.availableUntil % 60).padStart(2, '0')}" required></label></div>
      <button class="btn primary full">Save availability</button>
    </form></section>
    <section>
      <div class="section-head"><div><h2>Assigned route</h2><p>${assigned ? 'Your active mission and next stop.' : 'Accept a mission below to start a route.'}</p></div>${assigned ? badge('In progress', 'mint') : badge('No active route', 'lavender')}</div>
      ${assigned ? `<article class="panel assigned-route">
        <div class="assigned-head"><div><span class="eyebrow">${esc(focusLabel(assigned).toUpperCase())} · ${assigned.people} PEOPLE</span><h2>${esc(assigned.title)}</h2><p>${completedStops} of ${assigned.route.length} stops complete · ${assigned.distance} mi estimated</p></div>${a(`/volunteer/route/${assigned.id}`, 'Continue route ' + I('arrow'), 'btn primary')}</div>
        <div class="progress"><i style="width:${completedStops / assigned.route.length * 100}%"></i></div>
        ${nextStop ? `<div class="assigned-next"><span class="icon-tile">${I(nextStop.resourceId ? 'box' : 'heart', 20)}</span><div><small>NEXT · ${nextStop.resourceId ? 'PICKUP' : 'FINAL DELIVERY'}</small><strong>${esc(nextStop.provider)}</strong><p>${esc(nextStop.address)} · arrive ${time(nextStop.scheduledTime)}</p></div><a href="${googleDirectionsUrl(nextStop)}" target="_blank" rel="noopener" class="btn outline">Directions</a></div>` : ''}
      </article>` : `<div class="empty">No route assigned yet. Review the available missions below and accept one that fits your window.</div>`}
      <div class="section-head"><div><h2>Available missions</h2><p>Mission-specific delivery details, not a generic list.</p></div>${badge(`${missions.length} ready to help`, 'mint')}</div>
      ${missions.map((m)=>`<article class="panel nearby-mission"><div class="nearby-head"><span class="eyebrow">${esc(m.status.toUpperCase())} · ${esc(focusLabel(m).toUpperCase())}</span><span>${m.people} people</span></div><h2>${esc(m.title)}</h2><p>${m.route.length} stops · ${m.distance} estimated miles · ${esc(m.address)} · by ${time(m.deadline)}</p><div class="nearby-actions">${fundable(m) ? a(`/mission/${m.id}/fund`, 'View funding gap', 'btn outline') : a(`/mission/${m.id}/dispatch`, 'Review & accept route ' + I('arrow'), 'btn primary')}</div></article>`).join('') || '<div class="empty">No routes available yet. Build a mission to connect the community.</div>'}
    </section>
  </div>`);
}
function routeView() {
    const m = current();
    if (!m) return volunteer();
    const i = m.route.findIndex((x)=>!x.completedAt), s = m.route[i];
    if (m.status === 'Completed') return impactPage();
    return shell(`${title('VOLUNTEER ROUTE', 'Your delivery route', routeSummary(m), a(`/mission/${m.id}/live`, 'Live mission', 'btn outline'))}<div class="route-layout"><section class="mobile-route panel"><div class="progress-label"><strong>${i < 0 ? 0 : i} of ${m.route.length} stops complete</strong>${badge('In progress', 'mint')}</div><div class="progress"><i style="width:${i / m.route.length * 100}%"></i></div>${s ? `<span class="eyebrow">STOP ${i + 1} OF ${m.route.length} · ${s.resourceId ? 'PICKUP' : 'FINAL DELIVERY'}</span><div class="route-main-icon">${I(s.resourceId ? 'box' : 'heart', 50)}</div><h2>${esc(s.provider)}</h2><p>${esc(s.address)}</p><div class="pickup-detail"><span>${s.resourceId ? 'PICKUP' : 'DELIVER'}</span><strong>${esc(s.name)}</strong><p>Scheduled arrival ${time(s.scheduledTime)}</p>${s.resourceId ? (()=>{
        const resource = db.resources.find((r)=>r.id === s.resourceId);
        return resource ? `<p>Pickup window ${time(resource.availableFrom)}–${time(resource.availableUntil)}</p>` : '';
    })() : ''}${!s.resourceId && fundedNote(m) ? `<p>${fundedNote(m)}</p>` : ''}</div><a href="${googleDirectionsUrl(s)}" target="_blank" rel="noopener" class="btn outline full">${I('map')} Get directions in Google Maps</a>${btn(s.resourceId ? 'Mark Pickup Complete ' + I('check') : 'Complete Delivery ' + I('check'), 'complete-stop', 'primary full', outstanding(m) > 0 || ![
        'In progress',
        'Dispatched'
    ].includes(m.status) ? 'disabled' : '')}<p class="helper center">${outstanding(m) > 0 ? 'Fund and start the route before recording pickups.' : 'Confirm quantity and handling at each pickup. Route order is estimated; Google Maps may choose a different road route.'}</p>` : '<p>No delivery route is assigned yet.</p>'}${a(`/mission/${m.id}/dispatch`, 'View full route', 'subtle-link')}</section>${mapPanel(m.route)}</div>`);
}
function live() {
    const m = current();
    if (!m) return nonprofit();
    return shell(`${title('LIVE MISSION', 'Every stop brings us closer.', esc(m.title), badge(m.status, 'mint'))}<div class="dispatch-layout"><section class="panel"><h2>Mission timeline</h2><div class="timeline">${m.route.map((s, i)=>`<div class="${s.completedAt ? 'done' : ''}"><span>${s.completedAt ? I('check', 16) : i + 1}</span><section><small>${s.completedAt ? new Date(s.completedAt).toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit'
        }) : time(s.scheduledTime)}</small><h3>${esc(s.provider)}</h3><p>${s.completedAt ? s.resourceId ? 'Resources collected' : 'Delivered to Hope Shelter' : 'Awaiting ' + (s.resourceId ? 'pickup' : 'delivery')}</p></section>${badge(s.completedAt ? 'Complete' : 'Pending', s.completedAt ? 'mint' : '')}</div>`).join('')}</div>${m.status === 'Completed' ? a(`/mission/${m.id}/impact`, 'Celebrate your impact ' + I('arrow'), 'btn primary full') : a(`/volunteer/route/${m.id}`, 'Open volunteer route ' + I('arrow'), 'btn primary full')}</section>${mapPanel(m.route)}</div>`);
}
function impactPage() {
    const m = current();
    if (!m) return nonprofit();
    if (m.status !== 'Completed') return shell(`${title('MISSION IMPACT', 'Your impact is still in motion.', 'Complete the final delivery to record the outcome.')}<section class="panel">${a(`/mission/${m.id}/live`, 'Track your mission', 'btn primary')}</section>`);
    const x = impact(m), pct = Math.round(m.communityValue / (m.originalCost || 1) * 100), ctx = missionContext(m), focusReq = m.requirements.find((r)=>![
            'transportation',
            'space'
        ].includes(r.category)), matchedUnits = Math.round(m.matches.filter((r)=>r.category === focusReq?.category).reduce((s, r)=>s + Number(r.allocatedQuantity || 0), 0) * 100) / 100;
    return shell(`<section class="impact-hero"><span class="impact-medallion">${I('check', 48)}</span><span class="eyebrow">MISSION COMPLETE 🎉</span><h1>A mission accomplished.<br>A community connected.</h1><p>${esc(m.title)} · Delivered to Hope Community Shelter</p><blockquote>Your community already had ${pct}%<br>of what this mission needed.</blockquote><div class="actions">${btn('Share Impact ' + I('arrow'), 'share-impact', 'primary')}${a('/nonprofit/create', 'Create Another Mission', 'btn outline')}</div></section><div class="stats-grid">${stat('people', String(x.peopleServed), 'People supported')}${stat('box', `${matchedUnits} ${ctx.unit}`, 'Resources matched')}${stat('coin', money(x.estimatedValueSaved), 'Community resources reused')}${stat('heart', money(x.cashSpent), 'Simulated cash contributed')}</div><div class="stats-grid">${stat('mesh', String(x.partners), 'Community partners')}${stat('truck', '1', 'Volunteer')}${stat('map', `${x.miles} mi`, 'Estimated route distance')}${ctx.food ? stat('leaf', `${x.estimatedCO2} lbs`, 'Estimated CO₂ avoided') : stat('clock', `${x.volunteerHours} hrs`, 'Volunteer time')}</div><section class="panel impact-explanation"><h2>Small contributions. A shared outcome.</h2><p>${pct}% of the estimated original mission cost was covered by community resources. Volunteer time: ${x.volunteerHours} hours. ${ctx.food ? 'Food rescue and CO₂ figures are demo estimates (2.25 lb per rescued meal equivalent, 0.9 lb CO₂ per pound), not audited environmental results.' : `This non-food mission reports ${matchedUnits} ${ctx.unit} matched, with route distance kept as an estimate.`} ${money(x.cashSpent)} represents simulated funding, not real purchases.</p></section>`);
}
function sponsor() {
    const missions = db.missions.filter(fundable);
    const contributions = db.missions.flatMap((m)=>m.contributions.map((c)=>({
                ...c,
                missionTitle: m.title
            }))).sort((a, b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
    const contributed = contributions.reduce((s, c)=>s + Number(c.amount), 0);
    const partners = new Set(db.resources.map((r)=>r.organizationId)).size;
    return shell(`${title('COMMUNITY SPONSOR', 'Help a good mission cross the finish line.', 'See exactly what your contribution makes possible.')}
  <div class="stats-grid">
    ${stat('heart', money(contributed), 'Simulated contributions', 'Simulated total only')}
    ${stat('people', String(total('peopleServed')), 'People reached', 'Completed missions only')}
    ${stat('check', String(db.impactRecords.length), 'Missions completed', 'Recorded in this demo')}
    ${stat('mesh', String(partners), 'Demo partners', 'Organizations with listings')}
  </div>
  <div class="section-head"><div><h2>Missions with remaining gaps</h2><p>Only missions with a verified positive gap appear here.</p></div>${badge('Simulated payments', 'lavender')}</div>
  <div class="sponsor-list">${missions.map((m)=>`<section class="panel sponsor-card">
    <span class="eyebrow">${Math.round(m.communityValue / (m.originalCost || 1) * 100)}% COMMUNITY COVERED</span>
    <h2>${esc(m.title)}</h2>
    <p>Community resources already contributed ${money(m.communityValue)}.</p>
    <div class="gap-total"><span>Just the remaining gap</span><strong>${money(outstanding(m))}</strong></div>
    <p>${shortages(m).length ? `Still needed: ${shortages(m).map((x)=>`${Math.ceil(x.missing)} ${esc(x.unit)} ${esc(x.label || x.category)}`).join(' · ')}` : 'All resource requirements are covered — funding only.'}</p>
    ${a(`/mission/${m.id}/fund`, 'Review the funding gap ' + I('arrow'), 'btn primary full')}
  </section>`).join('') || '<div class="empty">No positive funding gaps right now. Build a mission or check back after resources are matched.</div>'}</div>
  <section class="section panel contribution-history">
    <div class="section-head"><div><h2>Contribution history</h2><p>Every entry is stored locally and marked as simulated.</p></div>${badge('Demo ledger', 'lavender')}</div>
    ${contributions.length ? `<div class="history-list">${contributions.map((c)=>`<div class="history-row"><span class="history-icon">${I('heart', 17)}</span><div><strong>${esc(c.sponsorName || 'Community sponsor')}</strong><small>${esc(c.missionTitle)} · ${new Date(c.createdAt).toLocaleDateString()}</small></div><strong>${money(c.amount)}</strong>${badge('Simulated', 'mint')}</div>`).join('')}</div>` : '<div class="empty">No contributions yet. A simulated contribution will appear here after a mission is supported.</div>'}
  </section>`);
}
function explore() {
    const categories = [
        'All resources',
        'Food',
        'Supplies',
        'Volunteers',
        'Transportation',
        'Space',
        'Funding Needed'
    ];
    const cat = {
        Food: [
            'meal',
            'drink'
        ],
        Supplies: [
            'supplies'
        ],
        Volunteers: [
            'transportation'
        ],
        Transportation: [
            'transportation'
        ],
        Space: [
            'space'
        ]
    };
    let items = filter === 'Funding Needed' ? db.missions.filter(fundable).map((m)=>({
            id: m.id,
            provider: m.title,
            name: money(outstanding(m)) + ' funding needed',
            category: 'funding',
            quantity: 1,
            unit: 'mission',
            lat: m.lat,
            lng: m.lng,
            address: m.address,
            availableUntil: m.deadline,
            status: 'Available',
            coordinatesResolved: hasVerifiedCoordinates(m),
            locationSource: m.locationSource
        })) : db.resources.filter((r)=>(!cat[filter] || cat[filter].includes(r.category)) && r.status !== 'Delivered');
    if (availabilityFilter === 'Available') items = items.filter((r)=>r.status === 'Available');
    if (availabilityFilter === 'Reserved') items = items.filter((r)=>[
            'Matched',
            'Pickup Assigned'
        ].includes(r.status));
    if (availabilityFilter === 'Unverified') items = items.filter((r)=>!hasVerifiedCoordinates(r));
    return shell(`${title('COMMUNITY RESOURCE MAP', 'Community map', 'Verified demo locations, pickup windows, and funding gaps around Atlanta. Demo organizations are labeled.')}
  <div class="map-filters">
    <div class="filter-row" role="group" aria-label="Filter resources by type">${categories.map((c)=>btn(c, 'filter-' + c, `chip ${filter === c ? 'selected' : ''}`)).join('')}</div>
    <label class="filter-select">Availability<select id="availability-filter">${[
        'All',
        'Available',
        'Reserved',
        'Unverified'
    ].map((x)=>`<option ${availabilityFilter === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
  </div>
  <div class="explore-layout"><section>${mapPanel(items)}<p class="helper">Pan and zoom the OpenStreetMap view. Every demo location also appears in the list with its type, address, pickup window, and a Google Maps link; the list stays usable if tiles cannot load.</p></section>
  <section class="explore-list"><div class="section-head"><div><h3>Nearby resources</h3><p>Demo organizations are labeled.</p></div><span id="resource-count">${items.length} available</span></div><div id="explore-cards">${items.map((r)=>resourceCard(r, true)).join('') || '<div class="empty">No resources match these filters. Try another type or availability state.</div>'}</div></section></div>`, false);
}
function globalImpact() {
    const completed = db.missions.filter((m)=>m.status === 'Completed');
    const records = db.impactRecords;
    const matched = completed.reduce((s, m)=>s + m.matches.length, 0);
    const fundedTotal = db.missions.reduce((s, m)=>s + m.contributions.reduce((a, c)=>a + Number(c.amount), 0), 0);
    if (!records.length) return shell(`${title('COMMUNITY IMPACT', 'Impact starts with a finished mission.', 'Nothing is estimated here until a demo delivery is completed and recorded.')}<section class="panel impact-empty"><span class="impact-empty-icon">${I('heart', 26)}</span><div><h2>No outcomes recorded yet.</h2><p>Complete a mission — fund the gap, accept the route, and confirm every stop — to record its impact. No numbers are pre-filled in this browser demo.</p></div><div class="actions">${a('/nonprofit', 'View missions', 'btn outline')}${a('/how-it-works', 'How it works', 'btn primary')}</div></section>`);
    return shell(`${title('COMMUNITY IMPACT', 'This is what together looks like.', 'Only outcomes completed and recorded in this browser demo appear here.')}
  <div class="stats-grid">
    ${stat('people', String(total('peopleServed')), 'People supported', 'Estimated from completed missions')}
    ${stat('box', String(matched), 'Resources matched', 'Across completed missions')}
    ${stat('truck', String(records.length), 'Volunteer routes completed', 'Recorded deliveries only')}
    ${stat('coin', money(fundedTotal), 'Simulated funding', 'No real money charged')}
  </div>
  <section class="panel impact-environment">
    <div class="section-head"><div><h2>Estimated environmental impact</h2><p>These are app-calculated demo estimates, not audited results.</p></div>${badge('Estimates only', 'lavender')}</div>
    <div class="environment-grid"><div><span>Food rescued</span><strong>${total('foodWeight')} lbs</strong></div><div><span>Waste prevented</span><strong>${total('wastePrevented')} lbs</strong></div><div><span>CO₂ avoided</span><strong>${total('estimatedCO2')} lbs</strong></div><div><span>Route distance</span><strong>${total('miles')} mi</strong></div></div>
  </section>
  <div class="section-head"><div><h2>Your completed missions <span class="count">${completed.length}</span></h2><p>Each card opens the recorded outcome for that mission.</p></div></div>
  <div class="missions-grid">${completed.map(missionCard).join('') || '<div class="empty">No completed missions yet. Finish a delivery to record the first outcome.</div>'}</div>`);
}
function how() {
    return shell(`${title('HOW MISSIONMESH WORKS', 'Tell us the outcome.<br>MissionMesh assembles the community.', 'A mission compiler for the resources your community already has.')}<div class="how-list">${[
        [
            '01',
            'Contribute what you have',
            'Businesses list surplus manually — food, goods, space, or transport — and confirm every quantity and pickup window before it is available.',
            '/business/quick-give',
            'Donate surplus'
        ],
        [
            '02',
            'Describe the outcome',
            'A nonprofit names a goal, deadline, budget, and infrastructure. The demo compiler creates editable requirements.',
            '/nonprofit/create',
            'Create a mission'
        ],
        [
            '03',
            'Review the community cart',
            'Deterministic matching evaluates categories, distance, quantity, timing, storage, and dietary fit. People approve the final plan.',
            '/nonprofit',
            'View missions'
        ],
        [
            '04',
            'Fund only what’s missing',
            'Sponsors see the gap and its purpose. Simulated contributions cover what free resources cannot.',
            '/sponsor',
            'See funding gaps'
        ],
        [
            '05',
            'Deliver and measure',
            'A volunteer follows ordered pickups, confirms each stop, and completes delivery. Everyone sees the outcome.',
            '/volunteer',
            'Volunteer'
        ]
    ].map(([n, h, p, url, cta])=>`<section class="panel"><span>${n}</span><div><h2>${h}</h2><p>${p}</p></div>${a(url, cta + ' ' + I('arrow'), 'btn outline')}</section>`).join('')}</div>`);
}
function render() {
    if ((path.startsWith('/mission/') || path.startsWith('/volunteer/route/')) && !current()) {
        path = '/not-found';
    }
    if (map) {
        map.remove();
        map = null;
    }
    if (pickerMap) {
        pickerMap.remove();
        pickerMap = null;
    }
    mapMarkers = {};
    let html = '';
    if (current()?.status === 'Draft' && path.startsWith('/mission/')) {
        match(current(), db.resources, db.volunteers[0]);
        save();
    }
    if (path === '/') html = landing();
    else if (path === '/business') html = business();
    else if (path === '/business/quick-give') html = quickGive();
    else if (path === '/nonprofit') html = nonprofit();
    else if (path === '/nonprofit/create') html = createMission();
    else if (path === '/volunteer') html = volunteer();
    else if (path.startsWith('/volunteer/route/')) html = routeView();
    else if (path === '/sponsor') html = sponsor();
    else if (path === '/explore') html = explore();
    else if (path === '/impact') html = globalImpact();
    else if (path === '/how-it-works') html = how();
    else if (/^\/mission\/[^/]+\/plan$/.test(path)) html = plan();
    else if (path.endsWith('/fund')) html = funding();
    else if (path.endsWith('/dispatch')) html = dispatch();
    else if (path.endsWith('/live')) html = live();
    else if (path.endsWith('/impact')) html = impactPage();
    else html = shell(`${title('PAGE NOT FOUND', 'Let’s get you back to the community.', 'This page does not exist.', a('/', 'Return home', 'btn primary'))}`);
    $('#app').innerHTML = html;
    bind();
    initMap();
    initLocationPicker();
}
function initLocationPicker() {
    const el = document.getElementById('location-picker');
    if (!el) return;
    const L = window.L;
    if (!L) {
        el.innerHTML = '<div class="map-placeholder">The map library could not load. Use your current location or a demo address.</div>';
        return;
    }
    try {
        pickerMap = L.map(el, {
            scrollWheelZoom: false
        }).setView([
            33.773,
            -84.39
        ], 12);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19
        }).addTo(pickerMap);
        let marker = null;
        const place = (lat, lng)=>{
            if (!draft) return;
            draft.lat = lat;
            draft.lng = lng;
            draft.coordinatesResolved = true;
            draft.locationSource = 'map-pin';
            const pos = [
                lat,
                lng
            ];
            if (marker) marker.setLatLng(pos);
            else marker = L.marker(pos, {
                draggable: true,
                keyboard: true,
                title: 'Delivery location pin',
                alt: 'Delivery location pin',
                icon: L.divIcon({
                    className: 'mm-pin pin-delivery',
                    html: '<span>+</span>',
                    iconSize: [
                        30,
                        30
                    ],
                    iconAnchor: [
                        15,
                        15
                    ]
                })
            }).addTo(pickerMap);
            const status = document.getElementById('location-pick-status');
            if (status) status.textContent = `Pin placed at ${lat.toFixed(5)}, ${lng.toFixed(5)}. Submit to search resources.`;
        };
        pickerMap.on('click', (e)=>place(e.latlng.lat, e.latlng.lng));
        if (hasVerifiedCoordinates(draft)) {
            marker = L.marker([
                draft.lat,
                draft.lng
            ], {
                draggable: true,
                keyboard: true,
                title: 'Delivery location pin',
                alt: 'Delivery location pin',
                icon: L.divIcon({
                    className: 'mm-pin pin-delivery',
                    html: '<span>+</span>',
                    iconSize: [
                        30,
                        30
                    ],
                    iconAnchor: [
                        15,
                        15
                    ]
                })
            }).addTo(pickerMap);
        }
    } catch  {
        el.innerHTML = '<div class="map-placeholder">The map could not initialize. Use your current location instead.</div>';
    }
}
function initMap() {
    const el = document.getElementById('map-canvas');
    if (!el) return;
    const L = window.L;
    if (!L) {
        el.innerHTML = '<div class="map-placeholder">The map library is unavailable. Use the verified resource list and Google Maps links.</div>';
        return;
    }
    let items = [];
    if (path === '/explore') {
        items = filter === 'Funding Needed' ? db.missions.filter(fundable).map((m)=>({
                ...m,
                provider: m.title,
                name: money(outstanding(m)) + ' funding gap',
                category: 'funding'
            })) : db.resources.filter((r)=>(filter === 'All resources' || (filter === 'Food' ? [
                'meal',
                'drink'
            ].includes(r.category) : filter === 'Volunteers' || filter === 'Transportation' ? r.category === 'transportation' : r.category === filter.toLowerCase())) && r.status !== 'Delivered');
    } else items = (current()?.route || []).map((s)=>({
            ...s,
            coordinatesResolved: true
        }));
    if (path === '/explore') {
        items = items.filter((r)=>availabilityFilter === 'All' || availabilityFilter === 'Available' && r.status === 'Available' || availabilityFilter === 'Reserved' && [
                'Matched',
                'Pickup Assigned'
            ].includes(r.status) || availabilityFilter === 'Unverified' && !hasVerifiedCoordinates(r));
    }
    items = items.filter(hasVerifiedCoordinates);
    if (!items.length) return;
    try {
        el.innerHTML = '';
        map = L.map(el, {
            scrollWheelZoom: false
        }).setView([
            33.773,
            -84.39
        ], 13);
        const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19
        });
        tiles.addTo(map);
        let loaded = false;
        tiles.on('tileload', ()=>loaded = true);
        setTimeout(()=>{
            if (!loaded && map && document.contains(el)) {
                map.remove();
                map = null;
                el.innerHTML = '<div class="map-placeholder">Map tiles could not load. The resource list and Google Maps links remain available.</div>';
            }
        }, 8000);
        mapMarkers = {};
        items.forEach((r, i)=>{
            const markerType = path === '/explore' ? r.category === 'transportation' ? 'pin-volunteer' : r.category === 'funding' ? 'pin-mission' : r.organizationId === 'org-hope' ? 'pin-nonprofit' : 'pin-business' : r.resourceId ? 'pin-pickup' : 'pin-delivery';
            const markerId = String(r.id || r.resourceId || i);
            const icon = L.divIcon({
                className: 'mm-pin ' + markerType,
                html: `<span data-marker-id="${esc(markerId)}" data-lat="${r.lat}" data-lng="${r.lng}">${path === '/explore' ? I(r.category === 'transportation' ? 'truck' : r.category === 'funding' ? 'coin' : 'box', 16) : i + 1}</span>`,
                iconSize: [
                    30,
                    30
                ],
                iconAnchor: [
                    15,
                    15
                ],
                popupAnchor: [
                    0,
                    -16
                ]
            });
            const maps = hasVerifiedCoordinates(r) ? googleMapsUrl(r) : '';
            const marker = L.marker([
                r.lat,
                r.lng
            ], {
                icon,
                title: `${r.provider || 'Demo location'} — ${r.name || 'location'}`,
                alt: `${r.provider || 'Demo location'} map marker`,
                keyboard: true
            }).addTo(map).bindPopup(`<strong>${esc(r.provider || 'Demo location')}</strong><br>${esc(r.name || '')}${r.address ? `<br><span>${esc(r.address)}</span>` : ''}${maps ? `<br><a href="${maps}" target="_blank" rel="noopener">Open in Google Maps</a>` : ''}`);
            mapMarkers[markerId] = marker;
        });
        if (path !== '/explore' && items.length > 1) L.polyline(items.map((r)=>[
                r.lat,
                r.lng
            ]), {
            color: '#198567',
            weight: 4,
            dashArray: '6 8',
            opacity: .85
        }).addTo(map);
        map.fitBounds(L.latLngBounds(items.map((r)=>[
                r.lat,
                r.lng
            ])).pad(.25));
    } catch  {
        map = null;
        el.innerHTML = '<div class="map-placeholder">The map could not initialize. Use the verified resource list for addresses.</div>';
    }
}
function focusMapItem(id) {
    if (!map || !mapMarkers[id]) return;
    const marker = mapMarkers[id];
    map.setView(marker.getLatLng(), Math.max(14, map.getZoom()), {
        animate: true
    });
    marker.openPopup();
    const card = Array.from(document.querySelectorAll('[data-map-item]')).find((el)=>el.dataset.mapItem === id);
    if (card) {
        card.classList.add('selected');
        setTimeout(()=>card.classList.remove('selected'), 1400);
        card.scrollIntoView({
            block: 'nearest',
            behavior: 'smooth'
        });
    }
}
async function processing(messages, done) {
    if (busy) return;
    busy = true;
    const modal = document.createElement('div');
    modal.className = 'processing-overlay';
    modal.innerHTML = `<div class="processing-card"><div class="spinner">${I('spark', 36)}</div><h2 aria-live="polite">${messages[0]}</h2><p>Connecting the possibilities.</p><div class="processing-dots">● ● ●</div></div>`;
    document.body.append(modal);
    for (const msg of messages){
        modal.querySelector('h2').textContent = msg;
        await new Promise((r)=>setTimeout(r, 550));
    }
    modal.remove();
    busy = false;
    done();
}
function bind() {
    document.querySelectorAll('[data-nav]').forEach((el)=>el.addEventListener('click', (e)=>{
            e.preventDefault();
            go(el.dataset.nav);
        }));
    document.querySelectorAll('[data-role]').forEach((el)=>el.addEventListener('click', ()=>{
            role = el.dataset.role;
            save();
            go('/' + role.toLowerCase());
        }));
    document.querySelectorAll('[data-action]').forEach((el)=>el.addEventListener('click', ()=>action(el.dataset.action)));
    document.querySelector('#availability-filter')?.addEventListener('change', (e)=>{
        availabilityFilter = e.target.value;
        render();
    });
    document.querySelectorAll('[data-map-focus]').forEach((el)=>el.addEventListener('click', (e)=>{
            e.stopPropagation();
            focusMapItem(el.dataset.mapFocus);
        }));
    document.querySelectorAll('[data-map-item]').forEach((el)=>el.addEventListener('click', (e)=>{
            if (e.target.closest('a,button')) return;
            focusMapItem(el.dataset.mapItem);
        }));
    document.querySelectorAll('[data-item]').forEach((el)=>el.addEventListener('change', ()=>{
            const input = el;
            scan[Number(input.dataset.item)][input.dataset.key] = input.dataset.key === 'quantity' ? Number(input.value) : input.value;
        }));
    document.querySelectorAll('[data-remove]').forEach((el)=>el.addEventListener('click', ()=>{
            scan.splice(Number(el.dataset.remove), 1);
            render();
        }));
    const file = document.querySelector('#photo');
    if (file) {
        file.onchange = ()=>readPhoto(file.files?.[0]);
        const upload = $('.upload');
        upload.ondragover = (e)=>{
            e.preventDefault();
            upload.classList.add('dragging');
        };
        upload.ondrop = (e)=>{
            e.preventDefault();
            readPhoto(e.dataTransfer?.files[0]);
        };
    }
    document.querySelector('#donation-form')?.addEventListener('submit', (e)=>{
        e.preventDefault();
        const f = new FormData(e.target);
        if (!scan.length || scan.some((x)=>!x.name.trim() || !Number.isFinite(x.quantity) || x.quantity < 1 || !x.unit.trim())) return toast('Confirm a valid name, quantity, and unit for every item.');
        const until = String(f.get('until')).split(':').map(Number);
        if (until[0] * 60 + until[1] <= 960) return toast('For this afternoon demo, choose a pickup deadline after 4 PM.');
        const ids = [];
        scan.forEach((x)=>{
            const id = uid();
            ids.push(id);
            const r = {
                id,
                organizationId: 'org-sunrise',
                provider: 'Sunrise Restaurant',
                name: x.name,
                category: x.category,
                quantity: x.quantity,
                unit: x.unit,
                estimatedValue: x.quantity * (x.category === 'meal' ? 8 : x.category === 'drink' ? 1.5 : 2),
                ...resolveKnownCoordinates(String(f.get('address') || '')),
                address: String(f.get('address') || ''),
                availableFrom: 960,
                availableUntil: until[0] * 60 + until[1],
                storageType: f.get('storage'),
                dietaryTags: f.getAll('diet'),
                handlingNotes: f.get('notes'),
                status: 'Available',
                imageUrl: photo.startsWith('data:') ? photo : undefined
            };
            if (x.category === 'meal' && /banana/i.test(x.name)) {
                r.category = 'side';
                r.estimatedValue = x.quantity * .5;
            }
            db.resources.push(r);
        });
        if (db.demoFlow) {
            db.resources = db.resources.filter((r)=>r.id !== 'sunrise');
            db.demoFlow = false;
        }
        save();
        photo = '';
        scan = [];
        scanned = false;
        go('/business');
        toast('Your surplus is now available to nearby community missions. Switch to Nonprofit to build your mission.');
    });
    document.querySelector('#mission-form')?.addEventListener('submit', (e)=>{
        e.preventDefault();
        const f = new FormData(e.target);
        const text = String(f.get('goal')).trim();
        if (text.length < 10) return toast('Describe your outcome with a little more detail.');
        processing([
            'Understanding your goal…',
            'Calculating requirements…',
            'Preparing your editable mission…'
        ], ()=>{
            draft = compile(text, {
                address: f.get('address'),
                budget: f.get('budget'),
                deadline: f.get('deadline')
            });
            render();
            $('#requirements')?.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        });
    });
    document.querySelector('#requirements-form')?.addEventListener('submit', (e)=>{
        e.preventDefault();
        if (!draft) return;
        const f = new FormData(e.target);
        draft.title = String(f.get('title'));
        draft.people = Number(f.get('people'));
        draft.budget = Number(f.get('budget'));
        const t = String(f.get('deadline')).split(':').map(Number);
        draft.deadline = t[0] * 60 + t[1];
        const submittedAddress = String(f.get('address')).trim();
        if (submittedAddress !== draft.address) {
            const point = resolveKnownCoordinates(submittedAddress);
            draft.address = submittedAddress;
            draft.lat = point.lat;
            draft.lng = point.lng;
            draft.coordinatesResolved = point.coordinatesResolved;
            draft.locationSource = point.locationSource;
        }
        const fridgeField = document.querySelector('#requirements-form [name=fridge]');
        if (fridgeField) draft.refrigeration = fridgeField.checked;
        const dietFields = document.querySelectorAll('#requirements-form [name=diet]');
        if (dietFields.length) draft.dietaryTags = f.getAll('diet').map(String);
        draft.requirements.forEach((r, i)=>{
            const q = f.get('quantity-' + i);
            if (q !== null) r.quantity = Number(q);
        });
        const m = draft;
        if (!m.coordinatesResolved) {
            render();
            toast('Confirm the delivery location on the map before we search resources.');
            document.querySelector('#requirements')?.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
            return;
        }
        processing([
            'Searching community resources…',
            'Checking availability, storage, and dietary fit…',
            'Assembling your community cart…'
        ], ()=>{
            match(m, db.resources, db.volunteers[0]);
            const existing = db.missions.findIndex((x)=>x.id === m.id);
            if (existing >= 0) db.missions[existing] = m;
            else db.missions.push(m);
            draft = null;
            save();
            go(`/mission/${m.id}/plan`);
        });
    });
    document.querySelector('#fund-custom')?.addEventListener('input', (e)=>{
        const n = Number(e.target.value);
        const b = document.querySelector('#fund-form > button');
        if (b) b.textContent = (n === outstanding(current()) ? 'Fund Full Gap — ' : 'Contribute ') + money(n) + ' (simulated)';
    });
    document.querySelector('#fund-form')?.addEventListener('submit', (e)=>{
        e.preventDefault();
        const f = new FormData(e.target), m = current();
        const amount = Number(f.get('amount'));
        if (!Number.isFinite(amount) || amount <= 0) return;
        fund(m, amount, String(f.get('sponsor')));
        save();
        render();
        toast('Simulated funding received. No money was charged.');
    });
    document.querySelector('#volunteer-form')?.addEventListener('submit', (e)=>{
        e.preventDefault();
        const f = new FormData(e.target), v = db.volunteers[0];
        const min = (s)=>Number(s.split(':')[0]) * 60 + Number(s.split(':')[1]);
        if (min(f.get('until')) <= min(f.get('from'))) return toast('Availability end must be after the start.');
        Object.assign(v, {
            name: f.get('name'),
            vehicleType: f.get('vehicle'),
            capacity: f.get('capacity'),
            availableFrom: min(f.get('from')),
            availableUntil: min(f.get('until'))
        });
        const r = db.resources.find((r)=>r.id === 'transport');
        Object.assign(r, {
            provider: v.name,
            name: v.vehicleType + ' • ' + v.capacity + ' capacity',
            availableFrom: v.availableFrom,
            availableUntil: v.availableUntil
        });
        save();
        toast('Availability saved. Dispatch will verify your time and capacity.');
    });
    document.querySelector('#assign-volunteer')?.addEventListener('change', (e)=>{
        current().manualPickup = e.target.value.startsWith('Manual');
        save();
    });
}
function readPhoto(file) {
    if (!file) return;
    const imageError = validateDonationImage(file.type, file.size);
    if (imageError) return toast(imageError);
    const reader = new FileReader();
    reader.onload = ()=>{
        photo = String(reader.result);
        render();
    };
    reader.onerror = ()=>toast('The image could not be previewed. Please try another file.');
    reader.readAsDataURL(file);
}
function installDonationHandler() {
    if (document.body.dataset.donationHandler) return;
    document.body.dataset.donationHandler = 'true';
    document.addEventListener('submit', (event)=>{
        const form = event.target.closest('#donation-form');
        if (!form) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        const f = new FormData(form), items = scan.map((x)=>({
                ...x,
                category: normalizeDonationCategory(x.category)
            }));
        const from = String(f.get('from')), until = String(f.get('until'));
        const fromParts = from.split(':').map(Number), untilParts = until.split(':').map(Number);
        const data = {
            businessName: String(f.get('business')).trim(),
            donationTitle: String(f.get('title')).trim(),
            address: String(f.get('address')).trim(),
            from,
            until,
            fromMinutes: fromParts[0] * 60 + fromParts[1],
            untilMinutes: untilParts[0] * 60 + untilParts[1],
            storage: String(f.get('storage')),
            dietaryTags: f.getAll('diet').map(String),
            allergens: String(f.get('allergens')).trim(),
            instructions: String(f.get('instructions')).trim(),
            useBy: String(f.get('useBy') || ''),
            items,
            imageUrl: photo || undefined,
            organizationId: String(f.get('business')).trim().toLowerCase() === 'sunrise restaurant' ? 'org-sunrise' : `org-${String(f.get('business')).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`
        };
        const errors = validateDonation(data);
        if (errors.length) {
            const box = document.querySelector('#donation-error');
            if (box) {
                box.textContent = errors[0];
                box.hidden = false;
                box.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });
            } else toast(errors[0]);
            return;
        }
        const resources = items.map((item)=>donationResource(data, item));
        db.resources.push(...resources);
        if (!db.organizations.some((o)=>o.id === data.organizationId)) db.organizations.push({
            id: data.organizationId,
            name: data.businessName
        });
        save();
        photo = '';
        scan = [];
        scanned = false;
        go('/business');
        toast(`${resources.length} donation item${resources.length === 1 ? '' : 's'} posted and available for matching.`);
    }, true);
}
function action(x) {
    if (x === 'run-demo' || x === 'reset') {
        if (x === 'reset' && !confirm('Reset this browser’s demo missions, donations, and contributions?')) return;
        db = seed();
        db.demoFlow = true;
        role = 'Business';
        draft = null;
        photo = '';
        scanned = false;
        scan = [];
        save();
        go(x === 'run-demo' ? '/business' : '/');
        toast('Demo reset. Start with Quick Give, then switch to Nonprofit.');
    } else if (x === 'sample') {
        photo = '/sample.svg';
        render();
    } else if (x === 'example-items') {
        scan = [
            {
                name: 'Boxed meals',
                description: 'Prepared meal portions',
                quantity: 40,
                unit: 'meals',
                category: 'meal'
            },
            {
                name: 'Bananas',
                description: 'Fresh bananas',
                quantity: 30,
                unit: 'pieces',
                category: 'meal'
            },
            {
                name: 'Bottled drinks',
                description: 'Sealed bottled drinks',
                quantity: 24,
                unit: 'bottles',
                category: 'drink'
            }
        ];
        scanned = true;
        render();
    } else if (x === 'scan') {
        toast('Image recognition is not enabled. Add or review donation items manually.');
    } else if (x === 'remove-photo') {
        photo = '';
        render();
    } else if (x === 'locate-me') {
        if (!draft) return;
        if (!navigator.geolocation) return toast('This browser cannot share a location. Click the map to place the pin instead.');
        toast('Requesting your current location…');
        navigator.geolocation.getCurrentPosition((p)=>{
            if (!draft) return;
            draft.lat = p.coords.latitude;
            draft.lng = p.coords.longitude;
            draft.coordinatesResolved = true;
            draft.locationSource = 'browser-location';
            const status = document.getElementById('location-pick-status');
            if (status) status.textContent = `Location confirmed at ${p.coords.latitude.toFixed(5)}, ${p.coords.longitude.toFixed(5)}. Submit to search resources.`;
            if (pickerMap) pickerMap.setView([
                p.coords.latitude,
                p.coords.longitude
            ], 14);
            toast('Location confirmed. Submit to search the community.');
        }, ()=>toast('Location permission was not granted. Click the map to place the pin instead.'), {
            enableHighAccuracy: false,
            timeout: 8000
        });
    } else if (x === 'edit-mission') {
        if (current().contributions.length) return;
        draft = JSON.parse(JSON.stringify(current()));
        go('/nonprofit/create');
        $('#requirements')?.scrollIntoView({
            behavior: 'smooth'
        });
    } else if (x === 'add-item') {
        scan.push({
            name: '',
            quantity: 1,
            unit: 'items',
            category: 'meal'
        });
        render();
    } else if (x.startsWith('example-')) {
        document.querySelector('#goal').value = x === 'example-food' ? example : 'Provide school supplies for 40 students by 7 PM. We have $50.';
    } else if (x.startsWith('fund-')) {
        const input = document.querySelector('#fund-custom');
        input.value = String(Math.min(Number(x.slice(5)), outstanding(current())));
        (document.querySelector('#fund-form button[type="submit"]') || document.querySelector('#fund-form > button')).textContent = 'Contribute ' + money(Number(input.value)) + ' (simulated)';
        input.focus();
    } else if (x === 'start-route') {
        const m = current();
        if (m.status === 'Completed') return go(`/mission/${m.id}/impact`);
        if (outstanding(m) > 0) return toast('Close the funding gap before starting the route.');
        const v = db.volunteers[0];
        if (!m.manualPickup && (v.availableFrom > 975 || v.availableUntil < m.route.at(-1).scheduledTime || v.capacity === 'Small')) return toast('Alex’s availability or capacity does not fit this route. Choose manual pickup or update availability.');
        const blocked = m.matches.some((x)=>{
            const r = db.resources.find((r)=>r.id === x.resourceId);
            return !r || [
                'Collected',
                'Delivered',
                'Pickup Assigned'
            ].includes(r.status) && r.missionId !== m.id;
        });
        if (blocked) return toast('A resource is already reserved by another mission. Rebuild the mission to find current resources.');
        if (!m.manualPickup && !m.matches.some((x)=>x.category === 'transportation')) return toast('No volunteer match is available. Choose manual pickup to dispatch.');
        m.matches.forEach((x)=>{
            const r = db.resources.find((r)=>r.id === x.resourceId);
            r.status = 'Pickup Assigned';
            r.missionId = m.id;
        });
        m.status = 'In progress';
        save();
        go(`/volunteer/route/${m.id}`);
    } else if (x === 'complete-stop') {
        const m = current();
        if (outstanding(m) > 0 || m.status !== 'In progress') return;
        const s = m.route.find((x)=>!x.completedAt);
        completeStop(m);
        if (s?.resourceId) {
            const r = db.resources.find((r)=>r.id === s.resourceId);
            if (r) r.status = 'Collected';
        }
        if (m.status === 'Completed') {
            m.matches.forEach((x)=>{
                const r = db.resources.find((r)=>r.id === x.resourceId);
                r.status = 'Delivered';
            });
            if (!db.impactRecords.some((x)=>x.missionId === m.id)) db.impactRecords.push(impact(m));
            save();
            go(`/mission/${m.id}/impact`);
            toast('Mission complete. Your community made it happen!');
        } else {
            save();
            render();
            toast('Pickup confirmed. On to the next stop.');
        }
    } else if (x === 'share-impact') {
        const m = current(), p = impact(m);
        const text = `MISSIONMESH: ${p.peopleServed} people served, ${p.foodWeight} lbs of food rescued, ${money(p.estimatedValueSaved)} in community resources reused. ${Math.round(m.communityValue / m.originalCost * 100)}% community covered.`;
        if (navigator.share) navigator.share({
            title: 'Our MissionMesh impact',
            text
        }).catch(()=>{});
        else if (navigator.clipboard) navigator.clipboard.writeText(text).then(()=>toast('Impact copied to clipboard.')).catch(()=>downloadImpact(text));
        else downloadImpact(text);
    } else if (x.startsWith('filter-')) {
        filter = x.slice(7);
        render();
    } else if (x === 'tab-active' || x === 'tab-completed') {
        const done = x === 'tab-completed';
        $('#mission-list').innerHTML = db.missions.filter((m)=>m.status === 'Completed' === done).map(missionCard).join('') || `<div class="empty">${done ? 'Completed missions will appear here.' : 'Create your first community mission.'}</div>`;
        document.querySelectorAll('[data-nav]').forEach((el)=>el.addEventListener('click', (e)=>{
                e.preventDefault();
                go(el.dataset.nav);
            }));
        document.querySelectorAll('.tabs button').forEach((el)=>el.classList.toggle('selected', el.dataset.action === x));
    }
}
function downloadImpact(text) {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([
        text
    ], {
        type: 'text/plain'
    }));
    link.download = 'missionmesh-impact.txt';
    link.click();
    setTimeout(()=>URL.revokeObjectURL(link.href), 1000);
    toast('Impact downloaded.');
}
function ensureMobileMenu() {
    if (!document.querySelector('.skip-link')) {
        const skip = document.createElement('a');
        skip.className = 'skip-link';
        skip.href = '#app';
        skip.textContent = 'Skip to content';
        document.body.prepend(skip);
    }
    const app = document.getElementById('app');
    if (!app) return;
    const top = document.querySelector('.top-actions');
    if (!top) return;
    let toggle = top.querySelector('.mobile-menu-toggle');
    if (!toggle) {
        toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'mobile-menu-toggle';
        toggle.setAttribute('aria-controls', 'mobile-menu');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.innerHTML = 'Menu ' + I('chevron', 16);
        top.append(toggle);
    }
    let menu = document.getElementById('mobile-menu');
    if (!menu) {
        menu = document.createElement('nav');
        menu.id = 'mobile-menu';
        menu.className = 'mobile-menu';
        menu.setAttribute('aria-label', 'Mobile navigation');
        menu.hidden = true;
        menu.innerHTML = '<div class="mobile-menu-label">WORKSPACE</div>' + [
            [
                'Business',
                '/business'
            ],
            [
                'Nonprofit',
                '/nonprofit'
            ],
            [
                'Volunteer',
                '/volunteer'
            ],
            [
                'Sponsor',
                '/sponsor'
            ],
            [
                'Create mission',
                '/nonprofit/create'
            ],
            [
                'Explore resources',
                '/explore'
            ],
            [
                'Our impact',
                '/impact'
            ],
            [
                'How it works',
                '/how-it-works'
            ]
        ].map(([label, p])=>`<a href="${p}" data-mobile-nav="${p}" ${path === p ? 'aria-current="page"' : ''}>${label}</a>`).join('') + '<div class="mobile-menu-label mobile-session-label">DEMO MODE · ALL ROLES UNLOCKED</div><div class="mobile-menu-auth"><button type="button" class="btn text" data-auth="login">Log in</button><button type="button" class="btn outline" data-auth="signup">Create account</button></div>';
        document.querySelector('.main-wrap')?.append(menu);
    }
    let backdrop = document.querySelector('.mobile-menu-backdrop');
    if (!backdrop) {
        backdrop = document.createElement('button');
        backdrop.type = 'button';
        backdrop.className = 'mobile-menu-backdrop';
        backdrop.setAttribute('aria-label', 'Close mobile navigation');
        backdrop.hidden = true;
        document.body.append(backdrop);
    }
    if (!document.body.dataset.mobileMenuBound) {
        document.body.dataset.mobileMenuBound = 'true';
        const close = ()=>{
            const m = document.getElementById('mobile-menu'), b = document.querySelector('.mobile-menu-backdrop'), t = document.querySelector('.mobile-menu-toggle');
            if (m) m.hidden = true;
            if (b) b.hidden = true;
            if (t) t.setAttribute('aria-expanded', 'false');
        };
        document.addEventListener('click', (e)=>{
            const target = e.target;
            if (target.closest('.mobile-menu-toggle')) {
                const m = document.getElementById('mobile-menu'), b = document.querySelector('.mobile-menu-backdrop'), t = target.closest('.mobile-menu-toggle');
                const open = Boolean(m?.hidden);
                if (m) m.hidden = !open;
                if (b) b.hidden = !open;
                if (t) t.setAttribute('aria-expanded', String(open));
                return;
            }
            if (target.closest('.mobile-menu-backdrop')) {
                close();
                return;
            }
            const link = target.closest('[data-mobile-nav]');
            if (link) {
                e.preventDefault();
                close();
                go(link.dataset.mobileNav || link.getAttribute('href') || '/');
            }
        });
        document.addEventListener('keydown', (e)=>{
            if (e.key === 'Escape') close();
        });
    }
}
async function aiRequest(endpoint, payload) {
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });
    const data = await response.json().catch(()=>({}));
    if (!response.ok) {
        const code = data.error?.code;
        throw new Error(code ? `${code}: ${data.error.message}` : data.error?.message || 'Gemini is unavailable.');
    }
    return data;
}
function aiText(parent, label, value) {
    const row = document.createElement('div');
    row.className = 'ai-result-row';
    const strong = document.createElement('strong');
    strong.textContent = label;
    const span = document.createElement('span');
    span.textContent = String(value ?? 'Not provided');
    row.append(strong, span);
    parent.append(row);
}
function showAiError(parent, error) {
    parent.innerHTML = '';
    const p = document.createElement('p');
    p.className = 'ai-error';
    p.textContent = error instanceof Error ? error.message : 'Gemini is unavailable. Your mission text is still preserved.';
    parent.append(p);
    const fallback = document.createElement('button');
    fallback.className = 'btn outline';
    fallback.type = 'button';
    fallback.textContent = 'Use rule-based parser';
    fallback.onclick = ()=>{
        document.querySelector('#mission-form')?.requestSubmit();
    };
    parent.append(fallback);
}
function showAnalysis(analysis) {
    const panel = document.createElement('section');
    panel.className = 'panel ai-result';
    panel.id = 'gemini-result';
    const heading = document.createElement('div');
    heading.className = 'section-head';
    heading.innerHTML = '<div><span class="eyebrow">GEMINI ANALYSIS</span><h2>Review the extracted mission</h2></div><span class="badge lavender">AI · editable</span>';
    panel.append(heading);
    aiText(panel, 'Objective', analysis.objective);
    aiText(panel, 'People served', analysis.peopleServed ?? 'Not specified');
    aiText(panel, 'Location', analysis.location || 'Not specified; no coordinates invented');
    aiText(panel, 'Deadline', analysis.deadlineText || 'Not specified');
    aiText(panel, 'Budget', analysis.budget === null || analysis.budget === undefined ? 'Not specified' : money(analysis.budget));
    const notice = document.createElement('p');
    notice.className = 'helper';
    notice.textContent = [
        ...analysis.missingDetails || [],
        ...analysis.ambiguities || []
    ].join(' ') || 'Review every editable field below before creating the mission.';
    panel.append(notice);
    document.querySelector('.create-layout')?.after(panel);
    panel.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
    });
}
function deadlineFromText(text) {
    const found = text?.match(/(?:at|by)?\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/i);
    if (!found) return undefined;
    const h = Number(found[1]) % 12 + (found[3]?.toLowerCase() === 'pm' ? 12 : 0);
    return `${String(h).padStart(2, '0')}:${found[2] || '00'}`;
}
function setupAiCreate() {
    const form = document.querySelector('#mission-form');
    if (!form || document.querySelector('#gemini-tools')) return;
    const tools = document.createElement('div');
    tools.id = 'gemini-tools';
    tools.className = 'ai-tools';
    tools.innerHTML = '<details class="ai-optional"><summary>Optional: analyze this description with Gemini</summary><p>Gemini can suggest extracted requirements. The rule-based compiler above remains the default, and nothing is saved until you review the editable fields.</p><button type="button" class="btn outline">Analyze with Gemini</button><div class="ai-status" aria-live="polite"></div></details>';
    form.after(tools);
    const button = tools.querySelector('button'), status = tools.querySelector('.ai-status');
    button.onclick = async ()=>{
        const text = form.querySelector('[name=goal]').value.trim();
        if (text.length < 10) {
            status.textContent = 'Describe the mission in at least 10 characters.';
            return;
        }
        button.disabled = true;
        status.textContent = 'Contacting Gemini…';
        try {
            const data = await aiRequest('/api/ai/mission/analyze', {
                description: text,
                context: {
                    address: form.querySelector('[name=address]').value
                }
            });
            const a = data.analysis;
            const extra = {
                address: a.location || String(form.querySelector('[name=address]').value),
                budget: a.budget ?? String(form.querySelector('[name=budget]').value),
                deadline: deadlineFromText(a.deadlineText || '')
            };
            draft = compile(text, extra);
            if (a.objective) draft.title = a.objective.slice(0, 120);
            if (a.peopleServed) draft.people = a.peopleServed;
            if (Array.isArray(a.requirements) && a.requirements.length) draft.requirements = a.requirements.map((r)=>({
                    category: r.category,
                    quantity: Number(r.quantity),
                    unit: r.unit,
                    priority: r.priority
                }));
            draft.dietaryTags = Array.isArray(a.dietaryTags) ? a.dietaryTags : [];
            draft.refrigeration = Boolean(a.refrigerationRequired);
            if (a.transportationRequired && !draft.requirements.some((r)=>r.category === 'transportation')) draft.requirements.push({
                category: 'transportation',
                quantity: 1,
                unit: 'vehicle',
                priority: 'required'
            });
            render();
            showAnalysis(a);
            document.querySelector('#requirements')?.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        } catch (error) {
            status.textContent = 'Gemini could not analyze this mission.';
            showAiError(status, error);
        } finally{
            button.disabled = false;
        }
    };
}
function setupAiPlan() {
    const m = current();
    const panel = document.querySelector('.cost-panel');
    if (!m || !panel || document.querySelector('#ai-plan-tools')) return;
    const wrap = document.createElement('section');
    wrap.id = 'ai-plan-tools';
    wrap.className = 'ai-tools';
    wrap.innerHTML = '<details class="ai-optional"><summary>Optional: ask Gemini to explain this plan</summary><p>Gemini explains the deterministic matches and highlights readiness risks. It cannot change resources, funding, or route state.</p><button type="button" class="btn outline">Analyze readiness with Gemini</button><label>Refine this mission naturally<textarea rows="3" placeholder="Example: change vegetarian meals to 60"></textarea></label><button type="button" class="btn outline">Propose refinement</button><div class="ai-status" aria-live="polite"></div></details>';
    panel.append(wrap);
    const status = wrap.querySelector('.ai-status');
    const result = (title)=>{
        const el = document.createElement('section');
        el.className = 'ai-output';
        const h = document.createElement('h3');
        h.textContent = title;
        el.append(h);
        wrap.append(el);
        return el;
    };
    wrap.querySelectorAll('button')[0].onclick = async ()=>{
        status.textContent = 'Reviewing the current deterministic plan…';
        try {
            const shortages = m.requirements.map((r)=>({
                    ...r,
                    missing: Math.max(0, r.quantity - m.matches.filter((x)=>x.category === r.category).reduce((s, x)=>s + x.fulfilledQuantity, 0))
                })).filter((r)=>r.missing > 0);
            const data = await aiRequest('/api/ai/mission/explain', {
                mission: m,
                matches: m.matches,
                shortages,
                volunteer: db.volunteers[0]
            });
            const out = result('Gemini explanation and readiness');
            for (const x of data.explanation.matchExplanations || [])aiText(out, 'Resource ' + x.resourceId, x.explanation);
            for (const x of data.explanation.risks || [])aiText(out, x.severity, x.issue + ' Next: ' + x.nextAction);
            for (const x of data.explanation.shortages || [])aiText(out, 'Shortage: ' + x.category, x.explanation + ' Next: ' + x.nextAction);
            status.textContent = 'AI explanation complete. Deterministic matching remains the source of truth.';
        } catch (error) {
            status.textContent = error instanceof Error ? error.message : 'Gemini is unavailable.';
        }
    };
    wrap.querySelectorAll('button')[1].onclick = async ()=>{
        const instruction = wrap.querySelector('textarea').value.trim();
        if (!instruction) {
            status.textContent = 'Describe the change you want first.';
            return;
        }
        status.textContent = 'Preparing an editable proposal…';
        try {
            const data = await aiRequest('/api/ai/mission/refine', {
                mission: m,
                instruction
            });
            const out = result('Proposed changes · human confirmation required');
            for (const x of data.changes || [])aiText(out, x.field, String(x.oldValue) + ' → ' + String(x.newValue) + ' · ' + x.reason);
            const confirm1 = document.createElement('button');
            confirm1.className = 'btn primary';
            confirm1.type = 'button';
            confirm1.textContent = 'Confirm and save refinement';
            confirm1.onclick = ()=>{
                const p = data.proposedMission;
                Object.assign(m, {
                    title: p.title,
                    description: p.description,
                    people: Number(p.people),
                    address: p.address,
                    deadline: Number(p.deadline),
                    budget: Number(p.budget),
                    refrigeration: Boolean(p.refrigeration),
                    dietaryTags: p.dietaryTags,
                    requirements: p.requirements,
                    matches: [],
                    route: [],
                    status: 'Draft'
                });
                match(m, db.resources, db.volunteers[0]);
                save();
                go(`/mission/${m.id}/plan`);
                toast('Refinement saved after your confirmation.');
            };
            out.append(confirm1);
            status.textContent = 'Review the proposal. Nothing changed yet.';
        } catch (error) {
            status.textContent = error instanceof Error ? error.message : 'Gemini is unavailable.';
        }
    };
}
function setupAiEnhancements() {
    if (path === '/nonprofit/create') setupAiCreate();
    if (/^\/mission\/[^/]+\/plan$/.test(path)) setupAiPlan();
}
const aiObserver = new MutationObserver(()=>setupAiEnhancements());
aiObserver.observe(document.getElementById('app'), {
    childList: true,
    subtree: true
});
const mobileMenuObserver = new MutationObserver(()=>ensureMobileMenu());
mobileMenuObserver.observe(document.getElementById('app'), {
    childList: true
});
installDonationHandler();
render();
ensureMobileMenu();
setupAiEnhancements();
