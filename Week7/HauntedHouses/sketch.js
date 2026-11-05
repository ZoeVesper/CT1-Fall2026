let house = new House(),
    sel = null,     // selected slot (Encounter)
    selLoc = null,  // selected Room/Corridor/Corner
    group = [],
    running = false,
    paused = false,
    spawnTimer = 0,
    logs = [],
    W = 960,
    H = 520,
    LAYOUT_H = 420, // the house is drawn above this line, the fear chart below
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

// Try to change the house to segs: refuse if two locations would overlap,
// or if a used wall slot would lose its hidden area.
function tryLayout(segs) {
    if (house.collides(segs)) {
        note("No room for that: it would run into another part of the house.");
        return false;
    }
    if (lostSlots(segs).length) {
        note("That would cover the hidden area behind a wall slot that is in use. Clear that slot first.");
        return false;
    }
    return true;
}

function addLoc(l) {
    if (house.segs.length >= MAX_LOCS) {
        note("A house has at most " + MAX_LOCS + " locations.");
        return false;
    }
    if (!tryLayout([...house.segs, l])) return false;
    if (!house.doors.length) house.doors.push(newDoor()); // house entrance
    house.segs.push(l);
    house.doors.push(newDoor());                           // this location's exit
    house.updateExits();
    selLoc = l; // show its settings straight away
    sel = null;
    edit();
    return true;
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
    let tries = 0;
    while (house.segs.length < 5 && tries++ < 60) {
        const k = random(['room', 'room', 'corridor', 'corridor', 'cornerL', 'cornerR']);
        const l = k == 'room' ? new Room(random(['straight', 'straight', 'left', 'right']))
            : k == 'corridor' ? new Corridor()
                : new Corner(k == 'cornerL' ? 'left' : 'right');
        if (!house.collides([...house.segs, l])) {
            if (!house.doors.length) house.doors.push(newDoor());
            house.segs.push(l);
            house.doors.push(newDoor());
        }
    }
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

function opts(a, v) {
    return a.map(x => `<option ${x == v ? 'selected' : ''}>${x}</option>`).join('');
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
        const turnedInto = i > 0 && house.segs[i - 1].exitTurn != 0;
        const blind = turnedInto ? ` Visitors turned to get here, so they could not see it coming: its scares are on the blind side (×${BLIND}).` : '';
        if (g.kind == 'room') {
            el.innerHTML = `<b>${locName(i)}</b> &nbsp; <label style="color:inherit">exit
                <select onchange="setExit(this.value)">${['straight', 'left', 'right'].map(v => `<option value="${v}" ${g.exit == v ? 'selected' : ''}>${{ straight: 'straight on (front wall)', left: 'turn left (left wall)', right: 'turn right (right wall)' }[v]}</option>`).join('')}</select></label><br>
                4 floor slots and 2 slots behind each wall. Using a floor slot rules out the two wall slots next to it, and the other way round.
                Visitors walk to the centre and out through the exit; a side exit is a direction change, so the next location is on the blind side.${blind}`;
        } else if (g.kind == 'corner') {
            el.innerHTML = `<b>${locName(i)}</b> &nbsp; <label style="color:inherit">turns
                <select onchange="setSide(this.value)">${opts(['left', 'right'], g.side)}</select></label><br>
                A corridor turn. One slot behind the front wall and one behind the outer side wall. The location after it is on the blind side.${blind}`;
        } else {
            el.innerHTML = `<b>${locName(i)}</b> – one direction only, entrance and exit at the two ends. One slot behind each side wall; nothing on the floor. Add a corner to change direction.${blind}`;
        }
        return;
    }
    const q = selInfo();
    if (!q) {
        sel = null;
        el.textContent = 'Select a slot, or click inside a room/corridor/corner to see its settings…';
        return;
    }
    const e = q.e;
    if (q.door !== undefined && q.door !== null) {
        el.innerHTML = e.kind == 'block'
            ? '<b>Visual block</b> – a curtain across the doorway; uses no scare slot. <button onclick="rmBlock()">Remove block</button>'
            : '<b>Doorway</b> – click it on the canvas, or <button onclick="setF(\'kind\',\'block\')">add a visual block</button>';
        return;
    }
    if (q.blockedBy && q.blockedBy.length) {
        el.innerHTML = `<b>Blocked</b> – the ${q.blockedBy[0].place} slot next to it is in use. Clear that one to use this slot.`;
        return;
    }
    const where = q.place == 'wall' ? '<b>Wall slot</b> (hidden behind the wall, shown through an opening)' : '<b>Floor slot</b>';
    let h = `${where} &nbsp; <label>type <select onchange="setF('kind',this.value)">${opts(e.kindOptions(), e.kind)}</select></label>`;
    if (e.kind == 'scare' || e.kind == 'cue') {
        h += `<label>core <select onchange="setF('core',this.value)">${opts(CORES, e.core)}</select></label>
         <label>concealment <select onchange="setF('conc',this.value)">${opts(e.concOptions(), e.conc)}</select></label>
         <label>visual <select onchange="setF('vis',this.value)">${opts(e.kind == 'cue' ? ['none', 'flashing'] : VIS, e.vis)}</select></label>`;
        if (e.kind == 'scare') h += `<label>sound <select onchange="setF('snd',this.value)">${opts(SND, e.snd)}</select></label>`;
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
    } else if (before.some(q => !after.some(a => a.e === q.e && a.space))) {
        note("That would cover the hidden area behind a wall slot that is in use. Clear that slot first.");
        g[key] = old;
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

// Fit the whole house into the top LAYOUT_H pixels of the canvas
function view() {
    if (!house.segs.length) return { s: 1, tx: 20, ty: 0 };
    const b = house.bounds();
    const bw = b.x1 - b.x0, bh = b.y1 - b.y0;
    const s = min(1, (W - 40) / bw, (LAYOUT_H - 20) / bh);
    return { s, tx: (W - bw * s) / 2 - b.x0 * s, ty: (LAYOUT_H - bh * s) / 2 - b.y0 * s };
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
    house.segs.forEach((g, i) => {
        const p = L.locs[i], b = g.body;
        push();
        translate(p.x, p.y);
        rotate(p.h * HALF_PI);
        fill(24);
        stroke(80);
        strokeWeight(2);
        rect(b[0], b[1], b[2] - b[0], b[3] - b[1]);
        // Turned into: the whole location is the blind side
        if (i > 0 && house.segs[i - 1].exitTurn != 0) {
            noStroke();
            fill(255, 170, 0, 22);
            rect(b[0] + 1, b[1] + 1, b[2] - b[0] - 2, b[3] - b[1] - 2);
        }
        // Doorways: gaps in the wall at the entrance and the exit
        const ex = g.routeLocal()[g.routeLocal().length - 1];
        doorGap(0, -30, 0, 30);
        if (ex[1] == 0) doorGap(ex[0], -30, ex[0], 30);
        else doorGap(ex[0] - 30, ex[1], ex[0] + 30, ex[1]);
        // Emergency exit door (into the staff area)
        if (g.emergencyLocal) {
            const [mx, my] = g.emergencyLocal();
            stroke(0, 200, 0);
            strokeWeight(5);
            line(mx - 14, my, mx + 14, my);
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

    // EXIT labels (upright)
    house.segs.forEach((g, i) => {
        const f = house.fleeTarget(i, L);
        if (!f) return;
        noStroke();
        fill(0, 200, 0);
        textSize(8);
        textAlign(CENTER, CENTER);
        const c = toW(L.locs[i], ...g.flee().via);
        const dx = f.door[0] - c[0], dy = f.door[1] - c[1], dl = Math.hypot(dx, dy) || 1;
        text('EXIT', f.door[0] + dx / dl * 12, f.door[1] + dy / dl * 12);
    });

    if (!house.segs.length) {
        fill(120);
        noStroke();
        textAlign(LEFT);
        textSize(16);
        text('Add a Room, Corridor or Corner to begin…', 0, 160);
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
        } else q.e.draw(q.x, q.y, q.n, q.e === sel);
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
        if (q.e.kind == 'block') q.e.drawBlock(q.x, q.y, q.n, q.e === sel, q.h * HALF_PI);
        else if (q.e === sel) {
            noFill();
            stroke(255, 200, 0);
            strokeWeight(2);
            ellipse(q.x, q.y, 30, 30);
        }
    });
    pop();

    // Fear chart: one bar per numbered encounter, in route order, along the bottom
    stroke(40);
    strokeWeight(1);
    line(20, LAYOUT_H + 2, W - 20, LAYOUT_H + 2);
    list.forEach(q => {
        if (q.e.hits > 0 && q.n) {
            const x = 20 + (q.n - 0.5) * (W - 40) / max(1, n);
            const h = min(70, q.e.total / q.e.hits * 1.4);
            fill(192, 57, 43);
            noStroke();
            rect(x - 8, H - 18 - h, 16, h);
            fill(200);
            textSize(10);
            textAlign(CENTER, CENTER);
            text('#' + q.n, x, H - 9);
        }
    });

    updateExitStats();

    if (running && !paused && frameCount % 10 == 0) {
        const f = group.length > 0 ? group.reduce((a, v) => a + v.fear, 0) / group.length : 0;
        document.getElementById('stats').textContent = 'Running… average fear ' + f.toFixed(0) + ' | panicked: ' + group.filter(v => v.fled).length;
    }
}

function updateExitStats() {
    const parts = [];
    house.segs.forEach((s, i) => {
        if (s.flee()) parts.push(`${locName(i)} exit: ${house.exitCounts[i]}`);
    });
    document.getElementById('exit-counts').innerHTML = parts.join(' | ');
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
