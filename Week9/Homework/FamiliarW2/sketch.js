// FAMILIARS — tame the spirits hiding in household objects. The camera (ml5 objectDetection)
// finds objects, a tap wakes the spirit inside, and one hand (ml5 handPose) tames it with seals.

// ───────────────────────── Data ─────────────────────────

const SEALS = {
    sword: { name: 'Sword Seal', how: 'Index and middle finger straight and pressed together; the rest curled.' },
    horns: { name: 'Horned Seal', how: 'Index and little finger straight; middle and ring curled.' },
    ring: { name: 'Ring Seal', how: 'Index and middle finger bent together to meet the thumb in a circle; ring and little finger curled.' },
    thread: { name: 'Thread Seal', how: 'Only the little finger straight; the rest curled.' },
    trident: { name: 'Trident Seal', how: 'Index, middle and ring finger straight and spread apart; the rest curled.' },
};
const TAMING = Object.keys(SEALS);

// Rarity: chance, eye colour, size and extra seals
const RARITY = [
    { name: 'Common', chance: 0.6, eye: [235, 50, 45], scale: 0.85, extra: 0 },
    { name: 'Uncommon', chance: 0.3, eye: [255, 176, 60], scale: 1, extra: 1 },
    { name: 'Rare', chance: 0.1, eye: [150, 230, 255], scale: 1.2, extra: 2 },
];

// One family per kind of object. friend: the family's friendliness (0–100). lumps: the body as
// fuzzy blobs [x, y, rx, ry] in a −1…1 box. eyes / mouthY / top: the face and the top of the head.
const FAMILIES = [
    { key: 'water', title: 'Water spirits', objects: ['bottle', 'cup', 'wine glass', 'bowl', 'vase'], friend: 55, names: ['Drip', 'Undertow', 'Drowned King'],
      lumps: [[0, -.55, .18, .25], [0, -.2, .38, .35], [0, .25, .55, .45], [-.45, .62, .14, .2], [.1, .72, .12, .22], [.5, .6, .1, .16]], eyes: [[-.17, -.15], [.17, -.15]], mouthY: .12, top: -.8 },
    { key: 'sheet', title: 'Sheet ghosts', objects: ['bed', 'couch'], friend: 70, names: ['Shroudling', 'Linen Wraith', 'Pale Matron'], body: [206, 196, 200], face: 'hollow',
      lumps: [[0, -.35, .48, .42], [0, .15, .55, .5], [-.42, .62, .16, .2], [-.14, .68, .16, .2], [.14, .68, .16, .2], [.42, .62, .16, .2]], eyes: [[-.18, -.35], [.18, -.35]], mouthY: -.05, top: -.77 },
    { key: 'screen', title: 'Screen phantoms', objects: ['tv', 'laptop', 'cell phone', 'keyboard', 'mouse', 'remote'], friend: 35, names: ['Flicker', 'Static', 'Dead Channel'],
      lumps: [[0, -.1, .62, .45, 'box'], [-.3, .55, .1, .2], [.3, .55, .1, .2], [-.25, -.7, .04, .2], [.25, -.7, .04, .2]], eyes: [[-.24, -.18], [.24, -.18]], mouthY: .1, top: -.55 },
    { key: 'book', title: 'Book whispers', objects: ['book'], friend: 60, names: ['Murmur', 'Marginalia', 'The Unread'],
      lumps: [[0, 0, .14, .6], [-.42, -.1, .36, .42], [.42, -.1, .36, .42], [0, .6, .2, .15]], eyes: [[-.4, -.15], [.4, -.15]], mouthY: .2, top: -.6 },
    { key: 'plant', title: 'Thornlings', objects: ['potted plant', 'banana', 'apple', 'orange'], friend: 75, names: ['Sprout-Thing', 'Thornling', 'Rot Bloom'],
      lumps: [[0, .2, .48, .42], [0, .62, .34, .16], [-.3, -.4, .1, .32], [0, -.5, .1, .36], [.3, -.4, .1, .32], [-.55, -.1, .2, .08], [.55, -.1, .2, .08]], eyes: [[-.18, .12], [.18, .12]], mouthY: .38, top: -.25 },
    { key: 'chair', title: 'Sitters', objects: ['chair', 'bench'], friend: 50, names: ['Sitter', 'Long Sitter', 'The One Who Waits'],
      lumps: [[0, -.45, .4, .35], [0, .1, .62, .28], [-.48, .55, .09, .3], [.48, .55, .09, .3], [-.2, .55, .07, .25], [.2, .55, .07, .25]], eyes: [[-.15, -.45], [.15, -.45]], mouthY: -.22, top: -.8 },
    { key: 'clock', title: 'Hour-eaters', objects: ['clock'], friend: 30, names: ['Tick', 'Hour-Eater', 'Midnight'], face: 'cyclops',
      lumps: [[0, 0, .6, .6], [-.35, .65, .1, .18], [.35, .65, .1, .18], [-.5, -.5, .14, .14], [.5, -.5, .14, .14]], eyes: [[0, -.08]], mouthY: .32, top: -.6 },
    { key: 'blade', title: 'Blade imps', objects: ['scissors', 'knife', 'fork', 'spoon'], friend: 15, names: ['Snip', 'Carver', 'The Edge'],
      lumps: [[0, .2, .3, .5], [-.22, -.5, .08, .42], [.22, -.5, .08, .42], [0, .7, .4, .1]], eyes: [[-.12, .05], [.12, .05]], mouthY: .3, top: -.35 },
    { key: 'toy', title: 'Hollow toys', objects: ['teddy bear'], friend: 85, names: ['Button-Eye', 'Hollow Bear', 'Old Favourite'],
      lumps: [[0, -.25, .42, .38], [-.38, -.6, .15, .15], [.38, -.6, .15, .15], [0, .38, .48, .4], [-.5, .2, .14, .22], [.5, .2, .14, .22]], eyes: [[-.16, -.28], [.16, -.28]], mouthY: -.05, top: -.63 },
    { key: 'bag', title: 'Hoarders', objects: ['backpack', 'handbag', 'suitcase', 'umbrella'], friend: 45, names: ['Pocketling', 'Hoarder', 'The Bottomless'],
      lumps: [[0, .1, .62, .55], [0, -.5, .25, .12], [-.6, .3, .12, .25], [.6, .3, .12, .25]], eyes: [[-.22, -.08], [.22, -.08]], mouthY: .28, top: -.5 },
];
FAMILIES.forEach(f => f.body ||= [14, 12, 14]); // charcoal, unless set
const familyOf = label => FAMILIES.find(f => f.objects.includes(label));
const familyByKey = key => FAMILIES.find(f => f.key == key);

// ───────────────────────── State ─────────────────────────

const TEX = 256, UNIT = 100;                         // spirit image size; px per unit in it
const HOLD_SEAL = 600, HOLD_WRONG = 900, GRACE = 450; // ms a gesture must be held / may drop out
const QUIET = 12000, STORE = 'familiars-w9-grimoire'; // ms an object stays quiet after an encounter
let W = 960, H = 720, vid = null, mirror = true, facing = 'user', camOn = false, started = false;
let run = 0, handPose = null, detector = null, detectorLoad = null, handLoad = null, hands = [];
let detections = [], quiet = {}, state = 'idle', stateT = 0, spirit = null; // state: idle | scan | summon | tame | tamed | fled
let sealHold = 0, wrongHold = 0, missed = 0, shake = 0, keySeal = null, lastSeen = null, fingerMem = [0, 0, 0, 0];
let handRate = 0, handCount = 0, handClock = 0, fakeIdx = 0, fledCount = 0, grimoire = [], followers = [], glyphs = {};

const $ = id => document.getElementById(id);
const setStatus = s => $('status').textContent = s;
const SCAN = 'Scanning the room… click or tap an object that glows red.';
const scanStatus = () => setStatus(camOn && detector ? SCAN : 'Practice mode: press Space to conjure an object, then click it.');

// ───────────────────────── Setup ─────────────────────────

function setup() {
    fitSize();
    const cnv = createCanvas(W, H);
    cnv.parent('cv');
    cnv.elt.addEventListener('pointerdown', e => { // a click or a tap wakes the spirit under it
        const r = cnv.elt.getBoundingClientRect();
        tapAt((e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height);
    });
    pixelDensity(Math.min(window.devicePixelRatio || 1, 2));
    textFont('Georgia');
    facing = matchMedia('(pointer: coarse)').matches ? 'environment' : 'user'; // phones use the back camera
    for (const k of TAMING) glyphs[k] = makeGlyph(k);
    loadGrimoire();
    buildCharts();
    showPanel();
    setStatus('Press “Begin the Séance” to wake the camera.');
}

// Landscape on a wide screen, portrait on a phone
function fitSize() {
    W = Math.max(280, Math.min($('cv').clientWidth || 960, 960));
    H = Math.min(Math.round(W < 560 ? W * 4 / 3 : W * 3 / 4), Math.max(360, innerHeight - 24));
}
function windowResized() { fitSize(); resizeCanvas(W, H); }

// ───────────────────────── Camera and models ─────────────────────────

function buttons(on) { $('btnBegin').disabled = on; $('btnStop').disabled = !on; $('btnFlip').disabled = true; }

// The Begin button. `run` goes up on every Begin and Stop, so a Begin still waiting
// for the camera or a model knows when Stop was pressed meanwhile.
async function begin() {
    if (started) return;
    started = true;
    const me = ++run, live = () => me == run;
    buttons(true);
    setStatus('Opening the camera…');
    await openCamera();
    if (!live()) return closeCamera();
    state = 'scan'; stateT = 0;
    if (!camOn) return setStatus('No camera — practice mode. Press Space to conjure an object, click it, then hold 1–5 for the seals.');
    $('btnFlip').disabled = false;
    // p5 2.x: ml5 returns a promise per model. Each loads once and is kept for the next Begin.
    try {
        if (!detector) setStatus('Summoning the object seer (ml5 objectDetection)…');
        const first = !detectorLoad;
        detector = await (detectorLoad ||= ml5.objectDetection('cocossd'));
        if (first) scanLoop();
    } catch (e) {
        console.error(e); detectorLoad = null;
        if (live()) setStatus('The object seer could not load (' + e.message + '). Press Space to conjure an object instead.');
    }
    if (!live()) return;
    try {
        if (detector) setStatus('Scanning the room… (still summoning the hand reader, ml5 handPose)');
        handPose = await (handLoad ||= ml5.handPose({ maxHands: 1 }));
        if (!live()) return;
        if (state != 'scan') readHands(true);
        if (detector && state == 'scan') setStatus(SCAN);
    } catch (e) {
        console.error(e); handLoad = null;
        if (live()) setStatus('The hand reader could not load (' + e.message + '). Hold keys 1–5 for the seals instead.');
    }
}

// The Stop button: close the camera, back to the title. A tamed spirit joins the row; any other is let go.
function endSeance() {
    if (!started) return;
    started = false; run++;
    readHands(false); closeCamera();
    if (spirit) state == 'tamed' ? addFollower({ ...spirit.rec, tex: spirit.tex }, spirit.landX) : spirit.tex.remove();
    state = 'idle'; stateT = 0; spirit = null; detections = []; keySeal = null; sealHold = wrongHold = 0;
    buttons(false); showPanel();
    setStatus('The camera is closed. Press “Begin the Séance” to wake it again.');
}

function closeCamera() {
    if (vid && vid.srcObject) { vid.srcObject.getTracks().forEach(t => t.stop()); vid.srcObject = null; }
    camOn = false; hands = [];
}

// One model at a time, so a phone keeps up: objects while scanning, the hand while a spirit is out
function readHands(on) {
    if (!handPose) return;
    if (on) handPose.detectStart(vid, r => { if (state != 'scan') { hands = r; handCount++; } });
    else handPose.detectStop();
    hands = [];
}

async function openCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: facing, width: { ideal: 640 }, height: { ideal: 480 } } });
        if (!vid) {
            vid = Object.assign(document.createElement('video'), { playsInline: true, muted: true });
            vid.style.display = 'none';
            document.body.appendChild(vid);
            vid.addEventListener('resize', sizeVideo); // handPose reads the element's width/height, not videoWidth
        }
        vid.srcObject = stream;
        await vid.play();
        sizeVideo();
        mirror = stream.getVideoTracks()[0].getSettings().facingMode != 'environment'; // a front camera is mirrored
        camOn = true;
    } catch (e) { console.warn('camera', e); camOn = false; }
}
function sizeVideo() { vid.width = vid.videoWidth; vid.height = vid.videoHeight; }

async function flipCamera() { // front ↔ back camera
    if (!camOn) return;
    closeCamera(); detections = [];
    facing = facing == 'user' ? 'environment' : 'user';
    await openCamera();
}

// Object detection is heavy, so it only runs while scanning, a few times a second
async function scanLoop() {
    for (;;) {
        if (state == 'scan' && camOn && vid.readyState >= 2) try {
            const found = await detector.detect(vid), now = millis();
            detections = found.filter(d => d.confidence > 0.45 && familyOf(d.label) && !(quiet[d.label] > now))
                .concat(detections.filter(d => d.fake && d.until > now));
        } catch (e) { console.warn(e) }
        await new Promise(r => setTimeout(r, 300));
    }
}

// Video pixel -> canvas pixel (the video covers the canvas, mirrored for a front camera)
const vScale = () => Math.max(W / vid.videoWidth, H / vid.videoHeight);
function v2c(x, y) {
    const s = vScale(), cx = (W - vid.videoWidth * s) / 2 + x * s;
    return [mirror ? W - cx : cx, (H - vid.videoHeight * s) / 2 + y * s];
}
function boxOf(d) { // a detection's box on the canvas
    if (d.fake) return { x: W * .5 - W * .12, y: H * .45 - H * .14, w: W * .24, h: H * .28 };
    const [x1, y1] = v2c(d.x, d.y), [x2, y2] = v2c(d.x + d.width, d.y + d.height);
    return { x: Math.min(x1, x2), y: y1, w: Math.abs(x2 - x1), h: y2 - y1 };
}

// ───────────────────────── Hand seals ─────────────────────────

const dist3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0));
const handPoints = hand => hand.keypoints3D?.length == 21 ? hand.keypoints3D : hand.keypoints;

// Index, middle, ring, little: knuckle-to-tip distance / finger length. ~1 straight, 0.3–0.5 folded.
function fingerRatios(hand) {
    const k = handPoints(hand), d = (a, b) => dist3(k[a], k[b]);
    return [5, 9, 13, 17].map(m => d(m, m + 3) / (d(m, m + 1) + d(m + 1, m + 2) + d(m + 2, m + 3)));
}
// Straight (1) or curled (0). In between keeps the last value, so a shaky phone reading doesn't flicker.
const readFingers = hand => fingerMem = fingerRatios(hand).map((r, i) => r > 0.84 ? 1 : r < 0.76 ? 0 : fingerMem[i]);

function readSeal(hand) { // which seal the hand makes, or null
    const k = handPoints(hand), palm = dist3(k[0], k[9]), near = (a, b, f) => dist3(k[a], k[b]) < palm * f;
    const [I, M, R, P] = readFingers(hand).map(v => v == 1);
    // Ring: thumb meets the index tip, middle beside it; the index bent but not folded (a fist)
    if (!R && !P && fingerRatios(hand)[0] > 0.5 && near(4, 8, 0.5) && near(8, 12, 0.6)) return 'ring';
    if (I && M && R && !P) return 'trident';
    if (I && M && !R && !P && near(8, 12, 0.6)) return 'sword';
    if (I && P && !M && !R) return 'horns';
    return P && !I && !M && !R ? 'thread' : null;
}
const currentSeal = () => keySeal || (hands[0] ? readSeal(hands[0]) : null); // keyboard (practice) or hand

// Practice mode: Space conjures an object, 1–5 are the seals. Keys are read by their place
// on the keyboard (e.code), so they work with a Chinese input method switched on.
addEventListener('keydown', e => {
    if (!started || e.target.closest?.('button, select, input, a')) return;
    const i = [...'12345'].findIndex(n => e.code == 'Digit' + n || e.code == 'Numpad' + n || e.key == n);
    if (i >= 0) keySeal = TAMING[i];
    if (e.code != 'Space' && e.key != ' ') return;
    e.preventDefault(); // Space would scroll the page
    if (state == 'scan') detections = [{ fake: true, label: FAMILIES[fakeIdx++ % FAMILIES.length].objects[0], confidence: 1, until: millis() + 8000 }];
});
addEventListener('keyup', () => keySeal = null);

// ───────────────────────── Spirits ─────────────────────────

const rollRarity = (r = Math.random()) => r < RARITY[0].chance ? 0 : r < RARITY[0].chance + RARITY[1].chance ? 1 : 2;

// Friendliness: around the family's. Seals: 2 + rarity (0–2) + timidity (0–2), at most 5.
// Patience: 3.5–7 s per seal, longer for friendlier spirits.
function makeSpirit(label, x, y) {
    const fam = familyOf(label), rarity = rollRarity();
    const friend = Math.round(constrain(randomGaussian(fam.friend, 14), 0, 100)), timid = Math.round(random(100));
    const steps = constrain(2 + RARITY[rarity].extra + (timid > 66 ? 2 : timid > 33 ? 1 : 0), 2, 5), seq = [];
    while (seq.length < steps) { const s = random(TAMING); if (s != seq.at(-1)) seq.push(s); } // no seal twice in a row
    const patience = steps * lerp(3.5, 7, friend / 100);
    const sp = { fam: fam.key, rarity, seed: Math.floor(Math.random() * 1e9), name: fam.names[rarity], from: label,
        friend, timid, seq, idx: 0, patience, patienceMax: patience, x0: x, y0: y };
    sp.tex = makeTexture(sp);
    return sp;
}

// Fuzzy charcoal blob: a soft shape, then many see-through dabs, larger in the middle
function fuzz(pg, cx, cy, rx, ry, col, box) {
    pg.noStroke();
    pg.fill(...col, 235);
    box ? pg.rect(cx - rx * .92, cy - ry * .92, rx * 1.84, ry * 1.84, 6) : pg.ellipse(cx, cy, rx * 1.75, ry * 1.75);
    for (let i = 0, n = Math.max(14, rx * ry / 9); i < n; i++) {
        let x, y, edge;
        if (box) {
            x = cx + random(-rx, rx); y = cy + random(-ry, ry);
            edge = Math.max(Math.abs(x - cx) / rx, Math.abs(y - cy) / ry);
        } else {
            const a = random(TWO_PI);
            edge = Math.sqrt(random());
            x = cx + Math.cos(a) * rx * edge; y = cy + Math.sin(a) * ry * edge;
        }
        const d = random(8, 22) * (1.2 - edge * .55);
        pg.fill(...col, random(30, 80));
        pg.ellipse(x + random(-3, 3), y + random(-3, 3), d, d * random(.7, 1.3));
    }
}

// The body, drawn once into its own image. The same seed always gives the same look.
function makeTexture(sp) {
    const fam = familyByKey(sp.fam), rare = RARITY[sp.rarity], c = TEX / 2, pg = createGraphics(TEX, TEX);
    const P = (x, y) => [c + x * UNIT, c + y * UNIT];
    pg.pixelDensity(1);
    randomSeed(sp.seed);
    if (sp.rarity == 2) { // Rare: a cold glow
        pg.noStroke();
        for (let i = 0; i < 26; i++) { pg.fill(...rare.eye, 5); pg.ellipse(c, c, TEX * (1 - i / 30), TEX * (1 - i / 30)); }
    }
    for (const [x, y, rx, ry, shape] of fam.lumps) fuzz(pg, ...P(x, y), rx * UNIT, ry * UNIT, fam.body, shape == 'box');
    if (sp.rarity >= 1) for (const side of [-1, 1]) for (let t = 0; t < 1; t += .12) { // Uncommon, Rare: horns
        const r = (1 - t) * 9 + 3;
        fuzz(pg, ...P(side * (.2 + t * .22), fam.top + .08 - t * .32), r, r, fam.body);
    }
    if (sp.rarity == 2) { // Rare: a crown of spikes
        pg.stroke(...fam.body, 230);
        pg.strokeWeight(5);
        for (let i = -2; i <= 2; i++) pg.line(...P(i * .07, fam.top + .05), ...P(i * .13, fam.top - .2 + Math.abs(i) * .05));
    }
    if (sp.fam == 'screen') { // scan lines
        pg.stroke(90, 80, 88, 70);
        pg.strokeWeight(1);
        for (let y = -.45; y < .3; y += .07) pg.line(...P(-.52, y), ...P(.52, y));
    }
    const light = fam.body[0] > 100; // stray charcoal scratches, like the Week 7 icons
    pg.strokeWeight(1);
    for (let i = 0; i < 16; i++) {
        const [x, y] = P(random(-.4, .4), random(-.3, .5)), a = random(TWO_PI), l = random(5, 16);
        pg.stroke(light ? 90 : 70, light ? 80 : 60, light ? 86 : 66, 90);
        pg.line(x, y, x + Math.cos(a) * l, y + Math.sin(a) * l);
    }
    randomSeed(Math.random() * 1e9);
    return pg;
}

// The face is drawn live so it can blink; g is the canvas (window) or a p5.Graphics. The glow is
// switched on and off directly, not with ctx.save/restore: p5 caches the fill colour, and restoring
// behind its back gave the next spirit wrong-coloured or missing eyes.
function drawFace(g, sp, x, y, size, blink) {
    const fam = familyByKey(sp.fam), col = RARITY[sp.rarity].eye, k = size / TEX * UNIT, ctx = g.drawingContext;
    const mood = sp.friend >= 65 ? 1 : sp.friend < 35 ? -1 : 0; // smile, frown or waver
    const ew = k * (fam.face == 'cyclops' ? .34 : .11);
    const glow = b => ctx.shadowBlur = b, dark = () => { glow(0); g.fill(12, 10, 12); };
    ctx.shadowColor = `rgb(${col})`;
    glow(k * .18);
    g.noStroke();
    for (const [ex, ey] of fam.eyes) {
        const px = x + ex * k, py = y + ey * k;
        if (fam.face == 'hollow') {
            dark(); g.ellipse(px, py, ew * 1.5, blink ? ew * .3 : ew * 2.1);
            if (!blink) { g.fill(...col); g.ellipse(px, py + ew * .2, ew * .45, ew * .45); }
        } else {
            g.fill(...col); g.ellipse(px, py, ew, blink ? ew * .15 : ew * (mood < 0 ? .7 : 1.25)); // hostile eyes narrow
            if (fam.face == 'cyclops' && !blink) { dark(); g.ellipse(px, py, ew * .3, ew * .75); }
        }
    }
    if (sp.rarity == 2 && fam.face != 'cyclops') { // Rare: a third eye
        glow(k * .18); g.fill(...col);
        g.ellipse(x, y + (fam.eyes[0][1] - .17) * k, ew * .75, blink ? ew * .12 : ew * .95);
    }
    const my = y + fam.mouthY * k, mw = k * (sp.fam == 'bag' ? .3 : .17);
    if (fam.face == 'hollow') { dark(); g.ellipse(x, my, mw * .7, mw * (mood > 0 ? .5 : .95)); }
    else { // a wavering line that curls with the mood
        glow(k * .12); g.noFill(); g.stroke(...col); g.strokeWeight(Math.max(1.5, k * .035));
        let px, py;
        for (let i = 0; i <= 6; i++) {
            const t = i / 6 * 2 - 1, nx = x + t * mw, ny = my + (1 - t * t) * mood * k * .06 + Math.sin(i * 2.1 + sp.seed) * k * .018;
            if (i) g.line(px, py, nx, ny);
            px = nx; py = ny;
        }
    }
    glow(0); g.noStroke();
}

function drawSpirit(sp, x, y, size, alpha) {
    drawingContext.globalAlpha = alpha;
    image(sp.tex, x - size / 2, y - size / 2, size, size);
    drawFace(window, sp, x, y, size, (frameCount + sp.seed % 200) % 190 < 7);
    drawingContext.globalAlpha = 1;
}

// A seal icon: long strokes are straight fingers, stubs are curled ones
function makeGlyph(key) {
    const pg = createGraphics(100, 100);
    const finger = (bx, len, deg) => { const a = radians(deg); pg.strokeWeight(8); pg.line(bx, 54, bx + Math.sin(a) * len, 54 - Math.cos(a) * len); };
    const stub = (...xs) => xs.forEach(bx => finger(bx, 6, 0));
    pg.stroke(232, 222, 222); pg.strokeCap(ROUND);
    pg.strokeWeight(3); pg.fill(232, 222, 222, 40); pg.rect(31, 54, 41, 36, 9); pg.noFill(); // palm
    pg.strokeWeight(8);
    if (key != 'ring') pg.line(31, 74, 27, 66); // folded thumb
    if (key == 'sword') { finger(39, 38, 0); finger(47.5, 40, 0); stub(57, 66); }
    if (key == 'horns') { finger(37, 36, -8); stub(47, 57); finger(66, 28, 12); }
    if (key == 'thread') { stub(37, 47, 57); finger(66, 30, 10); }
    if (key == 'trident') { finger(37, 34, -20); finger(47, 40, 0); finger(57, 34, 20); stub(66); }
    if (key == 'ring') { stub(57, 66); pg.strokeWeight(7); pg.ellipse(36, 38, 27, 27); pg.line(31, 74, 26, 50); }
    return pg;
}

// ───────────────────────── Game loop ─────────────────────────

function draw() {
    const dt = Math.min(deltaTime, 250); // a slow phone still counts real time
    stateT += dt;
    if ((handClock += deltaTime) >= 1000) { handRate = handCount; handCount = handClock = 0; }
    drawRoom();
    lastSeen = currentSeal();
    if (state == 'idle') drawTitle();
    if (state == 'scan') updateScan();
    if (state == 'summon') updateSummon();
    if (state == 'tame') updateTame(dt);
    if (state == 'tamed' || state == 'fled') updateLeaving();
    drawHand();
    updateFollowers(dt);
    drawFrame();
}

// The camera, grey and dusty like the Week 7 icons, with darkness creeping in from the edges
function drawRoom() {
    const ctx = drawingContext, wash = (op, style) => { ctx.globalCompositeOperation = op; ctx.fillStyle = style; ctx.fillRect(0, 0, W, H); };
    background(96, 84, 90);
    if (camOn && vid.readyState >= 2) {
        const s = vScale(), w = vid.videoWidth * s, h = vid.videoHeight * s;
        push();
        if (mirror) { translate(W, 0); scale(-1, 1); }
        ctx.drawImage(vid, (W - w) / 2, (H - h) / 2, w, h);
        pop();
        ctx.save(); wash('saturation', '#808080'); wash('multiply', 'rgb(158, 134, 144)'); ctx.restore();
    }
    const grad = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .25, W / 2, H / 2, Math.max(W, H) * .72);
    grad.addColorStop(0, 'rgba(8,6,8,0.12)');
    grad.addColorStop(1, 'rgba(8,6,8,0.9)');
    ctx.save(); wash('source-over', grad); ctx.restore(); // direct fills are undone by restore (p5 fill cache)
}

function drawFrame() { // a rough charcoal frame
    const m = 7;
    stroke(10, 8, 10); strokeWeight(5);
    line(0, m, W, m - 1); line(0, H - m, W, H - m + 1); line(m, 0, m + 1, H); line(W - m, 0, W - m - 1, H);
    noStroke();
}

function label(str, x, y, size, col = [232, 222, 222], align = CENTER) { // text with a shadow
    textAlign(align, CENTER); textSize(size);
    fill(0, 0, 0, 170); text(str, x + 1.5, y + 1.5);
    fill(...col); text(str, x, y);
}
const fs = k => Math.max(12, W / 46) * k; // font size that follows the canvas width

function drawTitle() {
    label('FAMILIARS', W / 2, H * .4, fs(2.6), [238, 85, 85]);
    label('Something lives in every object in this room.', W / 2, H * .4 + fs(2.6), fs(1));
}

// Scan: every object that houses a spirit glows
function updateScan() {
    const now = millis(), pulse = .6 + .4 * Math.sin(now / 260);
    detections = detections.filter(d => !d.fake || d.until > now);
    for (const d of detections) {
        const b = boxOf(d);
        drawingContext.shadowColor = 'rgb(238, 85, 85)';
        drawingContext.shadowBlur = 22 * pulse + 8;
        fill(238, 85, 85, 26 * pulse); stroke(238, 85, 85); strokeWeight(3);
        rect(b.x, b.y, b.w, b.h, 6);
        drawingContext.shadowBlur = 0; noStroke();
        label(d.label + ' — something stirs', b.x + b.w / 2, Math.max(fs(1), b.y - fs(.9)), fs(.85), [255, 190, 190]);
    }
    label(detections.length ? 'Click or tap a glowing object to commune' : 'Scanning the room…', W / 2, fs(1.6), fs(1));
}

// A click or a tap wakes the spirit in the object under it (the smallest, if boxes overlap)
function tapAt(x, y) {
    if (state != 'scan') return;
    const hit = detections.map(d => ({ d, b: boxOf(d) }))
        .filter(({ b }) => x > b.x - 14 && x < b.x + b.w + 14 && y > b.y - 14 && y < b.y + b.h + 14)
        .sort((p, q) => p.b.w * p.b.h - q.b.w * q.b.h)[0];
    if (!hit) return;
    spirit = makeSpirit(hit.d.label, hit.b.x + hit.b.w / 2, hit.b.y + hit.b.h / 2);
    quiet[hit.d.label] = millis() + QUIET;
    detections = []; sealHold = wrongHold = missed = shake = 0;
    setState('summon'); showPanel();
    setStatus('A ' + RARITY[spirit.rarity].name.toLowerCase() + ' spirit rises from the ' + spirit.from + '…');
}

// Where the spirit floats: a slow drift, plus a wobble that dies away after a wrong seal
function spiritHome() {
    return {
        x: W / 2 + Math.sin(millis() / 900) * W * .02 + Math.sin(millis() / 28) * shake * .5,
        y: H * .36 + Math.sin(millis() / 600) * H * .015,
        size: Math.min(W, H) * .5 * RARITY[spirit.rarity].scale,
    };
}

// Summon: the spirit pours out of the object and rises to the middle
function updateSummon() {
    const t = Math.min(1, stateT / 1400), e = 1 - (1 - t) ** 3, home = spiritHome();
    noFill(); strokeWeight(2);
    for (let i = 0; i < 3; i++) {
        const r = (stateT / 700 + i / 3) % 1;
        stroke(238, 85, 85, 200 * (1 - r));
        circle(spirit.x0, spirit.y0, r * Math.min(W, H) * .6);
    }
    noStroke();
    drawSpirit(spirit, lerp(spirit.x0, home.x, e), lerp(spirit.y0, home.y, e), home.size * e, e);
    if (t >= 1) { setState('tame'); setStatus('Tame it: make each seal in order and hold it.'); }
}

// Tame: make the seals in order before the spirit's patience runs out
function updateTame(dt) {
    const sp = spirit, home = spiritHome();
    shake = Math.max(0, shake - dt * .02);
    sp.patience -= dt / 1000;
    if (lastSeen == sp.seq[sp.idx]) { sealHold += dt; wrongHold = missed = 0; }
    else {
        if ((missed += dt) > GRACE) sealHold = Math.max(0, sealHold - dt * 2); // a dropped reading is forgiven briefly
        wrongHold = lastSeen && lastSeen != sp.seq[sp.idx - 1] ? wrongHold + dt : 0; // the seal just made doesn't count
        if (wrongHold > HOLD_WRONG) { // a wrong seal frightens it
            wrongHold = 0; sp.patience -= 1 + sp.timid / 50; shake = 14;
            setStatus('Wrong seal — the ' + sp.name + ' flinches.');
        }
    }
    if (sealHold >= HOLD_SEAL) {
        sealHold = missed = 0;
        if (++sp.idx >= sp.seq.length) return tame(sp);
    }
    if (sp.patience <= 0) {
        fledCount++; setState('fled'); showPanel();
        return setStatus('The ' + sp.name + ' slipped back into the ' + sp.from + '.');
    }
    drawSpirit(sp, home.x, home.y, home.size, 1);
    drawEncounterHud();
}

function drawEncounterHud() { // name, patience bar and the seals in order
    const sp = spirit, rare = RARITY[sp.rarity];
    label(sp.name, W / 2, fs(1.5), fs(1.5), rare.eye);
    label(rare.name + ' · from the ' + sp.from, W / 2, fs(3), fs(.8), [163, 148, 148]);
    const bw = Math.min(W * .5, 320), bx = W / 2 - bw / 2, by = fs(4), left = constrain(sp.patience / sp.patienceMax, 0, 1);
    fill(0, 0, 0, 150); rect(bx, by, bw, 7, 4);
    fill(left < .3 ? color(238, 85, 85) : color(232, 222, 222)); rect(bx, by, bw * left, 7, 4);
    const n = sp.seq.length, g = constrain(W / (n + 2.2), 40, 76), gap = g * .18;
    const total = n * g + (n - 1) * gap, y = H - 78 - g - fs(1.2);
    for (let i = 0; i < n; i++) {
        const x = W / 2 - total / 2 + i * (g + gap), done = i < sp.idx, now = i == sp.idx;
        fill(10, 8, 10, now ? 210 : 140);
        stroke(now ? color(238, 85, 85) : color(90, 58, 58)); strokeWeight(now ? 2 : 1);
        rect(x, y, g, g, 8); noStroke();
        drawingContext.globalAlpha = done ? .3 : now ? 1 : .7;
        image(glyphs[sp.seq[i]], x + g * .06, y + g * .06, g * .88, g * .88);
        drawingContext.globalAlpha = 1;
        if (done) label('✓', x + g / 2, y + g / 2, g * .5, [120, 220, 120]);
        if (now && sealHold > 0) { fill(238, 85, 85, 200); rect(x, y + g - 6, g * Math.min(1, sealHold / HOLD_SEAL), 6, 3); }
    }
    label(SEALS[sp.seq[sp.idx]].name + ' — hold', W / 2, y + g + fs(.8), fs(.9));
}

function tame(sp) {
    setState('tamed');
    setStatus('The ' + sp.name + ' is yours.');
    sp.rec = { fam: sp.fam, rarity: sp.rarity, seed: sp.seed, name: sp.name, from: sp.from, friend: sp.friend, timid: sp.timid };
    grimoire.push(sp.rec); saveGrimoire();
    sp.landX = W / 2; // it joins the row only when it has landed (updateLeaving)
    showPanel();
}

// Tamed: the spirit shrinks down into the row at the bottom and stays. Fled: it fades away.
function updateLeaving() {
    const t = Math.min(1, stateT / 1700), home = spiritHome();
    if (state == 'tamed') {
        const e = t * t, s = followerSize(spirit.rarity);
        drawSpirit(spirit, lerp(home.x, spirit.landX, e), lerp(home.y, H - 16 - s / 2, e), lerp(home.size, s, e), 1);
        label('TAMED', W / 2, H * .5, fs(2.4), RARITY[spirit.rarity].eye);
        if (t >= 1) addFollower({ ...spirit.rec, tex: spirit.tex }, spirit.landX);
    } else {
        drawSpirit(spirit, home.x, home.y - t * H * .12, home.size * (1 - t * .3), 1 - t);
        label('It slipped away…', W / 2, H * .5, fs(1.6), [163, 148, 148]);
        if (t >= 1) spirit.tex.remove();
    }
    if (t < 1) return;
    spirit = null; setState('scan'); showPanel(); scanStatus();
}

function setState(s) {
    state = s; stateT = 0;
    if (s == 'summon' || s == 'scan') readHands(s == 'summon');
}

// The tracked hand as faint bones; under the wrist a bar per finger (tall = straight) and the seal read
function drawHand() {
    const hand = hands[0];
    if (camOn && handPose && state != 'scan') label('hand ' + handRate + '/s', 16, H - 86, fs(.7), [163, 148, 148], LEFT); // readings a second
    if (hand && camOn) {
        const pt = i => v2c(hand.keypoints[i].x, hand.keypoints[i].y);
        stroke(232, 222, 222, 150); strokeWeight(2);
        for (const c of [[0, 1, 2, 3, 4], [0, 5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16], [0, 17, 18, 19, 20], [5, 9, 13, 17]])
            for (let i = 1; i < c.length; i++) line(...pt(c[i - 1]), ...pt(c[i]));
        noStroke();
        const [x, y0] = pt(0), y = Math.min(H - 100, y0 + fs(1.2));
        fingerMem.forEach((v, i) => {
            const h = 6 + v * 16;
            fill(v == 1 ? color(255, 190, 190) : color(120, 100, 104));
            rect(x - 23 + i * 12, y + 22 - h, 9, h, 2);
        });
        if (lastSeen) label(SEALS[lastSeen].name, x, y + 22 + fs(.8), fs(.8), [255, 190, 190]);
    } else if (keySeal && started && state != 'tame') label(SEALS[keySeal].name + ' (keyboard)', W / 2, H - 92, fs(.8), [255, 190, 190]);
}

// ───────────────────────── Followers and the grimoire ─────────────────────────

// Up to ten tamed spirits walk along the bottom, the newest in front, chasing the hand
function addFollower(rec, x) {
    rec.tex ||= makeTexture(rec);
    followers.unshift({ sp: rec, x: x || W / 2, phase: Math.random() * 6 });
    while (followers.length > 10) followers.pop().sp.tex.remove();
}
const followerSize = rarity => constrain(W / 10, 56, 76) * (.8 + rarity * .15);

function updateFollowers(dt) {
    if (!followers.length) return;
    const lead = hands[0] && camOn ? v2c(hands[0].keypoints[9].x, 0)[0] : W / 2 + Math.sin(millis() / 2600) * W * .3;
    const size = followerSize(0) / .8, gap = size * .78;
    followers.forEach((f, i) => {
        const goal = i == 0 ? lead : followers[i - 1].x - gap * Math.sign(followers[0].x - followers.at(-1).x || 1);
        f.x += (constrain(goal, size / 2, W - size / 2) - f.x) * Math.min(1, dt * .004);
        const s = followerSize(f.sp.rarity);
        drawSpirit(f.sp, f.x, H - 16 - s / 2 + Math.sin(millis() / 300 + f.phase) * 3, s, 1);
    });
}

function loadGrimoire() { // saved in the browser
    try { grimoire = JSON.parse(localStorage.getItem(STORE)) || [] } catch (e) { grimoire = [] }
    grimoire.slice(-10).forEach(r => addFollower({ ...r }));
}
function saveGrimoire() { try { localStorage.setItem(STORE, JSON.stringify(grimoire)) } catch (e) { } }
function releaseAll() { // the Release All button
    followers.forEach(f => f.sp.tex.remove());
    grimoire = []; followers = [];
    saveGrimoire(); showPanel();
}

// ───────────────────────── Page: side panel and charts ─────────────────────────

const bar = (name, v, note) => `<div class="stat"><span>${name}</span><div class="meter"><i style="width:${v}%"></i></div><span class="num">${v}</span></div>` +
    (note ? `<div class="stat-note">${note}</div>` : '');

function showPanel() {
    const sp = spirit, fam = sp && familyByKey(sp.fam), rare = sp && RARITY[sp.rarity];
    $('spirit').innerHTML = !sp ? '<span class="mut">No spirit here yet.</span>' :
        `<div class="sp-name r${sp.rarity}">${sp.name}</div><div class="mut">${rare.name} · ${fam.title} · from the ${sp.from}</div>` +
        bar('Family friendliness', fam.friend) +
        bar('Its friendliness', sp.friend, sp.friend >= 65 ? 'Patient: it waits a long time.' : sp.friend < 35 ? 'Hostile: it leaves quickly.' : 'Wary.') +
        bar('Timidity', sp.timid, sp.timid > 66 ? 'Very timid: +2 seals.' : sp.timid > 33 ? 'Timid: +1 seal.' : 'Bold: no extra seals.') +
        `<div class="stat-note">Seals needed: <b>${sp.seq.length}</b> (2 + ${rare.extra} rarity + ${sp.seq.length - 2 - rare.extra} timidity)</div>`;
    $('tally').textContent = `${grimoire.length} tamed · ${fledCount} fled`;
    $('grimoire').innerHTML = grimoire.length ? grimoire.slice().reverse().map(r =>
        `<div class="g-row"><span class="r${r.rarity}">${r.name}</span><span class="mut">${RARITY[r.rarity].name}, ${r.from}</span></div>`).join('')
        : '<span class="mut">Empty. Tame a spirit and it will follow you.</span>';
}

// A framed portrait of a spirit for the bestiary, in the style of the Week 7 icons
function portrait(sp) {
    const S = 150, pg = createGraphics(S, S);
    pg.pixelDensity(1); pg.background(122, 106, 112); pg.noStroke();
    for (let i = 0; i < 60; i++) {
        const a = random(TWO_PI), r = S * random(.42, .7);
        pg.fill(40, 34, 38, 26);
        pg.ellipse(S / 2 + Math.cos(a) * r, S / 2 + Math.sin(a) * r, random(30, 70), random(30, 70));
    }
    const tex = makeTexture(sp), size = S * .86 * RARITY[sp.rarity].scale / 1.2 + 10;
    pg.image(tex, S / 2 - size / 2, S / 2 - size / 2 + 4, size, size);
    drawFace(pg, sp, S / 2, S / 2 + 4, size, false);
    tex.remove();
    pg.stroke(12, 10, 12); pg.strokeWeight(4);
    pg.line(0, 5, S, 4); pg.line(0, S - 5, S, S - 4); pg.line(5, 0, 6, S); pg.line(S - 5, 0, S - 6, S);
    const url = pg.elt.toDataURL();
    pg.remove();
    return url;
}

// The seal chart and the bestiary below the game
function buildCharts() {
    $('seals').innerHTML = TAMING.map((k, i) => `<div class="seal"><img src="${glyphs[k].elt.toDataURL()}" alt="">` +
        `<div><b>${SEALS[k].name}</b> <span class="mut">key ${i + 1}</span><br><span class="mut">${SEALS[k].how}</span></div></div>`).join('');
    $('bestiary').innerHTML = FAMILIES.map((fam, n) =>
        `<div class="chart-row"><div><div class="chart-cat">${fam.title}</div>` +
        `<div class="chart-note">${fam.objects.join(', ')}<br>Friendliness ${fam.friend}</div></div><div class="chart-items">` +
        RARITY.map((rare, r) => `<div class="chart-item"><img src="${portrait({ fam: fam.key, rarity: r, seed: 1000 + n * 10 + r, friend: fam.friend })}" alt="${fam.names[r]}">` +
            `<span class="r${r}">${fam.names[r]}</span><span class="mut">${rare.name} · ${rare.chance * 100}%</span></div>`).join('') + '</div></div>').join('');
}
