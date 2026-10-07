let img1 = document.getElementById("image1")
let img2 = document.getElementById("image2")
let img3 = document.getElementById("image3")
let img4 = document.getElementById("image4")

let mainImg = document.getElementById("mainImage")

let imgNumber = 1

let changingImageAutomatically = function(){

    if(imgNumber == 1){
        mainImg.src = img1.src
        imgNumber = 2
    }

    else if(imgNumber == 2){
        mainImg.src = img2.src
        imgNumber = 3
    }

    else if(imgNumber == 3){
        mainImg.src = img3.src
        imgNumber = 4
    }

    else{
        mainImg.src = img4.src
        imgNumber = 1
    }

}

let pauseBtn = document.getElementById("pauseButton")
let playBtn = document.getElementById("playButton")

let imageTimer = setInterval(changingImageAutomatically, 3000)

let pauseImage = function(){
    clearInterval(imageTimer)
}

let playImage = function(){
    clearInterval(imageTimer)
    imageTimer = setInterval(changingImageAutomatically, 3000)
}

pauseBtn.addEventListener("click", pauseImage)
playBtn.addEventListener("click", playImage)

let changingImage1 = function(){
    mainImg.src = img1.src
    clearInterval(imageTimer)
    imgNumber = 2
}

let changingImage2 = function(){
    mainImg.src = img2.src
    clearInterval(imageTimer)
    imgNumber = 3
}

let changingImage3 = function(){
    mainImg.src = img3.src
    clearInterval(imageTimer)
    imgNumber = 4
}

let changingImage4 = function(){
    mainImg.src = img4.src
    clearInterval(imageTimer)
    imgNumber = 1
}

img1.addEventListener("click", changingImage1)
img2.addEventListener("click", changingImage2)
img3.addEventListener("click", changingImage3)
img4.addEventListener("click", changingImage4)

let disableRightClick = function(event){
    event.preventDefault()
}

img1.addEventListener("contextmenu", disableRightClick)
img2.addEventListener("contextmenu", disableRightClick)
img3.addEventListener("contextmenu", disableRightClick)
img4.addEventListener("contextmenu", disableRightClick)
mainImg.addEventListener("contextmenu", disableRightClick)