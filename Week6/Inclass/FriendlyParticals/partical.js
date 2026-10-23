class Particle {
    constructor(_x, _y){
        this.pos = createVector(_x, _y)
        this.size = 60
        this.velocity = createVector(random(-4, 4), random(-3, 3))
        this.accel = createVector(0, 0)
        this.clr = color(random(255), random(255), random(255))
        this.friendliness = random(70, 250)
    }

    move(){
        this.velocity.add(this.accel)
        this.pos.add(this.velocity)

        if(this.pos.x - this.size*0.5 <= 0){
            this.velocity.x *= -1
            this.pos.x = this.size*0.5
        }

        if(this.pos.x + this.size*0.5 >= width){
            this.velocity.x *= -1
            this.pos.x = width - this.size*0.5
        }

        if(this.pos.y - this.size*0.5 <= 0){
            this.velocity.y *= -1
            this.pos.y = this.size*0.5
        }
            
        if(this.pos.y + this.size*0.5 >= height){
            this.velocity.y *= -1
            this.pos.y = height - this.size*0.5
        }
    }

    display(){
        fill(this.clr)
        circle(this.pos.x, this.pos.y, this.size)
    }

    reachOut(_allparticles){
        _allparticles.forEach((p) => {
            if(this.pos.dist(p.pos) <= this.friendliness){
                stroke(255)
                line(this.pos.x, this.pos.y, p.pos.x, p.pos.y)
            }
        })
    }

}