const MAXB = 3;
const CORES = ['actor', 'installation', 'stationary'];
const CONC = ['none', 'door', 'screen', 'shutter', 'display'];
const VIS = ['none', 'darkness', 'flashing'];
const SND = ['none', 'sudden'];
const BASE = { actor: 38, installation: 44, stationary: 22 };

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
    concOptions() {
        if (this.kind == 'cue') return this.place == 'wall' ? ['display'] : ['none', 'display'];
        return this.place == 'wall' ? WALL_CONC : FLOOR_CONC;
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
    }

    // ang: direction of the route through this doorway (the curtain hangs across it)
    drawBlock(x, y, n, s, ang = 0) {
        push();
        translate(x, y);
        push();
        rotate(ang);
        if (s) {
            noFill();
            stroke(255, 200, 0);
            strokeWeight(2);
            rect(-26, -36, 52, 72, 6);
        }
        noStroke();
        const sw = this.open * 6;
        // curtain 64 long: fits across a 72-wide corridor or doorway
        for (let i = -3; i <= 3; i++) {
            fill(120 + i * 4, 25, 28, 238);
            rect(i * 7 - 3 + sin(frameCount * .3 + i) * sw, -32, 6, 64 + (i % 2 ? -6 : 0));
        }
        pop();
        // label stays upright, next to the curtain
        fill(150);
        textSize(10);
        textAlign(CENTER, CENTER);
        if (n) text('#' + n, abs(sin(ang)) > .5 ? 46 : 0, abs(sin(ang)) > .5 ? 0 : 46);
        pop();
    }

    draw(x, y, n, s) {
        push();
        translate(x, y);
        if (s) {
            noFill();
            stroke(255, 200, 0);
            strokeWeight(2);
            rect(-31, -31, 62, 62, 6);
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
            drawCore(this.core);
            if (this.vis == 'darkness') {
                fill(0, 0, 0, 190 * (1 - this.open * .6));
                rect(-25, -25, 50, 50);
            }
            drawConc(this.conc, this.open);
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
            if (this.ring > 0) {
                noFill();
                stroke(90, 255, 90, this.ring * 8);
                strokeWeight(2);
                ellipse(0, 0, (30 - this.ring) * 4, (30 - this.ring) * 4);
            }
        }
        noStroke();
        fill(150);
        textSize(10);
        textAlign(CENTER, CENTER);
        if (n) text('#' + n, 0, 38);
        pop();
    }
}

function drawCore(c) {
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
    if (k == 'door') {
        fill(70, 66, 66, a);
        stroke(140, a);
        rect(-18, -24, 36, 48);
        rect(-12, -18, 24, 14);
    }
    if (k == 'screen') {
        fill(110, 160, 210, a * .85);
        stroke(60, a);
        rect(-22, -20, 44, 40);
        line(0, -20, 0, 20);
        line(-22, 0, 22, 0);
    }
    if (k == 'display') {
        fill(30, 45, 45, a * .9);
        stroke(120, a);
        rect(-20, -26, 40, 52);
        line(0, -26, 0, 26);
        line(-20, 0, 20, 0);
    }
    if (k == 'shutter') {
        translate(0, -o * 46);
        fill(190, a);
        stroke(60, a);
        for (let j = 0; j < 4; j++) rect(-21, -23 + j * 11, 42, 9);
    }
    pop();
}

const BLIND = 1.5;      // scare multiplier on the blind side of a direction change
const ROUTE_PAD = 1000; // the route starts this far before the entrance (visitors queue there)
const MAX_LOCS = 8;

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
        this.enc = {};
        this.specs().forEach(s => {
            this.enc[s.id] = new Encounter();
            this.enc[s.id].place = s.place;
        });
        this.turnLogged = false;
    }
    spec(id) { return this.specs().find(s => s.id == id) }
    // -1 = exit turns left, 0 = straight on, +1 = turns right
    get exitTurn() { return 0 }
    // Route through the location in local coordinates; the last point is the exit
    routeLocal() { return [[0, 0], [this.len, 0]] }
    // Where the route turns (if it does)
    get turnPt() { return null }
    // Emergency exit: where panicking visitors leave the route, and the door they run to
    flee() { return null }
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
    // Emergency exit on a wall that is not a doorway (right wall, or left if the exit is on the right)
    emergencyLocal() { return this.exit == 'right' ? [120, -120] : [120, 120] }
    flee() { return { via: this.center, door: this.emergencyLocal() } }
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

// Corridor, 240 long and 72 wide, one direction only. No floor slots:
// one slot behind each side wall.
class Corridor extends Location {
    get kind() { return 'corridor' }
    get len() { return 240 }
    get body() { return [0, -36, 240, 36] }
    // Emergency door at x = 78: clear of the previous location's hidden areas
    // (they reach up to 64 into the corridor) and of this corridor's own slots (92..148)
    flee() { return { via: [78, 0], door: [78, 36] } }
    emergencyLocal() { return [78, 36] }
    specs() {
        return [
            wallSlot('L', 120, -70, [92, -100, 148, -36], [98, -36, 142, -36], []),
            wallSlot('R', 120, 70, [92, 36, 148, 100], [98, 36, 142, 36], []),
        ];
    }
}

// Corner (the corridor 'turn'): a 112 x 112 piece that turns the route 90° left or right.
// (Big enough that visual blocks on both of its doorways don't touch.)
// Its two closed walls (front and the outer side) each hold one slot.
class Corner extends Location {
    constructor(side = 'left') {
        super();
        this.side = side; // 'left' | 'right'
    }
    get kind() { return 'corner' }
    get body() { return [0, -56, 112, 56] }
    get exitTurn() { return this.side == 'left' ? -1 : 1 }
    get turnPt() { return [56, 0] }
    routeLocal() { return [[0, 0], [56, 0], [56, this.side == 'left' ? -56 : 56]] }
    specs() {
        const s = this.side == 'left' ? 1 : -1; // the outer (closed) side
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

    // Every slot in world space, with its state.
    // A wall slot has no space if its hidden area overlaps another location, or the
    // hidden area of an earlier location's wall slot.
    slotInfo(segs = this.segs) {
        const L = this.layout(segs);
        const bodies = segs.map((s, i) => rectW(L.locs[i], s.body));
        // The queue before the entrance and the walkway after the last exit are
        // visitor space too: no hidden area may be there.
        if (segs.length) {
            const dn = L.doors[L.doors.length - 1];
            bodies.push(rectW(L.locs[0], [-64, -36, 0, 36]));
            bodies.push(rectW({ x: dn.x, y: dn.y, h: dn.h }, [0, -36, 64, 36]));
        }
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
        return r.sort((a, b) => a.d - b.d);
    }

    // Bounding box of everything that gets drawn
    bounds() {
        const L = this.layout();
        let b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
        const add = r => { b.x0 = min(b.x0, r.x0); b.y0 = min(b.y0, r.y0); b.x1 = max(b.x1, r.x1); b.y1 = max(b.y1, r.y1); };
        this.segs.forEach((s, i) => add(rectW(L.locs[i], s.body)));
        this.slotInfo().forEach(q => { if (q.region && q.space) add(q.region); });
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

    // Emergency exit of location i, in world space: d where the visitor leaves the route, and the door
    fleeTarget(i, L = this.layout(), R = this.route(L)) {
        const f = this.segs[i].flee();
        if (!f) return null;
        return { d: R.locD[i] + f.via[0], door: toW(L.locs[i], f.door[0], f.door[1]) };
    }

    updateExits() {
        this.exitCounts = this.segs.map(() => 0);
    }
}

class Visitor {
    constructor(x, id, y, sp) {
        Object.assign(this, {
            x,
            id,
            y,
            sp,
            brave: random(.1, .7),
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
            blindLocs: new Set(), // locations entered right after a turn
            turnFlash: 0,
            // distance walked along the house route; x <= 0 means waiting before the entrance
            d: x + ROUTE_PAD
        });
    }

    // Emergency exit to run to: the location the visitor is in, or the nearest one
    // before it that has an exit (corners have none), else the next one after it.
    pickExit(R) {
        let cur = 0;
        R.locD.forEach((d, i) => { if (this.d >= d) cur = i; });
        for (let i = cur; i >= 0; i--) if (house.segs[i].flee()) return i;
        for (let i = cur + 1; i < house.segs.length; i++) if (house.segs[i].flee()) return i;
        return null;
    }

    update(list, grp) {
        if (this.out) return; // already left the house, don't move or count again
        const L = house.layout(), R = house.route(L);
        if (this.fled) {
            if (this.targetExitIdx === null) this.targetExitIdx = this.pickExit(R);
            if (this.targetExitIdx === null) { // nowhere to go: walk back out of the entrance
                this.d -= 3;
                [this.x, this.y] = house.pointAt(this.d, R);
                if (this.d < ROUTE_PAD - 40) this.out = true;
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

        // Direction change: turning in a room (side exit) or a corner.
        // The next location could not be seen before the turn: its scares are on the blind side.
        house.segs.forEach((s, i) => {
            if (R.turnD[i] === null || this.done.has(s) || this.d < R.turnD[i] + 1) return;
            this.done.add(s);
            this.ant = min(60, this.ant + 6);
            this.blindLocs.add(i + 1);
            this.turnFlash = 40;
            if (!s.turnLogged) {
                s.turnLogged = true;
                const nxt = house.segs[i + 1];
                note("Visitor " + this.id + " turns " + (s.exitTurn < 0 ? 'left' : 'right') + " in " + s.kind + " " + (i + 1) +
                    (nxt ? ": " + nxt.kind + " " + (i + 2) + " is on the blind side" : ""));
            }
        });

        for (const o of list) {
            // React when reaching the point of the route closest to the slot (14px early)
            if (!this.done.has(o.e) && o.e.kind != 'empty' && !(o.blockedBy && o.blockedBy.length) && this.d >= o.d - 14) {
                this.done.add(o.e);
                this.react(o, grp);
            }
        }

        // --- UPDATED: Changed 100 to 500 ---
        if (this.fear >= 500 && !this.fled) {
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
            this.add(e, 4 + (e.vis == 'flashing' ? 4 : 0), grp, o);
        } else {
            let m = 1 + this.ant / 100, why = '';
            if (this.focus > 0) {
                m *= 1.7;
                why = ' (misdirection ×1.7)';
            }
            if (o.loc !== null && this.blindLocs.has(o.loc)) {
                m *= BLIND;
                why += ' (blind side ×' + BLIND + ')';
            }
            m /= 1 + .5 * (this.seen[e.core] || 0);
            m *= 1 - this.numb;
            this.seen[e.core] = (this.seen[e.core] || 0) + 1;
            this.numb = min(.6, this.numb + .1);
            e.reveal = 70;
            if (e.snd == 'sudden') e.ring = 30;
            const d = e.power() * m * (1 - this.brave * .6);
            this.add(e, d, grp, o);
            if (!e.logged) {
                e.logged = true;
                note("Visitor " + this.id + " hit by " + e.core + (e.conc != 'none' ? ' behind ' + e.conc : '') + ": +" + d.toFixed(0) + " fear" + why);
            }
        }
    }

    add(e, d, grp, o) {
        this.fear += d;
        this.peak = max(this.peak, this.fear);
        e.total += d;
        e.hits++;
        for (const v of grp) {
            if (v !== this && !v.fled && abs(v.d - this.d) < 60) v.fear += d * .25;
        }
    }

    draw() {
        push();
        translate(this.x, this.y);
        noStroke();
        
        // Update the progress ratio to 500
        let progress = min(1, this.fear / 500);
        
        // Color changes gradually from green to red as they approach 500
        fill(lerpColor(color(120, 220, 140), color(255, 50, 50), progress));
        
        // If they have actually fled (panic state), they turn yellow
        if (this.fled) fill(255, 255, 0);
        
        ellipse(0, 0, 14, 14);
        fill(0);
        ellipse(-2.5, -1, 2, 2);
        ellipse(2.5, -1, 2, 2);
        
        // The "eye" height/size also scales with the new 500 threshold
        ellipse(0, 3, 3, this.fear > 250 ? 5 : 1); 
        
        noFill();
        stroke(255, 60, 60);
        strokeWeight(2);
        // The arc now fills based on the 500 threshold
        arc(0, 0, 22, 22, -HALF_PI, -HALF_PI + TWO_PI * progress);

        // Just turned a corner: a small amber turn arrow above the head
        if (this.turnFlash > 0) {
            stroke(255, 170, 0, this.turnFlash * 6);
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
