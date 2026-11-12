// EXORCISM — tame the spirits hiding in household objects.
// The camera (ml5 objectDetection, COCO-SSD) finds objects in the room; each
// kind of object houses one family of spirit. A click or a tap on the object
// wakes the spirit, and a single hand (ml5 handPose) tames it with a sequence
// of seals.

// ───────────────────────── Data ─────────────────────────

// The five taming seals
const SEALS = {
    sword: { name: 'Sword Seal', how: 'Index and middle finger straight and pressed together; the rest curled.' },
    horns: { name: 'Horned Seal', how: 'Index and little finger straight; middle and ring curled.' },
    ring: { name: 'Ring Seal', how: 'Index and middle finger bent together to meet the thumb in a circle; ring and little finger curled.' },
    thread: { name: 'Thread Seal', how: 'Only the little finger straight; the rest curled.' },
    trident: { name: 'Trident Seal', how: 'Index, middle and ring finger straight and spread apart; the rest curled.' },
};
const TAMING = Object.keys(SEALS);

// Rarity: chance, look and how many extra seals it asks for
const RARITY = [
    { name: 'Common', chance: 0.6, eye: [235, 50, 45], scale: 0.85, extra: 0 },
    { name: 'Uncommon', chance: 0.3, eye: [255, 176, 60], scale: 1, extra: 1 },
    { name: 'Rare', chance: 0.1, eye: [150, 230, 255], scale: 1.2, extra: 2 },
];

// Spirit families. One family per kind of object; the family never changes
// with rarity, only its look and name do.
//   friend: how friendly the whole family is to humans (0–100)
//   lumps:  the body, as fuzzy blobs [x, y, rx, ry] in a −1…1 box (y down)
//   eyes / mouthY / top: where the face and the top of the head are
const FAMILIES = [
    {
        key: 'water', title: 'Water spirits', objects: ['bottle', 'cup', 'wine glass', 'bowl', 'vase'], friend: 55,
        names: ['Drip', 'Undertow', 'Drowned King'], body: [14, 12, 14],
        lumps: [[0, -.55, .18, .25], [0, -.2, .38, .35], [0, .25, .55, .45], [-.45, .62, .14, .2], [.1, .72, .12, .22], [.5, .6, .1, .16]],
        eyes: [[-.17, -.15], [.17, -.15]], mouthY: .12, top: -.8,
    },
    {
        key: 'sheet', title: 'Sheet ghosts', objects: ['bed', 'couch'], friend: 70,
        names: ['Shroudling', 'Linen Wraith', 'Pale Matron'], body: [206, 196, 200], face: 'hollow',
        lumps: [[0, -.35, .48, .42], [0, .15, .55, .5], [-.42, .62, .16, .2], [-.14, .68, .16, .2], [.14, .68, .16, .2], [.42, .62, .16, .2]],
        eyes: [[-.18, -.35], [.18, -.35]], mouthY: -.05, top: -.77,
    },
    {
        key: 'screen', title: 'Screen phantoms', objects: ['tv', 'laptop', 'cell phone', 'keyboard', 'mouse', 'remote'], friend: 35,
        names: ['Flicker', 'Static', 'Dead Channel'], body: [14, 12, 14],
        lumps: [[0, -.1, .62, .45, 'box'], [-.3, .55, .1, .2], [.3, .55, .1, .2], [-.25, -.7, .04, .2], [.25, -.7, .04, .2]],
        eyes: [[-.24, -.18], [.24, -.18]], mouthY: .1, top: -.55,
    },
    {
        key: 'book', title: 'Book whispers', objects: ['book'], friend: 60,
        names: ['Murmur', 'Marginalia', 'The Unread'], body: [14, 12, 14],
        lumps: [[0, 0, .14, .6], [-.42, -.1, .36, .42], [.42, -.1, .36, .42], [0, .6, .2, .15]],
        eyes: [[-.4, -.15], [.4, -.15]], mouthY: .2, top: -.6,
    },
    {
        key: 'plant', title: 'Thornlings', objects: ['potted plant', 'banana', 'apple', 'orange'], friend: 75,
        names: ['Sprout-Thing', 'Thornling', 'Rot Bloom'], body: [14, 12, 14],
        lumps: [[0, .2, .48, .42], [0, .62, .34, .16], [-.3, -.4, .1, .32], [0, -.5, .1, .36], [.3, -.4, .1, .32], [-.55, -.1, .2, .08], [.55, -.1, .2, .08]],
        eyes: [[-.18, .12], [.18, .12]], mouthY: .38, top: -.25,
    },
    {
        key: 'chair', title: 'Sitters', objects: ['chair', 'bench'], friend: 50,
        names: ['Sitter', 'Long Sitter', 'The One Who Waits'], body: [14, 12, 14],
        lumps: [[0, -.45, .4, .35], [0, .1, .62, .28], [-.48, .55, .09, .3], [.48, .55, .09, .3], [-.2, .55, .07, .25], [.2, .55, .07, .25]],
        eyes: [[-.15, -.45], [.15, -.45]], mouthY: -.22, top: -.8,
    },
    {
        key: 'clock', title: 'Hour-eaters', objects: ['clock'], friend: 30,
        names: ['Tick', 'Hour-Eater', 'Midnight'], body: [14, 12, 14], face: 'cyclops',
        lumps: [[0, 0, .6, .6], [-.35, .65, .1, .18], [.35, .65, .1, .18], [-.5, -.5, .14, .14], [.5, -.5, .14, .14]],
        eyes: [[0, -.08]], mouthY: .32, top: -.6,
    },
    {
        key: 'blade', title: 'Blade imps', objects: ['scissors', 'knife', 'fork', 'spoon'], friend: 15,
        names: ['Snip', 'Carver', 'The Edge'], body: [14, 12, 14],
        lumps: [[0, .2, .3, .5], [-.22, -.5, .08, .42], [.22, -.5, .08, .42], [0, .7, .4, .1]],
        eyes: [[-.12, .05], [.12, .05]], mouthY: .3, top: -.35,
    },
    {
        key: 'toy', title: 'Hollow toys', objects: ['teddy bear'], friend: 85,
        names: ['Button-Eye', 'Hollow Bear', 'Old Favourite'], body: [14, 12, 14],
        lumps: [[0, -.25, .42, .38], [-.38, -.6, .15, .15], [.38, -.6, .15, .15], [0, .38, .48, .4], [-.5, .2, .14, .22], [.5, .2, .14, .22]],
        eyes: [[-.16, -.28], [.16, -.28]], mouthY: -.05, top: -.63,
    },
    {
        key: 'bag', title: 'Hoarders', objects: ['backpack', 'handbag', 'suitcase', 'umbrella'], friend: 45,
        names: ['Pocketling', 'Hoarder', 'The Bottomless'], body: [14, 12, 14],
        lumps: [[0, .1, .62, .55], [0, -.5, .25, .12], [-.6, .3, .12, .25], [.6, .3, .12, .25]],
        eyes: [[-.22, -.08], [.22, -.08]], mouthY: .28, top: -.5,
    },
];
function familyOf(label) { return FAMILIES.find(f => f.objects.includes(label)) }
function familyByKey(key) { return FAMILIES.find(f => f.key == key) }

// ───────────────────────── State ─────────────────────────

const TEX = 256, UNIT = 100;       // spirit texture size; px per unit in it
const HOLD_SEAL = 600, HOLD_WRONG = 900; // ms a gesture must be held
const QUIET = 12000;               // ms an object stays quiet after an encounter
const STORE = 'exocrism-grimoire';

let W = 960, H = 720;
let vid = null, mirror = true, facing = 'user', camOn = false, started = false;
let handPose = null, detector = null, hands = [];
let detections = [];               // spirit-bearing objects seen right now
let quiet = {};                    // label -> time until it can stir again
let state = 'idle';                // idle | scan | summon | tame | tamed | fled
let stateT = 0;                    // ms in the current state
let spirit = null;                 // the spirit being met
let sealHold = 0, wrongHold = 0, shake = 0;
let keySeal = null;                // practice mode: a seal held on the keyboard
let fakeIdx = 0;
let grimoire = [];                 // every tamed spirit (saved in the browser)
let followers = [];                // the latest ones, walking along the bottom
let fledCount = 0;
let glyphs = {};                   // seal icons (p5.Graphics)
let lastSeen = null;               // the seal the hand is making right now

// ───────────────────────── Setup ─────────────────────────

function setup() {
    fitSize();
    const cnv = createCanvas(W, H);
    cnv.parent('cv');
    // a click or a tap on a glowing object wakes its spirit
    cnv.elt.addEventListener('pointerdown', e => {
        const r = cnv.elt.getBoundingClientRect();
        tapAt((e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height);
    });
    pixelDensity(Math.min(window.devicePixelRatio || 1, 2));
    textFont('Georgia');
    // phones look at the room with the back camera; laptops only have the front one
    facing = window.matchMedia('(pointer: coarse)').matches ? 'environment' : 'user';

    for (const k in SEALS) glyphs[k] = makeGlyph(k);
    loadGrimoire();
    buildCharts();
    showPanel();
    setStatus('Press “Begin the Séance” to wake the camera.');
}

// The canvas fills its column: landscape on a wide screen, portrait on a phone
function fitSize() {
    const box = document.getElementById('cv');
    W = Math.max(280, Math.min(box.clientWidth || 960, 960));
    H = Math.round(W < 560 ? W * 4 / 3 : W * 3 / 4);
    H = Math.min(H, Math.max(360, window.innerHeight - 24));
}
function windowResized() {
    fitSize();
    resizeCanvas(W, H);
}

// ───────────────────────── Camera and models ─────────────────────────

// Called by the Begin button (browsers only open the camera after a click)
async function begin() {
    if (started) return;
    started = true;
    document.getElementById('btnBegin').disabled = true;
    setStatus('Opening the camera…');
    await openCamera();
    state = 'scan';
    stateT = 0;
    if (!camOn) {
        setStatus('No camera — practice mode. Press Space to conjure an object, click it, then hold 1–5 for the seals.');
        return;
    }
    document.getElementById('btnFlip').disabled = false;
    // With p5 2.x, ml5 returns a promise for each model, so both are awaited.
    // The object seer comes first: it is the one the scan needs.
    try {
        setStatus('Summoning the object seer (ml5 objectDetection)…');
        detector = await ml5.objectDetection('cocossd');
        scanLoop();
    } catch (e) {
        console.error(e);
        setStatus('The object seer could not load (' + e.message + '). Press Space to conjure an object instead.');
    }
    try {
        if (detector) setStatus('Scanning the room… (still summoning the hand reader, ml5 handPose)');
        handPose = await ml5.handPose({ maxHands: 1 });
        if (state != 'scan') readHands(true);
        if (detector && state == 'scan') setStatus('Scanning the room… click or tap an object that glows red.');
    } catch (e) {
        console.error(e);
        setStatus('The hand reader could not load (' + e.message + '). Hold keys 1–5 for the seals instead.');
    }
}

// Only one model runs at a time, so a phone can keep up: the object seer
// while scanning, the hand reader while a spirit is out
function readHands(on) {
    if (!handPose) return;
    if (on) handPose.detectStart(vid, r => { if (state != 'scan') hands = r });
    else handPose.detectStop();
    hands = [];
}

async function openCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: { facingMode: facing, width: { ideal: 640 }, height: { ideal: 480 } },
        });
        if (!vid) {
            vid = document.createElement('video');
            vid.playsInline = true;
            vid.muted = true;
            vid.style.display = 'none';
            document.body.appendChild(vid);
            // handPose measures the picture by the element's width and height
            // (not videoWidth), so they must follow the camera, also when a
            // phone is turned
            vid.addEventListener('resize', sizeVideo);
        }
        vid.srcObject = stream;
        await vid.play();
        sizeVideo();
        // a back camera shows the room as it is; a front camera is mirrored
        const s = stream.getVideoTracks()[0].getSettings();
        mirror = s.facingMode != 'environment';
        camOn = true;
    } catch (e) {
        console.warn('camera', e);
        camOn = false;
    }
}

function sizeVideo() {
    vid.width = vid.videoWidth;
    vid.height = vid.videoHeight;
}

// Switch between the front and back camera (phones)
async function flipCamera() {
    if (!camOn) return;
    vid.srcObject.getTracks().forEach(t => t.stop());
    facing = facing == 'user' ? 'environment' : 'user';
    hands = [];
    detections = [];
    await openCamera();
}

// Object detection is heavy, so it only runs while scanning, a few times a second
async function scanLoop() {
    while (true) {
        if (state == 'scan' && camOn && vid.readyState >= 2) {
            try {
                const found = await detector.detect(vid);
                const now = millis();
                detections = found
                    .filter(d => d.confidence > 0.45 && familyOf(d.label) && !(quiet[d.label] > now))
                    .concat(detections.filter(d => d.fake && d.until > now));
            } catch (e) { console.warn(e) }
        }
        await new Promise(r => setTimeout(r, 300));
    }
}

// Video pixel -> canvas pixel (the video covers the canvas, mirrored for a front camera)
function vScale() { return Math.max(W / vid.videoWidth, H / vid.videoHeight) }
function v2c(x, y) {
    const s = vScale();
    const cx = (W - vid.videoWidth * s) / 2 + x * s, cy = (H - vid.videoHeight * s) / 2 + y * s;
    return [mirror ? W - cx : cx, cy];
}
// A detection's box on the canvas
function boxOf(d) {
    if (d.fake) return { x: W * .5 - W * .12, y: H * .45 - H * .14, w: W * .24, h: H * .28 };
    const [x1, y1] = v2c(d.x, d.y), [x2, y2] = v2c(d.x + d.width, d.y + d.height);
    return { x: Math.min(x1, x2), y: y1, w: Math.abs(x2 - x1), h: y2 - y1 };
}

// ───────────────────────── Hand seals ─────────────────────────

function dist3(a, b) { return Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0)) }

// How straight each finger is (index, middle, ring, little): 1 = straight,
// 0 = curled, 0.5 = in between. A finger is straight when its tip is far from
// its knuckle compared with the finger's own length, and curled when the tip
// has folded back.
function handPoints(hand) {
    return hand.keypoints3D && hand.keypoints3D.length == 21 ? hand.keypoints3D : hand.keypoints;
}
function readFingers(hand) {
    const k = handPoints(hand);
    return [5, 9, 13, 17].map(m => {
        const r = dist3(k[m], k[m + 3]) / (dist3(k[m], k[m + 1]) + dist3(k[m + 1], k[m + 2]) + dist3(k[m + 2], k[m + 3]));
        return r > 0.85 ? 1 : r < 0.78 ? 0 : 0.5;
    });
}

// Which seal is this hand making? (null if none)
function readSeal(hand) {
    const k = handPoints(hand), palm = dist3(k[0], k[9]);
    const f = readFingers(hand);
    const [I, M, R, P] = f.map(v => v == 1), curl = f.map(v => v == 0);

    // Ring Seal: thumb tip meets the index tip, middle tip beside it
    if (dist3(k[4], k[8]) < palm * 0.38 && dist3(k[8], k[12]) < palm * 0.45 && curl[2] && curl[3]) return 'ring';
    if (I && M && R && curl[3]) return 'trident';
    if (I && M && curl[2] && curl[3] && dist3(k[8], k[12]) < palm * 0.42) return 'sword';
    if (I && P && curl[1] && curl[2]) return 'horns';
    if (P && curl[0] && curl[1] && curl[2]) return 'thread';
    return null;
}

// The seal being made right now: the keyboard (practice mode) or the hand
function currentSeal() {
    if (keySeal) return keySeal;
    if (hands[0]) return readSeal(hands[0]);
    return null;
}

// Practice mode: Space conjures an object (click it to commune), 1–5 are
// the seals, so one hand can reach them all. The keys are read by their place on the keyboard (e.code), so
// they also work while a Chinese or other input method is switched on.
window.addEventListener('keydown', e => {
    if (!started || e.target.closest && e.target.closest('button, select, input, a')) return;
    const i = ['1', '2', '3', '4', '5'].findIndex(n => e.code == 'Digit' + n || e.code == 'Numpad' + n || e.key == n);
    if (i >= 0) keySeal = TAMING[i];
    if (e.code != 'Space' && e.key != ' ') return;
    e.preventDefault(); // Space would scroll the page
    if (state == 'scan') {
        const fam = FAMILIES[fakeIdx++ % FAMILIES.length];
        detections = [{ fake: true, label: fam.objects[0], confidence: 1, until: millis() + 8000 }];
    }
});
window.addEventListener('keyup', () => keySeal = null);

// ───────────────────────── Spirits ─────────────────────────

function rollRarity() {
    const r = Math.random();
    return r < RARITY[0].chance ? 0 : r < RARITY[0].chance + RARITY[1].chance ? 1 : 2;
}

// A new spirit rises from an object.
//   friendliness: around its family's friendliness
//   timidity:     its own; the more timid, the more seals it needs
//   seals:        2 + rarity (0/1/2) + timidity (0/1/2), at most 5
//   patience:     seconds before it flees; friendlier spirits wait longer
function makeSpirit(label, x, y) {
    const fam = familyOf(label), rarity = rollRarity();
    const friend = Math.round(constrain(randomGaussian(fam.friend, 14), 0, 100));
    const timid = Math.round(random(100));
    const steps = constrain(2 + RARITY[rarity].extra + (timid > 66 ? 2 : timid > 33 ? 1 : 0), 2, 5);
    const seq = [];
    while (seq.length < steps) {
        const s = random(TAMING);
        if (s != seq[seq.length - 1]) seq.push(s);
    }
    const patience = steps * lerp(3.5, 7, friend / 100);
    const sp = {
        fam: fam.key, rarity, seed: Math.floor(Math.random() * 1e9), name: fam.names[rarity], from: label,
        friend, timid, seq, idx: 0, patience, patienceMax: patience, x0: x, y0: y,
    };
    sp.tex = makeTexture(sp);
    return sp;
}

// Fuzzy charcoal blob: lots of soft dabs, denser in the middle
function fuzz(pg, cx, cy, rx, ry, col, box) {
    pg.noStroke();
    pg.fill(col[0], col[1], col[2], 235);
    if (box) pg.rect(cx - rx * .92, cy - ry * .92, rx * 1.84, ry * 1.84, 6);
    else pg.ellipse(cx, cy, rx * 1.75, ry * 1.75);
    const n = Math.max(14, rx * ry / 9);
    for (let i = 0; i < n; i++) {
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
        pg.fill(col[0], col[1], col[2], random(30, 80));
        pg.ellipse(x + random(-3, 3), y + random(-3, 3), d, d * random(.7, 1.3));
    }
}

// The spirit's body, drawn once into its own image. Always the same for the
// same seed, so a saved spirit looks the same when the page is opened again.
function makeTexture(sp) {
    const fam = familyByKey(sp.fam), rare = RARITY[sp.rarity], c = TEX / 2;
    const pg = createGraphics(TEX, TEX);
    pg.pixelDensity(1);
    randomSeed(sp.seed);
    const P = (x, y) => [c + x * UNIT, c + y * UNIT];

    // Rare: a cold glow behind the body
    if (sp.rarity == 2) {
        pg.noStroke();
        for (let i = 0; i < 26; i++) {
            pg.fill(rare.eye[0], rare.eye[1], rare.eye[2], 5);
            pg.ellipse(c, c, TEX * (1 - i / 30), TEX * (1 - i / 30));
        }
    }
    for (const [x, y, rx, ry, shape] of fam.lumps) {
        const [px, py] = P(x, y);
        fuzz(pg, px, py, rx * UNIT, ry * UNIT, fam.body, shape == 'box');
    }
    // Uncommon and rare: horns
    if (sp.rarity >= 1) {
        for (const side of [-1, 1]) {
            for (let t = 0; t < 1; t += .12) {
                const [px, py] = P(side * (.2 + t * .22), fam.top + .08 - t * .32);
                fuzz(pg, px, py, (1 - t) * 9 + 3, (1 - t) * 9 + 3, fam.body);
            }
        }
    }
    // Rare: a crown of spikes
    if (sp.rarity == 2) {
        pg.stroke(fam.body[0], fam.body[1], fam.body[2], 230);
        for (let i = -2; i <= 2; i++) {
            const [x1, y1] = P(i * .07, fam.top + .05), [x2, y2] = P(i * .13, fam.top - .2 + Math.abs(i) * .05);
            pg.strokeWeight(5);
            pg.line(x1, y1, x2, y2);
        }
    }
    // Screen phantoms: scan lines
    if (sp.fam == 'screen') {
        pg.stroke(90, 80, 88, 70);
        pg.strokeWeight(1);
        for (let y = -.45; y < .3; y += .07) pg.line(...P(-.52, y), ...P(.52, y));
    }
    // Stray charcoal scratches, like the Week 7 icons
    const light = fam.body[0] > 100;
    pg.strokeWeight(1);
    for (let i = 0; i < 16; i++) {
        const [x, y] = P(random(-.4, .4), random(-.3, .5)), a = random(TWO_PI), l = random(5, 16);
        pg.stroke(light ? 90 : 70, light ? 80 : 60, light ? 86 : 66, 90);
        pg.line(x, y, x + Math.cos(a) * l, y + Math.sin(a) * l);
    }
    randomSeed(Math.random() * 1e9);
    return pg;
}

// The face is drawn live so it can blink. g is the canvas (window) or a
// p5.Graphics; x, y is the spirit's centre and size the width of its image.
function drawFace(g, sp, x, y, size, blink) {
    const fam = familyByKey(sp.fam), col = RARITY[sp.rarity].eye, k = size / TEX * UNIT;
    const ctx = g.drawingContext;
    const mood = sp.friend >= 65 ? 1 : sp.friend < 35 ? -1 : 0; // smile, frown or waver
    const ew = k * (fam.face == 'cyclops' ? .34 : .11);
    // The glow is set straight on the canvas and switched off again at the end.
    // (Not with ctx.save / ctx.restore: p5 remembers the last fill colour and
    // skips setting it again, so restoring an older one behind its back made
    // the next spirit's eyes come out in the wrong colour, or not at all.)
    ctx.shadowColor = `rgb(${col})`;
    ctx.shadowBlur = k * .18;
    g.noStroke();

    for (const [ex, ey] of fam.eyes) {
        const px = x + ex * k, py = y + ey * k;
        if (fam.face == 'hollow') {
            ctx.shadowBlur = 0;
            g.fill(12, 10, 12);
            g.ellipse(px, py, ew * 1.5, blink ? ew * .3 : ew * 2.1);
            if (!blink) { g.fill(...col); g.ellipse(px, py + ew * .2, ew * .45, ew * .45); }
        } else {
            g.fill(...col);
            // hostile spirits narrow their eyes
            g.ellipse(px, py, ew, blink ? ew * .15 : ew * (mood < 0 ? .7 : 1.25));
            if (fam.face == 'cyclops' && !blink) {
                ctx.shadowBlur = 0;
                g.fill(12, 10, 12);
                g.ellipse(px, py, ew * .3, ew * .75);
            }
        }
    }
    // Rare: a third eye
    if (sp.rarity == 2 && fam.face != 'cyclops') {
        ctx.shadowBlur = k * .18;
        g.fill(...col);
        const ey = fam.eyes[0][1] - .17;
        g.ellipse(x, y + ey * k, ew * .75, blink ? ew * .12 : ew * .95);
    }
    // Mouth: a wavering charcoal line that curls with the spirit's mood
    const my = y + fam.mouthY * k, mw = k * (sp.fam == 'bag' ? .3 : .17);
    if (fam.face == 'hollow') {
        ctx.shadowBlur = 0;
        g.fill(12, 10, 12);
        g.ellipse(x, my, mw * .7, mw * (mood > 0 ? .5 : .95));
    } else {
        ctx.shadowBlur = k * .12;
        g.noFill();
        g.stroke(...col);
        g.strokeWeight(Math.max(1.5, k * .035));
        let px, py;
        for (let i = 0; i <= 6; i++) {
            const t = i / 6 * 2 - 1;
            const nx = x + t * mw;
            const ny = my + (1 - t * t) * mood * k * .06 + Math.sin(i * 2.1 + sp.seed) * k * .018;
            if (i) g.line(px, py, nx, ny);
            px = nx; py = ny;
        }
    }
    ctx.shadowBlur = 0;
    g.noStroke();
}

// Draw a spirit on the canvas at x, y with a body `size` px wide
function drawSpirit(sp, x, y, size, alpha) {
    const blink = (frameCount + sp.seed % 200) % 190 < 7;
    drawingContext.globalAlpha = alpha;
    image(sp.tex, x - size / 2, y - size / 2, size, size);
    drawFace(window, sp, x, y, size, blink);
    drawingContext.globalAlpha = 1;
}

// ───────────────────────── Seal icons ─────────────────────────

// A small diagram of a hand: long strokes are straight fingers, stubs are curled ones
function makeGlyph(key) {
    const pg = createGraphics(100, 100);
    pg.stroke(232, 222, 222);
    pg.strokeCap(ROUND);
    pg.noFill();
    const finger = (bx, len, deg) => {
        const a = radians(deg);
        pg.strokeWeight(8);
        pg.line(bx, 54, bx + Math.sin(a) * len, 54 - Math.cos(a) * len);
    };
    const stub = bx => finger(bx, 6, 0);
    const base = [37, 47, 57, 66]; // index, middle, ring, little
    // palm
    pg.strokeWeight(3);
    pg.fill(232, 222, 222, 40);
    pg.rect(31, 54, 41, 36, 9);
    pg.noFill();
    // thumb: folded
    pg.strokeWeight(8);
    if (key != 'ring') pg.line(31, 74, 27, 66);

    if (key == 'sword') { finger(39, 38, 0); finger(47.5, 40, 0); stub(57); stub(66); }
    if (key == 'horns') { finger(37, 36, -8); stub(47); stub(57); finger(66, 28, 12); }
    if (key == 'thread') { stub(37); stub(47); stub(57); finger(66, 30, 10); }
    if (key == 'trident') { finger(37, 34, -20); finger(47, 40, 0); finger(57, 34, 20); stub(66); }
    if (key == 'ring') {
        stub(57); stub(66);
        pg.strokeWeight(7);
        pg.ellipse(36, 38, 27, 27); // index + middle + thumb meet in a circle
        pg.line(31, 74, 26, 50);
    }
    return pg;
}

// ───────────────────────── Game loop ─────────────────────────

function draw() {
    const dt = Math.min(deltaTime, 100);
    stateT += dt;
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

// The camera, turned grey and dusty like the Week 7 icons
function drawRoom() {
    const ctx = drawingContext;
    background(96, 84, 90);
    if (camOn && vid.readyState >= 2) {
        const s = vScale(), w = vid.videoWidth * s, h = vid.videoHeight * s;
        push();
        if (mirror) { translate(W, 0); scale(-1, 1); }
        ctx.drawImage(vid, (W - w) / 2, (H - h) / 2, w, h);
        pop();
        ctx.save(); // fills made straight on the canvas are undone by restore
        ctx.globalCompositeOperation = 'saturation';
        ctx.fillStyle = '#808080';
        ctx.fillRect(0, 0, W, H);
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = 'rgb(158, 134, 144)';
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
    }
    // darkness creeping in from the edges
    const grad = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .25, W / 2, H / 2, Math.max(W, H) * .72);
    grad.addColorStop(0, 'rgba(8,6,8,0.12)');
    grad.addColorStop(1, 'rgba(8,6,8,0.9)');
    ctx.save();
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
}

// A rough charcoal frame, overshooting the corners
function drawFrame() {
    stroke(10, 8, 10);
    strokeWeight(5);
    const m = 7;
    line(0, m, W, m - 1); line(0, H - m, W, H - m + 1);
    line(m, 0, m + 1, H); line(W - m, 0, W - m - 1, H);
    noStroke();
}

function label(str, x, y, size, col, align) {
    textAlign(align || CENTER, CENTER);
    textSize(size);
    fill(0, 0, 0, 170);
    text(str, x + 1.5, y + 1.5);
    fill(...(col || [232, 222, 222]));
    text(str, x, y);
}
function fs(k) { return Math.max(12, W / 46) * k }

function drawTitle() {
    label('EXORCISM', W / 2, H * .4, fs(2.6), [238, 85, 85]);
    label('Something lives in every object in this room.', W / 2, H * .4 + fs(2.6), fs(1));
}

// Scan: every object that houses a spirit glows; a click or a tap wakes it
function updateScan() {
    const now = millis();
    detections = detections.filter(d => !d.fake || d.until > now);

    for (const d of detections) {
        const b = boxOf(d), pulse = .6 + .4 * Math.sin(now / 260);
        const ctx = drawingContext;
        ctx.shadowColor = 'rgb(238, 85, 85)';
        ctx.shadowBlur = 22 * pulse + 8;
        fill(238, 85, 85, 26 * pulse);
        stroke(238, 85, 85);
        strokeWeight(3);
        rect(b.x, b.y, b.w, b.h, 6);
        ctx.shadowBlur = 0;
        noStroke();
        label(d.label + ' — something stirs', b.x + b.w / 2, Math.max(fs(1), b.y - fs(.9)), fs(.85), [255, 190, 190]);
    }
    label(!detections.length ? 'Scanning the room…' : 'Click or tap a glowing object to commune', W / 2, fs(1.6), fs(1));
}

// A click or a tap on the canvas: wake the spirit in the object under it
// (the smallest one, if boxes overlap). Leaving it alone lets it sleep.
function tapAt(x, y) {
    if (state != 'scan') return;
    const pad = 14;
    const hit = detections
        .map(d => ({ d, b: boxOf(d) }))
        .filter(({ b }) => x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad)
        .sort((p, q) => p.b.w * p.b.h - q.b.w * q.b.h)[0];
    if (!hit) return;
    spirit = makeSpirit(hit.d.label, hit.b.x + hit.b.w / 2, hit.b.y + hit.b.h / 2);
    quiet[hit.d.label] = millis() + QUIET;
    detections = [];
    sealHold = wrongHold = shake = 0;
    setState('summon');
    showPanel();
    setStatus('A ' + RARITY[spirit.rarity].name.toLowerCase() + ' spirit rises from the ' + spirit.from + '…');
}

// Where the spirit floats while it is being tamed, and how big it is
function spiritHome() {
    const sp = spirit;
    const size = Math.min(W, H) * .5 * RARITY[sp.rarity].scale;
    return {
        // a slow drift; `shake` adds a quick wobble that dies away after a wrong seal
        x: W / 2 + Math.sin(millis() / 900) * W * .02 + Math.sin(millis() / 28) * shake * .5,
        y: H * .36 + Math.sin(millis() / 600) * H * .015,
        size,
    };
}

// Summon: the spirit pours out of the object and rises to the middle
function updateSummon() {
    const t = Math.min(1, stateT / 1400), e = 1 - Math.pow(1 - t, 3), home = spiritHome();
    noFill();
    for (let i = 0; i < 3; i++) {
        const r = ((stateT / 700 + i / 3) % 1);
        stroke(238, 85, 85, 200 * (1 - r));
        strokeWeight(2);
        circle(spirit.x0, spirit.y0, r * Math.min(W, H) * .6);
    }
    noStroke();
    drawSpirit(spirit, lerp(spirit.x0, home.x, e), lerp(spirit.y0, home.y, e), home.size * e, e);
    if (t >= 1) {
        setState('tame');
        setStatus('Tame it: make each seal in order and hold it.');
    }
}

// Tame: make the seals in order before the spirit's patience runs out
function updateTame(dt) {
    const sp = spirit, need = sp.seq[sp.idx], prev = sp.seq[sp.idx - 1], home = spiritHome();
    shake = Math.max(0, shake - dt * .02);
    sp.patience -= dt / 1000;

    if (lastSeen == need) {
        sealHold += dt;
        wrongHold = 0;
    } else {
        sealHold = Math.max(0, sealHold - dt * 2);
        // a wrong seal frightens it (the seal just finished doesn't count)
        if (lastSeen && lastSeen != prev) wrongHold += dt;
        else wrongHold = 0;
        if (wrongHold > HOLD_WRONG) {
            wrongHold = 0;
            sp.patience -= 1 + sp.timid / 50;
            shake = 14;
            setStatus('Wrong seal — the ' + sp.name + ' flinches.');
        }
    }
    if (sealHold >= HOLD_SEAL) {
        sealHold = 0;
        sp.idx++;
        if (sp.idx >= sp.seq.length) {
            tame(sp);
            return;
        }
    }
    if (sp.patience <= 0) {
        fledCount++;
        setState('fled');
        setStatus('The ' + sp.name + ' slipped back into the ' + sp.from + '.');
        showPanel();
        return;
    }

    drawSpirit(sp, home.x, home.y, home.size, 1);
    drawEncounterHud(home);
}

function drawEncounterHud(home) {
    const sp = spirit, rare = RARITY[sp.rarity];
    label(sp.name, W / 2, fs(1.5), fs(1.5), rare.eye);
    label(rare.name + ' · from the ' + sp.from, W / 2, fs(3), fs(.8), [163, 148, 148]);

    // patience
    const bw = Math.min(W * .5, 320), bx = W / 2 - bw / 2, by = fs(4);
    fill(0, 0, 0, 150);
    rect(bx, by, bw, 7, 4);
    const left = constrain(sp.patience / sp.patienceMax, 0, 1);
    fill(left < .3 ? color(238, 85, 85) : color(232, 222, 222));
    rect(bx, by, bw * left, 7, 4);

    // the seals, in order
    const n = sp.seq.length, g = constrain(W / (n + 2.2), 40, 76), gap = g * .18;
    const total = n * g + (n - 1) * gap, y = H - 78 - g - fs(1.2);
    for (let i = 0; i < n; i++) {
        const x = W / 2 - total / 2 + i * (g + gap), done = i < sp.idx, now = i == sp.idx;
        fill(10, 8, 10, now ? 210 : 140);
        stroke(now ? color(238, 85, 85) : color(90, 58, 58));
        strokeWeight(now ? 2 : 1);
        rect(x, y, g, g, 8);
        noStroke();
        drawingContext.globalAlpha = done ? .3 : now ? 1 : .7;
        image(glyphs[sp.seq[i]], x + g * .06, y + g * .06, g * .88, g * .88);
        drawingContext.globalAlpha = 1;
        if (done) label('✓', x + g / 2, y + g / 2, g * .5, [120, 220, 120]);
        if (now && sealHold > 0) {
            fill(238, 85, 85, 200);
            rect(x, y + g - 6, g * Math.min(1, sealHold / HOLD_SEAL), 6, 3);
        }
    }
    label(SEALS[sp.seq[sp.idx]].name + ' — hold', W / 2, y + g + fs(.8), fs(.9));
}

function tame(sp) {
    setState('tamed');
    setStatus('The ' + sp.name + ' is yours.');
    const rec = { fam: sp.fam, rarity: sp.rarity, seed: sp.seed, name: sp.name, from: sp.from, friend: sp.friend, timid: sp.timid };
    grimoire.push(rec);
    saveGrimoire();
    // it joins the row at the bottom only when it has landed there (updateLeaving)
    sp.rec = rec;
    sp.landX = W / 2;
    showPanel();
}

// Tamed: the spirit itself shrinks down into the row at the bottom and stays
// there as a follower. Fled: it fades away.
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
    }
    if (t >= 1) {
        if (state == 'fled') spirit.tex.remove();
        spirit = null;
        setState('scan');
        showPanel();
        setStatus(camOn && detector ? 'Scanning the room… click or tap an object that glows red.' : 'Practice mode: press Space to conjure an object, then click it.');
    }
}

function setState(s) {
    state = s;
    stateT = 0;
    if (s == 'summon') readHands(true);
    if (s == 'scan') readHands(false);
}

// The tracked hand, as faint bones, with the seal it is making
function drawHand() {
    const hand = hands[0];
    if (hand && camOn) {
        const pt = i => v2c(hand.keypoints[i].x, hand.keypoints[i].y);
        stroke(232, 222, 222, 150);
        strokeWeight(2);
        for (const chain of [[0, 1, 2, 3, 4], [0, 5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16], [0, 17, 18, 19, 20], [5, 9, 13, 17]]) {
            for (let i = 1; i < chain.length; i++) line(...pt(chain[i - 1]), ...pt(chain[i]));
        }
        noStroke();
        // What the game reads, under the wrist: a bar for each finger (index
        // to little) — tall = straight, short = curled — and the seal's name
        const [x, y0] = pt(0), y = Math.min(H - 100, y0 + fs(1.2)), f = readFingers(hand);
        f.forEach((v, i) => {
            const h = 6 + v * 16;
            fill(v == 1 ? color(255, 190, 190) : v == 0 ? color(120, 100, 104) : color(190, 150, 150));
            rect(x - 23 + i * 12, y + 22 - h, 9, h, 2);
        });
        if (lastSeen) label(SEALS[lastSeen].name, x, y + 22 + fs(.8), fs(.8), [255, 190, 190]);
    } else if (keySeal && started && state != 'tame') {
        label(SEALS[keySeal].name + ' (keyboard)', W / 2, H - 92, fs(.8), [255, 190, 190]);
    }
}

// ───────────────────────── Followers ─────────────────────────

// Tamed spirits walk in a line along the bottom, the newest in front, chasing
// the hand (or wandering when there is no hand)
function addFollower(rec, x) {
    if (!rec.tex) rec.tex = makeTexture(rec);
    followers.unshift({ sp: rec, x: x || W / 2, phase: Math.random() * 6 });
    while (followers.length > 10) followers.pop().sp.tex.remove();
}

// How big a follower of this rarity is drawn
function followerSize(rarity) { return constrain(W / 10, 56, 76) * (.8 + rarity * .15) }

function updateFollowers(dt) {
    if (!followers.length) return;
    let lead = W / 2 + Math.sin(millis() / 2600) * W * .3;
    if (hands[0] && camOn) lead = v2c(hands[0].keypoints[9].x, 0)[0];
    const size = followerSize(0) / .8, gap = size * .78;
    followers.forEach((f, i) => {
        const goal = i == 0 ? lead : followers[i - 1].x - gap * Math.sign(followers[0].x - followers[followers.length - 1].x || 1);
        f.x += (constrain(goal, size / 2, W - size / 2) - f.x) * Math.min(1, dt * .004);
        const s = followerSize(f.sp.rarity);
        drawSpirit(f.sp, f.x, H - 16 - s / 2 + Math.sin(millis() / 300 + f.phase) * 3, s, 1);
    });
}

function loadGrimoire() {
    try { grimoire = JSON.parse(localStorage.getItem(STORE)) || [] } catch (e) { grimoire = [] }
    grimoire.slice(-10).forEach(r => addFollower({ ...r }));
}
function saveGrimoire() {
    try { localStorage.setItem(STORE, JSON.stringify(grimoire)) } catch (e) { }
}
// Called by the Release All button
function releaseAll() {
    grimoire = [];
    followers.forEach(f => f.sp.tex.remove());
    followers = [];
    saveGrimoire();
    showPanel();
}

// ───────────────────────── Page (side panel and charts) ─────────────────────────

function setStatus(s) { document.getElementById('status').textContent = s }

function bar(name, v, note) {
    return `<div class="stat"><span>${name}</span><div class="meter"><i style="width:${v}%"></i></div><span class="num">${v}</span></div>` +
        (note ? `<div class="stat-note">${note}</div>` : '');
}

function showPanel() {
    const el = document.getElementById('spirit');
    if (!spirit) {
        el.innerHTML = '<span class="mut">No spirit here yet.</span>';
    } else {
        const sp = spirit, fam = familyByKey(sp.fam), rare = RARITY[sp.rarity];
        el.innerHTML =
            `<div class="sp-name r${sp.rarity}">${sp.name}</div>` +
            `<div class="mut">${rare.name} · ${fam.title} · from the ${sp.from}</div>` +
            bar('Family friendliness', fam.friend) +
            bar('Its friendliness', sp.friend, sp.friend >= 65 ? 'Patient: it waits a long time.' : sp.friend < 35 ? 'Hostile: it leaves quickly.' : 'Wary.') +
            bar('Timidity', sp.timid, sp.timid > 66 ? 'Very timid: +2 seals.' : sp.timid > 33 ? 'Timid: +1 seal.' : 'Bold: no extra seals.') +
            `<div class="stat-note">Seals needed: <b>${sp.seq.length}</b> (2 + ${rare.extra} rarity + ${sp.seq.length - 2 - rare.extra} timidity)</div>`;
    }
    document.getElementById('tally').textContent = `${grimoire.length} tamed · ${fledCount} fled`;
    document.getElementById('grimoire').innerHTML = grimoire.length
        ? grimoire.slice().reverse().map(r =>
            `<div class="g-row"><span class="r${r.rarity}">${r.name}</span><span class="mut">${RARITY[r.rarity].name}, ${r.from}</span></div>`).join('')
        : '<span class="mut">Empty. Tame a spirit and it will follow you.</span>';
}

// A framed portrait of a spirit for the charts, in the style of the Week 7 icons
function portrait(sp) {
    const S = 150, pg = createGraphics(S, S);
    pg.pixelDensity(1);
    pg.background(122, 106, 112);
    pg.noStroke();
    for (let i = 0; i < 60; i++) {
        const a = random(TWO_PI), r = S * random(.42, .7);
        pg.fill(40, 34, 38, 26);
        pg.ellipse(S / 2 + Math.cos(a) * r, S / 2 + Math.sin(a) * r, random(30, 70), random(30, 70));
    }
    const tex = makeTexture(sp), size = S * .86 * RARITY[sp.rarity].scale / 1.2 + 10;
    pg.image(tex, S / 2 - size / 2, S / 2 - size / 2 + 4, size, size);
    drawFace(pg, sp, S / 2, S / 2 + 4, size, false);
    tex.remove();
    pg.stroke(12, 10, 12);
    pg.strokeWeight(4);
    pg.line(0, 5, S, 4); pg.line(0, S - 5, S, S - 4); pg.line(5, 0, 6, S); pg.line(S - 5, 0, S - 6, S);
    const url = pg.elt.toDataURL();
    pg.remove();
    return url;
}

// The seal chart and the bestiary below the game
function buildCharts() {
    document.getElementById('seals').innerHTML = Object.keys(SEALS).map((k, i) =>
        `<div class="seal"><img src="${glyphs[k].elt.toDataURL()}" alt="">` +
        `<div><b>${SEALS[k].name}</b> <span class="mut">key ${i + 1}</span><br><span class="mut">${SEALS[k].how}</span></div></div>`).join('');

    document.getElementById('bestiary').innerHTML = FAMILIES.map((fam, n) =>
        `<div class="chart-row"><div><div class="chart-cat">${fam.title}</div>` +
        `<div class="chart-note">${fam.objects.join(', ')}<br>Friendliness ${fam.friend}</div></div><div class="chart-items">` +
        RARITY.map((rare, r) => {
            const sp = { fam: fam.key, rarity: r, seed: 1000 + n * 10 + r, friend: fam.friend };
            return `<div class="chart-item"><img src="${portrait(sp)}" alt="${fam.names[r]}"><span class="r${r}">${fam.names[r]}</span><span class="mut">${rare.name} · ${rare.chance * 100}%</span></div>`;
        }).join('') + '</div></div>').join('');
}
