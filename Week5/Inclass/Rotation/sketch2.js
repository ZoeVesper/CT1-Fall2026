const numberCircles = 10
let radius
let strWeight = 20
let aWidth
let aHeight

function setup(){
    createCanvas(600, 600, document.getElementById("sk2"))
    
    colorMode(HSB, TWO_PI, 1, 1, 1)


    radius = width*0.1
}

function draw(){
    noFill()

    for(let i = 0; i < numberCircles; i++){
        stroke(TWO_PI/numberCircles*i, 0.8, 0.8)
        strokeWeight(strWeight)

        aWidth = radius * 2 + (strWeight * i * 2)
        aHeight = aWidth

        push()
        translate(width*0.5, height*0.5)
        rotate(sin( millis() *0.001) * (i*0.3+1) )
        arc(0, 0, aWidth, aHeight, 3/4*PI, 1/4*PI)
        pop()
        }
}

