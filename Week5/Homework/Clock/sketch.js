const numberCircle = 6
let radius
let strWeight = 20
let aWidth
let aHeight

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
    fill(255)
    circle(0, 0, 10)

    for (let i = 0; i < 60; i++) {
        let angle = map(i, 0, 60, 0, TWO_PI) - HALF_PI

        let x = cos(angle) * 65
        let y = sin(angle) * 65

        let dotSize = (i % 5 === 0) ? 6 : 3
        
        circle(x, y, dotSize)
    }
    

}