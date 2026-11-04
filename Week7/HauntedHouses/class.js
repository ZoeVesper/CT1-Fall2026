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
            logged: false
        });
    }

    sanitize() {
        if (this.kind == 'cue') {
            if (!['none', 'display'].includes(this.conc)) this.conc = 'none';
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

    drawBlock(x, y, n, s) {
        push();
        translate(x, y);
        if (s) {
            noFill();
            stroke(255, 200, 0);
            strokeWeight(2);
            rect(-26, -46, 52, 92, 6);
        }
        noStroke();
        const sw = this.open * 6;
        for (let i = -3; i <= 3; i++) {
            fill(120 + i * 4, 25, 28, 238);
            rect(i * 7 - 3 + sin(frameCount * .3 + i) * sw, -42, 6, 84 + (i % 2 ? -8 : 0));
        }
        fill(150);
        textSize(10);
        textAlign(CENTER, CENTER);
        if (n) text('#' + n, 0, 56);
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
        } else if (this.kind == 'turn') {
            fill(200, 170, 90);
            triangle(-12, -16, 14, 0, -12, 16);
            fill(18);
            triangle(-16, -16, 6, 0, -16, 16);
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

class Location {
    constructor() {
        this.slots = Array.from({ length: this.cap }, () => new Encounter());
    }
}

class Room extends Location {
    get cap() { return 6 } // Entrance, 4 Scare Slots, Exit
    get w() { return 240 }
    get kind() { return 'room' }
    pos(i) {
        const xPositions = [5, 40, 90, 150, 200, 235];
        const yPositions = [170, 95, 245, 95, 245, 170];
        return [xPositions[i], yPositions[i]];
    }
}

class Corridor extends Location {
    get cap() { return 4 } // Entrance, 2 Scare Slots, Exit
    get w() { return 150 }
    get kind() { return 'corridor' }
    pos(i) {
        const xPositions = [5, 40, 110, 145];
        const yPositions = [170, 130, 210, 170];
        return [xPositions[i], yPositions[i]];
    }
}

class House {
    constructor() {
        this.segs = [];
        this.bl = [null];
    }
    get total() { return this.segs.reduce((a, s) => a + s.w, 0) }
    
    updateExits() {
        let o = 0;
        this.segs.forEach((s) => {
            // Gate positions are basically the boundaries between segments
            s.exit = { x: o + s.w, y: 170 };
            o += s.w;
        });
    }

    slots() {
        let o = 0, r = [];
        const n = this.segs.length;
        this.segs.forEach((s, si) => {
            s.slots.forEach((e, i) => {
                let p = s.pos(i);
                r.push({ e, x: o + p[0], y: p[1] });
            });
            o += s.w;
        });
        return r.sort((a, b) => a.x - b.x);
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
            targetExitIdx: null
        });
    }

    update(list, grp) {
        if (this.fled) {
            let nearest = null;
            let minDist = Infinity;
            let currentNearestIdx = null;

            house.segs.forEach((s, idx) => {
                let d = Math.hypot(this.x - s.exit.x, this.y - s.exit.y);
                if (d < minDist) {
                    minDist = d;
                    nearest = s.exit;
                    currentNearestIdx = idx;
                }
            });

            if (nearest) {
                let angle = Math.atan2(nearest.y - this.y, nearest.x - this.x);
                this.x += Math.cos(angle) * 3;
                this.y += Math.sin(angle) * 3;
            }

            if (minDist < 10) {
                this.out = true;
                if (currentNearestIdx !== null) {
                    house.exitCounts[currentNearestIdx]++;
                }
            }
            return;
        }

        this.x += this.sp * (1 - this.ant / 250);
        this.focus = max(0, this.focus - 1);
        this.numb = max(0, this.numb - .0006);
        this.fear *= .9985;

        for (const o of list) {
            if (!this.done.has(o.e) && o.e.kind != 'empty' && abs(this.x - o.x) < 14) {
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
        } else if (e.kind == 'turn') {
            this.ant = min(60, this.ant + 6);
            this.focus = 0;
        } else if (e.kind == 'cue') {
            this.focus = 150;
            this.add(e, 4 + (e.vis == 'flashing' ? 4 : 0), grp, o);
        } else {
            let m = 1 + this.ant / 100, why = '';
            if (this.focus > 0) {
                m *= 1.7;
                why = ' (misdirection ×1.7)';
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
            if (v !== this && !v.fled && abs(v.x - this.x) < 60) v.fear += d * .25;
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
        pop();
    }

}
