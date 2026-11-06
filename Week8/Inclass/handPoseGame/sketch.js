let handPose
let video

async function setup() {
  createCanvas(800, 600)

  video = createCapture(VIDEO)

  handPose = await ml5.handPose();
}

function draw() {

}