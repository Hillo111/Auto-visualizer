var canvas = document.getElementById("visualizer");
var widthPX = canvas.width.animVal.value;
//while (canvas.height.animVal.value == 0)
var heightPX = canvas.height.animVal.value;
var widthM = 16.54;
var heightM = 8.02;

function mToPx(p){
    return [p[0] / widthM * widthPX, heightPX - p[1] / heightM * heightPX];
}

async function getPoints(points_file){
    var points = {};
    let response = await fetch(`${base_url}/${points_file}`);
    let text = await response.text();
    lines = text.split('\n');
    for (i = 0; i < lines.length; i ++){
        let l = lines[i].split(',');
        if (l.length < 3)
            continue;
        points[l[0]] = [parseFloat(l[1]), parseFloat(l[2])];
    }
    return new Promise(resolve => {
        setTimeout(() => {
            resolve(points);
        }, 0);
    });
}

function transformToRed(points){
    for (const pn in points){
        points[pn] = [(16.54 - points[pn][0]).toFixed(2), (8.02 - points[pn][1]).toFixed(2)]
    }
    return new Promise(resolve => {
        setTimeout(() => {
            resolve(points);
        }, 0);
    });
}

function clearCanvas(){
    document.getElementById('points').innerHTML = ''
    document.getElementById('trajectories').innerHTML = ''
    document.getElementById('labels').innerHTML = ''
}

function makeSVGElement(tag, attributes, innerHTML=""){
    // svg element are special and need a special xml to be created.
    // also this doesnt actually try to request it, it just happens to look like a uri
    let elem = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (let param in attributes) {elem.setAttribute(param, attributes[param]);} 
    elem.innerHTML = innerHTML;
    return elem;
}

function makeElement(tag, attributes){
    let elem = document.createElement(tag);
    for (let param in attributes) {elem.setAttribute(param, attributes[param]);} 
    return elem;
}

function drawPoints(points, color){
    let markers = makeSVGElement('g', {id: color});
    let labels = makeSVGElement('g', {id: color})

    let rect_width = 120;
    let left_side_offset = 10

    for (const pn in points){
        const x = points[pn];
        pPX = mToPx(points[pn]);
        // add marker + marker label
        let circle_params = {
            "cx": `${pPX[0]}`, "cy" : `${pPX[1]}`, "id": `point`, "fill": color, r: "5", stroke: "black", "stroke-width": "2", "style": "position: relative"
        };
        let point = makeSVGElement('g', {id: pn})
        let circle = makeSVGElement('circle', circle_params)
        point.appendChild(circle);
        point.appendChild(makeSVGElement(
            'text', 
            {id:`name`, x:`${pPX[0] + 10}`, y:`${pPX[1] + 5}`, fill:"black", style:"font-size:12px; pointer-events: none;"},
            pn
        ))
        markers.appendChild(point)

        // add label elements
        let full_label = makeSVGElement('g', {id: pn, style: 'display: none'})
        pPX = mToPx(points[pn]);
        let offset = left_side_offset
        if (pPX[0] > widthPX / 2)
            offset = -rect_width - left_side_offset
        let bg = makeSVGElement(
            "rect", 
            {"style": "fill:rgb(255,255,255);stroke-width:3;stroke:rgb(0,0,0);", "id": `labelbg`, "x": `${pPX[0] + offset}`, "y": `${pPX[1] - 20}`, "width": `${rect_width}`, "height": "50"}
        )
        full_label.appendChild(bg)
        let label = makeSVGElement(
            "text", 
            {"id":`labelname`, "x":`${pPX[0] + offset + 5}`, "y":`${pPX[1] - 3}`, "fill":"black", "style":"font-size:16px; pointer-events: none;"},
            pn
        )
        full_label.appendChild(label)
        let coords = makeSVGElement(
            "text",
            {id:`labelcoords`,"x":`${pPX[0] + offset + 5}`,"y":`${pPX[1] + 20}`, "fill":"black", "style":";font-size:16px"},
            `(${points[pn][0]}, ${points[pn][1]})`
        )
        full_label.appendChild(coords)
        labels.appendChild(full_label)

        // assign mouse events for point
        circle.onmouseover = ()=>{
            canvas.querySelector('#labels').querySelector('#' + color).querySelector('#' + pn).style.display = "block"
        }
        circle.onmouseout = () => {
            canvas.querySelector('#labels').querySelector('#' + color).querySelector('#' + pn).style.display = "none"
        }
    }

    canvas.getElementById("points").appendChild(markers)
    canvas.getElementById("labels").appendChild(labels)

    return new Promise(resolve => {
        setTimeout(() => {
            resolve();
        }, 0);
    });
}

function makeArrowPoints(x, y, angle, size=2){
    if (angle < 360)
        angle += 360
    angle = angle / 180 * Math.PI;
    let mx = Math.cos(angle), my = Math.sin(angle);
    let front_d = 4 * size, back_d = -2 * size;
    let front = `${x + mx * front_d},${y + my * front_d}`, back = `${x + mx * back_d},${y + my * back_d}`
    let angle_off = (35) / 180.0 * Math.PI, angle_up = angle + angle_off, angle_down = angle - angle_off;
    let accent_d = -4 * size;
    let accent_up = `${x + Math.cos(angle_up) * accent_d},${y + Math.sin(angle_up) * accent_d}`, accent_down = `${x + Math.cos(angle_down) * accent_d},${y + Math.sin(angle_down) * accent_d}`
    return front + " " + accent_up + " " + back + " " + accent_down
}

function drawInstance(instance, t, backwards=false){
    let pos = mToPx([instance['x'], instance['y']])
    return (makeSVGElement(
        'polygon',
        {points: makeArrowPoints(pos[0], pos[1], instance["angle"] + (backwards ? 180 : 0)), style: `fill:rgb(0, ${255 * t}, 0); stroke: black; stroke-width: 1`}
    ))
}

function clearTrajectories(){
    canvas.getElementById("trajectories").innerHTML = "";
}

function invertInstance(instance){
    instance['x'] = 16.54 - instance['x']
    instance['y'] = 8.02 - instance['y']
    return instance
}

function deepCopy(json){
    return JSON.parse(JSON.stringify(json))
}

function drawTrajectory(trajectory, traj_number, isBlue){
    let trajDiv = makeSVGElement(
        'g',
        {}
    )
    trajDiv.id = `${traj_number}`
    for (let i = 0; i < trajectory.length; i += 5){
        let instance = deepCopy(trajectory[i]);
        instance['angle'] = - instance['angle']
        if (!isBlue){
            instance = invertInstance(instance);
        }
        trajDiv.appendChild(drawInstance(instance, i / (trajectory.length - 1), !isBlue))
    }
    let instance = deepCopy(trajectory[trajectory.length - 1]);
    instance['angle'] = -instance['angle']
    if (!isBlue){
        instance = invertInstance(instance);
    }
    trajDiv.appendChild(drawInstance(instance, 1, !isBlue))
    canvas.getElementById('trajectories').appendChild(trajDiv);
    return trajDiv;
}