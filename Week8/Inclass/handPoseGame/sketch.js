let handPose
let video
let hands = []

async function setup() {
  createCanvas(640, 480)

  video = createCapture(VIDEO)
  video.size(640, 480)
  video.hide()

  handPose = await ml5.handPose();

  handPose.detectStart(video, gotHands)
}

function draw() {
  background(220)

  if(hands[0]){
    fill(255, 0, 0)
    circle(hands[0].index_finger_tip.x, hands[0].index_finger_tip.y, 15)

    fill(0, 255, 0)
    circle(hands[0].thumb_tip.x, hands[0].thumb_tip.y, 15)
  }

}

function gotHands(results) {
  console.log(results)
  hands = results
}