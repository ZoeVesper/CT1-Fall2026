let clrArea = document.getElementById("colorArea")
let imgToToggle = document.getElementById("imgToToggle")
console.log(imgToToggle)
let clrBtn = document.getElementById("colorButton")
let txtBtn = document.getElementById("textButton")
let imgBtn = document.getElementById("imageButton")

let changingColor = ()=>{
    let redC = Math.random()*255
    let greenC = Math.random()*255
    let blueC = Math.random()*255
    clrArea.style.backgroundColor = "rgb("+ redC +", "+ greenC +", "+ blueC +")"
}

let addingText = ()=>{
    let p = document.createElement("p")
    console.log(p)
    p.innerHTML = "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum."
    clrArea.append(p)
}

let changingImage = ()=>{
    if(imgToToggle.alt == "Cobra."){
        imgToToggle.src = "Images/Message.png"
        imgToToggle.alt = "The medium is the message."
    }
    else {
        if(imgToToggle.alt == "The medium is the message."){
            imgToToggle.src = "Images/image3.jpeg"
            imgToToggle.alt = "image 3."
        }
        else{
            imgToToggle.src = "Images/Cobra.jpg"
            imgToToggle.alt = "Cobra."
        }
    }
}

clrBtn.addEventListener("click", changingColor)
txtBtn.addEventListener("click", addingText)
imgBtn.addEventListener("click", changingImage)