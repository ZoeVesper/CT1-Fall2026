// Element chart: one row per category, an icon + name per element, and the
// details in a tooltip on hover (or keyboard focus). Icons are the pictures in
// Icon/ (see PICTURES), or small SVGs drawn to match the map where there is none.

const FRAME = (inner, bg = '#1a1515') =>
    `<svg viewBox="0 0 56 56" width="56" height="56" aria-hidden="true">` +
    `<rect x="1" y="1" width="54" height="54" rx="6" fill="${bg}" stroke="#4a3a3a"/>${inner}</svg>`;

const ACTOR = `<ellipse cx="28" cy="36" rx="14" ry="16" fill="#050505"/><circle cx="28" cy="18" r="10" fill="#050505"/>` +
    `<circle cx="24" cy="17" r="1.6" fill="#ff1e1e"/><circle cx="32" cy="17" r="1.6" fill="#ff1e1e"/><rect x="24" y="23" width="8" height="2" fill="#ff1e1e"/>`;

const ICONS = {
    room: FRAME(`<rect x="8" y="8" width="40" height="40" fill="#181818" stroke="#6a6a6a" stroke-width="2"/>` +
        `<path d="M8 22V34M48 22V34" stroke="#181818" stroke-width="3"/>` +
        `<g fill="#121212" stroke="#555"><rect x="13" y="13" width="10" height="10" rx="1.5"/><rect x="33" y="13" width="10" height="10" rx="1.5"/><rect x="13" y="33" width="10" height="10" rx="1.5"/><rect x="33" y="33" width="10" height="10" rx="1.5"/></g>` +
        `<path d="M24 50H32" stroke="#00c800" stroke-width="3"/>`),
    corridor: FRAME(`<rect x="5" y="20" width="46" height="16" fill="#181818" stroke="#6a6a6a" stroke-width="2"/>` +
        `<path d="M5 23V33M51 23V33" stroke="#181818" stroke-width="3"/><path d="M8 28H48" stroke="#555" stroke-dasharray="3 3"/>` +
        `<path d="M14 36H22" stroke="#00c800" stroke-width="3"/>`),
    actor: FRAME(ACTOR, '#2a2222'),
    installation: FRAME(`<ellipse cx="28" cy="37" rx="13" ry="15" fill="#323232"/><polygon points="14,23 42,23 28,5" fill="#141414"/>` +
        `<rect x="12" y="21" width="32" height="3" fill="#141414"/><circle cx="30" cy="29" r="1.6" fill="#ff2828"/><circle cx="38" cy="41" r="5" fill="none" stroke="#828282"/>`, '#2a2222'),
    stationary: FRAME(`<circle cx="28" cy="28" r="18" fill="#821414"/><path d="M17 33L38 23" stroke="#ebebeb" stroke-width="3"/>` +
        `<circle cx="17" cy="33" r="2.6" fill="#ebebeb"/><circle cx="38" cy="23" r="2.6" fill="#ebebeb"/>`, '#2a2222'),
    door: FRAME(`<rect x="12" y="5" width="32" height="46" fill="#464242" stroke="#8c8c8c"/><rect x="17" y="10" width="22" height="13" fill="none" stroke="#8c8c8c"/>`),
    shutter: FRAME(`<g fill="#bebebe" stroke="#3c3c3c"><rect x="7" y="6" width="42" height="9"/><rect x="7" y="17" width="42" height="9"/><rect x="7" y="28" width="42" height="9"/><rect x="7" y="39" width="42" height="9"/></g>`),
    screen: FRAME(`<rect x="7" y="8" width="42" height="40" fill="#6ea0d2" fill-opacity=".85" stroke="#3c3c3c"/><path d="M28 8V48M7 28H49" stroke="#3c3c3c"/>`),
    display: FRAME(ACTOR + `<rect x="5" y="3" width="46" height="50" rx="2" fill="#96c8d2" fill-opacity=".16" stroke="#96aaaf" stroke-width="1.5"/>` +
        `<rect x="5" y="49" width="46" height="4" fill="#5a463c"/><path d="M11 9L22 20M11 17L17 23" stroke="#fff" stroke-opacity=".35" stroke-width="2"/>`, '#2a2222'),
    darkness: FRAME(ACTOR + `<rect x="2" y="2" width="52" height="52" rx="5" fill="#000" fill-opacity=".72"/>`, '#2a2222'),
    flashing: FRAME(ACTOR + `<rect class="flash" x="2" y="2" width="52" height="52" rx="5" fill="#ffffbe"/>`, '#2a2222'),
    sudden: FRAME(`<polygon points="10,22 18,22 28,13 28,43 18,34 10,34" fill="#cfcfcf"/>` +
        `<g fill="none" stroke="#5aff5a" stroke-width="2"><path d="M33 22a8 8 0 0 1 0 12"/><path d="M37 17a15 15 0 0 1 0 22"/><path d="M41 12a22 22 0 0 1 0 32"/></g>`),
    block: FRAME([-3, -2, -1, 0, 1, 2, 3].map(i =>
        `<rect x="${28 + i * 7 - 3}" y="6" width="6" height="${i % 2 ? 38 : 44}" fill="rgb(${120 + i * 4},25,28)"/>`).join('') +
        `<rect x="3" y="3" width="50" height="50" rx="5" fill="none" stroke="#c83c3c" stroke-width="1.5"/>`),
    cue: FRAME(`<rect x="5" y="3" width="46" height="50" rx="2" fill="#96c8d2" fill-opacity=".16" stroke="#96aaaf" stroke-width="1.5"/>` +
        `<rect x="5" y="49" width="46" height="4" fill="#5a463c"/>` +
        `<ellipse cx="28" cy="26" rx="13" ry="8" fill="none" stroke="#50c850" stroke-width="2"/><circle cx="28" cy="26" r="4" fill="#50c850"/>`, '#2a2222'),
    turn: FRAME(`<rect x="3" y="3" width="50" height="50" rx="5" fill="#ffaa00" fill-opacity=".1" stroke="#ffaa00" stroke-width="1.5"/>` +
        `<g fill="none" stroke="#ffaa00" stroke-width="3" stroke-linecap="round"><path d="M12 40H30V14"/><path d="M24 21L30 14L36 21"/></g>`),
};

// The artist's own pictures (Icon/ folder) replace the drawn icons above
// wherever there is one
const PICTURES = {
    room: 'Room', corridor: 'Corridor', actor: 'Actor', installation: 'Instal', stationary: 'Stationary',
    door: 'Door', shutter: 'Shutter', screen: 'Screen', display: 'Display',
    darkness: 'Darkness', flashing: 'Flash', sudden: 'AudioAddon',
    block: 'VisualBlock', cue: 'VisualCue', turn: 'DirectionChange',
};
Object.entries(PICTURES).forEach(([id, file]) =>
    ICONS[id] = FRAME(`<image href="Icon/${file}.png" x="3" y="3" width="50" height="50"/>`));

const SHARED = {
    core: 'Repeating the same core weakens it for that visitor.',
    conc: 'Any concealment adds +12 strength.',
};

const CHART = [
    {
        cat: 'Location', note: 'Safety rule: every 3 locations in a row need an emergency exit (green); the last location already leads to the house exit.', items: [
            { id: 'room', name: 'Room', tip: 'Default lighting and sound. 4 floor slots, plus 2 slots behind each wall, for adding encounters. Optional emergency exit (green).' },
            { id: 'corridor', name: 'Corridor', tip: 'Default lighting and sound. Runs straight, or turns 90° left or right when Direction Change is chosen as the optional strategy. 1 slot behind each side wall. Optional emergency exit (green).' },
        ]
    },
    {
        cat: 'Core', note: SHARED.core, items: [
            { id: 'actor', name: 'Actor', tip: 'A live performer. Base strength ' + BASE.actor + '.' },
            { id: 'installation', name: 'Installation', tip: 'A mechanical figure. Base strength ' + BASE.installation + '.' },
            { id: 'stationary', name: 'Stationary', tip: 'A still prop. Base strength ' + BASE.stationary + '. It can’t move, so it can’t use a Screen.' },
        ]
    },
    {
        cat: 'Concealment', note: SHARED.conc, items: [
            { id: 'door', name: 'Door', tip: 'Wall slots only; swings open to reveal the scare.' },
            { id: 'shutter', name: 'Shutter', tip: 'Wall slots only; rolls up to reveal the scare.' },
            { id: 'screen', name: 'Screen', tip: 'Wall or floor slot (free-standing on the floor). It never opens: the scare suddenly comes up close behind it and shows through. Needs a core that can move, so not with Stationary.' },
            { id: 'display', name: 'Display', tip: 'A glass display case: the piece inside is on show the whole time; it never opens. Wall or floor slot. The only concealment a Visual Cue can use.' },
        ]
    },
    {
        cat: 'Visual Add-on', items: [
            { id: 'darkness', name: 'Darkness', tip: 'Scares only. +8 strength.' },
            { id: 'flashing', name: 'Flashing Light', tip: 'Scares: +6 strength. On a Visual Cue it doubles the cue’s own fear (+8 instead of +4).' },
        ]
    },
    {
        cat: 'Audio Add-on', items: [
            { id: 'sudden', name: 'Sudden Sound', tip: 'Scares only. +14 strength.' },
        ]
    },
    {
        cat: 'Optional Strategy', items: [
            { id: 'block', name: 'Visual Block', tip: 'Raises anticipation +10, which makes every later scare stronger. Scares and cues in the first 100 units behind it ×1.2 (red outline).' },
            { id: 'cue', name: 'Visual Cue', tip: 'Built from three other categories: a core + concealment (a Display, or none on the floor) + visual add-on (optional Flashing Light). Adds +4 fear (+8 if flashing), and the visitor stares at it (a green pulse on the map): scares in the next 150 frames ×1.7 (misdirection).' },
            { id: 'turn', name: 'Direction Change', tip: 'A room’s side exit, or a turning corridor (turns 90°; 2 wall slots). Raises anticipation +6. After a turning corridor, scares and cues in the first 100 units of the next location ×1.5: the blind side (amber outline on those slots). A room turns in its centre, too far away for that.' },
        ]
    },
];

(function buildChart() {
    const root = document.getElementById('chart');
    if (!root) return;
    root.innerHTML = CHART.map(row =>
        `<div class="chart-row"><div class="chart-cat">${row.cat}${row.note ? `<div class="chart-note">${row.note}</div>` : ''}</div><div class="chart-items">` +
        row.items.map(it =>
            `<div class="chart-item" tabindex="0" data-tip="${it.tip.replace(/"/g, '&quot;')}">${ICONS[it.id]}<span>${it.name}</span></div>`
        ).join('') + `</div></div>`
    ).join('');

    // One shared tooltip, kept inside the window
    const tip = document.createElement('div');
    tip.className = 'chart-tip';
    document.body.appendChild(tip);
    const show = el => {
        tip.textContent = el.dataset.tip;
        tip.style.display = 'block';
        const r = el.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
        const x = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), innerWidth - w - 8);
        const y = r.bottom + 8 + h < innerHeight ? r.bottom + 8 : r.top - 8 - h;
        tip.style.left = x + 'px';
        tip.style.top = y + 'px';
    };
    const hide = () => { tip.style.display = 'none'; };
    root.querySelectorAll('.chart-item').forEach(el => {
        el.addEventListener('mouseenter', () => show(el));
        el.addEventListener('mouseleave', hide);
        el.addEventListener('focus', () => show(el));
        el.addEventListener('blur', hide);
    });
    addEventListener('scroll', hide, { passive: true });
})();
