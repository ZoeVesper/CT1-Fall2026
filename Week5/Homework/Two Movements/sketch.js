const numberCircle = 6
let radius
let strWeight = 20
let aWidth
let aHeight
let noiseSpeed = 0.005

function setup() {
    createCanvas(600, 600)
    radius = width * 0.2
}

function draw() {
    background(0, 20)
    translate(width/2, height/2)

    noFill()
    stroke(255)
    strokeWeight(2)
    circle(0, 0, 150)

    strokeCap(ROUND)

    let now = new Date()

    let s = now.getSeconds() + now.getMilliseconds()/1000
    let m = now.getMinutes() + s/60
    let h = now.getHours() + m/60

    let secondAngle = map(s, 0, 60, 0, TWO_PI) - HALF_PI
    let minuteAngle = map(m, 0, 60, 0, TWO_PI) - HALF_PI
    let hourAngle = map(h, 0, 12, 0, TWO_PI) - HALF_PI

    stroke(255)
    strokeWeight(8)
    line(0, 0, cos(hourAngle) * 30, sin(hourAngle) * 30)

    strokeWeight(5)
    line(0, 0, cos(minuteAngle) * 45, sin(minuteAngle) * 45)

    strokeWeight(2)
    line(0, 0, cos(secondAngle) * 60, sin(secondAngle) * 60)

    noStroke()
    let t = frameCount * noiseSpeed
        
    fill(noise(t, 0)*255, noise(t + 0.5, 0.02)*255, noise(t + 0.3, 0.07)*255)
    circle(0, 0, 12)

    for (let i = 0; i < 60; i++) {
        fill(255)
        let angle = map(i, 0, 60, 0, TWO_PI) - HALF_PI

        let x = cos(angle) * 65
        let y = sin(angle) * 65

        let dotSize = (i % 5 === 0) ? 6 : 3
        
        circle(x, y, dotSize)
    }

    for (let i = 0; i < numberCircle; i++) {
        noFill()

        let t = frameCount * noiseSpeed
        
        stroke(noise(t, 0)*255, noise(t + 0.5, 0.02)*255, noise(t + 0.3, 0.07)*255)
        strokeWeight(strWeight)
        strokeCap(PROJECT)

        let swing = sin(s * TWO_PI) * PI / 6;

        let aWidth = radius * 2 + (strWeight * i * 2);
        let aHeight = aWidth;

        let offset = TWO_PI / numberCircle * i;
        let arcLength = PI / 8

        push();
        rotate(swing*(i*0.5+1))

        arc(0, 0, aWidth, aHeight, 15 / 16 * PI + offset, 15 / 16 * PI + offset + arcLength);

        arc(0, 0, aWidth, aHeight, -1 / 16 * PI + offset, -1 / 16 * PI + offset + arcLength);

        pop()
}

}