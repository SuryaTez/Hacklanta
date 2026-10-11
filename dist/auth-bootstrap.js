import { initializeAuth, login, logout, saveProfile, getProfile } from './auth.js';
const esc = (value)=>String(value ?? '').replace(/[&<>"']/g, (c)=>({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        })[c]);
const roleInfo = {
    Nonprofit: [
        'Coordinate a community need',
        'Organization name',
        'What outcome does your organization focus on?'
    ],
    Business: [
        'Share surplus resources',
        'Business name',
        'What kinds of resources do you usually share?'
    ],
    Volunteer: [
        'Deliver the last mile',
        'Your name',
        'What kinds of deliveries can you help with?'
    ],
    Sponsor: [
        'Close funding gaps',
        'Your name or organization',
        'What causes would you like to support?'
    ]
};
let user;
function logo() {
    return '<div class="auth-logo">◈ MISSION<span>MESH</span></div>';
}
function onboarding() {
    return `<main class="auth-screen"><section class="auth-card onboarding-card">${logo()}<div class="eyebrow">WELCOME TO MISSIONMESH</div><h1>Hi ${esc(user?.name || user?.email || 'there')}. How will you help?</h1><p class="auth-lead">Choose a workspace and tell us a little about yourself. This provisional profile stays in this browser until Supabase synchronization is added.</p><form id="auth-onboarding-form"><fieldset><legend>Your role</legend><div class="role-choice">${[
        'Nonprofit',
        'Business',
        'Volunteer',
        'Sponsor'
    ].map((role, i)=>`<label><input type="radio" name="role" value="${role}" ${i === 0 ? 'checked' : ''}><span><strong>${role}</strong><small>${roleInfo[role][0]}</small></span></label>`).join('')}</div></fieldset><label><span id="profile-name-label">${roleInfo.Nonprofit[1]}</span><input name="displayName" value="${esc(user?.name || '')}" required></label><label>City or service area<input name="location" placeholder="Atlanta, GA" required></label><label><span id="profile-focus-label">Focus</span><input name="focus" placeholder="Community meals, food rescue, or local deliveries" required></label><p class="helper">Role selection changes navigation only. It does not grant backend permissions.</p><button class="btn primary full">Enter my workspace →</button></form><button class="btn text" data-auth="logout">Use a different account</button></section></main>`;
}
function authButtons() {
    const host = document.querySelector('.landing-hero .hero-copy');
    if (host && !host.querySelector('.auth-entry')) host.insertAdjacentHTML('beforeend', '<div class="auth-entry"><span>Have an account?</span><button class="btn outline" data-auth="login">Log in</button><button class="btn primary" data-auth="signup">Create account</button></div>');
    const top = document.querySelector('.top-actions');
    if (top && !top.querySelector('.auth-entry-top')) top.insertAdjacentHTML('beforeend', '<div class="auth-entry-top"><button class="btn text" data-auth="login">Log in</button><button class="btn primary" data-auth="signup">Sign up</button></div>');
}
function profileControls() {
    document.querySelector('.demo-dot')?.replaceChildren(document.createTextNode(`Signed in · ${user?.name || user?.email || 'MissionMesh user'}`));
    const top = document.querySelector('.top-actions');
    if (!top) return;
    top.querySelector('.role-switch')?.setAttribute('hidden', 'true');
    if (!top.querySelector('.auth-profile')) top.insertAdjacentHTML('beforeend', `<div class="auth-profile"><span class="auth-avatar">${esc((user?.name || user?.email || 'M').slice(0, 1).toUpperCase())}</span><span>${esc(user?.name || user?.email || 'Account')}</span><button class="btn text" data-auth="logout">Log out</button></div>`);
}
function bind() {
    document.querySelectorAll('[data-auth]').forEach((el)=>el.addEventListener('click', async ()=>{
            const action = el.dataset.auth;
            try {
                if (action === 'logout') await logout();
                else await login(action === 'signup');
            } catch (error) {
                const toast = document.querySelector('#toast');
                if (toast) {
                    toast.textContent = error instanceof Error ? error.message : 'Authentication could not start.';
                    toast.classList.add('show');
                }
            }
        }));
    const form = document.querySelector('#auth-onboarding-form');
    if (form) {
        document.querySelectorAll('input[name=role]').forEach((input)=>input.addEventListener('change', ()=>{
                const info = roleInfo[input.value];
                document.querySelector('#profile-name-label').textContent = info[1];
                document.querySelector('#profile-focus-label').textContent = info[2];
            }));
        form.addEventListener('submit', (event)=>{
            event.preventDefault();
            const fields = new FormData(form), selected = String(fields.get('role'));
            saveProfile(user, selected, {
                displayName: String(fields.get('displayName')).trim(),
                location: String(fields.get('location')).trim(),
                focus: String(fields.get('focus')).trim()
            });
            window.location.assign(`/${selected.toLowerCase()}`);
        });
    }
}
async function start() {
    try {
        const state = await initializeAuth();
        user = state.user;
        const profile = getProfile(user);
        if (user && !profile) {
            document.querySelector('#app').innerHTML = onboarding();
            bind();
            return;
        }
        if (user) profileControls();
        else authButtons();
        bind();
    } catch (error) {
        document.querySelector('#app').insertAdjacentHTML('afterbegin', '<div class="auth-error">Authentication setup could not be loaded. Demo mode remains available.</div>');
        authButtons();
        bind();
    }
}
start();
