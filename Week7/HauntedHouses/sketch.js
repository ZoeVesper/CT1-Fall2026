// Fixed map scale: the canvas shows VIEW_W x VIEW_H house units, whatever the
// house looks like, and that is also the limit on how big a house can be.
// Width: 6 rooms in 2 rows of 3 (874 units with their hidden areas, the queue
// and the way out). Height: room (side exit) + corridor + corner + corridor +
// room stacked up (664 units), plus the 8 px edge margin.
const VIEW_W = 900,
    VIEW_H = 680,
    EDGE = 8; // everything stays at least this many px inside the canvas edge

let house = new House(),
    sel = null,     // selected slot (Encounter)
    selLoc = null,  // selected Room/Corridor/Corner
    group = [],
    running = false,
    paused = false,
    spawnTimer = 0,
    logs = [],
    W = 960,
    H = Math.round(960 * VIEW_H / VIEW_W), // 725
    LAYOUT_H = H, // the house fills the canvas (fear per encounter is in the table below it)
    MAX_VISITORS = 10;

const NAMES = { room: 'Room', corridor: 'Corridor', corner: 'Corner' };
function locName(i) { return NAMES[house.segs[i].kind] + ' ' + (i + 1) }

function note(s) {
    logs.unshift(s);
    logs = logs.slice(0, 8);
    document.getElementById('log').innerHTML = logs.join('<br>');
}

// Used slots whose hidden area would be lost if the house changed to segs
function lostSlots(segs) {
    const after = house.slotInfo(segs);
    return house.slotInfo().filter(q => q.space && q.e.kind != 'empty' &&
        !after.some(a => a.e === q.e && a.space));
}

// Why the house can't change to segs (null if it can): two locations would
// overlap, a location would stand across the way in or out, it would leave the
// canvas, or a used wall slot would lose its hidden area.
function layoutProblem(segs) {
    if (house.collides(segs)) return "No room for that: it would run into another part of the house.";
    if (house.blocksWay(segs)) return "No room for that: the way into or out of the house would run into another part of it.";
    if (!fitsCanvas(segs)) return "No room for that: it would go off the edge of the map.";
    if (lostSlots(segs).length) return "That would cover the hidden area behind a wall slot that is in use. Clear that slot first.";
    return null;
}

function tryLayout(segs) {
    const p = layoutProblem(segs);
    if (p) note(p);
    return !p;
}

function addLoc(l) {
    if (house.segs.length >= MAX_LOCS) {
        note("A house has at most " + MAX_LOCS + " locations.");
        return false;
    }
    // A room whose exit wall doesn't work here (e.g. it would lead straight into
    // another part of the house) takes the first other wall that does.
    if (l.kind == 'room' && layoutProblem([...house.segs, l])) {
        const want = l.exit;
        const ok = ['straight', 'left', 'right'].find(x => {
            l.exit = x;
            return !layoutProblem([...house.segs, l]);
        });
        l.exit = ok || want;
        if (ok) note("Exit set to " + { straight: 'straight on', left: 'turn left', right: 'turn right' }[ok] + " so the way through is clear.");
    }
    if (!tryLayout([...house.segs, l])) return false;
    if (!house.doors.length) house.doors.push(newDoor()); // house entrance
    const flags = house.segs.map(s => s.emergency);
    house.segs.push(l);
    house.doors.push(newDoor());                           // this location's exit
    const fix = fixExitRule();
    if (!fix.ok) {
        // nowhere to fit the emergency exits the rule needs: take it back
        house.segs.pop();
        house.doors.pop();
        if (!house.segs.length) house.doors = [];
        house.segs.forEach((s, k) => s.emergency = flags[k]);
        note("No room for that: there would be 3 locations in a row with no clear wall for an emergency exit.");
        return false;
    }
    noteAdded(fix.added);
    house.updateExits();
    selLoc = l; // show its settings straight away
    sel = null;
    edit();
    return true;
}

// Every 3 locations in a row (or the whole house, if shorter) need an emergency
// exit; a run that reaches the last location already has the house exit. Where
// a run has none that fits, add one: the last location of the run that has a
// clear spot (so it also covers the next run).
// Returns whether the rule now holds, and which locations got an exit.
function fixExitRule() {
    const n = house.segs.length, w = min(3, n), added = [];
    for (let i = 0; i + w <= n; i++) {
        if (i + w == n || house.exits().slice(i, i + w).some(Boolean)) continue;
        for (let j = i + w - 1; j >= i; j--) {
            const s = house.segs[j];
            if (s.emergency) continue;
            s.emergency = true;
            if (house.exits()[j]) { added.push(j); break; }
            s.emergency = false;
        }
    }
    return { ok: !house.exitGaps().length, added };
}

function noteAdded(added) {
    if (added.length) note("Emergency exit added to " + added.map(locName).join(', ') + " (every 3 locations need one).");
}

// Tick box in a location's settings
function setEmergency(v) {
    const g = selLoc, i = house.segs.indexOf(g);
    g.emergency = v;
    if (!v && house.exitGaps().length) {
        g.emergency = true;
        note("Every 3 locations in a row need an emergency exit, so this one has to stay.");
    } else if (v && !house.exits()[i]) {
        note("No clear spot on " + locName(i) + "'s walls for an emergency exit.");
    }
    edit();
}

function newDoor() {
    const e = new Encounter();
    e.place = 'door';
    return e;
}

function undo() {
    if (house.segs.length) {
        house.segs.pop();
        house.doors.pop();
        if (!house.segs.length) house.doors = [];
        house.updateExits();
        noteAdded(fixExitRule().added); // a shorter house may need one somewhere else
    }
    sel = null;
    edit();
}

// Put a visual block on doorways ks
function blk(h, ks) {
    ks.forEach(k => {
        h.doors[k].kind = 'block';
        h.doors[k].sanitize();
    });
}

// Stop any test that is running (used when the house is rebuilt).
function stopRun() {
    running = false;
    paused = false;
    group = [];
    document.getElementById('btnPause').textContent = "Pause";
    document.getElementById('stats').textContent = 'No run yet.';
}

function randomHouse() {
    stopRun();
    house = new House();
    sel = selLoc = null;
    // A layout can get boxed in by the canvas edges early, or leave no clear wall
    // for the emergency exits it needs, so try a few: keep the first with 5
    // locations that meets the exit rule (or the biggest one that does).
    let best = [];
    for (let attempt = 0; attempt < 40 && best.length < 5; attempt++) {
        const segs = [];
        let tries = 0;
        while (segs.length < 5 && tries++ < 60) {
            const k = random(['room', 'room', 'corridor', 'corridor', 'cornerL', 'cornerR']);
            const l = k == 'room' ? new Room(random(['straight', 'straight', 'left', 'right']))
                : k == 'corridor' ? new Corridor()
                    : new Corner(k == 'cornerL' ? 'left' : 'right');
            const next = [...segs, l];
            if (!house.collides(next) && !house.blocksWay(next) && fitsCanvas(next)) segs.push(l);
        }
        if (segs.length <= best.length) continue;
        house.segs = segs;
        segs.forEach(s => s.emergency = random() < .3);
        if (fixExitRule().ok) best = segs;
    }
    house.segs = best;
    house.doors = best.length ? [newDoor(), ...best.map(() => newDoor())] : [];
    house.updateExits();
    // Fill slots in random order, skipping any that a neighbour already rules out
    shuffle(house.slotInfo()).forEach(q => {
        const info = house.slotInfo().find(o => o.e === q.e);
        if (!info.space || info.blockedBy.length || random() < .35) return;
        q.e.kind = random(['scare', 'scare', 'cue']);
        q.e.core = random(CORES);
        q.e.conc = random(q.e.concOptions());
        q.e.vis = random(VIS);
        q.e.snd = random(SND);
        q.e.sanitize();
    });
    blk(house, house.doors.map((_, k) => k).filter(() => random() < .4));
    selLoc = null;
    edit();
}

function startTest() {
    if (!house || house.segs.length === 0) {
        note("Build something first.");
        return;
    }
    if (house.exitGaps().length) {
        const i = house.exitGaps()[0], names = house.segs.slice(i, i + 3).map((_, k) => locName(i + k));
        note("Can't start: " + (names.length == 1 ? names[0] + " needs an emergency exit."
            : names.join(', ') + " need an emergency exit between them."));
        return;
    }
    stopRun();
    house.updateExits(); // resets exit counts
    logs = [];
    document.getElementById('log').innerHTML = '';
    document.getElementById('stats').textContent = 'Initializing...';

    house.slots().forEach(slot => {
        slot.e.total = 0;
        slot.e.hits = 0;
        slot.e.logged = false;
        slot.e.open = 0;
        slot.e.reveal = 0;
    });
    house.segs.forEach(g => g.turnLogged = false);

    for (let i = 0; i < 5; i++) {
        group.push(new Visitor(-i * 40, i + 1, 0, 1.2));
    }
    spawnTimer = 0;
    running = true;
    note("Test Started. Visitors entering...");
    document.getElementById('stats').textContent = "Running...";
}

function togglePause() {
    if (!running) return;
    paused = !paused;
    document.getElementById('btnPause').textContent = paused ? "Resume" : "Pause";
    if (paused) note("Test Paused.");
    else note("Test Resumed.");
}

function endTest() {
    running = false;
    paused = false;
    document.getElementById('btnPause').textContent = "Pause";
    summary();
}

// "flashing" -> "Flashing"
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1) }

function opts(a, v) {
    // value stays as the code uses it; the text shown is capitalised
    return a.map(x => `<option value="${x}" ${x == v ? 'selected' : ''}>${cap(x)}</option>`).join('');
}

// Info about the selected slot (doorway or location slot)
function selInfo() {
    if (!sel) return null;
    const k = house.doors.indexOf(sel);
    if (k >= 0) return { door: k, e: sel };
    return house.slotInfo().find(q => q.e === sel) || null;
}

function edit() {
    const el = document.getElementById('ed');
    if (selLoc && !house.segs.includes(selLoc)) selLoc = null;
    if (selLoc) {
        const i = house.segs.indexOf(selLoc), g = selLoc;
        if (g.kind == 'room') {
            el.innerHTML = `<b>${locName(i)}</b> &nbsp; <label style="color:inherit">Exit
                <select onchange="setExit(this.value)">${opts(['straight', 'left', 'right'], g.exit)}</select></label>`;
        } else if (g.kind == 'corner') {
            el.innerHTML = `<b>${locName(i)}</b> &nbsp; <label style="color:inherit">Turns
                <select onchange="setSide(this.value)">${opts(['left', 'right'], g.side)}</select></label>`;
        } else {
            el.innerHTML = `<b>${locName(i)}</b>`;
        }
        // Emergency exit option (placed automatically where its wall is clear)
        const noSpot = g.emergency && !house.exits()[i];
        el.innerHTML += ` &nbsp; <label style="color:inherit"><input type="checkbox" onchange="setEmergency(this.checked)"
            ${g.emergency ? 'checked' : ''}> Emergency Exit</label>${noSpot ? ' <span style="color:#dc5050">No clear wall for it</span>' : ''}`;
        return;
    }
    const q = selInfo();
    if (!q) {
        sel = null;
        el.textContent = 'Select a slot, room or doorway…';
        return;
    }
    const e = q.e;
    if (q.door !== undefined && q.door !== null) {
        el.innerHTML = e.kind == 'block'
            ? '<b>Visual Block</b> &nbsp; <button onclick="rmBlock()">Remove</button>'
            : '<b>Doorway</b> &nbsp; <button onclick="setF(\'kind\',\'block\')">Add Visual Block</button>';
        return;
    }
    if (q.blockedBy && q.blockedBy.length) {
        el.innerHTML = `<b>Blocked</b> by the ${q.blockedBy[0].place} slot next to it`;
        return;
    }
    const where = q.place == 'wall' ? '<b>Wall Slot</b>' : '<b>Floor Slot</b>';
    const slot = house.slots().find(o => o.e === e);
    let h = `${where}${slot && slot.blind ? ` <span style="color:#ffaa00">×${BLIND}</span>` : ''}` +
        `${slot && slot.behindBlock ? ` <span style="color:#dc5050">×${BLOCK}</span>` : ''} &nbsp; <label>Type <select onchange="setF('kind',this.value)">${opts(e.kindOptions(), e.kind)}</select></label>`;
    if (e.kind == 'scare' || e.kind == 'cue') {
        h += `<label>Core <select onchange="setF('core',this.value)">${opts(CORES, e.core)}</select></label>
         <label>Concealment <select onchange="setF('conc',this.value)">${opts(e.concOptions(), e.conc)}</select></label>
         <label>Visual <select onchange="setF('vis',this.value)">${opts(e.kind == 'cue' ? ['none', 'flashing'] : VIS, e.vis)}</select></label>`;
        if (e.kind == 'scare') h += `<label>Sound <select onchange="setF('snd',this.value)">${opts(SND, e.snd)}</select></label>`;
    }
    el.innerHTML = h;
}

// Change a setting of the selected location (a room's exit wall, a corner's side).
// The rest of the house moves with it, so undo the change if it no longer fits.
function changeLoc(key, v) {
    const g = selLoc, old = g[key];
    const before = house.slotInfo().filter(q => q.space && q.e.kind != 'empty');
    g[key] = v;
    const after = house.slotInfo();
    if (house.collides()) {
        note("No room for that: the rest of the house would run into another part.");
        g[key] = old;
    } else if (house.blocksWay()) {
        note("No room for that: the way into or out of the house would run into another part of it.");
        g[key] = old;
    } else if (!fitsCanvas(house.segs)) {
        note("No room for that: the rest of the house would go off the edge of the map.");
        g[key] = old;
    } else if (before.some(q => !after.some(a => a.e === q.e && a.space))) {
        note("That would cover the hidden area behind a wall slot that is in use. Clear that slot first.");
        g[key] = old;
    } else {
        const flags = house.segs.map(s => s.emergency), fix = fixExitRule();
        if (fix.ok) noteAdded(fix.added);
        else {
            note("No room for that: it would leave 3 locations in a row without a clear wall for an emergency exit.");
            g[key] = old;
            house.segs.forEach((s, k) => s.emergency = flags[k]);
        }
    }
    house.updateExits();
    edit();
}
function setExit(v) { changeLoc('exit', v) }
function setSide(v) { changeLoc('side', v) }

function setF(k, v) {
    sel[k] = v;
    sel.sanitize();
    edit();
}

function setup() {
    createCanvas(W, H).parent('cv');
    textFont('monospace');
}

// House units -> canvas px: a fixed scale, with the house centred on the canvas
function view() {
    const s = W / VIEW_W, b = house.bounds();
    return { s, tx: W / 2 - (b.x0 + b.x1) / 2 * s, ty: LAYOUT_H / 2 - (b.y0 + b.y1) / 2 * s };
}

// Would the house (as segs) fit inside the canvas?
function fitsCanvas(segs) {
    const b = house.bounds(segs), s = W / VIEW_W;
    return (b.x1 - b.x0) * s <= W - 2 * EDGE && (b.y1 - b.y0) * s <= LAYOUT_H - 2 * EDGE;
}

// Arrow at a turn: comes in along hin, leaves along hout
function cornerArrow(x, y, hin, hout) {
    push();
    translate(x, y);
    stroke(255, 170, 0);
    strokeWeight(2);
    noFill();
    const a = [-hin[0] * 12, -hin[1] * 12], c = [hout[0] * 12, hout[1] * 12];
    line(a[0], a[1], 0, 0);
    line(0, 0, c[0], c[1]);
    const back = [-hout[0] * 6, -hout[1] * 6], side = [-hout[1] * 5, hout[0] * 5];
    line(c[0], c[1], c[0] + back[0] + side[0], c[1] + back[1] + side[1]);
    line(c[0], c[1], c[0] + back[0] - side[0], c[1] + back[1] - side[1]);
    pop();
}

// Gap in a wall (local coordinates): paint over the wall line in floor colour
function doorGap(x1, y1, x2, y2) {
    stroke(24);
    strokeWeight(4);
    line(x1, y1, x2, y2);
}

function draw() {
    background(8);
    const V = view(),
        L = house.layout(),
        info = house.slotInfo(),
        list = house.slots();
    push();
    translate(V.tx, V.ty);
    scale(V.s);

    // Hidden staff areas behind walls (only where a wall slot has space)
    info.forEach(q => {
        if (!q.region || !q.space) return;
        fill(16, 12, 14);
        stroke(75, 60, 65);
        strokeWeight(1.5);
        drawingContext.setLineDash([4, 4]);
        rect(q.region.x0, q.region.y0, q.region.x1 - q.region.x0, q.region.y1 - q.region.y0);
        drawingContext.setLineDash([]);
    });

    // Floors and walls, each in its own (rotated) frame
    const EX = house.exits(); // where each location's emergency door is (if it has one)
    house.segs.forEach((g, i) => {
        const p = L.locs[i], b = g.body;
        push();
        translate(p.x, p.y);
        rotate(p.h * HALF_PI);
        fill(24);
        stroke(80);
        strokeWeight(2);
        rect(b[0], b[1], b[2] - b[0], b[3] - b[1]);
        // Turned into: its first BLIND_D units are the blind side (faint amber,
        // dashed line where it ends)
        if (i > 0 && house.segs[i - 1].kind == 'corner' && g.kind != 'corner') {
            const x1 = min(b[2], BLIND_D);
            noStroke();
            fill(255, 170, 0, 20);
            rect(b[0] + 1, b[1] + 1, x1 - b[0] - 1, b[3] - b[1] - 2);
            if (x1 < b[2]) {
                stroke(255, 170, 0, 110);
                strokeWeight(1.5);
                drawingContext.setLineDash([5, 5]);
                line(x1, b[1] + 1, x1, b[3] - 1);
                drawingContext.setLineDash([]);
            }
        }
        // Doorways: gaps in the wall at the entrance and the exit
        const ex = g.routeLocal()[g.routeLocal().length - 1];
        doorGap(0, -30, 0, 30);
        if (ex[1] == 0) doorGap(ex[0], -30, ex[0], 30);
        else doorGap(ex[0] - 30, ex[1], ex[0] + 30, ex[1]);
        // Emergency exit door (into the staff area)
        if (EX[i]) {
            const [mx, my] = EX[i].door;
            stroke(0, 200, 0);
            strokeWeight(5);
            // along the wall it sits in: an end wall (corner front) or a side wall
            if (mx == b[0] || mx == b[2]) line(mx, my - 14, mx, my + 14);
            else line(mx - 14, my, mx + 14, my);
        }
        // Selected location: yellow outline
        if (g === selLoc) {
            noFill();
            stroke(255, 200, 0);
            strokeWeight(3);
            rect(b[0] - 3, b[1] - 3, b[2] - b[0] + 6, b[3] - b[1] + 6, 4);
        }
        pop();
    });

    // Wall openings for wall slots: dashed while empty, solid when something is behind them
    info.forEach(q => {
        if (!q.opening || !q.space) return;
        const used = q.e.kind != 'empty';
        stroke(used ? color(200, 150, 90) : color(120));
        strokeWeight(used ? 5 : 3);
        if (!used) drawingContext.setLineDash([4, 4]);
        line(...q.opening);
        drawingContext.setLineDash([]);
    });

    if (!house.segs.length) {
        fill(120);
        noStroke();
        textAlign(CENTER, CENTER);
        textSize(16);
        text('Add a Room, Corridor or Corner to begin…', 20, 0); // centre of the empty map
    } else {
        // The visitors' route (dashed)
        const R = house.route(L);
        const pts = R.pts.slice(1, -1);
        pts.unshift([-40, 0]);
        const dn = L.doors[L.doors.length - 1], [hx, hy] = HEAD[dn.h];
        pts.push([dn.x + hx * 40, dn.y + hy * 40]);
        drawingContext.setLineDash([6, 6]);
        stroke(60);
        strokeWeight(1);
        for (let i = 1; i < pts.length; i++) line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
        drawingContext.setLineDash([]);
        // Turn arrows where the route changes direction
        house.segs.forEach((g, i) => {
            if (!g.turnPt) return;
            const [x, y] = toW(L.locs[i], ...g.turnPt);
            cornerArrow(x, y, HEAD[L.locs[i].h], HEAD[L.doors[i + 1].h]);
        });
    }

    // Slots
    let n = 0;
    list.forEach(q => {
        q.e.tick();
        if (q.e.kind != 'empty') n++;
        q.n = q.e.kind != 'empty' ? n : 0;
        if (q.door !== null) return; // doorways are drawn after the visitors
        if (q.blockedBy.length && q.e.kind == 'empty') {
            // ruled out by a neighbouring slot: faint cross
            noFill();
            stroke(50);
            strokeWeight(1);
            rect(q.x - 20, q.y - 20, 40, 40, 4);
            line(q.x - 10, q.y - 10, q.x + 10, q.y + 10);
            line(q.x + 10, q.y - 10, q.x - 10, q.y + 10);
            if (q.e === sel) { stroke(255, 200, 0); rect(q.x - 24, q.y - 24, 48, 48, 6); }
        } else {
            // Blind side: a scare just after a turn, amber outline + multiplier
            if (q.blind) {
                noFill();
                stroke(255, 170, 0);
                strokeWeight(2);
                rect(q.x - 35, q.y - 35, 70, 70, 8);
                noStroke();
                fill(255, 170, 0);
                textSize(10);
                textAlign(RIGHT, BOTTOM);
                text('×' + BLIND, q.x + 35, q.y - 37);
            }
            // Behind a visual block: curtain-red outline, multiplier top left
            if (q.behindBlock) {
                noFill();
                stroke(200, 60, 60);
                strokeWeight(2);
                rect(q.x - 33, q.y - 33, 66, 66, 7);
                noStroke();
                fill(220, 80, 80);
                textSize(10);
                textAlign(LEFT, BOTTOM);
                text('×' + BLOCK, q.x - 35, q.y - 37);
            }
            q.e.draw(q.x, q.y, q.n, q.e === sel);
        }
    });

    if (running && !paused) {
        spawnTimer++;
        // Keep sending visitors in until the group reaches MAX_VISITORS
        if (spawnTimer > 120 && group.length < MAX_VISITORS) {
            group.push(new Visitor(-20, group.length + 1, 0, 1.2));
            spawnTimer = 0;
        }
        group.forEach(v => v.update(list, group));

        const end = house.route(L).endD;
        if (group.every(v => v.out || v.d > end)) {
            running = false;
            summary();
        }
    }

    group.forEach(v => {
        if (!v.out) v.draw();
    });

    // Doorways: visual blocks, or a faint marker where one can go
    list.forEach(q => {
        if (q.door === null) return;
        if (q.e.kind == 'block') q.e.drawBlock(q.x, q.y, q.n, q.e === sel);
        else if (q.e === sel) {
            noFill();
            stroke(255, 200, 0);
            strokeWeight(2);
            ellipse(q.x, q.y, 30, 30);
        }
    });
    pop();

    updateExitStats();
    if (frameCount % 10 == 0) updateScareTable(list);

    if (running && !paused && frameCount % 10 == 0) {
        const f = group.length > 0 ? group.reduce((a, v) => a + v.fear, 0) / group.length : 0;
        document.getElementById('stats').textContent = 'Running… average fear ' + f.toFixed(0) + ' | panicked: ' + group.filter(v => v.fled).length;
    }
}

function updateExitStats() {
    const parts = [], ex = house.exits();
    house.segs.forEach((s, i) => {
        if (ex[i]) parts.push(`${locName(i)} exit: ${house.exitCounts[i]}`);
    });
    // panicked visitors who ran on out through the house exit (from the last location)
    if (house.segs.length && !ex[house.segs.length - 1]) parts.push(`House exit: ${house.fledOut || 0}`);
    document.getElementById('exit-counts').innerHTML = parts.join(' | ');
}

// What an encounter is, in a few words
function encDesc(e) {
    if (e.kind == 'block') return 'visual block (raises anticipation)';
    const bits = [e.core];
    if (e.conc != 'none') bits.push('behind ' + e.conc);
    if (e.vis != 'none') bits.push(e.vis);
    if (e.snd != 'none') bits.push(e.snd + ' sound');
    return e.kind + ': ' + bits.join(', ');
}

// Where an encounter is: a doorway, or a location's floor / wall slot
function encWhere(q) {
    if (q.door !== null) return q.door == 0 ? 'Entrance' : 'Doorway after ' + locName(q.door - 1);
    return locName(q.loc) + ' ' + q.place;
}

// Fear per encounter (numbered as on the map, in route order)
let lastTable = '';
function updateScareTable(list) {
    const rows = list.filter(q => q.n).map(q => {
        const e = q.e, avg = e.hits ? e.total / e.hits : 0;
        const bar = e.hits ? `<span class="bar" style="width:${min(100, avg * 1.5).toFixed(0)}%"></span>` : '';
        return `<tr><td>#${q.n}</td><td><span class="where">${encWhere(q)}</span><br>${encDesc(e)}</td>` +
            `<td class="num">${e.hits || '–'}</td><td class="num">${e.hits ? avg.toFixed(1) : '–'}${bar}</td>` +
            `<td class="num">${e.hits ? e.total.toFixed(0) : '–'}</td></tr>`;
    });
    const html = rows.length
        ? `<table><thead><tr><th>#</th><th>Encounter</th><th class="num">Hits</th>` +
          `<th class="num">Avg</th><th class="num">Total</th></tr></thead><tbody>${rows.join('')}</tbody></table>`
        : '<span class="mut">No encounters placed yet.</span>';
    if (html != lastTable) {
        document.getElementById('scare-stats').innerHTML = html;
        lastTable = html;
    }
}

function summary() {
    if (group.length === 0) {
        document.getElementById('stats').textContent = 'Test ended with no visitors.';
        return;
    }
    const p = group.reduce((a, v) => a + v.peak, 0) / group.length;
    document.getElementById('stats').textContent = 'Done. Average peak fear ' + p.toFixed(0) + ' | panicked: ' + group.filter(v => v.fled).length + '/' + group.length;
}

function mousePressed() {
    if (mouseX < 0 || mouseY < 0 || mouseX > W || mouseY > LAYOUT_H) return;
    const V = view(),
        mx = (mouseX - V.tx) / V.s,
        my = (mouseY - V.ty) / V.s,
        L = house.layout();
    // Doorways first (they sit on the route): empty -> place a block, block -> select it
    const k = L.doors.findIndex(d => dist(mx, my, d.x, d.y) < 30);
    if (k >= 0 && house.doors[k]) {
        if (house.doors[k].kind == 'empty') return putBlock(k);
        sel = house.doors[k];
        selLoc = null;
        edit();
        return;
    }
    let hit = null;
    house.slotInfo().forEach(q => {
        if (q.space && abs(mx - q.x) < 28 && abs(my - q.y) < 28) hit = q.e;
    });
    if (hit) {
        sel = hit;
        selLoc = null;
        edit();
        return;
    }
    // Clicked on a floor (not on a slot): select the location itself
    const li = house.segs.findIndex((g, i) => {
        const [lx, ly] = toL(L.locs[i], mx, my), b = g.body;
        return lx >= b[0] && lx <= b[2] && ly >= b[1] && ly <= b[3];
    });
    if (li >= 0) {
        selLoc = house.segs[li];
        sel = null;
        edit();
    }
}

function putBlock(k) {
    blk(house, [k]);
    sel = house.doors[k];
    selLoc = null;
    edit();
}

function rmBlock() {
    if (sel) sel.kind = 'empty';
    sel = null;
    edit();
}

function clearHouse() {
    stopRun();
    house = new House();
    sel = selLoc = null;
    edit();
    logs = [];
    document.getElementById('log').innerHTML = '';
}
