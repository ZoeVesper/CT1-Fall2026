const MAXB = 3;
const CORES = ['actor', 'installation', 'stationary'];
const CONC = ['none', 'door', 'screen', 'shutter', 'display'];
const VIS = ['none', 'darkness', 'flashing'];
const SND = ['none', 'sudden'];
// Outline of whatever is selected (a location or a slot)
const SEL_COL = [255, 200, 0];
const BASE = { actor: 44, installation: 38, stationary: 22 };
// Fear at which a visitor panics and runs for an exit.
const PANIC = 275;
const BRAVE = [.1, .7]; // range of visitor bravery (cuts the fear of each scare by up to 60%)
const SPREAD = .15;      // share of a visitor's new fear passed to visitors within SPREAD_D
const SPREAD_D = 60;
// After a scare goes off it can't be set off again for COOL frames (1.5 s), so its
// animation and sound always play out. Visitors within NEAR_D units of it (along the
// route) who didn't set it off still get a fright: ×NEAR[1] right next to it, down to
// ×NEAR[0] at NEAR_D. A visual cue still works on every visitor; only its green pulse
// waits COOL frames before it can show again.
const COOL = 90;
const NEAR_D = 100;
const NEAR = [.3, .8];

class Encounter {
    constructor() {
        Object.assign(this, {
            kind: 'empty',
            core: 'actor',
            conc: 'none',
            vis: 'none',
            snd: 'none',
            open: 0,
            reveal: 0,
            ring: 0,
            cool: 0,
            total: 0,
            hits: 0,
            logged: false,
            place: 'floor' // 'floor' | 'wall' (behind a wall, in the hidden area) | 'door' (a doorway)
        });
    }

    // Types this slot can hold
    kindOptions() {
        return this.place == 'door' ? ['empty', 'block'] : ['empty', 'scare', 'cue'];
    }

    // Concealments allowed here: a wall slot needs an opening in the wall,
    // a floor slot is open or behind a free-standing screen/display.
    // A visual cue is shown openly or on a display.
    // A screen works by the scare coming up close behind it, so a stationary
    // core (which can't move) can't use one.
    concOptions() {
        if (this.kind == 'cue') return this.place == 'wall' ? ['display'] : ['none', 'display'];
        const ok = this.place == 'wall' ? WALL_CONC : FLOOR_CONC;
        return this.core == 'stationary' ? ok.filter(c => c != 'screen') : ok;
    }

    sanitize() {
        if (!this.kindOptions().includes(this.kind)) this.kind = 'empty';
        if (this.kind == 'cue' || this.kind == 'scare') {
            const ok = this.concOptions();
            if (!ok.includes(this.conc)) this.conc = ok[0];
        }
        if (this.kind == 'cue') {
            if (this.vis == 'darkness') this.vis = 'none';
            this.snd = 'none';
        } else if (this.kind != 'scare') {
            this.conc = this.vis = this.snd = 'none';
        }
    }

    power() {
        let p = BASE[this.core];
        if (this.conc != 'none') p += 12;
        if (this.vis == 'darkness') p += 8;
        if (this.vis == 'flashing') p += 6;
        if (this.snd == 'sudden') p += 14;
        return p;
    }

    tick() {
        if (this.reveal > 0) {
            this.open = lerp(this.open, 1, .3);
            this.reveal--;
        } else this.open = lerp(this.open, 0, .1);
        if (this.ring > 0) this.ring--;
        if (this.cool > 0 && !paused) this.cool--;
    }

    // Visual block on a doorway: a square icon like the other slots, with the
    // curtain always hanging down (whichever way the route goes through it);
    // it sways when visitors push through
    drawBlock(x, y, n, s) {
        push();
        translate(x, y);
        if (s) {
            noFill();
            stroke(...SEL_COL);
            strokeWeight(2);
            rect(-34, -34, 68, 68, 7);
        }
        stroke(70);
        strokeWeight(1);
        fill(18);
        rect(-26, -26, 52, 52, 4);
        noStroke();
        const sw = this.open * 3;
        if (IMG.block) {
            // the artist's picture, swaying side to side when pushed through
            push();
            translate(sin(frameCount * .3) * sw, 0);
            drawPic(IMG.block, 48, 48);
            pop();
        } else for (let i = -3; i <= 3; i++) {
            fill(120 + i * 4, 25, 28, 238);
            rect(i * 7 - 3 + sin(frameCount * .3 + i) * sw, -23, 6, 46 + (i % 2 ? -6 : 0));
        }
        fill(150);
        textSize(10);
        textAlign(CENTER, CENTER);
        if (n) text('#' + n, 0, 38);
        pop();
    }

    // side: which side of the icon its #n goes (see labelSide / labelSpots)
    draw(x, y, n, s, side = null) {
        push();
        translate(x, y);
        if (s) {
            noFill();
            stroke(...SEL_COL);
            strokeWeight(2);
            rect(-34, -34, 68, 68, 7);
        }
        stroke(70);
        strokeWeight(1);
        fill(18);
        rect(-26, -26, 52, 52, 4);
        noStroke();
        if (this.kind == 'empty') {
            fill(90);
            textAlign(CENTER, CENTER);
            textSize(20);
            text('+', 0, 0);
        } else if (this.kind == 'block') {
            fill(120, 30, 30);
            for (let i = -3; i <= 3; i++) rect(i * 7 - 3, -24, 6, 48 + (i % 2 ? -6 : 0));
        } else {
            // Behind a screen the scare is far back (small) until it is
            // revealed: then it comes right up to the screen
            push();
            if (this.conc == 'screen') scale(lerp(.55, 1, this.open));
            drawCore(this.core);
            pop();
            drawConc(this.conc, this.open);
            // Darkness dims everything in the slot (the scare and its cover),
            // a little less while it is being revealed
            if (this.vis == 'darkness') {
                noStroke();
                fill(0, 0, 0, 100 * (1 - this.open * .6));
                rect(-26, -26, 52, 52, 4);
            }
            if (this.vis == 'flashing' && frameCount % 20 < 10) {
                fill(255, 255, 190, 100);
                rect(-25, -25, 50, 50);
            }
            if (this.kind == 'cue') {
                stroke(80, 200, 80);
                strokeWeight(2);
                noFill();
                ellipse(-16, -18, 14, 8);
                fill(80, 200, 80);
                noStroke();
                ellipse(-16, -18, 5, 5);
            }
            // Sudden sound: small yellow sound waves in the top-left corner, kept
            // inside the slot (the same corner as a cue's green eye; a cue never
            // has a sound, so the two never meet)
            if (this.snd == 'sudden') {
                stroke(255, 220, 60);
                strokeWeight(1.5);
                noFill();
                arc(-20, -18, 6, 6, -QUARTER_PI, QUARTER_PI);
                arc(-20, -18, 12, 12, -QUARTER_PI, QUARTER_PI);
                arc(-20, -18, 18, 18, -QUARTER_PI, QUARTER_PI);
                noStroke();
                fill(255, 220, 60);
                ellipse(-20, -18, 3, 3);
            }
            // The pulse when it goes off: green for a cue catching the eye,
            // yellow for a sudden sound
            if (this.ring > 0) {
                noFill();
                const fade = this.ring / PULSE * 240; // fades out as it grows
                if (this.kind == 'cue') stroke(90, 255, 90, fade);
                else stroke(255, 220, 60, fade);
                strokeWeight(2);
                ellipse(0, 0, (PULSE - this.ring) * 4, (PULSE - this.ring) * 4);
            }
            // A scare in the open or in a display case has nothing to open, so it
            // flashes red when it strikes
            if (this.kind == 'scare' && this.reveal > 0 && (this.conc == 'none' || this.conc == 'display')) {
                noFill();
                stroke(255, 60, 60, this.reveal * 3.5);
                strokeWeight(3);
                rect(-27, -27, 54, 54, 5);
            }
        }
        noStroke();
        fill(150);
        textSize(10);
        const [nx, ny, ah, av] = labelSpots(side).n;
        textAlign(ah, av);
        if (n) text('#' + n, nx, ny);
        pop();
    }
}

// The artist's own pictures used on the map (files in Icon/), by the name the
// code uses. sketch.js setup() loads them into IMG; anything without one keeps
// its drawn icon.
const MAP_PICTURES = {
    actor: 'Actor', installation: 'Instal', stationary: 'Stationary',
    door: 'Door', shutter: 'Shutter', screen: 'Screen', display: 'Display',
    block: 'VisualBlock',
};
const IMG = {};
const DISPLAY_ALPHA = 150; // how solid the Display picture is on the map (0 = invisible, 255 = solid)

// Which side of its icon a slot's labels go ('up', 'down', 'left', 'right', or
// null = the floor-slot layout). House.slotInfo works it out (q.side); a wall
// slot's labels go away from its location unless a neighbour's icon is there.
function labelSide(q) { return q.side !== undefined ? q.side : outerSide(q) }

// The side of a wall slot facing away from its location (null for a floor slot)
function outerSide(q) {
    if (!q.opening) return null;
    const ox = (q.opening[0] + q.opening[2]) / 2, oy = (q.opening[1] + q.opening[3]) / 2;
    const dx = q.x - ox, dy = q.y - oy;
    return abs(dx) > abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
}

// Where the label text of a slot at (x, y) goes on a given side
function labelText(x, y, side) {
    if (side == 'up') return { x0: x - 30, y0: y - 44, x1: x + 30, y1: y - 31 };
    if (side == 'left') return { x0: x - 60, y0: y - 19, x1: x - 31, y1: y + 19 };
    if (side == 'right') return { x0: x + 31, y0: y - 19, x1: x + 60, y1: y + 19 };
    return { x0: x - 30, y0: y + 31, x1: x + 30, y1: y + 44 }; // down (and the #n of a floor slot)
}

// Pick each slot's label side: its outer side first, then the two at right
// angles, then the inner one; the first whose text lands on no other icon
function chooseLabelSides(slots) {
    const flip = { up: 'down', down: 'up', left: 'right', right: 'left' };
    const turn = { up: ['left', 'right'], down: ['left', 'right'], left: ['up', 'down'], right: ['up', 'down'] };
    slots.forEach(q => {
        const out = outerSide(q);
        if (!out) { q.side = null; return; }
        const free = s => !slots.some(o => o !== q &&
            overlaps(labelText(q.x, q.y, s), { x0: o.x - 26, y0: o.y - 26, x1: o.x + 26, y1: o.y + 26 }));
        q.side = [out, ...turn[out], flip[out]].find(free) || out;
    });
}

// Where a slot's labels sit, from its icon centre: [x, y, horizontal align,
// vertical align] for the #n, the ×1.5 (blind side) and the ×1.2 (visual block)
function labelSpots(side) {
    switch (side) {
        case 'up': return { n: [0, -38, CENTER, CENTER], blind: [30, -32, RIGHT, BOTTOM], block: [-30, -32, LEFT, BOTTOM] };
        case 'down': return { n: [0, 38, CENTER, CENTER], blind: [30, 32, RIGHT, TOP], block: [-30, 32, LEFT, TOP] };
        case 'left': return { n: [-32, 0, RIGHT, CENTER], blind: [-32, -13, RIGHT, CENTER], block: [-32, 13, RIGHT, CENTER] };
        case 'right': return { n: [32, 0, LEFT, CENTER], blind: [32, -13, LEFT, CENTER], block: [32, 13, LEFT, CENTER] };
        default: return { n: [0, 38, CENTER, CENTER], blind: [30, -32, RIGHT, BOTTOM], block: [-30, -32, LEFT, BOTTOM] };
    }
}

// The area a slot's icon and its labels cover (for fitting the house on the map)
function labelBox(q) {
    const s = labelSide(q), x = q.x, y = q.y;
    if (s == null) return { x0: x - 31, y0: y - 44, x1: x + 31, y1: y + 44 };
    const t = labelText(x, y, s);
    return { x0: min(t.x0, x - 31), y0: min(t.y0, y - 31), x1: max(t.x1, x + 31), y1: max(t.y1, y + 31) };
}

// Draw a picture centred, fitted inside w x h without stretching it
function drawPic(img, w, h) {
    const s = min(w / img.width, h / img.height);
    imageMode(CENTER);
    image(img, 0, 0, img.width * s, img.height * s);
}

function drawCore(c) {
    if (IMG[c]) return drawPic(IMG[c], 46, 46);
    noStroke();
    if (c == 'actor') {
        fill(12);
        ellipse(0, 6, 30, 38);
        ellipse(0, -12, 22, 22);
        fill(255, 30, 30);
        ellipse(-4, -13, 3, 3);
        ellipse(4, -13, 3, 3);
        rect(-4, -7, 8, 2);
    } else if (c == 'installation') {
        fill(50);
        ellipse(0, 8, 28, 34);
        fill(20);
        triangle(-14, -6, 14, -6, 0, -24);
        rect(-16, -8, 32, 3);
        fill(255, 40, 40);
        ellipse(2, -1, 3, 3);
        noFill();
        stroke(130);
        ellipse(10, 12, 10, 10);
    } else {
        fill(130, 20, 20);
        ellipse(0, 0, 38, 38);
        stroke(235);
        strokeWeight(3);
        line(-12, 6, 10, -4);
        strokeWeight(5);
        point(10, -4);
        point(-12, 6);
    }
}

function drawConc(k, o) {
    if (k == 'none') return;
    let a = 255 * (1 - o);
    push();
    strokeWeight(1);
    if (IMG[k]) {
        // The artist's picture, behaving like the drawn version: a door fades
        // away, a shutter rolls up, a screen turns see-through, a display stays
        // see-through all the time so the core inside shows (DISPLAY_ALPHA)
        if (k == 'shutter') translate(0, -o * 46);
        tint(255, k == 'screen' ? lerp(220, 60, o) : k == 'display' ? DISPLAY_ALPHA : a);
        drawPic(IMG[k], 48, 50);
        pop();
        return;
    }
    if (k == 'door') {
        fill(70, 66, 66, a);
        stroke(140, a);
        rect(-18, -24, 36, 48);
        rect(-12, -18, 24, 14);
    }
    if (k == 'screen') {
        // A screen never opens: it stays in place and turns see-through as the
        // scare comes up close behind it
        fill(110, 160, 210, lerp(220, 60, o));
        stroke(60);
        rect(-22, -20, 44, 40);
        line(0, -20, 0, 20);
        line(-22, 0, 22, 0);
    }
    if (k == 'display') {
        // A display case never opens: the piece inside is on show the whole
        // time, behind glass (a faint tint, a frame and a glare stripe)
        fill(150, 200, 210, 40);
        stroke(150, 170, 175);
        strokeWeight(1.5);
        rect(-23, -25, 46, 50, 2);
        noStroke();
        fill(90, 70, 60);
        rect(-23, 21, 46, 4);            // plinth
        stroke(255, 255, 255, 90);
        strokeWeight(2);
        line(-17, -19, -6, -8);          // glare
        line(-17, -11, -11, -5);
    }
    if (k == 'shutter') {
        translate(0, -o * 46);
        fill(190, a);
        stroke(60, a);
        for (let j = 0; j < 4; j++) rect(-21, -23 + j * 11, 42, 9);
    }
    pop();
}

const BLIND = 1.5;      // multiplier for scares just after a direction change (blind side)
const BLIND_D = 100;    // ...in this first stretch of the location after the turn
const BLOCK = 1.2;      // multiplier for scares in that first stretch behind a visual block
const ROUTE_PAD = 1000; // the route starts this far before the entrance (visitors queue there)
const PULSE = 30;       // frames a cue's or a sudden sound's pulse lasts (the sound fades with it)
const MAX_LOCS = 8;
const WAY_LEN = 3000;   // how far the ways in and out of the house are kept clear
// Wall slots sit in the hidden staff area behind a wall, so they need an opening;
// floor slots are in the visitors' space: open, or behind a free-standing screen/display.
const WALL_CONC = ['door', 'screen', 'shutter', 'display'];
const FLOOR_CONC = ['none', 'screen', 'display'];

// Headings, clockwise: 0 = right, 1 = down, 2 = left, 3 = up
const HEAD = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const ARROW = ['→', '↓', '←', '↑'];

// Each location has its own local frame: origin = middle of its entrance,
// x = the way visitors walk in, y = to their right.
function toW(g, lx, ly) {
    const [hx, hy] = HEAD[g.h];
    return [g.x + hx * lx - hy * ly, g.y + hy * lx + hx * ly];
}
function toL(g, x, y) {
    const [hx, hy] = HEAD[g.h], dx = x - g.x, dy = y - g.y;
    return [dx * hx + dy * hy, -dx * hy + dy * hx];
}
// Local rectangle [x0, y0, x1, y1] -> world rectangle {x0, y0, x1, y1}
function rectW(g, r) {
    const a = toW(g, r[0], r[1]), b = toW(g, r[2], r[3]);
    return { x0: min(a[0], b[0]), y0: min(a[1], b[1]), x1: max(a[0], b[0]), y1: max(a[1], b[1]) };
}
function overlaps(a, b) {
    return a.x0 < b.x1 - .5 && b.x0 < a.x1 - .5 && a.y0 < b.y1 - .5 && b.y0 < a.y1 - .5;
}

// A slot spec: id, place ('floor' | 'wall'), icon position, hidden staff area
// behind the wall (wall slots), the wall opening it shows through, and the
// neighbouring slots it rules out when used.
function wallSlot(id, x, y, region, opening, blocks) {
    return { id, place: 'wall', x, y, region, opening, blocks };
}
function floorSlot(id, x, y, blocks) {
    return { id, place: 'floor', x, y, region: null, opening: null, blocks };
}

class Location {
    constructor() {
        this.makeSlots();
        this.turnLogged = false;
        this.emergency = false; // the player wants an emergency exit here (House.exits places it)
    }
    // An empty Encounter for each of its slots
    makeSlots() {
        this.enc = {};
        this.specs().forEach(s => {
            this.enc[s.id] = new Encounter();
            this.enc[s.id].place = s.place;
        });
    }
    spec(id) { return this.specs().find(s => s.id == id) }
    // -1 = exit turns left, 0 = straight on, +1 = turns right
    get exitTurn() { return 0 }
    // Route through the location in local coordinates; the last point is the exit
    routeLocal() { return [[0, 0], [this.len, 0]] }
    // Where the route turns (if it does)
    get turnPt() { return null }

    // Possible spots for an emergency door (local points on the walls), best
    // first: side walls before end walls, each from its middle outwards. Never
    // in a doorway or a wall slot's opening (or right next to one).
    doorSpots() {
        const b = this.body, r = this.routeLocal(), ex = r[r.length - 1];
        const ways = [[0, 0], ex];                       // entrance and exit doorways
        const openings = this.specs().filter(s => s.opening).map(s => s.opening);
        const walls = [
            { y: b[1], a: b[0], z: b[2] }, { y: b[3], a: b[0], z: b[2] },   // side walls
            { x: b[2], a: b[1], z: b[3] }, { x: b[0], a: b[1], z: b[3] },   // front, back
        ];
        const spots = [];
        walls.forEach(w => {
            const onWall = (px, py) => (w.x !== undefined ? px == w.x : py == w.y);
            const along = (px, py) => (w.x !== undefined ? py : px);
            const mid = (w.a + w.z) / 2, half = (w.z - w.a) / 2 - DOOR_HALF;
            for (let o = 0; o <= half; o += 2) for (const t of o ? [mid + o, mid - o] : [mid]) {
                const busy = ways.some(([px, py]) => onWall(px, py) && abs(along(px, py) - t) < 30 + DOOR_HALF + 4) ||
                    openings.some(op => onWall(op[0], op[1]) && onWall(op[2], op[3]) &&
                        t + DOOR_HALF + 4 > min(along(op[0], op[1]), along(op[2], op[3])) &&
                        t - DOOR_HALF - 4 < max(along(op[0], op[1]), along(op[2], op[3])));
                if (!busy) spots.push(w.x !== undefined ? [w.x, t] : [t, w.y]);
            }
        });
        return spots;
    }
}

const DOOR_HALF = 14;   // an emergency door is 28 wide
const DOOR_CLEAR = 24;  // ...and needs this much free space outside it

// What an emergency door (local point on a wall of location s) opens onto: a
// strip as wide as the door and `depth` deep just outside that wall, in world
// space (g = s's placement)
function doorStrip(s, door, g, depth = DOOR_CLEAR) {
    const [mx, my] = door, b = s.body;
    const end = mx == b[0] || mx == b[2]; // in an end wall, else a side wall
    const out = end ? (mx == b[2] ? depth : -depth) : (my == b[3] ? depth : -depth);
    const r = end ? [mx, my - DOOR_HALF, mx + out, my + DOOR_HALF] : [mx - DOOR_HALF, my, mx + DOOR_HALF, my + out];
    return rectW(g, [min(r[0], r[2]), min(r[1], r[3]), max(r[0], r[2]), max(r[1], r[3])]);
}

// Square room, 240 x 240: 4 floor slots and 2 slots on each wall (8).
// Using a floor slot rules out the two wall slots next to it, and the other way round.
// The middle of each wall is a doorway: the entrance (back wall) and the chosen exit.
class Room extends Location {
    constructor(exit = 'straight') {
        super();
        this.exit = exit; // 'straight' | 'left' | 'right'
    }
    get kind() { return 'room' }
    get body() { return [0, -120, 240, 120] }
    get exitTurn() { return { straight: 0, left: -1, right: 1 }[this.exit] }
    get center() { return [120, 0] }
    get turnPt() { return this.exitTurn ? this.center : null }
    exitLocal() { return { straight: [240, 0], left: [120, -120], right: [120, 120] }[this.exit] }
    routeLocal() { return [[0, 0], this.center, this.exitLocal()] }
    specs() {
        return [
            floorSlot('f1', 60, -60, ['B1', 'L1']), floorSlot('f2', 60, 60, ['B2', 'R1']),
            floorSlot('f3', 180, -60, ['F1', 'L2']), floorSlot('f4', 180, 60, ['F2', 'R2']),
            // back wall (entrance side)
            wallSlot('B1', -34, -72, [-64, -100, 0, -44], [0, -94, 0, -50], ['f1']),
            wallSlot('B2', -34, 72, [-64, 44, 0, 100], [0, 50, 0, 94], ['f2']),
            // front wall
            wallSlot('F1', 274, -72, [240, -100, 304, -44], [240, -94, 240, -50], ['f3']),
            wallSlot('F2', 274, 72, [240, 44, 304, 100], [240, 50, 240, 94], ['f4']),
            // left wall
            wallSlot('L1', 48, -154, [20, -184, 76, -120], [26, -120, 70, -120], ['f1']),
            wallSlot('L2', 192, -154, [164, -184, 220, -120], [170, -120, 214, -120], ['f3']),
            // right wall
            wallSlot('R1', 48, 154, [20, 120, 76, 184], [26, 120, 70, 120], ['f2']),
            wallSlot('R2', 192, 154, [164, 120, 220, 184], [170, 120, 214, 120], ['f4']),
        ];
    }
}

// Corridor: straight on, or turning 90° left or right (Direction Change).
// No floor slots. A straight corridor is 120 long and 72 wide, with one slot
// behind each side wall. A turning one is a 112 x 112 piece (big enough that
// visual blocks on both of its doorways don't touch); its two closed walls
// (front and the outer side) each hold one slot.
class Corridor extends Location {
    constructor(turn = 'straight') {
        super();
        this.turn = turn; // 'straight' | 'left' | 'right'
        this.makeSlots();  // again: super() made them before the turn was known
    }
    get kind() { return 'corridor' }
    get turning() { return this.turn != 'straight' }
    get len() { return this.turning ? 112 : 120 }
    get body() { return this.turning ? [0, -56, 112, 56] : [0, -36, 120, 36] }
    get exitTurn() { return { straight: 0, left: -1, right: 1 }[this.turn] }
    get turnPt() { return this.turning ? [56, 0] : null }
    routeLocal() {
        return this.turning ? [[0, 0], [56, 0], [56, this.turn == 'left' ? -56 : 56]] : [[0, 0], [120, 0]];
    }
    specs() {
        if (!this.turning)
            // The previous location's hidden areas can reach 64 into the corridor,
            // so its wall slots sit in the second half (64..120)
            return [
                wallSlot('L', 92, -70, [64, -100, 120, -36], [70, -36, 114, -36], []),
                wallSlot('R', 92, 70, [64, 36, 120, 100], [70, 36, 114, 36], []),
            ];
        const s = this.turn == 'left' ? 1 : -1; // the outer (closed) side
        return [
            wallSlot('F', 146, 0, [112, -28, 176, 28], [112, -22, 112, 22], []),
            wallSlot('S', 56, 90 * s, s > 0 ? [28, 56, 84, 120] : [28, -120, 84, -56], [34, 56 * s, 78, 56 * s], []),
        ];
    }
}

class House {
    constructor() {
        this.segs = [];
        // doors[0] = house entrance, doors[i + 1] = exit of segs[i] (= entrance of segs[i + 1])
        this.doors = [];
        this.exitCounts = [];
    }

    // World placement of every location: each one starts at the previous one's exit
    layout(segs = this.segs) {
        let x = 0, y = 0, h = 0;
        const locs = [], doors = [{ x, y, h }];
        segs.forEach(s => {
            const g = { x, y, h };
            locs.push(g);
            const r = s.routeLocal(), e = r[r.length - 1];
            [x, y] = toW(g, e[0], e[1]);
            h = (h + s.exitTurn + 4) % 4;
            doors.push({ x, y, h });
        });
        return { locs, doors };
    }

    // Two locations' floors overlap (touching walls is fine)
    collides(segs = this.segs) {
        const L = this.layout(segs);
        const bodies = segs.map((s, i) => rectW(L.locs[i], s.body));
        for (let i = 0; i < bodies.length; i++)
            for (let j = i + 1; j < bodies.length; j++)
                if (overlaps(bodies[i], bodies[j])) return true;
        return false;
    }

    // Visitor space outside the house: the way in (the queue before the
    // entrance) and the way out (after the last exit), each a 72-wide path
    // running straight on to well beyond the map.
    ways(L) {
        const dn = L.doors[L.doors.length - 1];
        return [rectW(L.doors[0], [-WAY_LEN, -36, 0, 36]), rectW(dn, [0, -36, WAY_LEN, 36])];
    }

    // Would a location stand across the way in or out? (Then visitors would walk
    // into the house, or leave it, through another part of it.)
    blocksWay(segs = this.segs) {
        if (!segs.length) return false;
        const L = this.layout(segs), way = this.ways(L);
        return segs.some((s, i) => way.some(w => overlaps(w, rectW(L.locs[i], s.body))));
    }

    // Every slot in world space, with its state.
    // A wall slot has no space if its hidden area overlaps another location, or the
    // hidden area of an earlier location's wall slot.
    slotInfo(segs = this.segs) {
        const L = this.layout(segs);
        const bodies = segs.map((s, i) => rectW(L.locs[i], s.body));
        // The ways in and out are visitor space too: no hidden area may be there.
        if (segs.length) bodies.push(...this.ways(L));
        const out = [], taken = [];
        segs.forEach((s, i) => {
            const g = L.locs[i];
            s.specs().forEach(sp => {
                const [x, y] = toW(g, sp.x, sp.y);
                const q = { loc: i, id: sp.id, e: s.enc[sp.id], place: sp.place, x, y, door: null, space: true };
                if (sp.region) {
                    q.region = rectW(g, sp.region);
                    q.opening = [...toW(g, sp.opening[0], sp.opening[1]), ...toW(g, sp.opening[2], sp.opening[3])];
                    q.space = !bodies.some((b, j) => j != i && overlaps(b, q.region)) &&
                        !taken.some(t => t.loc != i && overlaps(t.region, q.region));
                    if (q.space) taken.push(q);
                }
                out.push(q);
            });
        });
        // adjacency: blocked when a neighbouring slot (that has space) is in use
        out.forEach(q => {
            const sp = segs[q.loc].spec(q.id);
            q.blockedBy = sp.blocks.map(b => out.find(o => o.loc == q.loc && o.id == b))
                .filter(o => o && o.space && o.e.kind != 'empty');
        });
        chooseLabelSides(out.filter(q => q.space)); // where each slot's labels go
        return out;
    }

    // All slots the visitors can meet (doorways + location slots with space), in route order
    slots() {
        const L = this.layout(), R = this.route(L), r = [];
        this.doors.forEach((e, k) => {
            const d = L.doors[k];
            r.push({ e, x: d.x, y: d.y, door: k, h: d.h, loc: null, place: 'door', blockedBy: [], d: this.project(d.x, d.y, R) });
        });
        this.slotInfo().forEach(q => {
            if (!q.space) return;
            // Visitors meet a slot while walking through its own location
            const lo = R.locD[q.loc], hi = q.loc + 1 < R.locD.length ? R.locD[q.loc + 1] : R.endD;
            q.d = this.project(q.x, q.y, R, lo, hi);
            r.push(q);
        });
        r.sort((a, b) => a.d - b.d);
        // These bonuses belong to the slot (shown even while it is empty);
        // only a scare or cue placed there makes use of them.
        // Blind side: visitors can't see into the location after a turn until
        // they have turned into it, so the scares they reach in its first BLIND_D
        // units catch them unprepared. Only a turning corridor's tight turn counts: a room
        // turns in its centre, too far from the next location to hide it. A
        // turning corridor after a turn gets nothing either: it is itself a turn.
        r.forEach(q => q.blind = false);
        this.segs.forEach((s, i) => {
            if (!s.turning || i + 1 >= this.segs.length || this.segs[i + 1].turning) return;
            const start = R.locD[i + 1];
            r.forEach(q => {
                if (q.loc === i + 1 && !q.blockedBy.length &&
                    q.d - start <= BLIND_D) q.blind = true;
            });
        });
        // Behind a visual block: a curtain on a location's entrance hides what is
        // just behind it, so the scares in the same first stretch hit harder too.
        r.forEach(q => q.behindBlock = false);
        this.segs.forEach((s, i) => {
            if (!this.doors[i] || this.doors[i].kind != 'block') return;
            const start = R.locD[i];
            r.forEach(q => {
                if (q.loc === i && !q.blockedBy.length &&
                    q.d - start <= BLIND_D) q.behindBlock = true;
            });
        });
        return r;
    }

    // Bounding box of everything that gets drawn (for the house as it is, or as segs)
    bounds(segs = this.segs) {
        const L = this.layout(segs);
        let b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
        const add = r => { b.x0 = min(b.x0, r.x0); b.y0 = min(b.y0, r.y0); b.x1 = max(b.x1, r.x1); b.y1 = max(b.y1, r.y1); };
        segs.forEach((s, i) => add(rectW(L.locs[i], s.body)));
        this.slotInfo(segs).forEach(q => {
            if (q.region && q.space) add(q.region);
            // the slot icon with its labels (#n, ×1.5, ×1.2)
            if (q.space) add(labelBox(q));
        });
        // doorways: a visual block's icon and the #n under it
        L.doors.forEach(d => add({ x0: d.x - 26, y0: d.y - 26, x1: d.x + 26, y1: d.y + 44 }));
        add({ x0: -50, y0: -40, x1: 0, y1: 40 }); // queue before the entrance
        const dn = L.doors[L.doors.length - 1], [hx, hy] = HEAD[dn.h];
        add({ x0: dn.x + hx * 50 - 40, y0: dn.y + hy * 50 - 40, x1: dn.x + hx * 50 + 40, y1: dn.y + hy * 50 + 40 });
        return b;
    }

    // ---- Route: the polyline visitors walk along ----
    route(L = this.layout()) {
        const pts = [[-ROUTE_PAD, 0]], locD = [], turnD = [];
        const len = [0];
        const push = p => {
            const q = pts[pts.length - 1];
            const l = Math.hypot(p[0] - q[0], p[1] - q[1]);
            if (l < 1e-6) return;
            pts.push(p);
            len.push(len[len.length - 1] + l);
        };
        this.segs.forEach((s, i) => {
            const g = L.locs[i];
            push([g.x, g.y]);
            locD.push(len[len.length - 1]);
            s.routeLocal().slice(1).forEach(p => push(toW(g, p[0], p[1])));
            const t = s.turnPt;
            turnD.push(t ? locD[i] + t[0] : null); // turn point is t[0] along the entrance axis
        });
        const dn = L.doors[L.doors.length - 1], [hx, hy] = HEAD[dn.h];
        const endD = len[len.length - 1] + 40;
        push([dn.x + hx * ROUTE_PAD, dn.y + hy * ROUTE_PAD]);
        return { pts, len, locD, turnD, endD };
    }

    pointAt(d, R = this.route()) {
        const { pts, len } = R;
        for (let i = 1; i < pts.length; i++) {
            if (d <= len[i] || i == pts.length - 1) {
                const t = (d - len[i - 1]) / max(1e-9, len[i] - len[i - 1]);
                return [lerp(pts[i - 1][0], pts[i][0], t), lerp(pts[i - 1][1], pts[i][1], t)];
            }
        }
    }

    // Distance along the route of the route point closest to (x, y) (first one on ties),
    // only looking at the part of the route between distances lo and hi
    project(x, y, R = this.route(), lo = -Infinity, hi = Infinity) {
        const { pts, len } = R;
        let best = Infinity, bestD = 0;
        for (let i = 1; i < pts.length; i++) {
            const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
            const L2 = (bx - ax) ** 2 + (by - ay) ** 2, sl = Math.sqrt(L2);
            if (len[i] < lo || len[i - 1] > hi || !L2) continue;
            let t = ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / L2;
            t = constrain(t, max(0, (lo - len[i - 1]) / sl), min(1, (hi - len[i - 1]) / sl));
            const dist = Math.hypot(ax + t * (bx - ax) - x, ay + t * (by - ay) - y);
            if (dist < best - 1e-6) { best = dist; bestD = len[i - 1] + t * Math.sqrt(L2); }
        }
        return bestD;
    }

    // Emergency exit of every location: {door (local point on its wall), d (where
    // panicking visitors leave the route)}, or null where the player didn't ask
    // for one, or no spot is clear. A door goes at the first of its location's
    // doorSpots() whose outside is free: no other location's floor, hidden area,
    // slot icon, way in or out, or other emergency exit. Cached per layout.
    exits() {
        const key = this.segs.map(s => [s.kind, s.exit, s.turn, s.emergency].join()).join('|');
        if (this._exits && this._exits.key == key) return this._exits.val;
        const L = this.layout(), R = this.route(L);
        const bodies = this.segs.map((s, i) => rectW(L.locs[i], s.body));
        const blocked = [...this.ways(L)];
        this.slotInfo().forEach(q => {
            if (!q.space) return;
            blocked.push({ x0: q.x - 30, y0: q.y - 30, x1: q.x + 30, y1: q.y + 30 });
            if (q.region) blocked.push(q.region);
        });
        const val = this.segs.map((s, i) => {
            if (!s.emergency) return null;
            const door = s.doorSpots().find(p => {
                const w = doorStrip(s, p, L.locs[i]);
                return !bodies.some((b, j) => j != i && overlaps(w, b)) && !blocked.some(o => overlaps(w, o));
            });
            if (!door) return null;
            blocked.push(doorStrip(s, door, L.locs[i])); // exits keep clear of each other
            const [wx, wy] = toW(L.locs[i], door[0], door[1]);
            const hi = i + 1 < R.locD.length ? R.locD[i + 1] : R.endD;
            return { door, d: this.project(wx, wy, R, R.locD[i], hi) };
        });
        this._exits = { key, val };
        return val;
    }

    hasExit(i) { return !!this.exits()[i] }

    // Where the rule "every 3 locations in a row (or the whole house, if it is
    // shorter) have an emergency exit" is broken: the first location of each
    // such run. The last location needs none: it opens onto the house exit.
    exitGaps(ex = this.exits()) {
        const n = this.segs.length, w = min(3, n), gaps = [];
        for (let i = 0; i + w <= n; i++)
            if (i + w < n && !ex.slice(i, i + w).some(Boolean)) gaps.push(i);
        return gaps;
    }

    // Emergency exit of location i, in world space: d where the visitor leaves the route, and the door
    fleeTarget(i, L = this.layout()) {
        const f = this.exits()[i];
        if (!f) return null;
        return { d: f.d, door: toW(L.locs[i], f.door[0], f.door[1]) };
    }

    updateExits() {
        this.exitCounts = this.segs.map(() => 0);
        this.fledOut = 0; // panicked visitors who ran out through the house exit
    }
}

class Visitor {
    constructor(x, id, y, sp) {
        Object.assign(this, {
            x,
            id,
            y,
            sp,
            brave: random(BRAVE[0], BRAVE[1]),
            fear: 0,
            peak: 0,
            ant: 0,
            focus: 0,
            numb: 0,
            seen: {},
            done: new Set(),
            fled: false,
            out: false,
            targetExitIdx: null,
            turnFlash: 0,
            // distance walked along the house route; x <= 0 means waiting before the entrance
            d: x + ROUTE_PAD
        });
    }

    // Exit to run to: the emergency exit of the location the visitor is in, or of
    // the nearest one before it, else of the next one after it. In the last
    // location, or with no emergency exit left ahead before it, they run on out of
    // the house exit ('house').
    pickExit(R) {
        let cur = 0;
        R.locD.forEach((d, i) => { if (this.d >= d) cur = i; });
        const ex = house.exits(), last = house.segs.length - 1;
        // In the last location the house exit is right ahead: take it, even if
        // that location has an emergency exit too (and run on to it from further back
        // rather than to that emergency exit)
        if (cur == last) return 'house';
        for (let i = cur; i >= 0; i--) if (ex[i]) return i;
        for (let i = cur + 1; i < last; i++) if (ex[i]) return i;
        return 'house';
    }

    update(list, grp) {
        if (this.out) return; // already left the house, don't move or count again
        const L = house.layout(), R = house.route(L);
        if (this.fled) {
            if (this.targetExitIdx === null) this.targetExitIdx = this.pickExit(R);
            if (this.targetExitIdx == 'house') { // run on out of the house exit
                this.d += 3;
                [this.x, this.y] = house.pointAt(this.d, R);
                if (this.d > R.endD) {
                    this.out = true;
                    house.fledOut++;
                }
                return;
            }
            const t = house.fleeTarget(this.targetExitIdx, L, R);
            // Along the route (clear of all slots) to the point level with the emergency
            // door, then straight across the floor to the door and into the staff area.
            if (abs(this.d - t.d) > 0.5) {
                this.d += constrain(t.d - this.d, -3, 3);
                [this.x, this.y] = house.pointAt(this.d, R);
            } else {
                const step = Math.hypot(t.door[0] - this.x, t.door[1] - this.y);
                const angle = Math.atan2(t.door[1] - this.y, t.door[0] - this.x);
                this.x += Math.cos(angle) * min(3, step);
                this.y += Math.sin(angle) * min(3, step);
                if (step < 4) {
                    this.out = true;
                    house.exitCounts[this.targetExitIdx]++;
                }
            }
            return;
        }

        // Walk along the route
        this.d += this.sp * (1 - this.ant / 250);
        [this.x, this.y] = house.pointAt(this.d, R);
        this.focus = max(0, this.focus - 1);
        this.numb = max(0, this.numb - .0006);
        this.fear *= .9985;
        if (this.turnFlash > 0) this.turnFlash--;

        // Direction change: turning in a room (side exit) or a turning corridor.
        // The next location could not be seen before the turn: scares at its start
        // are on the blind side (marked by House.slots, applied in react()).
        house.segs.forEach((s, i) => {
            if (R.turnD[i] === null || this.done.has(s) || this.d < R.turnD[i] + 1) return;
            this.done.add(s);
            this.ant = min(60, this.ant + 6);
            this.turnFlash = 40;
            if (!s.turnLogged) {
                s.turnLogged = true;
                const nxt = house.segs[i + 1];
                note("Visitor " + this.id + " turns " + (s.exitTurn < 0 ? 'left' : 'right') + " in " + NAMES[s.kind].toLowerCase() + " " + (i + 1) +
                    (nxt && s.turning && !nxt.turning ? ": the start of " + NAMES[nxt.kind].toLowerCase() + " " + (i + 2) + " is on the blind side" : ""));
            }
        });

        for (const o of list) {
            // React when reaching the point of the route closest to the slot (14px early)
            if (!this.done.has(o.e) && o.e.kind != 'empty' && !(o.blockedBy && o.blockedBy.length) && this.d >= o.d - 14) {
                this.done.add(o.e);
                this.react(o, grp);
            }
        }

        if (this.fear >= PANIC && !this.fled) {
            this.fled = true;
            note("Visitor " + this.id + " panics and runs for the nearest exit!");
        }
    }

    react(o, grp) {
        const e = o.e;
        if (e.kind == 'block') {
            this.ant = min(60, this.ant + 10);
            e.reveal = 40;
        } else if (e.kind == 'cue') {
            this.focus = 150;
            if (!e.cool) {
                e.ring = PULSE; // a green pulse: it caught the visitor's eye
                e.cool = COOL;
            }
            // its own small fright is stronger just after a turn or behind a curtain too
            this.add(e, (4 + (e.vis == 'flashing' ? 4 : 0)) * (o.blind ? BLIND : 1) * (o.behindBlock ? BLOCK : 1), grp, o);
        } else {
            if (e.cool) return; // still going off for someone else (they got the nearby fright)
            e.cool = COOL;
            e.reveal = 70;
            if (e.snd == 'sudden') {
                e.ring = PULSE; // the yellow pulse, and the sound with it
                playSuddenSound(e);
            }
            const { d, why } = this.scareFear(o);
            this.seen[e.core] = (this.seen[e.core] || 0) + 1;
            this.numb = min(.6, this.numb + .1);
            this.add(e, d, grp, o);
            // Visitors close by (in front or behind) see or hear it too
            for (const v of grp) {
                const gap = abs(v.d - o.d);
                if (v === this || v.fled || v.out || gap > NEAR_D) continue;
                const f = v.scareFear(o).d * lerp(NEAR[1], NEAR[0], gap / NEAR_D);
                v.fear += f;
                v.peak = max(v.peak, v.fear);
                e.total += f;
                e.hits++;
            }
            if (!e.logged) {
                e.logged = true;
                note("Visitor " + this.id + " hit by " + e.core + (e.conc != 'none' ? ' behind ' + e.conc : '') + ": +" + d.toFixed(0) + " fear" + why);
            }
        }
    }

    // The fear this visitor would get from the scare in slot o, given its state
    // (anticipation, focus on a cue, habituation, numbness, bravery) and the slot's
    // place (blind side, behind a visual block)
    scareFear(o) {
        const e = o.e;
        let m = 1 + this.ant / 100, why = '';
        if (this.focus > 0) {
            m *= 1.7;
            why = ' (×1.7)';
        }
        if (o.blind) {
            m *= BLIND;
            why += ' (×' + BLIND + ')';
        }
        if (o.behindBlock) {
            m *= BLOCK;
            why += ' (×' + BLOCK + ')';
        }
        m /= 1 + .5 * (this.seen[e.core] || 0);
        m *= 1 - this.numb;
        return { d: e.power() * m * (1 - this.brave * .6), why };
    }

    add(e, d, grp, o) {
        this.fear += d;
        this.peak = max(this.peak, this.fear);
        e.total += d;
        e.hits++;
        for (const v of grp) {
            if (v !== this && !v.fled && abs(v.d - this.d) < SPREAD_D) v.fear += d * SPREAD;
        }
    }

    draw() {
        push();
        translate(this.x, this.y);
        noStroke();
        
        let progress = min(1, this.fear / PANIC);
        
        // Color changes gradually from green to red as they approach PANIC
        fill(lerpColor(color(120, 220, 140), color(255, 50, 50), progress));
        
        // If they have actually fled (panic state), they turn yellow
        if (this.fled) fill(255, 255, 0);
        
        ellipse(0, 0, 14, 14);
        fill(0);
        ellipse(-2.5, -1, 2, 2);
        ellipse(2.5, -1, 2, 2);
        
        // The "eye" height/size also scales with the PANIC threshold
        ellipse(0, 3, 3, this.fear > 250 ? 5 : 1); 
        
        noFill();
        stroke(255, 60, 60);
        strokeWeight(2);
        // The arc now fills based on the PANIC threshold
        arc(0, 0, 22, 22, -HALF_PI, -HALF_PI + TWO_PI * progress);

        // Just turned a corner: a small dark red turn arrow above the head (the ×1.5 colour)
        if (this.turnFlash > 0) {
            stroke(150, 20, 30, this.turnFlash * 6);
            strokeWeight(2);
            noFill();
            drawTurnArrow(0, -20, 0.6);
        }
        pop();
    }

}

// Bent arrow: goes right, then turns up (used for direction changes)
function drawTurnArrow(x, y, s) {
    push();
    translate(x, y);
    scale(s);
    line(-12, 8, 4, 8);
    line(4, 8, 4, -8);
    line(4, -12, -1, -5);
    line(4, -12, 9, -5);
    pop();
}
