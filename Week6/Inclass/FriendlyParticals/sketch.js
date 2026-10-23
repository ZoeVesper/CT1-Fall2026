let particles = []

function setup() {
    createCanvas(800, 600)
    particles.push(new Particle(width/2, height/2))
}

function draw() {
    background(0)

    particles.forEach((p)=>{
        p.move()
        p.display()
        p.reachOut(particles)
    })
}

function mouseReleased(event){
    particles.push(new Particle(mouseX, mouseY))
}