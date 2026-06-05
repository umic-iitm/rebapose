import {
  forwardRef,
  useRef,
  useState,
  useCallback,
  useImperativeHandle,
} from "react"
import { Stage, Layer, Circle, Image, Group, Rect } from "react-konva"

const Canvas = forwardRef(
  (
    {
      image,
      points,
      selectedPoint,
      pointsColor,
      setSelectedPoint,
      updatePointOnClick,
      isPointsHidden,
    },
    ref
  ) => {
    const [canvasWidth, setCanvasWidth] = useState(null)
    const [pointerPos, setPointerPos] = useState(["-", "-"])

    const stageRef = useRef(null)
    const layerRef = useRef(null)
    const groupRef = useRef(null)

    const handleImageScalingForButton = (scaleFactor) => {
      var oldScale = layerRef.current.scaleX()
      var newScale = oldScale * scaleFactor

      layerRef.current.scale({ x: newScale, y: newScale })

      var mousePointTo = {
        x: (stageRef.current.width() / 2 - layerRef.current.x()) / oldScale,
        y: (stageRef.current.height() / 2 - layerRef.current.y()) / oldScale,
      }

      var newPos = {
        x: stageRef.current.width() / 2 - mousePointTo.x * newScale,
        y: stageRef.current.height() / 2 - mousePointTo.y * newScale,
      }

      layerRef.current.position(newPos)
      layerRef.current.scale({ x: newScale, y: newScale })
    }

    useImperativeHandle(ref, () => ({
      incrementScale() {
        handleImageScalingForButton(1.1)
      },
      decrementScale() {
        handleImageScalingForButton(0.9)
      },
      handleFit2Canvas() {
        const stageWidth = stageRef.current.width()
        const stageHeight = stageRef.current.height()

        const imageWidth = image.image.width + 2
        const imageHeight = image.image.height

        const canvasHeight = window.innerHeight - 28

        if (imageWidth > imageHeight) {
          layerRef.current.scale({
            x: canvasWidth / imageWidth,
            y: canvasWidth / imageWidth,
          })
          layerRef.current.position({
            x: 0,
            y: (stageHeight - imageHeight * (canvasWidth / imageWidth)) / 2,
          })
        } else {
          layerRef.current.scale({
            x: canvasHeight / imageHeight,
            y: canvasHeight / imageHeight,
          })
          layerRef.current.position({
            x: (stageWidth - imageWidth * (canvasHeight / imageHeight)) / 2,
            y: 0,
          })
        }
      },
    }))

    const canvasRef = useCallback((canvasNode) => {
      if (canvasNode) setCanvasWidth(canvasNode?.offsetWidth + 2)
    }, [])

    const handleOnWheel = (e) => {
      e.evt.preventDefault()

      var oldScale = layerRef.current.scaleX()
      var pointer = stageRef.current.getPointerPosition()

      var mousePointTo = {
        x: (pointer.x - layerRef.current.x()) / oldScale,
        y: (pointer.y - layerRef.current.y()) / oldScale,
      }

      let direction = e.evt.deltaY > 0 ? -1 : 1

      var newScale = direction > 0 ? oldScale * 1.1 : oldScale / 1.1

      layerRef.current.scale({ x: newScale, y: newScale })

      var newPos = {
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
      }

      layerRef.current.position(newPos)
    }

    const conditionallyRenderPoints = (p) => {
      if (points[p][2] !== 0) {
        if (isPointsHidden && selectedPoint !== p) return null

        return (
          <Circle
            key={p}
            x={points[p][0]}
            y={points[p][1]}
            radius={2}
            fill={pointsColor[p] || "#FF0000"}
            draggable
            onClick={(e) => setSelectedPoint(p)}
            onDragStart={(e) => setSelectedPoint(p)}
            onDragEnd={(e) => {
              const { x, y } = layerRef.current.getRelativePointerPosition()
              updatePointOnClick(
                x < 0 ? 0 : Math.round(x),
                y < 0 ? 0 : Math.round(y)
              )
            }}
            onMouseEnter={() =>
              (stageRef.current.container().style.cursor = "move")
            }
            onMouseLeave={() =>
              (stageRef.current.container().style.cursor = "default")
            }
          />
        )
      }
    }

    return (
      <div ref={canvasRef}>
        <Stage
          ref={stageRef}
          width={canvasWidth}
          height={window.innerHeight - 28}
          onWheel={handleOnWheel}
        >
          <Layer ref={layerRef} draggable>
            <Group
              ref={groupRef}
              onPointerMove={(e) => {
                const { x, y } = groupRef.current.getRelativePointerPosition()
                setPointerPos([Math.round(x), Math.round(y)])
              }}
            >
              <Image x={0} y={0} image={image.image} />
              <Rect
                x={image.borderBox["x_min"]}
                y={image.borderBox["y_min"]}
                width={image.borderBox["width"]}
                height={image.borderBox["height"]}
                stroke="#FF0000"
                onClick={() => {
                  const { x, y } = layerRef.current.getRelativePointerPosition()
                  updatePointOnClick(Math.round(x), Math.round(y))
                }}
                onMouseEnter={() =>
                  selectedPoint &&
                  (stageRef.current.container().style.cursor = "crosshair")
                }
                onMouseLeave={() => {
                  setPointerPos(["-", "-"])
                  stageRef.current.container().style.cursor = "default"
                }}
              />
              {Object.keys(points).map((p) => conditionallyRenderPoints(p))}
            </Group>
          </Layer>
        </Stage>
        <span
          style={{
            color: "#444",
            WebkitTextStroke: "0.5px white",
            fontSize: 12,
            position: "absolute",
            bottom: 4,
            left: 8,
            zIndex: 30,
          }}
        >
          {pointerPos.join(" ")} {image ? " • " + image.json_name : null}
        </span>
      </div>
    )
  }
)

export default Canvas
