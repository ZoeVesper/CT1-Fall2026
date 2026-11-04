let house = new House(),
    sel = null,
    group = [],
    running = false,
    paused = false,
    spawnTimer = 0,
    logs = [],
    W = 960,
    H = 440,
    MAX_VISITORS = 10;

function note(s) {
    logs.unshift(s);
    logs = logs.slice(0, 8);
    document.getElementById('log').innerHTML = logs.join('<br>');
}

function addLoc(l) {
    if (house.segs.length < 5) {
        // LINKING LOGIC: Link the entrance of the new location 
        // to the exit of the previous location.
        if (house.segs.length > 0) {
            let prevRoom = house.segs[house.segs.length - 1];
            // The entrance (index 0) of the new location is now the same object as the exit of the previous one
            // (use the PREVIOUS location's size, not the new one's)
            l.slots[0] = prevRoom.slots[prevRoom.cap - 1];
        }

        house.segs.push(l);
        house.updateExits();
        console.log("Added location. Total segments:", house.segs.length);
    }
}

function undo() {
    if (house.segs.length) {
        house.segs.pop();
        house.updateExits();
    }
    sel = null;
    edit();
}

function mk(L, a) {
    a.forEach((o, i) => Object.assign(L.slots[i], o));
}

// Put a visual block on doorways ks (blocks live in the doorway slots).
function blk(h, ks) {
    ks.forEach(k => {
        const e = h.doorway(k);
        e.kind = 'block';
        e.sanitize();
    });
}

// Stop any test that is running (used when the house is rebuilt).
function stopRun() {
    running = false;
    paused = false;
    group = [];
    document.getElementById('btnPause').textContent = "Pause";
}

function sample() {
    stopRun();
    house = new House();
    sel = null;
    const cue = { kind: 'cue', core: 'stationary', conc: 'display', vis: 'flashing' };
    
    // Room A (6 slots: Block, 4 Scares, Block)
    let a = new Room();
    // We define the middle scare slots only. 
    // 0 and 5 are left null to be linked and marked as 'block' later.
    mk(a, [null, {kind:'cue', core:'stationary'}, {kind:'scare', core:'actor', conc:'door', snd:'sudden'}, {kind:'turn'}, {kind:'scare', core:'actor', conc:'door', snd:'sudden'}, null]);

    // Corridor B (4 slots: Block, 2 Scares, Block)
    let b = new Corridor();
    mk(b, [null, cue, {kind:'turn'}, null]);

    // Corridor C (4 slots: Block, 2 Scares, Block)
    let c = new Corridor();
    mk(c, [null, cue, {kind:'turn'}, null]);

    // Room D (6 slots: Block, 4 Scares, Block)
    let d = new Room();
    mk(d, [null, {kind:'cue', core:'stationary', vis:'flashing'}, {kind:'scare', core:'actor', conc:'screen', vis:'darkness', snd:'sudden'}, {kind:'scare', core:'installation', conc:'shutter', vis:'darkness', snd:'sudden'}, {kind:'scare', core:'actor', conc:'door', snd:'sudden'}, null]);

    // 1. Add them to the house. 
    // addLoc will handle the "linking" of the shared doorway objects.
    addLoc(a);
    addLoc(b);
    addLoc(c);
    addLoc(d);

    // 2. NOW mark the entrance and exit slots as blocks.
    // Because they are shared objects, marking one side automatically marks the other.
    [a, b, c, d].forEach(loc => {
        loc.slots[0].kind = 'block';
        loc.slots[loc.cap - 1].kind = 'block';
    });

    edit();
}

function randomHouse() {
    stopRun();
    house = new House();
    sel = null;
    for (let i = 0; i < 3; i++) addLoc(random() < .5 ? new Room() : new Corridor());
    house.updateExits();
    house.segs.forEach(g => g.slots.forEach(e => {
        e.kind = random(['scare', 'scare', 'cue', 'turn', 'empty']);
        e.core = random(CORES);
        e.conc = random(CONC);
        e.vis = random(VIS);
        e.snd = random(SND);
        e.sanitize();
    }));
    // Doorways (one more than the number of locations) are either empty or a block.
    const doors = [];
    for (let k = 0; k <= house.segs.length; k++) {
        house.doorway(k).kind = 'empty';
        house.doorway(k).sanitize();
        if (random() < .5) doors.push(k);
    }
    blk(house, doors);
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

    const allSlots = house.slots();
    allSlots.forEach(slot => {
        slot.e.total = 0;
        slot.e.hits = 0;
        slot.e.logged = false;
        slot.e.open = 0;
        slot.e.reveal = 0;
    });

    for (let i = 0; i < 5; i++) {
        group.push(new Visitor(-i * 40, i + 1, 170, 1.2));
    }

    if (group.length === 5) {
        spawnTimer = 0;
        running = true;
        note("Test Started. Visitors entering...");
        document.getElementById('stats').textContent = "Running...";
    } else {
        note("Error: Failed to create visitors.");
        document.getElementById('stats').textContent = "Error during initialization.";
    }
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

function edit() {
    const el = document.getElementById('ed');
    if (!sel) {
        el.textContent = 'Select a slot…';
        return;
    }
    const e = sel;
    if (e.kind == 'block') {
        el.innerHTML = '<b>Visual block</b> – sits on an entrance/exit and uses no scare slot. A doorway shared by two locations holds just one block. <button onclick="rmBlock()">Remove block</button>';
        return;
    }
    let h = `<label>type <select onchange="setF('kind',this.value)">${opts(['empty', 'scare', 'cue', 'turn', 'block'], e.kind)}</select></label>`;
    if (e.kind == 'scare' || e.kind == 'cue') {
        h += `<label>core <select onchange="setF('core',this.value)">${opts(CORES, e.core)}</select></label>
         <label>concealment <select onchange="setF('conc',this.value)">${opts(e.kind == 'cue' ? ['none', 'display'] : CONC, e.conc)}</select></label>
         <label>visual <select onchange="setF('vis',this.value)">${opts(e.kind == 'cue' ? ['none', 'flashing'] : VIS, e.vis)}</select></label>`;
        if (e.kind == 'scare') h += `<label>sound <select onchange="setF('snd',this.value)">${opts(SND, e.snd)}</select></label>`;
    }
    el.innerHTML = h;
}

function setF(k, v) {
    sel[k] = v;
    sel.sanitize();
    edit();
}

function setup() {
    createCanvas(W, H).parent('cv');
    textFont('monospace');
}

function sc() {
    return min(1, (W - 40) / max(1, house.total));
}

function draw() {
    background(8);
    const s = sc(),
        list = house.slots();
    push();
    translate(20, 0);
    scale(s);
    let o = 0;
    noStroke();
    house.segs.forEach(g => {
        fill(24);
        stroke(80);
        strokeWeight(2);
        if (g.kind == 'room') rect(o + 4, 20, g.w - 8, 300);
        else rect(o + 4, 90, g.w - 8, 160);
        o += g.w;
        
        fill(0, 200, 0);
        noStroke();
        rect(g.exit.x, g.exit.y, 40, 20);
    });
    
    if (!house.segs.length) {
        fill(120);
        noStroke();
        textAlign(LEFT);
        textSize(16);
        text('Add a Room or Corridor to begin…', 20, 160);
    } else {
        stroke(60);
        strokeWeight(1);
        drawingContext.setLineDash([6, 6]);
        line(0, 170, house.total, 170);
        drawingContext.setLineDash([]);
    }

    let n = 0;
    list.forEach(q => {
        q.e.tick();
        if (q.e.kind != 'empty') n++;
        q.n = q.e.kind != 'empty' ? n : 0;
        if (q.e.kind != 'block') q.e.draw(q.x, q.y, q.n, q.e === sel);
    });

    if (running && !paused) {
        spawnTimer++;
        // Keep sending visitors in until the group reaches MAX_VISITORS,
        // otherwise new ones keep spawning and the test can never finish.
        if (spawnTimer > 120 && group.length < MAX_VISITORS) {
            group.push(new Visitor(-20, group.length + 1, 170, 1.2));
            spawnTimer = 0;
        }
        group.forEach(v => v.update(list, group));
        
        const allDone = group.every(v => v.out || v.x > (house.total + 40));
        if (allDone) {
            running = false;
            summary();
        }
    }

    group.forEach(v => {
        if (!v.out) v.draw();
    });

    list.forEach(q => {
        if (q.e.kind == 'block') q.e.drawBlock(q.x, q.y, q.n, q.e === sel);
    });

    list.forEach(q => {
        if (q.e.hits > 0) {
            const h = min(80, q.e.total / q.e.hits * 1.6);
            fill(192, 57, 43);
            noStroke();
            rect(q.x - 8, 430 - h, 16, h);
            fill(200);
            textSize(10);
            textAlign(CENTER);
            text('#' + q.n, q.x, 438);
        }
    });
    pop();

    updateExitStats();

    if (running && !paused && frameCount % 10 == 0) {
        const f = group.length > 0 ? group.reduce((a, v) => a + v.fear, 0) / group.length : 0;
        document.getElementById('stats').textContent = 'Running… average fear ' + f.toFixed(0) + ' | panicked: ' + group.filter(v => v.fled).length;
    }
}

function updateExitStats() {
    let html = "";
    house.segs.forEach((s, i) => {
        html += `Exit ${i}: ${house.exitCounts[i]} | `;
    });
    document.getElementById('exit-counts').innerHTML = html;
}

function summary() {
    if (group.length === 0) {
        document.getElementById('stats').textContent = 'Test ended with no visitors.';
        return;
    }
    const f = group.reduce((a, v) => a + v.fear, 0) / group.length;
    const p = group.reduce((a, v) => a + v.peak, 0) / group.length;
    document.getElementById('stats').textContent = 'Done. Average peak fear ' + p.toFixed(0) + ' | panicked: ' + group.filter(v => v.fled).length + '/' + group.length;
}

function mousePressed() {
    if (mouseX < 0 || mouseY < 0 || mouseX > W || mouseY > H) return;
    const s = sc(),
        mx = (mouseX - 20) / s,
        my = mouseY / s;
    let hit = null;
    house.slots().forEach(q => {
        const k = q.e.kind == 'block';
        if (abs(mx - q.x) < (k ? 16 : 28) && abs(my - q.y) < (k ? 46 : 28)) hit = q.e;
    });
    if (hit) {
        sel = hit;
        edit();
        return;
    }
    if (abs(my - 170) < 22 && house.segs.length) {
        let b = -1,
            bd = 40,
            o = 0;
        const xs = [12];
        house.segs.forEach(g => {
            o += g.w;
            xs.push(o);
        });
        xs[xs.length - 1] -= 12;
        xs.forEach((x, k) => {
            if (abs(mx - x) < bd) {
                bd = abs(mx - x);
                b = k;
            }
        });
        if (b >= 0) putBlock(b);
    }
}

function putBlock(k) {
    blk(house, [k]);
    sel = house.doorway(k);
    edit();
}

function addBlock() {
    if (!house.segs.length) {
        note("Add a location first.");
        return;
    }
    let k = -1;
    for (let i = 0; i <= house.segs.length; i++) {
        if (house.doorway(i).kind != 'block') { k = i; break; }
    }
    if (k < 0) note("Every entrance and exit already has a visual block.");
    else putBlock(k);
}

function rmBlock() {
    if (sel) sel.kind = 'empty';
    sel = null;
    edit();
}

function clearHouse() {
    stopRun();
    house = new House();
    sel = null;
    edit();
    group = [];
    logs = [];
    document.getElementById('log').innerHTML = '';
    document.getElementById('stats').textContent = 'No run yet.';
}
