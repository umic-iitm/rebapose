import { MdClose } from "react-icons/md"

const MANDATORY_POINTS = ["forehead", "neck", "center_hip"]

const PartsListRow = ({
  bodyPart,
  selectedPoint,
  setSelectedPoint,
  points,
  setPoints,
  setIsManuallyPointSelected,
}) => {
  const conditionallyRenderPoint = (bodyPart, point) => {
    if (point[2] === 0) return null
    else
      return (
        <div style={{ display: "flex", flexDirection: "row" }}>
          <div style={{ flex: 5, padding: "4px 0" }}>{point[0] || "-"}</div>
          <div style={{ flex: 5, padding: "4px 0" }}>{point[1] || "-"}</div>
          <div style={{ flex: 3, padding: "0" }}>
            {bodyPart === selectedPoint ? (
              <div
                title="Click to mark point as obscured"
                style={{
                  height: "100%",
                  cursor: "pointer",
                  backgroundColor: "#00000010",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                onClick={(e) => {
                  setPoints({ ...points, [bodyPart]: [0, 0, 0] })
                }}
              >
                <MdClose />
              </div>
            ) : null}
          </div>
        </div>
      )
  }

  return (
    <div
      className="row pose-point-row"
      style={{
        padding: "0",
        borderRadius: 4,
        overflow: "hidden",
        background: bodyPart === selectedPoint ? "#1cd8d290" : null,
        cursor: bodyPart === selectedPoint ? "default" : "pointer",
        fontFamily: "Poppins",
        fontSize: 14,
      }}
      onClick={(e) => {
        if (bodyPart !== selectedPoint) {
          setSelectedPoint(bodyPart)
          setIsManuallyPointSelected(true)
        }
      }}
    >
      <div
        className="col-6"
        style={{
          padding: "4px 0 4px 8px",
          fontWeight: MANDATORY_POINTS.includes(bodyPart) ? 600 : 400,
          textDecoration:
            points[bodyPart][2] === 0 ? "line-through 2px #FF000090" : null,
        }}
      >
        {bodyPart
          .split("_")
          .map((e) => e.charAt(0).toUpperCase() + e.slice(1))
          .join(" ")}
      </div>
      <div className="col-6 p-0">
        {conditionallyRenderPoint(bodyPart, points[bodyPart])}
      </div>
    </div>
  )
}

export default PartsListRow
