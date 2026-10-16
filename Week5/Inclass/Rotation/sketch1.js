let angle = 0

function setup() {
    createCanvas(800, 600, document.getElementById("sk1"));
}

function draw() {
    background(220);

    stroke(0, 0, 0)

    makeGrid()
    fill(250, 50, 0)
    rect(100, 70, 200, 150)

    push()
    translate(200, 145) 
    rotate(angle)
    fill(250, 50, 0)
    rect(-100, -75, 200, 150)

    makeGrid()

    pop()

    angle += 0.01

}

function makeGrid(gridRes = 10){
    let xVal = width/gridRes
    for(let x = 0; x < gridRes; x++){
        line(xVal * x, 0, xVal * x, height)
    }
    let yVal = height/gridRes
    for(let y = 0; y < gridRes; y++){
        line(0, yVal * y, width, yVal * y)
    }

} 