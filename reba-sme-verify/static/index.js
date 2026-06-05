let width = window.innerWidth;
let height = window.innerHeight;

let colorCoding = {}
let stage = null
let pose_label = ['forehead', 'neck', 'center_hip'];
let pose_label_index = 0
let json_data = {}
let score_track = {}

window.onload = () => {

  

  stage = new Konva.Stage({
    container: 'konva-container',
    width: width / 2.5,
    height: height,
  });
  layer = new Konva.Layer();  
  stage.add(layer);
  console.log(stage);
  
  fetch_json_file('home')
  ////////////// FOR SCROLL ZOOMING  //////////////////
  let scaleBy = 1.15;
  stage.on('wheel', (e) => {
    // stop default scrolling
    e.evt.preventDefault();

    let oldScale = stage.scaleX();
    let pointer = stage.getPointerPosition();

    let mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    // how to scale? Zoom in? Or zoom out?
    let direction = e.evt.deltaY > 0 ? -1 : 1;

    // when we zoom on trackpad, e.evt.ctrlKey is true
    // in that case lets revert direction
    if (e.evt.ctrlKey) {
      direction = -direction;
    }

    let newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;

    stage.scale({ x: newScale, y: newScale });

    let newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };
    stage.position(newPos);
  });

}

function add_image_and_points(stage, jsondata, pose_label_index) {
  document.getElementById('question').innerText = pose_label[pose_label_index]
  let layer = stage.children[0];
  
  let group = new Konva.Group({
    draggable: true,
  });

  if(!jsondata['image_name']){let simpleText = new Konva.Text({
    x: 10,
    y: 15,
    text: 'Thats all the Images. Thanks for Participating!',
    fontSize: 20,
    fontFamily: 'Calibri',
    fill: 'black',
  });
  group.add(simpleText)
  layer.removeChildren()
  layer.add(group)}
  // main API:
  let imageObj = new Image();
  imageObj.onload = function () {
    let yoda = new Konva.Image({
      image: imageObj,
      width: stage.attrs.width,
      height: stage.attrs.height,
    });
    group.add(yoda);
    
    add_pose_points.call(this, stage, group, jsondata, pose_label[pose_label_index]);
    layer.removeChildren()
    layer.add(group);
    
  };
  imageObj.alt = "Thats all the images!"
  if(jsondata['image_name']){
    imageObj.src = '/static/images/' + jsondata['image_name'];
  }
}

function add_pose_points(stage, group, jsondata, point_label) {

      var rect1 = new Konva.Rect({
        x: jsondata['bbox'][0] / this.width * stage.attrs.width,
        y: jsondata['bbox'][1] / this.height * stage.attrs.height,
        width: jsondata['bbox'][2] / this.width * stage.attrs.width,
        height: jsondata['bbox'][3] / this.height * stage.attrs.height,
        stroke: 'white',
        strokeWidth: 1,
      });
      group.add(rect1);

      let three_set_points = jsondata[point_label];
      console.log(three_set_points);
      colors = ['red', 'blue'];

      random = Math.floor(Math.random() * 2)
      
      if(random == 1){
        colorCoding = {[colors[0]]:'reba', [colors[1]]:'yolo'}
        // reba
        let points1 = three_set_points['reba']
        let circle1 = new Konva.Circle({
          x: points1[0] / this.width * stage.attrs.width,
        y: points1[1] / this.height * stage.attrs.height,
        radius: 2,
        fill: colors[0],
        stroke: 'black',
        strokeWidth: 0.5,
      });
      group.add(circle1);
      // Yolo
      let points2 = three_set_points['yolo']
      let circle2 = new Konva.Circle({
        x: points2[0] / this.width * stage.attrs.width,
      y: points2[1] / this.height * stage.attrs.height,
      radius: 2,
      fill: colors[1],
      stroke: 'black',
      strokeWidth: 0.5,
    });
    group.add(circle2);
      
    }else {
      colorCoding = {[colors[1]]:'reba', [colors[0]]:'detectron'}
      // Detectron
      let points1 = three_set_points['detectron']
      let circle1 = new Konva.Circle({
        x: points1[0] / this.width * stage.attrs.width,
      y: points1[1] / this.height * stage.attrs.height,
      radius: 2,
      fill: colors[0],
      stroke: 'black',
      strokeWidth: 0.5,
    });
    group.add(circle1);
    // Reba
    let points2 = three_set_points['reba']
    let circle2 = new Konva.Circle({
      x: points2[0] / this.width * stage.attrs.width,
    y: points2[1] / this.height * stage.attrs.height,
    radius: 2,
    fill: colors[1],
    stroke: 'black',
    strokeWidth: 0.5,
  });
  group.add(circle2);
    }
    
}


function submitSurvey(event) {
  event.preventDefault();
  

  if(event.target.mark[0].checked == true){
    score_track[pose_label[pose_label_index % 3]][colorCoding['blue']] += 1
  }else{
    score_track[pose_label[pose_label_index % 3]][colorCoding['red']] += 1
  }

  event.target.reset();



  pose_label_index = pose_label_index + 1

  if(pose_label_index % 3 == 0){
    fetch_json_file('submit')
    score_track['annotations'] += 1
    console.log(score_track)
    json_data['score'] = score_track
    fetch('/add_score_person', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(json_data),
    })
    .then(response => response)
    .then(data => {
      console.log('Success:', data);
    })
    .catch((error) => {
      console.error('Error:', error);
    });
    
    }
    add_image_and_points(stage, json_data, pose_label_index % 3)
  
}

function fetch_json_file(home) {
  fetch('/get_next_json?home=' + home)
    .then(response => response.json())
    .then(data => {
        json_data = data
        add_image_and_points(stage, json_data, pose_label_index % 3)
        score_track = data['score']
      }).catch(error =>{
        console.log(error)
        json_data = null
      })
}

