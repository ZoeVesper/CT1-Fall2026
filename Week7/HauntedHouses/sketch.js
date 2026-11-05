// Fixed map scale: the canvas shows VIEW_W x VIEW_H house units, whatever the
// house looks like, and that is also the limit on how big a house can be.
// Width: 6 rooms in 2 rows of 3 (908 units with their hidden areas, slot
// labels, the queue and the way out). Height: room (side exit) + corridor +
// corner + corridor + room stacked up (692 units), plus the 8 px edge margin.
const VIEW_W = 924,
    VIEW_H = 708,
    EDGE = 8; // everything stays at least this many px inside the canvas edge

let house = new House(),
    sel = null,     // selected slot (Encounter)
    selLoc = null,  // selected Room/Corridor/Corner
    group = [],     // visitors in or near the house
    finished = [],  // visitors who have left (kept for the end-of-test summary)
    nextId = 1,
    running = false,
    paused = false,
    spawnTimer = 0,
    logs = [],
    W = 960,
    H = Math.round(960 * VIEW_H / VIEW_W), // 736
    LAYOUT_H = H; // the house fills the canvas (fear per encounter is in the table below it)

const NAMES = { room: 'Room', corridor: 'Corridor', corner: 'Corridor' };
function locName(i) { return NAMES[house.segs[i].kind] + ' ' + (i + 1) }

function note(s) {
    logs.unshift(s);
    logs = logs.slice(0, 8);
    document.getElementById('log').innerHTML = logs.join('<br>');
}

// Used slots whose hidden area would be lost if the house changed to segs
// (slots of a location that segs leaves out don't count: they go with it)
function lostSlots(segs) {
    const after = house.slotInfo(segs);
    return house.slotInfo().filter(q => q.space && q.e.kind != 'empty' && segs.includes(house.segs[q.loc]) &&
        !after.some(a => a.e === q.e && a.space));
}

// Why the house can't change to segs (null if it can): two locations would
// overlap, a location would stand across the way in or out, it would leave the
// canvas, or a used wall slot would lose its hidden area.
function layoutProblem(segs, checkSlots = true) {
    if (house.collides(segs)) return "No room for that: it would run into another part of the house.";
    if (house.blocksWay(segs)) return "No room for that: the way into or out of the house would run into another part of it.";
    if (!fitsCanvas(segs)) return "No room for that: it would go off the edge of the map.";
    if (checkSlots && lostSlots(segs).length) return "That would cover the hidden area behind a wall slot that is in use. Clear that slot first.";
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
    finished = [];
    nextId = 1;
    document.getElementById('btnPause').textContent = "Pause";
    document.getElementById('stats').textContent = 'No test yet.';
}

// Randomise, four ways (encounters = scares, cues and visual blocks):
//   randomLayout()     - Layout: a new random layout with no encounters (the player fills it)
//   randomEncounters() - Encounters: keep the player's layout, random encounters everywhere
//   randomHouse()      - All: a new random layout with random encounters
//   randomSelected()   - Selected: random encounter(s) in the selected slot or location

// The Randomise ▾ menu in Build: run the chosen action, then show the menu's
// name again, so the same action can be picked twice in a row
function runMenu(menu, actions) {
    const run = actions[menu.value];
    menu.value = '';
    if (run) run();
}

function randomise(menu) {
    runMenu(menu, { layout: randomLayout, encounters: randomEncounters, all: randomHouse, selected: randomSelected });
}

// "Clear Encounter" in the selection panel: empty the selected slot, or take the
// visual block off the selected doorway
function removeSelected() {
    const q = selInfo();
    if (q) {
        if (q.e.kind == 'empty') {
            note("That slot is already empty.");
            return;
        }
        stopRun();
        const was = q.e.kind == 'block' ? 'visual block' : q.e.kind;
        q.e.kind = 'empty';
        q.e.sanitize();
        q.e.total = q.e.hits = 0;
        edit();
        note("Removed the " + was + (q.door !== undefined && q.door !== null ? " from the doorway slot." : " in " + locName(q.loc) + "."));
        return;
    }
}

// "Clear Encounters" in a location's panel: empty every slot of the selected
// location (the location itself stays)
function clearLocEncounters() {
    const i = house.segs.indexOf(selLoc);
    if (i < 0) return;
    stopRun();
    let n = 0;
    Object.values(selLoc.enc).forEach(e => {
        if (e.kind == 'empty') return;
        e.kind = 'empty';
        e.sanitize();
        e.total = e.hits = 0;
        n++;
    });
    edit();
    note(n ? "Removed " + n + " encounter" + (n == 1 ? "" : "s") + " in " + locName(i) + "." : locName(i) + " has no encounters.");
}

// Take location i out of the house. The one before it then connects straight
// to the one after it, the same way as when building (the doorway between them
// keeps its visual block, if any). Refused, with the reason, if they can't be
// joined like that: the rest of the house would run into itself, block the way
// in or out, leave the map or cover a used wall slot's hidden area, or no wall
// would be left for the emergency exits that every 3 locations need.
// A used wall slot whose hidden area the joined-up house would cover is
// emptied (and named in the log) instead of refusing.
function removeLoc(i) {
    const name = locName(i), gone = house.segs[i];
    const joins = i > 0 && i < house.segs.length - 1;
    const segs = house.segs.filter((_, k) => k != i);
    // the build message, reworded: "No room for that: it would…" -> "the rest of the house would…"
    let p = segs.length ? layoutProblem(segs, false) : null;
    if (p) {
        p = p.replace(/^No room for that: it/, 'the rest of the house').replace(/^No room for that: /, '').replace(/^That/, 'that');
        note("Can't remove " + name + ": " + (joins ? locName(i - 1) + " and " + locName(i + 1) + " can't be joined, " : "") + p);
        return false;
    }
    const lost = segs.length ? lostSlots(segs) : [];
    stopRun();
    const old = { segs: house.segs, doors: house.doors.slice(), flags: house.segs.map(s => s.emergency) };
    house.segs = segs;
    house.doors.splice(i + 1, 1); // the removed location's exit doorway
    if (!segs.length) house.doors = [];
    const fix = fixExitRule();
    if (!fix.ok) {
        house.segs = old.segs;
        house.doors = old.doors;
        house.segs.forEach((s, k) => s.emergency = old.flags[k]);
        note("Can't remove " + name + ": there would be 3 locations in a row with no clear wall for an emergency exit.");
        return false;
    }
    // empty the slots that lost their hidden area (named by their location as it is now)
    const cleared = lost.map(q => {
        q.e.kind = 'empty';
        q.e.sanitize();
        q.e.total = q.e.hits = 0;
        return locName(q.loc > i ? q.loc - 1 : q.loc);
    });
    if (selLoc === gone) selLoc = null;
    sel = null;
    house.updateExits();
    edit();
    note("Removed " + name + (joins ? ": the locations on either side are now joined." : "."));
    if (cleared.length) note("Emptied " + cleared.length + " wall slot" + (cleared.length == 1 ? "" : "s") +
        " whose hidden area is now covered: in " + [...new Set(cleared)].join(', ') + ".");
    noteAdded(fix.added);
    return true;
}

function randomHouse() {
    randomLayout(false);
    fillSlots(() => true);
    blk(house, house.doors.map((_, k) => k).filter(() => random() < .4));
    edit();
    note("New random layout with random encounters.");
}

function randomEncounters() {
    if (!house.segs.length) {
        note("Build a layout first (or Randomise → All).");
        return;
    }
    stopRun();
    house.doors.forEach(d => { d.kind = 'empty'; d.sanitize(); });
    fillSlots(() => true);
    blk(house, house.doors.map((_, k) => k).filter(() => random() < .4));
    sel = null;
    edit();
    note("New random encounters for this layout.");
}

// Randomise → Selected: a selected slot gets a new random encounter; a selected
// location gets new random encounters in all of its slots
function randomSelected() {
    const q = selInfo();
    if (q && q.door !== undefined && q.door !== null) {
        // a doorway slot only holds a visual block
        stopRun();
        blk(house, [q.door]);
        q.e.total = q.e.hits = 0;
        edit();
        note("New visual block in the doorway slot.");
        return;
    }
    if (q) {
        if (q.blockedBy && q.blockedBy.length) {
            note("This slot is blocked by the " + q.blockedBy[0].place + " slot next to it.");
            return;
        }
        stopRun();
        randomEnc(q.e);
        q.e.total = q.e.hits = 0;
        edit();
        note("New random " + q.e.kind + " in " + locName(q.loc) + ".");
        return;
    }
    const i = selLoc ? house.segs.indexOf(selLoc) : -1;
    if (i < 0) {
        note("Select a slot, or a room or corridor (click inside it on the map), first.");
        return;
    }
    stopRun();
    fillSlots(q => q.loc === i);
    edit();
    note("New random encounters in " + locName(i) + ".");
}

// Give a slot a random scare or cue
function randomEnc(e) {
    e.kind = random(['scare', 'scare', 'cue']);
    e.core = random(CORES);
    e.conc = random(e.concOptions());
    e.vis = random(VIS);
    e.snd = random(SND);
    e.sanitize();
}

// Empty the slots that pick(q) chooses, then fill them in random order,
// skipping any that a neighbouring slot already rules out
function fillSlots(pick) {
    const mine = house.slotInfo().filter(q => q.door === undefined || q.door === null).filter(pick);
    mine.forEach(q => {
        q.e.kind = 'empty';
        q.e.sanitize();
        q.e.total = q.e.hits = 0;
    });
    shuffle(mine).forEach(q => {
        const info = house.slotInfo().find(o => o.e === q.e);
        if (!info.space || info.blockedBy.length || random() < .35) return;
        randomEnc(q.e);
    });
}

// announce = called on its own from the page (a layout with empty slots)
function randomLayout(announce = true) {
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
    if (announce) {
        edit();
        note("New random layout with no encounters, ready for yours.");
    }
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
    document.getElementById('stats').textContent = 'Starting…';

    house.slots().forEach(slot => {
        slot.e.total = 0;
        slot.e.hits = 0;
        slot.e.logged = false;
        slot.e.open = 0;
        slot.e.reveal = 0;
    });
    house.segs.forEach(g => g.turnLogged = false);

    // the first visitor enters straight away; the rest follow one by one (see draw)
    group.push(new Visitor(-20, nextId++, 0, 1.2));
    spawnTimer = 0;
    running = true;
    note("Test started. Visitors are entering…");
    document.getElementById('stats').textContent = "Running…";
}

function togglePause() {
    if (!running) return;
    paused = !paused;
    document.getElementById('btnPause').textContent = paused ? "Resume" : "Pause";
    if (paused) note("Test paused.");
    else note("Test resumed.");
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

// The selection panel: settings on the left, its buttons on the right, the
// same layout (and height) for a location, a slot, a doorway or nothing
function edit() {
    const el = document.getElementById('ed');
    const show = (main, actions = '') =>
        el.innerHTML = `<div class="ed-main">${main}</div>` + (actions ? `<div class="ed-actions">${actions}</div>` : '');
    if (selLoc && !house.segs.includes(selLoc)) selLoc = null;
    if (selLoc) {
        const i = house.segs.indexOf(selLoc), g = selLoc;
        let h = `<b>${locName(i)}</b>`;
        if (g.kind == 'room')
            h += `<label>Exit <select onchange="setExit(this.value)">${opts(['straight', 'left', 'right'], g.exit)}</select></label>`;
        else if (g.kind == 'corner')
            h += `<label>Turns <select onchange="setSide(this.value)">${opts(['left', 'right'], g.side)}</select></label>`;
        // Emergency exit option (placed automatically where its wall is clear)
        const noSpot = g.emergency && !house.exits()[i];
        h += `<label><input type="checkbox" onchange="setEmergency(this.checked)" ${g.emergency ? 'checked' : ''}> Emergency Exit</label>` +
            (noSpot ? '<span style="color:#dc5050">No clear wall for it</span>' : '');
        return show(h, `<button onclick="clearLocEncounters()">Clear Encounters</button>
            <button onclick="removeLoc(${i})">Remove ${NAMES[g.kind]}</button>`);
    }
    const q = selInfo();
    if (!q) {
        sel = null;
        return show('Select a slot or a location…');
    }
    const e = q.e;
    if (q.door !== undefined && q.door !== null) {
        // A doorway slot (on the dashed path) holds only a visual block
        const types = e.kindOptions().map(x =>
            `<option value="${x}" ${x == e.kind ? 'selected' : ''}>${x == 'block' ? 'Visual Block' : cap(x)}</option>`).join('');
        return show(`<b>Doorway Slot</b><label>Type <select onchange="setF('kind',this.value)">${types}</select></label>`,
            e.kind == 'block' ? '<button onclick="removeSelected()">Clear Encounter</button>' : '');
    }
    if (q.blockedBy && q.blockedBy.length)
        return show(`<b>Blocked</b> by the ${q.blockedBy[0].place} slot next to it`);
    const where = q.place == 'wall' ? '<b>Wall Slot</b>' : '<b>Floor Slot</b>';
    const slot = house.slots().find(o => o.e === e);
    let h = where + (slot && slot.blind ? ` <span style="color:#ffaa00">×${BLIND}</span>` : '') +
        (slot && slot.behindBlock ? ` <span style="color:#dc5050">×${BLOCK}</span>` : '') +
        `<label>Type <select onchange="setF('kind',this.value)">${opts(e.kindOptions(), e.kind)}</select></label>`;
    if (e.kind == 'scare' || e.kind == 'cue') {
        h += `<label>Core <select onchange="setF('core',this.value)">${opts(CORES, e.core)}</select></label>
         <label>Concealment <select onchange="setF('conc',this.value)">${opts(e.concOptions(), e.conc)}</select></label>
         <label>Visual <select onchange="setF('vis',this.value)">${opts(e.kind == 'cue' ? ['none', 'flashing'] : VIS, e.vis)}</select></label>`;
        if (e.kind == 'scare') h += `<label>Sound <select onchange="setF('snd',this.value)">${opts(SND, e.snd)}</select></label>`;
        return show(h, '<button onclick="removeSelected()">Clear Encounter</button>');
    }
    show(h);
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

async function setup() {
    createCanvas(W, H).parent('cv');
    textFont('monospace');
    // The artist's own pictures for the map (see MAP_PICTURES in class.js).
    // One that can't be loaded is skipped: that element keeps its drawn icon.
    for (const [name, file] of Object.entries(MAP_PICTURES)) {
        try {
            IMG[name] = await loadImage('Icon/' + file + '.png');
        } catch (err) {
            console.warn('Could not load Icon/' + file + '.png', err);
        }
    }
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
        // (The blind side after a corner isn't shaded: its slots carry the
        // amber outline and ×1.5 instead.)
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

    // Selected location: yellow outline, drawn after every floor so a location
    // built later (and drawn later) can't cover it
    const si = house.segs.indexOf(selLoc);
    if (si >= 0) {
        const p = L.locs[si], b = selLoc.body;
        push();
        translate(p.x, p.y);
        rotate(p.h * HALF_PI);
        noFill();
        stroke(255, 200, 0);
        strokeWeight(3);
        rect(b[0] - 3, b[1] - 3, b[2] - b[0] + 6, b[3] - b[1] + 6, 4);
        pop();
    }

    if (!house.segs.length) {
        fill(120);
        noStroke();
        textAlign(CENTER, CENTER);
        textSize(16);
        text('Add a Room or Corridor to begin…', 20, 0); // centre of the empty map
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
        if (q.door !== null) {
            // An empty doorway is a slot for a visual block: a faint dashed
            // curtain-red square with a "+" (drawn under the visitors; a block
            // itself is drawn after them)
            if (q.e.kind != 'block') {
                noFill();
                stroke(150, 60, 60, 150);
                strokeWeight(1.5);
                drawingContext.setLineDash([4, 3]);
                rect(q.x - 22, q.y - 22, 44, 44, 4);
                drawingContext.setLineDash([]);
                noStroke();
                fill(150, 60, 60, 170);
                textAlign(CENTER, CENTER);
                textSize(18);
                text('+', q.x, q.y);
            }
            return;
        }
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
            // Bonus outlines hug the icon (at most 5 units out), so they never
            // reach a neighbouring slot's icon, even one only a few units away.
            // Labels go on the slot's outer side (labelSide / labelSpots).
            const side = labelSide(q), spot = labelSpots(side);
            // Blind side: a scare just after a turn, amber outline + multiplier
            if (q.blind) {
                noFill();
                stroke(255, 170, 0);
                strokeWeight(2);
                rect(q.x - 30, q.y - 30, 60, 60, 6);
                noStroke();
                fill(255, 170, 0);
                textSize(10);
                textAlign(spot.blind[2], spot.blind[3]);
                text('×' + BLIND, q.x + spot.blind[0], q.y + spot.blind[1]);
            }
            // Behind a visual block: curtain-red outline (inside the amber one)
            if (q.behindBlock) {
                noFill();
                stroke(200, 60, 60);
                strokeWeight(2);
                rect(q.x - 28, q.y - 28, 56, 56, 5);
                noStroke();
                fill(220, 80, 80);
                textSize(10);
                textAlign(spot.block[2], spot.block[3]);
                text('×' + BLOCK, q.x + spot.block[0], q.y + spot.block[1]);
            }
            q.e.draw(q.x, q.y, q.n, q.e === sel, side);
        }
    });

    if (running && !paused) {
        spawnTimer++;
        // A new visitor every 2 seconds (120 frames), at the same pace from start
        // to finish, until the test is paused or ended
        if (spawnTimer >= 120) {
            group.push(new Visitor(-20, nextId++, 0, 1.2));
            spawnTimer = 0;
        }
        group.forEach(v => v.update(list, group));

        // Visitors who have left (by an exit, or walked well past the house exit)
        // move to `finished`, so the crowd on the map doesn't keep growing
        const end = house.route(L).endD;
        group = group.filter(v => {
            const gone = v.out || v.d > end + 120;
            if (gone) finished.push(v);
            return !gone;
        });
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
            // same rounded square as a selected visual block on a doorway
            rect(q.x - 31, q.y - 31, 62, 62, 6);
        }
    });
    pop();

    updateExitStats();
    if (frameCount % 10 == 0) updateScareTable(list);

    if (running && !paused && frameCount % 10 == 0) {
        const f = group.length > 0 ? group.reduce((a, v) => a + v.fear, 0) / group.length : 0;
        const all = [...finished, ...group];
        document.getElementById('stats').textContent = 'Running… visitors ' + all.length + ' | average fear ' + f.toFixed(0) +
            ' | panicked: ' + all.filter(v => v.fled).length;
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
    const all = [...finished, ...group];
    if (all.length === 0) {
        document.getElementById('stats').textContent = 'Test ended with no visitors.';
        return;
    }
    const p = all.reduce((a, v) => a + v.peak, 0) / all.length;
    document.getElementById('stats').textContent = 'Done. ' + all.length + ' visitors | average peak fear ' + p.toFixed(0) +
        ' | panicked: ' + all.filter(v => v.fled).length + '/' + all.length;
}

// Space pauses or resumes a running test (p5 calls this on every key press).
// Returning false stops the page from scrolling, and a focused button (Start
// Test, say) from being pressed by the Space key as well.
function keyPressed() {
    if (key !== ' ' || !running) return;
    const f = document.activeElement;
    if (f && (f.tagName == 'SELECT' || f.tagName == 'INPUT')) return; // Space belongs to that control
    if (f && f.tagName == 'BUTTON') f.blur(); // or the browser outlines the last clicked button
    togglePause();
    return false;
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

function clearHouse() {
    stopRun();
    house = new House();
    sel = selLoc = null;
    edit();
    logs = [];
    document.getElementById('log').innerHTML = '';
}

// Empty every slot and doorway: scares, cues and visual blocks all go; the
// layout and emergency exits stay as they are
function clearEncounters() {
    stopRun();
    let n = 0;
    const all = [...house.doors];
    house.segs.forEach(s => all.push(...Object.values(s.enc)));
    all.forEach(e => {
        if (e.kind == 'empty') return;
        e.kind = 'empty';
        e.sanitize();
        e.total = e.hits = 0;
        n++;
    });
    sel = null;
    edit();
    note(n ? "Removed " + n + " encounter" + (n == 1 ? "" : "s") + " (scares, cues and visual blocks)." : "No encounters to remove.");
}
