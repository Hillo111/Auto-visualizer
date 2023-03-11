function getAuto(auto_name){
    fetch(`${base_url}/${auto_name}`)
    .then(function(response) {return response.text()})
    .then(function(text) {
        document.getElementById("autoEditor").value = text;
    });
}

var autoOptions = [];
var trajectories = {};

function drawAuto(){
    let auto = getChecked();
    if (!(auto in trajectories))
        return;
    let color = "";
    if (blueSideSelector.checked){
        color = "blue"
    } else if (redSideSelector.checked){
        color = "red"
    } else {
        return;
    }
        
    let auto_trajectories = trajectories[auto][color];
    let r = getSliderVals()
    clearTrajectories();
    for (let i = r[0]; i <= r[1]; i ++){
        drawTrajectory(auto_trajectories[i]['states'], i, color == "blue")
    }
}

(async function (){
    autoOptions = await (await fetch(`${base_url}/vals/auto-options`)).json();
    autoOptions.sort();
    for (let i = 0; i < autoOptions.length; i ++){
        let li = document.createElement("li")
        let button = document.createElement("input")
        button.type = "radio"
        button.name = "auto"
        button.id = autoOptions[i]
        let label = document.createElement("label")
        label.innerHTML = autoOptions[i]
        li.appendChild(button)
        li.appendChild(label)

        document.getElementById("autoList").appendChild(li)

        button.onclick = () => {
            getAuto(autoOptions[i])

            let state_count = trajectories[autoOptions[i]]["blue"].length
            let slides = document.getElementById("trajectorySelector").getElementsByTagName("input");
            slides[0].max = `${state_count - 1}`;
            slides[1].max = `${state_count - 1}`;
            slides[0].value = "0";
            slides[1].value = `${state_count - 1}`
            var displayElement = document.getElementById("trajectorySelector").getElementsByClassName("rangeValues")[0];
            displayElement.innerHTML = "Trajectories " + 1 + " - " + (state_count);

            drawAuto();
        };

        trajectories[autoOptions[i]] = await (await fetch(`${base_url}/${autoOptions[i]}.json`)).json()
    }
})();

function getChecked(){
    for (let i = 0; i < autoOptions.length; i ++){
        if (document.getElementById(autoOptions[i]).checked)
            return autoOptions[i];
    }
    return NaN
}

document.getElementById("loadAuto").onclick = () => {
    let selected_auto = getChecked();
    getAuto(selected_auto);
    fetch(`${base_url}/${selected_auto}.json`)
    .then(response=>{return response.json()})
    .then(json=>{
        clearTrajectories();
        console.log(json)
        trajectories[selected_auto] = json;
        drawAuto()
    })
};

document.getElementById("submitAuto").onclick = async () => {
    let selected_auto = getChecked();
    fetch(`${base_url}/`,{
        method: 'POST',
        body: JSON.stringify({
            cmd: 'update-auto',
            name: selected_auto,
            content: document.getElementById("autoEditor").value
        })
    })
    .then(response=>{return response.json()})
    .then(json=>{
        clearTrajectories();
        trajectories[selected_auto] = json;
        drawAuto()
    })
};

var bluePointsCheck = document.getElementById("bluePointsEnabler"), redPointsCheck = document.getElementById("redPointsEnabler");

let bPoints, rPoints;
var updated_points = false;
async function updatePoints(){
    bPoints = await getPoints("blue_points.csv")
    rPoints = await getPoints("red_points.csv")
    rPoints = await transformToRed(rPoints);
}
let blue_things, red_things;

var made = {"blue": false, "red": false}

bluePointsCheck.onclick = () => {
    Array.from(canvas.getElementById("points").querySelector('#blue').children).forEach(element=>{
        element.style.display = bluePointsCheck.checked ? "block" : "none";
    })
};
redPointsCheck.onclick = () => {
    Array.from(canvas.getElementById("points").querySelector('#red').children).forEach(element=>{
        element.style.display = redPointsCheck.checked ? "block" : "none";
    })
};

async function drawAllPoints(){
    heightPX = canvas.height.animVal.value
    blue_things = await drawPoints(bPoints, "blue");
    red_things = await drawPoints(rPoints, "red")
    return new Promise(resolve => {
        setTimeout(() => {
            resolve();
        }, 0);
    });
}

bluePointsCheck.checked = true;
redPointsCheck.checked = true;
(async function (){
    await updatePoints();
    await drawAllPoints();
})();

function getSliderVals(){
    // Get slider values
    var parent = document.getElementById('trajectorySelector');
    var slides = parent.getElementsByTagName("input");
        var slide1 = parseFloat( slides[0].value );
        var slide2 = parseFloat( slides[1].value );
    // Neither slider will clip the other, so make sure we determine which is larger
    if( slide1 > slide2 ){ var tmp = slide2; slide2 = slide1; slide1 = tmp; }
        
    return [slide1, slide2]
}

window.onload = function(){
    // Initialize Sliders
    var sliderSections = document.getElementsByClassName("range-slider");
    const sect = sliderSections[0];
    for( var x = 0; x < sliderSections.length; x++ ){
        var sliders = sliderSections[x].getElementsByTagName("input");
        for( var y = 0; y < sliders.length; y++ ){
            if( sliders[y].type ==="range" ){
                sliders[y].oninput = ()=>{
                    let sliderVals = getSliderVals();
                    let slide1 = sliderVals[0], slide2 = sliderVals[1];
                    var displayElement = sect.getElementsByClassName("rangeValues")[0];
                    displayElement.innerHTML = "Trajectories " + (slide1 + 1) + " - " + (slide2 + 1);
                    drawAuto();
                };
                // Manually trigger event first time to display values
                // sliders[y].oninput();
            }
        }
    }
}

var blueSideSelector = document.getElementById("sideSelector").querySelector('#blue')
blueSideSelector.onclick = ()=>{
    drawAuto()
}
blueSideSelector.checked = true;
var redSideSelector = document.getElementById("sideSelector").querySelector('#red')
redSideSelector.onclick = ()=>{
    drawAuto()
}