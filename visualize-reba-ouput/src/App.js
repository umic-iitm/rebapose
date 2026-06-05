import { useState, useEffect } from 'react';
import './App.css';
import 'bootstrap/dist/css/bootstrap.css'

import {dump} from 'js-yaml'

function App() {
  const [imageList, setImageList] = useState([]);
  const [jsonList, setJsonList] = useState({});
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    // Fetch the list of image files from the src folder
    const importAll = (r) => r.keys().map(r);
    const images = importAll(require.context('./images', false, /\.(png|jpe?g|svg)$/));
    const jsons = importAll(require.context('./jsons', false, /\.(json)$/));
    // console.log(images)
    setImageList(images);
    // console.log(dump(jsons))
    jsons.forEach(element => {
      setJsonList(old => {
        let id = Number(element.id)
        if(old.hasOwnProperty(id) && old[id].constructor === Set){
          old[id]?.add(element)
          // old[element.id] = new Set(old[element.id])
        }else{
          old[id] = new Set([element])
        }
        return old;
      })
    });
    

  }, []);

  const getJsonsForId = (img) => {

    let imageId = Number(img.split('/').pop().split('.')[0])

    let jsonArray = [...jsonList[imageId]]
    let table = []
    for(let item of jsonArray){
      let data = []
      let header = []
      for(let [jsonKey, jsonVal] of Object.entries(item.reba.individualScore)){
        header.push(<th>{jsonKey}</th>)
        data.push(<td>{dump(jsonVal)}</td>)
      }
      
      table.push(<><div>{item.file_name} {dump(item.reba.aggregateScore)}</div><table className='table table-bordered' key={item.id + Math.random()}>
        <thead>
          <tr>{header}</tr>
          </thead>
          <tbody>
        <tr>{data}</tr>

          </tbody>

      </table></>)
      
    }
     


    return table


  }


  const nextImage = () => {
    // console.log(jsonList)
    setCurrentImageIndex((prevIndex) => (prevIndex + 1) % imageList.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prevIndex) =>
      prevIndex === 0 ? imageList.length - 1 : prevIndex - 1
    );
  };







  return (
    <div className="App">
      <h1>Reba Visualizer</h1>
      {imageList.length > 0 && (
        <div>
          
          <div className=''>
            <div className='col'>
            <img className='p-1' src={imageList[currentImageIndex]} alt={`img not loaded ${currentImageIndex}`} height={500}  />
            </div>
            <div className=' p-1'>
            <button className=' btn btn-primary m-1' onClick={prevImage}>Previous</button>
            <button className=' btn btn-primary m-1' onClick={nextImage}>Next</button>
            <div className=' primary p-1'>Image Id: 
            {Number(imageList[currentImageIndex]?.split('/')?.pop()?.split('.')[0])}
            </div>
          </div>
            <div className='col'>
                {imageList[currentImageIndex] &&  getJsonsForId(imageList[currentImageIndex])}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
