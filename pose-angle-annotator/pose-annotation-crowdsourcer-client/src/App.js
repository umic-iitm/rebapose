import { useState, useEffect, useRef } from "react"
import { OverlayTrigger, Spinner, Tooltip } from "react-bootstrap"
import { GithubPicker } from "react-color"
import { ToastContainer, toast } from "react-toastify"
import "./App.scss"
import axios from "axios"
import Button from "./components/Button"
import {
  PiPlusCircle,
  PiMinusCircle,
  PiEyeBold,
  PiEyeClosedBold,
} from "react-icons/pi"
import { FcIdea } from "react-icons/fc"
import POINTS from "./config/points.json"
import MANDATORY_POINTS from "./config/mandatory_points.json"
import PartsListRow from "./components/PartsListRow"
import Canvas from "./components/Canvas"
import SkipDialog from "./components/SkipDailog"
import ViewAnnotation from "./components/ViewAnnotation"

const COLOR_PALETTE = [
  "#FF0000",
  "#DB3E00",
  "#FCCB00",
  "#008B02",
  "#006B76",
  "#1273DE",
  "#004DCF",
  "#5300EB",
]

const MANDATORY_POINTS_COLOR = {}
MANDATORY_POINTS.forEach((e) => (MANDATORY_POINTS_COLOR[e] = "#FCCB00"))

const App = () => {
  const [image, setImage] = useState({})
  const [points, setPoints] = useState(POINTS)
  const [pointsColor, setPointsColor] = useState({})
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [selectedPoint, setSelectedPoint] = useState(null)
  const [isPaletteOpen, setIsPaletteOpen] = useState(false)
  const [hasReachedEnd, setHasReachedEnd] = useState(false)
  const [isAutojumpEnabled, setIsAutojumpEnabled] = useState(false)
  const [isManuallyPointSelected, setIsManuallyPointSelected] = useState(false)
  const [showSkipDailog, setShowSkipDailog] = useState(false)
  const [isPointsHidden, setIsPointsHidden] = useState(false)
  const [isViewEnabled, setIsViewEnabled] = useState(false)

  const canvasRef = useRef(null)

  const imageRef = useRef({})
  const pointsRef = useRef(POINTS)
  const selectedPointRef = useRef(null)

  const obscurePoint = () => {
    setPoints({ ...pointsRef.current, [selectedPointRef.current]: [0, 0, 0] })
  }

  const mandatoryPointsRefMarked = () => {
    for (let i = 0; i < MANDATORY_POINTS.length; i++) {
      if (
        pointsRef.current[MANDATORY_POINTS[i]][0] === null ||
        pointsRef.current[MANDATORY_POINTS[i]][1] === null
      )
        return false
    }

    return true
  }

  useEffect(() => {
    const startAfter = localStorage.getItem("startAfter")
    console.log(startAfter)
    nextImage(startAfter)
    window.addEventListener("keydown", (e) => {
      console.log(e.key)
      if (e.key === "f" || e.key === "F" || e.key === "1") {
        setSelectedPoint(MANDATORY_POINTS[0])
      } else if (e.key === "n" || e.key === "N" || e.key === "2") {
        setSelectedPoint(MANDATORY_POINTS[1])
      } else if (e.key === "h" || e.key === "H" || e.key === "3") {
        setSelectedPoint(MANDATORY_POINTS[2])
      } else if (e.key === "q" || e.key === "Q") {
        obscurePoint()
      } else if (e.key === " " && e.shiftKey) {
        if (mandatoryPointsRefMarked()) saveImage()
      }
    })

    return () => {
      window.removeEventListener("keydown", (e) => {
        console.log("keydown event removed")
      })
    }
  }, [])

  useEffect(() => {
    imageRef.current = image
    if (image.loaded === false) {
      var imageObj = new window.Image()
      imageObj.src = image.signedURL
      imageObj.onload = () => {
        setImage({ ...image, image: imageObj, loaded: true })
        setPointsColor({ ...MANDATORY_POINTS_COLOR })
        setSelectedPoint("forehead")
        setIsManuallyPointSelected(false)
      }
    }
  }, [image])

  useEffect(() => {
    pointsRef.current = points
    if (isAutojumpEnabled && !isManuallyPointSelected) {
      for (const p of MANDATORY_POINTS) {
        if (points[p][0] === null && points[p][1] === null) {
          setSelectedPoint(p)
          break
        }
      }
    }
  }, [points])

  useEffect(() => {
    selectedPointRef.current = selectedPoint
  }, [selectedPoint])

  useEffect(() => {
    if (isAutojumpEnabled) {
      for (const p of MANDATORY_POINTS) {
        if (points[p][0] === null && points[p][1] === null) {
          setSelectedPoint(p)
          break
        }
      }
    }
  }, [isAutojumpEnabled])

  const searchImageByJsonName = (id, json_name) => {
    setIsLoading(true)
    axios
      .get(`/api/image/json/${json_name}`)
      .then((res) => res.data)
      .then((data) => {
        setImage({ ...data, id, image: null, loaded: false })
        setPoints({
          ...POINTS,
          ...data.json,
          ...MANDATORY_POINTS.reduce(
            (ac, point) => ({
              ...ac,
              [point]:
                data.json[point][2] === 0 ? [null, null, 2] : data.json[point],
            }),
            {}
          ),
        })
        setIsLoading(false)
      })
      .catch((err) => {
        console.error(err)
        setPoints({ ...POINTS })
        setIsLoading(false)
        if (err?.response?.status === 404) setHasReachedEnd(true)
      })
  }

  const nextImage = (startAfter) => {
    if (showSkipDailog) setShowSkipDailog(false)
    setIsLoading(true)
    axios
      .get(`/api/image/new${startAfter ? `?startAfter=${startAfter}` : ""}`)
      .then((res) => res.data)
      .then((data) => {
        setImage({ ...data, image: null, loaded: false })
        setPoints({
          ...POINTS,
          ...data.json,
          ...MANDATORY_POINTS.reduce(
            (ac, point) => ({
              ...ac,
              [point]: [null, null, 2],
            }),
            {}
          ),
        })
        setIsLoading(false)
      })
      .catch((err) => {
        console.error(err)
        setPoints({ ...POINTS })
        setIsLoading(false)
        if (err?.response?.status === 404) setHasReachedEnd(true)
      })
  }

  const saveImage = () => {
    setIsSaving(true)
    axios
      .post("/api/image/save", {
        id: imageRef.current.id,
        json: pointsRef.current,
        json_name: imageRef.current.json_name,
        image_id: imageRef.current.image_id,
      })
      .then((res) => {
        setIsSaving(false)
        localStorage.setItem("startAfter", imageRef.current.json_name)
        nextImage(imageRef.current.json_name)
      })
      .catch((err) => {
        setIsSaving(false)
        triggerToast(
          "error",
          "Oops, seems like an error occured. Please try again later"
        )
        console.log(err)
      })
  }

  const renderLoading = (msg) => {
    return (
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          textAlign: "center",
        }}
      >
        <Spinner animation="border" variant="info" />
        {msg ? (
          <div
            style={{
              fontFamily: "Poppins",
              fontSize: 14,
              color: "#004745",
              marginTop: 4,
            }}
          >
            {msg}
          </div>
        ) : null}
      </div>
    )
  }

  const renderSaving = () => {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          position: "absolute",
          top: 0,
          left: 0,
          background: "#ffffff90",
          backdropFilter: "blur(4px)",
          zIndex: 20,
          overflow: "hidden",
        }}
      >
        {renderLoading("Saving Image")}
      </div>
    )
  }

  const updatePointOnClick = (x, y) => {
    if (selectedPoint) {
      setPoints({
        ...points,
        [selectedPoint]: [x, y, 2],
      })
    }
  }

  const triggerToast = (type, message) => {
    if (type === "error") {
      toast.error(message)
    } else {
      toast.info(message)
    }
  }

  const renderHasReachedEnd = () => {
    return (
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          textAlign: "center",
        }}
      >
        <img
          src={require("./assets/66794_folder_empty_icon.png")}
          alt="Empty Folder"
          style={{ opacity: 0.7 }}
        />
        <div
          style={{
            fontFamily: "Poppins",
            fontSize: 14,
            color: "#004745",
            marginTop: 4,
          }}
        >
          That's all we had! Thank you for your contribution.
        </div>
      </div>
    )
  }

  const mandatoryPointsMarked = () => {
    for (let i = 0; i < MANDATORY_POINTS.length; i++) {
      if (
        points[MANDATORY_POINTS[i]][0] === null ||
        points[MANDATORY_POINTS[i]][1] === null
      )
        return false
    }

    return true
  }

  const conditionallyRenderCanvas = () => {
    if (isLoading) return renderLoading("Fetching Image")
    else if (hasReachedEnd) {
      return renderHasReachedEnd()
    } else if (image.loaded === false) {
      return renderLoading("Loading Image")
    } else if (image.loaded === true) {
      return (
        <>
          {isSaving ? renderSaving() : null}
          {showSkipDailog ? (
            <SkipDialog
              isLoading={isLoading}
              isSaving={isSaving}
              hasReachedEnd={hasReachedEnd}
              setShowSkipDailog={setShowSkipDailog}
              nextImage={nextImage}
              json_name={image.json_name}
            />
          ) : null}
          <Canvas
            ref={canvasRef}
            image={image}
            points={points}
            selectedPoint={selectedPoint}
            pointsColor={pointsColor}
            setPoints={setPoints}
            setSelectedPoint={setSelectedPoint}
            updatePointOnClick={updatePointOnClick}
            isPointsHidden={isPointsHidden}
          />
        </>
      )
    } else {
      return (
        <div style={{ padding: 16 }}>
          Oops! Seems like an error occured. Please try reloading the page or
          try again later
        </div>
      )
    }
  }

  const renderCanvas = () => {
    return (
      <div className="row">
        <div
          className="col-3 p-0"
          style={{ height: window.innerHeight - 16, overflowY: "auto" }}
        >
          <div
            style={{
              padding: "0 8px",
              display: "flex",
              flexDirection: "column",
              height: "100%",
            }}
          >
            <h2 className="app-name p-2 pb-0 m-0">
              Pose{" "}
              <span style={{ textDecoration: "#1cd8d2 underline 2px" }}>
                Annotator.
              </span>
            </h2>
            <div
              className="mb-2"
              style={{
                fontFamily: "Poppins",
                fontSize: 11,
                color: "#004745",
                padding: "4px 8px",
                display: "flex",
                border: "1px solid #05c8c1",
                borderRadius: 8,
              }}
            >
              <div
                style={{
                  fontSize: 24,
                  display: "flex",
                  alignItems: "center",
                  paddingRight: 4,
                }}
              >
                <FcIdea />
              </div>
              <div style={{ flex: 1 }}>
                Press <b>1, 2, 3</b> to jump to Forehead, Neck & Hip
                respectively,
                <b> Q</b> to obscure a point & <b>Shift+Space</b> to save an
                image
              </div>
            </div>
            {isViewEnabled ? (
              <div className="mb-2">
                <ViewAnnotation searchImageByJsonName={searchImageByJsonName} />
              </div>
            ) : null}
            <div
              style={{
                padding: "0 14px 8px 14px",
                flex: 1,
                color: "#004745",
                position: "relative",
              }}
            >
              {isLoading ? (
                <div
                  style={{
                    height: "100%",
                    width: "100%",
                    backdropFilter: "blur(4px)",
                    position: "absolute",
                    left: 0,
                    top: 0,
                  }}
                >
                  {renderLoading()}
                </div>
              ) : null}
              {Object.keys(points).map((bodyPart) => (
                <PartsListRow
                  key={bodyPart}
                  bodyPart={bodyPart}
                  selectedPoint={selectedPoint}
                  setSelectedPoint={setSelectedPoint}
                  points={points}
                  setPoints={setPoints}
                  setIsManuallyPointSelected={setIsManuallyPointSelected}
                />
              ))}
            </div>
            <div
              style={{
                fontFamily: "Poppins",
                fontSize: 10,
                color: "#00474595",
                padding: "4px 0",
                textAlign: "center",
              }}
            >
              v0.4.0 • Made with ❤️ by Hriddhi •{" "}
              <PiEyeBold
                cursor="pointer"
                onClick={() => setIsViewEnabled(!isViewEnabled)}
              />
            </div>
          </div>
        </div>
        <div
          className="col-9 p-0"
          style={{
            border: "transparent 6px solid",
          }}
        >
          <div
            style={{
              height: "100%",
              borderRadius: 4,
              overflow: "hidden",
              backgroundColor: "#ffffff99",
              position: "relative",
            }}
          >
            {conditionallyRenderCanvas()}
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <ToastContainer
        position="bottom-center"
        autoClose={3000}
        hideProgressBar
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
      <div className="container-xxl">
        <div className="row p-2">
          <div
            className="col-11"
            style={{
              borderRadius: 8,
              backgroundColor: "rgba(255,255,255,0.75)",
              boxShadow: "0 0 8px rgba(0,0,0, 0.25)",
              overflow: "hidden",
              zIndex: 5,
            }}
          >
            {renderCanvas()}
          </div>
          <div className="col-1 m-0 p-0 pt-4 pb-4">
            <div
              className="container-fluid"
              style={{
                fontFamily: "Poppins",
                color: "#004745",
                height: "100%",
                backgroundColor: "rgba(255,255,255,0.75)",
                boxShadow: "0 0 8px rgba(0,0,0, 0.25)",
                overflow: "hidden",
                borderRadius: " 0 16px 16px 0",
                padding: "8px",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div style={{ flexGrow: 1 }}>
                <Button
                  variant="outline"
                  style={{
                    fontSize: 12,
                    minHeight: 34,
                  }}
                  onClick={() =>
                    canvasRef.current
                      ? canvasRef.current.handleFit2Canvas()
                      : null
                  }
                >
                  Fit2Canvas
                </Button>
                <Button
                  variant="outline"
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    minHeight: 34,
                    cursor: "default",
                  }}
                >
                  <div
                    className="zoom__icon"
                    onClick={() =>
                      canvasRef.current
                        ? canvasRef.current.decrementScale()
                        : null
                    }
                  >
                    <PiMinusCircle />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flex: 1,
                      fontSize: 11,
                      alignItems: "center",
                    }}
                  >
                    Zoom
                  </div>
                  <div
                    className="zoom__icon"
                    onClick={() =>
                      canvasRef.current
                        ? canvasRef.current.incrementScale()
                        : null
                    }
                  >
                    <PiPlusCircle />
                  </div>
                </Button>
                <OverlayTrigger
                  placement="top"
                  overlay={
                    <Tooltip style={{ fontSize: 11 }}>
                      Click to turn {isAutojumpEnabled ? "OFF" : "ON"} auto jump
                    </Tooltip>
                  }
                >
                  <div>
                    <Button
                      variant="outline"
                      style={{
                        fontSize: 11,
                        minHeight: 34,
                      }}
                      onClick={() => setIsAutojumpEnabled(!isAutojumpEnabled)}
                    >
                      Autojump
                      <b style={{ marginLeft: 2 }}>
                        {isAutojumpEnabled ? "ON" : "OFF"}
                      </b>
                    </Button>
                  </div>
                </OverlayTrigger>
                <OverlayTrigger
                  placement="top"
                  overlay={
                    <Tooltip style={{ fontSize: 11 }}>
                      Click to <i>{isPointsHidden ? "show" : "hide"}</i>{" "}
                      non-selected points
                    </Tooltip>
                  }
                >
                  <div>
                    <Button
                      variant="outline"
                      style={{
                        fontSize: 12,
                        minHeight: 34,
                      }}
                      onClick={() => setIsPointsHidden(!isPointsHidden)}
                    >
                      Points
                      <b style={{ marginLeft: 4 }}>
                        {isPointsHidden ? (
                          <PiEyeClosedBold size={16} />
                        ) : (
                          <PiEyeBold size={16} />
                        )}
                      </b>
                    </Button>
                  </div>
                </OverlayTrigger>
                <Button
                  variant="outline"
                  style={{
                    color: pointsColor[selectedPoint] || "#FF0000",
                    border: `solid 3px ${
                      pointsColor[selectedPoint] || "#FF0000"
                    }`,
                    minHeight: 34,
                  }}
                  onClick={() => setIsPaletteOpen(!isPaletteOpen)}
                >
                  Palette
                </Button>

                {isPaletteOpen ? (
                  <div style={{ position: "absolute" }}>
                    <GithubPicker
                      colors={COLOR_PALETTE}
                      triangle="hide"
                      width="112px"
                      onChange={(color, event) => {
                        setPointsColor({
                          ...pointsColor,
                          [selectedPoint]: color.hex,
                        })
                      }}
                    />
                  </div>
                ) : null}
              </div>
              <div>
                <OverlayTrigger
                  placement="top"
                  overlay={
                    !mandatoryPointsMarked() ? (
                      <Tooltip style={{ fontSize: 11 }}>
                        Please mark <i>Forehead</i>, <i>Neck</i> and{" "}
                        <i>Center Hip</i> to save
                      </Tooltip>
                    ) : (
                      <></>
                    )
                  }
                >
                  <div>
                    <Button
                      margin="6px 0 0 0"
                      style={{ minHeight: 34 }}
                      disabled={
                        isLoading ||
                        isSaving ||
                        hasReachedEnd ||
                        !mandatoryPointsMarked()
                      }
                      onClick={saveImage}
                    >
                      Save
                    </Button>
                  </div>
                </OverlayTrigger>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default App
