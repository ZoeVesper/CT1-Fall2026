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

    for (let i = 0; i < numberCircle; i++) {
        noFill();
        stroke(255);
        strokeWeight(strWeight)
        strokeCap(PROJECT)

        let aWidth = radius * 2 + (strWeight * i * 2);
        let aHeight = aWidth;

        push();
        rotate(sin(millis() * 0.001) * 0.5 * (i * 0.5 + 5))

        arc(0, 0, aWidth, aHeight, 15/16 * PI, 17/16 * PI)
        arc(0, 0, aWidth, aHeight, -1/16 * PI, 1/16 * PI)
        
        pop()
    }

}